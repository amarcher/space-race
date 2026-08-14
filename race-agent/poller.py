#!/usr/bin/env python3
"""
Race Agent sweep engine — the Slack front door to Andrew's Claude Code, for
the space-race project.

One call = one sweep. daemon.py (the launchd KeepAlive process) triggers a
sweep the moment Slack pushes a message/reaction event over Socket Mode, and
as a periodic fallback in case an event is missed. A sweep reads the
#space-race channel (C0BQ3571U1Z, The Archers workspace) with the Space Race Claude
bot token from the persisted watermark; on a new human message (top-level or
in a tracked thread) it wakes `claude -p --model opus` headless in the repo
with the thread as context. The headless agent does everything else —
classification, building, gating, replying — under race-agent/RUNNER.md and
race-agent/policy.md. The sweep stays a dumb, provable transport: detect,
dedupe, spawn, never interpret. (Running this file by hand performs a single
sweep — the event push only decides WHEN sweeps happen, never WHAT they do.)

This is a direct port of smart-home/house-agent's poller.py — same shape,
same safety spine — adapted for a different Slack workspace (The Archers, not
the family workspace), a single trust tier (Andrew; no second "alicia"-style
tier — see policy.md), and Opus instead of the CLI's default model.

Approval loop: when the agent needs Andrew's 👍 it writes a pending file into
STATE_DIR/pending/<message_ts>.json (see RUNNER.md). Each cycle the poller
checks reactions on those messages; Andrew's 👍/👎 wakes the agent again with
the verdict. Nobody else's reactions count.

Safety spine:
  * singleton lock (dead-pid reclaimed) — one agent run at a time; a slow
    build just delays the next poll's pickup, never overlaps it
  * at-most-once: state advances BEFORE the spawn, so a crashing agent can't
    poison-loop on one message; the failure posts a fallback line
  * at-most-once ACROSS the two spawn paths too: an approval run that already
    had the message in front of it and replied after it means the message
    sweep in the same cycle must not wake a second session on it
    (drop_answered) — otherwise the thread gets two replies to one message
  * the bot's own messages and join/leave noise never wake the agent
  * everything run-generated — AND both Slack tokens — lives OUTSIDE the
    repo (~/.space-race/race-agent), beyond the reach of any git clean
  * every wake runs in its OWN disposable `git worktree` cut fresh from
    `origin/main` — never the shared repo checkout. This closes a real
    incident hit by a sibling port of this exact pattern
    (storybook-studio/fable-agent, 2026-08-14): two wakes sharing one
    checkout let wake N+1 branch from wake N's leftover feature branch
    instead of a clean main, and its "one-line fix" PR squash-merged wake
    N's entire unreviewed diff onto main as a stowaway. See
    `make_worktree`/`remove_worktree`/`register_resume` below — preserved
    (never deleted) if a run leaves uncommitted/unpushed work behind, with
    a 👍-gated resume ask so that work is never silently lost or silently
    resumed either.

The RACE_AGENT_* env overrides are the offline-selftest seam (selftest.py):
they redirect the Slack API base, token file, state dir, claude binary, and
repo dir so a verification run can never read the real token, touch Slack,
or spawn a real agent. Production never sets them.
"""
import datetime
import fcntl
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import uuid

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("RACE_AGENT_REPO", os.path.dirname(BASE))
API = os.environ.get("RACE_AGENT_API", "https://slack.com/api")
STATE_DIR = os.environ.get("RACE_AGENT_STATE_DIR",
                           os.path.expanduser("~/.space-race/race-agent"))
# Tokens live in STATE_DIR, OUTSIDE the repo — same reasoning as house-agent
# (2026-07-03: a `git clean` during branch juggling deleted gitignored token
# files from a repo-relative state dir and silently broke the sweep for three
# days). Nothing under the repo tree may be load-bearing at runtime unless
# git owns it.
TOKEN_FILE = os.environ.get("RACE_AGENT_TOKEN_FILE",
                            os.path.join(STATE_DIR, "slack_token.txt"))
WORKTREE_DIR = os.environ.get("RACE_AGENT_WORKTREE_DIR",
                              os.path.join(STATE_DIR, "worktrees"))
CLAUDE_BIN = os.environ.get("RACE_AGENT_CLAUDE_BIN",
                            "/Users/archer/.local/bin/claude")
# Every spawn runs Opus, not the CLI's configured default (Sonnet) — the one
# deliberate difference from house-agent, per Andrew's call when this was
# built. Overridable for the offline selftest seam.
CLAUDE_MODEL = os.environ.get("RACE_AGENT_CLAUDE_MODEL", "opus")

CHANNEL = "C0BQ3571U1Z"          # #space-race, The Archers workspace
BOT_USER = "U0BPU7AD9GF"         # Space Race Claude's own user id, via auth.test
ANDREW = "U406UR8P4"            # Andrew — same id as house-agent, same
                                  # workspace; approvals come from him ONLY
# Single trust tier: only Andrew is enforced-privileged. Anyone else who
# ever joins #space-race falls through to "unknown" below — read-only,
# nothing executes, flagged to Andrew in thread. Add a collaborator here
# (and to policy.md's table) if that should change; nothing about the code
# below assumes exactly one entry.
TIERS = {ANDREW: "andrew"}
APPROVE, DENY = "+1", "-1"       # reaction names for the 👍 / 👎 verdict

# Tiered spawn — the trust tier enforced HARD at the spawn boundary, not just
# in policy prose: only a wake whose new messages are ALL Andrew's (or an
# approval wake, which exists only because Andrew reacted) runs with the
# permission gate bypassed. Every other wake runs permission-gated —
# non-allowlisted tool calls fail fast and the agent routes the ask through
# the 👍 flow instead. Text in a public channel can never conjure an
# ungated agent.
TIER_MODE = {"andrew": "bypassPermissions"}
DEFAULT_MODE = "acceptEdits"

# launchd hands its children a bare PATH (/usr/bin:/bin:/usr/sbin:/sbin) — no
# /opt/homebrew/bin, so a woken agent has no npm/gh/vercel without this (see
# house-agent's 20260802-0954 finding: the gate died at stage 2 before any
# real verification ran, and the gate being non-negotiable meant the wake
# shipped nothing). The fix lives HERE, at the spawn boundary both wakes
# share, not in each agent's head or in per-plist EnvironmentVariables.
BREW_BIN = "/opt/homebrew/bin"

THREAD_TTL_S = 48 * 3600         # stop watching a thread 48 h after last activity
CLAUDE_TIMEOUT_S = 45 * 60       # a single agent run may build + gate; cap it.
                                 # 45, not 30: a real feature build + the
                                 # repo's check can run past 20 min, and once
                                 # every wake runs in its own worktree a
                                 # longer cap only delays the next wake's
                                 # turn — it can no longer let one wake's
                                 # leftover state contaminate another's PR
                                 # (see make_worktree below).
CONTEXT_LIMIT = 25               # most recent messages handed to the agent
# The only copy the POLLER itself can put in the channel (the agent voices
# everything else). It must NOT promise "nothing changed": a timed-out run
# may have already branched and committed, so the line points to progress
# rather than claiming a clean slate.
FALLBACK_TEXT = ("Started on that but ran long and had to stop partway "
                 "through — Andrew will pick up from where it got to.")


def log(msg):
    print(f"{datetime.datetime.now().isoformat(timespec='seconds')}  {msg}",
          flush=True)


def slack(method, **params):
    """Slack Web API call. Raises on transport errors; returns the parsed
    body (callers check body['ok'])."""
    tok = open(TOKEN_FILE).read().strip()
    url = f"{API}/{method}"
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {tok}")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def post_message(text, thread_ts=None):
    params = {"channel": CHANNEL, "text": text}
    if thread_ts:
        params["thread_ts"] = thread_ts
    return slack("chat.postMessage", **params)


def add_reaction(name, ts):
    """Best-effort ack reaction on a triggering message — 'seen, working on
    it' before the (possibly multi-minute) agent run even starts. Never
    blocks or fails the wake: an already-reacted message ("already_reacted")
    is not an error, and any other transport/API failure is logged and
    swallowed, since a missing eyes-emoji is cosmetic, not correctness."""
    try:
        r = slack("reactions.add", channel=CHANNEL, name=name, timestamp=ts)
        if not r.get("ok") and r.get("error") != "already_reacted":
            log(f"reaction add not ok ({r.get('error')}) on {ts}")
    except Exception as e:
        log(f"reaction add failed on {ts}: {e}")


# ------------------------------------------------------------------ state
def state_path():
    return os.path.join(STATE_DIR, "state.json")


def load_state():
    try:
        with open(state_path()) as f:
            return json.load(f)
    except Exception:
        return {"last_ts": "0", "threads": {}}


def save_state(st):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = state_path() + ".tmp"
    with open(tmp, "w") as f:
        json.dump(st, f, indent=2)
    os.replace(tmp, state_path())


def acquire_lock():
    """Singleton: one poller/agent run at a time. Returns the held lock file
    object, or None when another live run owns it (dead-pid locks are
    reclaimed by flock itself — the lock dies with the process)."""
    os.makedirs(STATE_DIR, exist_ok=True)
    f = open(os.path.join(STATE_DIR, "poller.lock"), "a+")
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        f.close()
        return None
    f.seek(0)
    f.truncate()
    f.write(str(os.getpid()))
    f.flush()
    return f


# ------------------------------------------------------------------ messages
def is_human(m):
    """A message that should wake the agent: a real user (not our bot, not
    any bot integration), no join/leave/topic subtype."""
    if m.get("subtype") or m.get("bot_id"):
        return False
    u = m.get("user")
    return bool(u) and u != BOT_USER


def fetch_new(st):
    """New human messages since the watermark: top-level channel history plus
    replies in every tracked (recently active) thread. Returns a list of
    (thread_ts_or_None, message), oldest first, and updates watermarks."""
    new = []
    r = slack("conversations.history", channel=CHANNEL,
              oldest=st["last_ts"], limit=50)
    if not r.get("ok"):
        log(f"conversations.history not ok: {r.get('error')}")
        return []
    for m in sorted(r.get("messages", []), key=lambda m: m["ts"]):
        if float(m["ts"]) <= float(st["last_ts"]):
            continue
        st["last_ts"] = m["ts"]
        if is_human(m):
            new.append((m.get("thread_ts"), m))
            st["threads"][m.get("thread_ts") or m["ts"]] = m["ts"]
    # tracked threads: replies don't appear in channel history, poll each
    now = datetime.datetime.now().timestamp()
    for tts in list(st["threads"]):
        if now - float(st["threads"][tts]) > THREAD_TTL_S:
            del st["threads"][tts]
            continue
        r = slack("conversations.replies", channel=CHANNEL, ts=tts,
                  oldest=st["threads"][tts], limit=50)
        if not r.get("ok"):
            continue
        for m in sorted(r.get("messages", []), key=lambda m: m["ts"]):
            if float(m["ts"]) <= float(st["threads"][tts]):
                continue
            st["threads"][tts] = m["ts"]
            if is_human(m):
                new.append((tts, m))
    return new


def thread_context(thread_ts):
    """The conversation the agent sees: the thread's messages (or recent
    channel history for a top-level message), each tagged with its policy
    tier. The agent re-reads policy.md to interpret the tiers."""
    r = slack("conversations.replies", channel=CHANNEL, ts=thread_ts,
              limit=CONTEXT_LIMIT)
    msgs = r.get("messages", []) if r.get("ok") else []
    out = []
    for m in msgs[-CONTEXT_LIMIT:]:
        who = ("race-claude" if m.get("user") == BOT_USER or m.get("bot_id")
               else TIERS.get(m.get("user"), f"unknown:{m.get('user')}"))
        out.append({"who": who, "ts": m["ts"], "text": m.get("text", "")})
    return out


def newest_house_reply(thread_ts):
    """Newest race-claude message currently in the thread, as a float ts —
    or None when Slack can't say. None must always read as 'nobody has
    replied', so an unreadable thread can only ever cause an extra wake,
    never a swallowed one."""
    try:
        ours = [float(c["ts"]) for c in thread_context(thread_ts)
                if c["who"] == "race-claude"]
    except Exception as e:
        log(f"thread {thread_ts} unreadable ({e}); treating as unanswered")
        return None
    return max(ours) if ours else None


def drop_answered(thread_ts, msgs, covered):
    """Drop the messages a run earlier in THIS sweep already answered.

    An approval run is spawned with a snapshot of its thread and RUNNER.md
    tells it to reply there, so a message that (a) predates that snapshot —
    i.e. the run saw it — and (b) is older than a race-claude reply now
    sitting in the thread has already been answered. Waking a second session
    on it would double-reply (house-agent hit exactly this on 2026-08-06;
    ported here verbatim since the failure mode is identical).

    Fail-open by construction: `covered` only carries threads whose run
    SUCCEEDED (a timed-out run's fallback line must not count as an answer),
    both halves must hold, and an unreadable thread suppresses nothing. A
    genuinely unanswered message always wakes a session.
    """
    seen_at = covered.get(thread_ts)
    if not seen_at:
        return msgs
    replied = newest_house_reply(thread_ts)
    if replied is None:
        return msgs
    keep, done = [], []
    for m in msgs:
        (done if float(m["ts"]) < seen_at and float(m["ts"]) < replied
         else keep).append(m)
    if done:
        log(f"thread {thread_ts}: {len(done)} message(s) "
            f"({', '.join(m['ts'] for m in done)}) already answered by the "
            f"run that just finished; not waking a second session")
    return keep


# ------------------------------------------------------------------ approvals
def pending_dir():
    return os.path.join(STATE_DIR, "pending")


def check_approvals():
    """For each pending approval the agent registered, read the reactions on
    its ask-message. Andrew's 👍 → verdict 'approved'; his 👎 → 'denied';
    anyone else's reactions are ignored. Returns [(pending_dict, verdict)]
    and removes decided files."""
    decided = []
    d = pending_dir()
    if not os.path.isdir(d):
        return decided
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(d, fn)
        try:
            p = json.load(open(path))
            r = slack("reactions.get", channel=CHANNEL, timestamp=p["ask_ts"])
            if not r.get("ok"):
                continue
            verdict = None
            for rx in (r.get("message", {}).get("reactions") or []):
                if ANDREW not in rx.get("users", []):
                    continue
                if rx.get("name") == APPROVE:
                    verdict = "approved"
                elif rx.get("name") == DENY:
                    verdict = "denied"
                    break            # an explicit 👎 always wins
            if verdict:
                decided.append((p, verdict))
                os.remove(path)
        except Exception as e:
            log(f"pending {fn}: unreadable ({e}); leaving for next pass")
    return decided


# ------------------------------------------------------------------ the agent
def spawn_env(tier):
    """The environment a woken agent runs in: the tier stamp (worklist.py's
    filing gate reads it — set here so a prompt can't rewrite it) plus a
    PATH that carries Homebrew's bin, without which the repo gate and gh/npm
    are structurally unreachable from a launchd-spawned run."""
    env = {**os.environ, "RACE_AGENT_TIER": tier}
    path = env.get("PATH", "")
    if BREW_BIN not in path.split(":"):
        env["PATH"] = f"{BREW_BIN}:{path}" if path else BREW_BIN
    return env


def make_worktree(label):
    """A fresh git worktree off up-to-date origin/main, isolated to this one
    wake. (Incident this closes — hit in storybook-studio/fable-agent,
    2026-08-14, identical architecture: wakes shared the one main checkout;
    wake N left it on its own feature branch, wake N+1 branched from THAT
    instead of main, so its "one-line fix" PR squash-merged wake N's entire
    unreviewed diff along as a stowaway.) A worktree is the actual fix: no
    wake can ever see another wake's branch, uncommitted state, or an
    in-progress build, because each gets its own directory and checkout."""
    subprocess.run(["git", "fetch", "origin", "main"],
                   cwd=REPO, capture_output=True, timeout=30, check=True)
    subprocess.run(["git", "worktree", "prune"],
                   cwd=REPO, capture_output=True, timeout=30)
    path = os.path.join(WORKTREE_DIR, label)
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)
    os.makedirs(WORKTREE_DIR, exist_ok=True)
    subprocess.run(["git", "worktree", "add", "--detach", path, "origin/main"],
                   cwd=REPO, capture_output=True, timeout=60, check=True)
    return path


def remove_worktree(path):
    """Best-effort cleanup once a wake is done — never fatal, and NEVER
    destroys a worktree that still holds uncommitted or unpushed work.
    RUNNER.md's push-early contract means real work should already be safe
    on its own remote branch by the time a wake ends; if that contract was
    violated (a crash, a timeout mid-commit), leaving the worktree in place
    is the ONLY way that work survives — a clean-looking git dir is not
    proof the work inside it is safe. Returns True when the worktree was
    left in place (there may be real work an Andrew-approved resume can pick
    back up — see register_resume), False when it was removed."""
    try:
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=path,
                               capture_output=True, text=True, timeout=15)
        unpushed = subprocess.run(["git", "log", "@{u}..HEAD", "--oneline"],
                                  cwd=path, capture_output=True, text=True,
                                  timeout=15)
        if dirty.stdout.strip() or (unpushed.returncode == 0 and unpushed.stdout.strip()):
            log(f"worktree left in place — uncommitted or unpushed work "
                f"survives: {path}")
            return True
    except Exception as e:
        log(f"worktree safety check failed ({e}) — leaving it in place: {path}")
        return True
    subprocess.run(["git", "worktree", "remove", "--force", path],
                   cwd=REPO, capture_output=True, timeout=30)
    return False


def register_resume(thread_ts, wt, kind):
    """A run that left real, unpublished work behind (crash/timeout
    mid-commit) gets ONE honest message and a real path back to it — never a
    silently rotting worktree nobody knows exists. Reuses the exact approval
    mechanism (Andrew's own 👍/👎, nobody else's) rather than inventing a
    second one: resuming is exactly as consequential as any other
    andrew-tier, ungated action, so it earns the same gate. If the ask
    itself can't be posted, the worktree still survives on disk
    (remove_worktree already decided that) — it's just unregistered, same as
    any other still-there-but-not-yet-noticed state."""
    try:
        branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"],
                                cwd=wt, capture_output=True, text=True,
                                timeout=10).stdout.strip() or "(unknown branch)"
    except Exception:
        branch = "(unknown branch)"
    ask_text = (
        f"This one ran long and I had to stop before finishing — the "
        f"in-progress work is still there, on `{branch}`. React 👍 here if "
        f"you'd like me to pick it back up where I left off, or leave it "
        f"and I won't touch it again."
    )
    try:
        r = post_message(ask_text, thread_ts=thread_ts)
        ask_ts = r.get("ts")
        if not ask_ts:
            log(f"resume ask posted but Slack returned no ts — can't "
                f"register it for approval, worktree still on disk: {wt}")
            return
    except Exception as e:
        log(f"resume ask post failed ({e}) — worktree left in place but "
            f"unregistered: {wt}")
        return
    p = {"ask_ts": ask_ts, "thread_ts": thread_ts,
         "summary": f"resume the interrupted {kind} run on {branch}",
         "action": "resume and finish the original task in the "
                   "already-checked-out worktree",
         "resume_worktree": wt}
    os.makedirs(pending_dir(), exist_ok=True)
    json.dump(p, open(os.path.join(pending_dir(), f"{ask_ts}.json"), "w"))


def wake_agent(kind, thread_ts, payload, tier):
    """Spawn headless Claude Code (Opus) in an isolated worktree with the
    thread as context. The prompt stays thin on purpose: RUNNER.md and
    policy.md (read fresh each run) are the real instructions, so behavior
    changes ship as doc edits, not poller deploys. `tier` picks the
    permission mode (see TIER_MODE) — the hard enforcement of the trust
    tier.

    An approval whose pending file carries `resume_worktree` (see
    register_resume) is Andrew resuming a run that ran long and left real
    work behind — it runs IN that already-checked-out worktree, on its
    current branch, instead of a fresh one off origin/main."""
    mode = TIER_MODE.get(tier, DEFAULT_MODE)
    resume_wt = (payload.get("pending") or {}).get("resume_worktree") \
        if kind == "approval" else None
    resuming = bool(resume_wt and os.path.isdir(resume_wt))
    if resume_wt and not resuming:
        log(f"resume worktree {resume_wt!r} no longer exists — starting "
            f"fresh instead")
    brief = {
        "kind": kind,                       # "message" | "approval"
        "channel": CHANNEL,
        "thread_ts": thread_ts,
        "tier": tier,
        "payload": payload,
        "context": thread_context(thread_ts),
    }
    resume_note = (
        "You are RESUMING your own prior run in this exact worktree — it "
        "already has real, uncommitted-or-unpushed work on its current "
        "branch. Run `git status` and `git log` first to see exactly where "
        "you left off before doing anything else. "
    ) if resuming else ""
    prompt = (
        "You are Space Race Claude, woken by race-agent/poller.py for the "
        "#space-race Slack channel. FIRST read race-agent/RUNNER.md and "
        "race-agent/policy.md and follow them exactly — they are the "
        "contract for scope, trust tiers, approvals, and how to reply "
        "in-thread. " + resume_note +
        "Then handle this:\n\n" + json.dumps(brief, indent=2)
    )
    os.makedirs(os.path.join(STATE_DIR, "runs"), exist_ok=True)
    run_log = os.path.join(STATE_DIR, "runs",
                           f"{thread_ts}-{kind}-{os.getpid()}.log")
    env = spawn_env(tier)
    # A random suffix, not just thread/kind/pid: the daemon's pid is stable
    # for days, so two wakes in the SAME thread (e.g. a reply after an
    # earlier resume is still pending) would otherwise compute the identical
    # label — and make_worktree's own "rm any existing dir at this path"
    # step would silently destroy an earlier wake's PRESERVED, resume-ask
    # worktree the moment a same-thread wake landed after it.
    label = f"{thread_ts}-{kind}-{os.getpid()}-{uuid.uuid4().hex[:8]}"
    wake_started = datetime.datetime.now().timestamp()
    wt = None
    cleaned_up = False
    try:
        wt = resume_wt if resuming else make_worktree(label)
        if resuming:
            log(f"resuming preserved worktree: {wt}")
        with open(run_log, "w") as out:
            subprocess.run(
                [CLAUDE_BIN, "-p", prompt, "--model", CLAUDE_MODEL,
                 "--permission-mode", mode],
                cwd=wt, stdout=out, stderr=subprocess.STDOUT,
                timeout=CLAUDE_TIMEOUT_S, check=True, env=env,
            )
        log(f"agent run ok ({kind}, thread {thread_ts}, {tier}/{mode}) → {run_log}")
        return True
    except Exception as e:
        log(f"agent run FAILED ({kind}, thread {thread_ts}): {e} — see {run_log}")
        # A run that already replied since this wake started already spoke
        # for itself — a second, scarier fallback line on top of a finished
        # job is noise at best, actively misleading at worst.
        already_spoke = False
        try:
            newest = newest_house_reply(thread_ts)
            already_spoke = newest is not None and newest > wake_started
        except Exception as e2:
            log(f"already-spoke check failed ({e2}) — falling back to posting")

        preserved = False
        if wt is not None:
            preserved = remove_worktree(wt)
            cleaned_up = True

        if preserved:
            # Real, unpublished work survives on disk — make sure Andrew can
            # actually find it and decide whether to resume, rather than it
            # silently rotting in WORKTREE_DIR forever.
            register_resume(thread_ts, wt, kind)
        elif already_spoke:
            log(f"skipping fallback ({kind}, thread {thread_ts}) — the agent "
                f"already replied since this wake started")
        else:
            try:
                post_message(FALLBACK_TEXT, thread_ts=thread_ts)
            except Exception as e2:
                log(f"fallback post also failed: {e2}")
        return False
    finally:
        if wt is not None and not cleaned_up:
            remove_worktree(wt)


# ------------------------------------------------------------------ main
def main():
    lock = acquire_lock()
    if lock is None:
        log("another run holds the lock; skipping this sweep")
        return 0
    st = load_state()
    first_arm = st["last_ts"] == "0"

    # Decided approvals wake the agent with the verdict. Tier andrew: an
    # approval wake exists only because Andrew explicitly reacted, and it
    # executes exactly the registered action he reviewed.
    # These runs block the sweep (often for minutes) and reply in-thread, so
    # record thread → when the run's thread snapshot was taken; drop_answered
    # uses it below to keep the message sweep from re-waking on anything that
    # run already answered.
    covered = {}
    for p, verdict in check_approvals():
        log(f"approval {verdict}: {p.get('summary', p['ask_ts'])}")
        snapshot = datetime.datetime.now().timestamp()
        if wake_agent("approval", p["thread_ts"],
                      {"verdict": verdict, "pending": p}, tier="andrew"):
            covered[p["thread_ts"]] = max(covered.get(p["thread_ts"], 0),
                                          snapshot)

    new = fetch_new(st)
    # Arm-time watermark: the very first sweep only sets the high-water mark —
    # it must not replay the channel's whole backlog into agent runs.
    if first_arm:
        save_state(st)
        log(f"first sweep: watermark armed at {st['last_ts']}, "
            f"{len(new)} backlog message(s) skipped")
        return 0
    # At-most-once: persist the advanced watermark BEFORE spawning, so a
    # crashing agent can't poison-loop on the same message forever.
    save_state(st)
    by_thread = {}
    for tts, m in new:
        by_thread.setdefault(tts or m["ts"], []).append(m)
    for thread_ts, msgs in by_thread.items():
        msgs = drop_answered(thread_ts, msgs, covered)
        if not msgs:
            continue
        # The wake's tier is the WEAKEST author among its new messages: one
        # non-Andrew message in the batch and the whole run is gated.
        tiers = {TIERS.get(m.get("user"), "unknown") for m in msgs}
        tier = "andrew" if tiers == {"andrew"} else "unknown"
        log(f"waking agent: thread {thread_ts}, {len(msgs)} new, tier {tier}")
        # Instant "seen, working on it" before the (possibly multi-minute)
        # run starts — skipped for approval wakes above, where Andrew's own
        # reaction is already the visible signal.
        add_reaction("eyes", msgs[-1]["ts"])
        wake_agent("message", thread_ts, {"new_ts": [m["ts"] for m in msgs]},
                   tier=tier)
    if not new:
        log("no new messages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
