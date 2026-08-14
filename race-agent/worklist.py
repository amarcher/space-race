#!/usr/bin/env python3
"""
The daylight worklist — Space Race Claude's own queue, worked in daylight.

Direct port of smart-home/house-agent's worklist.py. Why this exists (from
house-agent, same reasoning applies here): ending a thread late with "still
open, so it doesn't get lost" hands Andrew a to-do list and makes him the
memory. The fix is a queue the agent itself works, in daytime, without being
pointed at it.

So: anything the agent finds but shouldn't do right now goes in here (one
JSON file per item, in STATE_DIR/worklist/, outside the repo like every other
piece of race-agent state). A launchd calendar job runs `--run` twice in the
daylight window; each pass claims the oldest open item and wakes headless
Claude Code on it, in the Slack thread the item came from. The agent does the
work, marks it done, and posts ONE line when it lands.

The escape hatch: an item that fails MAX_ATTEMPTS passes goes `stuck`, and
that — a thing genuinely needing Andrew — is the only case that ever costs
him a message. Not a list; one item, with the reason. Because it is the ONE
unprompted message the whole design allows, it has to be the best-written
line the bot sends: see `compose_stuck_notice` for why the item's own
`title` is never allowed anywhere near it (whoever else ever joins
#space-race shouldn't get a build log for a stuck item either).

Trust: `add` refuses unless the filing run is an Andrew-tier run (the poller
stamps RACE_AGENT_TIER at the spawn boundary), so a queued item always
traces back to a session Andrew's own messages authorized. That stamp is what
justifies the daylight run's permission mode — same rule as poller.py's
TIER_MODE, and the same reason: text in a public channel must never be able
to conjure an ungated agent.

Usage (the agent's side, from a woken session):
    python3 race-agent/worklist.py add --title "..." --detail "..." \
        [--public-title "..."] [--thread <ts>] [--priority 2]
    python3 race-agent/worklist.py list [--json]
    python3 race-agent/worklist.py done <id> [--note "what landed"]
    python3 race-agent/worklist.py drop <id> [--note "why"]

Usage (launchd's side, one daylight pass):
    python3 race-agent/worklist.py --run

The RACE_AGENT_* env overrides are the offline-selftest seam, exactly as in
poller.py: state dir, claude binary, repo dir, and the clock. Production
never sets them.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import uuid

import poller  # same directory; STATE_DIR, the singleton lock, the log helper

WORKLIST_DIR = os.path.join(poller.STATE_DIR, "worklist")
DONE_DIR = os.path.join(WORKLIST_DIR, "done")

# The daylight window, enforced in code and NOT only in the plist: launchd
# runs a missed StartCalendarInterval job the moment the Mac wakes, so a lid
# opened at 03:00 would otherwise start a build in the middle of the night.
DAY_START_H, DAY_END_H = 9, 18

MAX_ATTEMPTS = 3          # then the item goes `stuck` and Andrew hears once
CLAUDE_TIMEOUT_S = 45 * 60  # same cap as a Slack wake (build + gate) — see
                            # poller.py's CLAUDE_TIMEOUT_S comment

# Only an item filed by an Andrew-tier run may wake an ungated agent. Anything
# else runs permission-gated — the poller's rule, carried across the queue.
TIER_MODE = {"andrew": "bypassPermissions"}
DEFAULT_MODE = "acceptEdits"

ID_SAFE = re.compile(r"[^a-z0-9]+")

# ---------------------------------------------------------- the stuck notice
# An item's `title` is written by Space Race Claude FOR Space Race Claude and reads like
# it: "Deploy PR #196 — Shippo live-mode rollout (awaiting Andrew's 👍)". The
# stuck notice never says the title — the channel is public with non-Andrew
# members. It says `public_title`, which the filing run writes in plain,
# non-ops language on purpose, and when there isn't one it says nothing
# specific at all. Nothing is summarised at post time: a title that can't be
# said safely is simply not said.
OPS_VOCAB = re.compile(r"""(?xi)
      \#\d                                     # PR / issue numbers
    | \b\d+\.\d+                               # version strings
    | \b[\w.-]+\.(py|md|ya?ml|json|sh|js|ts|plist|html|css|tsx)\b
    | /                                        # paths
    | \b(pr|repo|repository|branch|commit|merge|rebase|deploy|deployed
        |deployment|rollback|revert|config|entity|entities|api|cli|mcp|rest
        |json|yaml|cron|launchd|plist|add-?on|bridge|endpoint|token|script
        |selftest|regex|traceback|integration|webhook|payload|schema|env
        |workaround|patch|refactor|render|repo-side|upstream|stripe|shippo
        |vercel|neon|resend)\b
""")

# The tail both endings share: whichever way it's stuck, nothing moves alone.
WAITS_HERE = "Nothing's moved on it, and nothing will until you say."


def public_subject(item):
    """The words the notice is allowed to say out loud, or None.

    `public_title` is the only field written for the channel to read. The
    guard is the backstop for the day a future filing run writes one by
    pasting the title in: a subject that reads like ops vocabulary is
    dropped, not cleaned — failing closed costs Andrew a vaguer sentence,
    failing open costs him a build log in a channel anyone else who joins
    #space-race can also read."""
    t = (item.get("public_title") or "").strip().rstrip(".")
    if not t:
        return None
    hit = OPS_VOCAB.search(t)
    if hit:
        poller.log(f"worklist: public_title for {item.get('id')} reads like "
                   f"ops vocabulary ({hit.group(0)!r}); using the generic line")
        return None
    return t


def waiting_on_andrew(item):
    """True when the item is parked on an unanswered 👍 rather than failing.

    An item that asked for approval and is waiting stays `working` on disk and
    its attempts still tick up each pass — even though every one of those
    passes did nothing, by design. Reaching `stuck` that way is the intended
    escalation, but "I've tried it three times and keep stopping in the same
    place" would be a flat lie about it. An undecided pending file in the same
    thread is how we tell the two apart (poller.check_approvals deletes the
    file the moment Andrew decides)."""
    thread = item.get("thread_ts")
    if not thread:
        return False
    d = poller.pending_dir()
    if not os.path.isdir(d):
        return False
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        try:
            p = json.load(open(os.path.join(d, fn)))
        except Exception as e:
            poller.log(f"worklist: pending {fn} unreadable ({e}); "
                       f"not counting it as a wait")
            continue
        if p.get("thread_ts") == thread:
            return True
    return False


def compose_stuck_notice(item, waiting=False):
    """The one unprompted line a stuck item may cost Andrew. Plain language,
    no title, no ops vocabulary, and honest about WHICH kind of stuck it
    is."""
    subject = public_subject(item)
    if waiting:
        if subject:
            return (f"Still waiting on your :+1: for {subject} — it's a "
                    f"little further up this thread. {WAITS_HERE}")
        return (f"Still waiting on your :+1: for something asked a little "
                f"further up this thread. {WAITS_HERE}")
    n = item.get("attempts", 0)
    tried = (f"Tried it {n} times and kept stopping in the same place, "
             f"so it needs you.")
    if subject:
        return (f"One thing that didn't get done on its own: {subject}. "
                f"{tried} It'll wait here until you say.")
    return (f"There's something in the project that didn't get done on its "
            f"own. {tried} Ask and I'll walk you through it — it'll wait "
            f"here until you say.")


def now():
    """Wall clock (selftest seam: RACE_AGENT_NOW as an ISO string)."""
    override = os.environ.get("RACE_AGENT_NOW")
    if override:
        return datetime.datetime.fromisoformat(override)
    return datetime.datetime.now()


def in_daylight(t=None):
    t = t or now()
    return DAY_START_H <= t.hour < DAY_END_H


# ---------------------------------------------------------------- storage
def _paths():
    os.makedirs(DONE_DIR, exist_ok=True)
    return WORKLIST_DIR, DONE_DIR


def load_items():
    """Open/working/stuck items, oldest first within priority order."""
    d, _ = _paths()
    items = []
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        try:
            items.append(json.load(open(os.path.join(d, fn))))
        except Exception as e:
            poller.log(f"worklist {fn}: unreadable ({e}); leaving it")
    items.sort(key=lambda i: (i.get("priority", 2), i.get("filed", "")))
    return items


def save_item(item):
    d, _ = _paths()
    path = os.path.join(d, f"{item['id']}.json")
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(item, f, indent=2)
    os.replace(tmp, path)
    return path


def retire(item, outcome, note=""):
    """Move a finished item out of the queue — kept, never deleted, so the
    record of what the bot did while nobody watched stays readable."""
    d, done = _paths()
    item["state"] = outcome
    item["closed"] = now().isoformat(timespec="seconds")
    if note:
        item["note"] = note
    with open(os.path.join(done, f"{item['id']}.json"), "w") as f:
        json.dump(item, f, indent=2)
    try:
        os.remove(os.path.join(d, f"{item['id']}.json"))
    except FileNotFoundError:
        pass


def find(item_id):
    for i in load_items():
        if i["id"] == item_id:
            return i
    return None


# ---------------------------------------------------------------- commands
def cmd_add(a):
    tier = os.environ.get("RACE_AGENT_TIER", "")
    if tier != "andrew":
        print("worklist: refusing to file — only an Andrew-tier run may queue "
              "work (RACE_AGENT_TIER is %r). Say it in-thread instead."
              % tier, file=sys.stderr)
        return 2
    t = now()
    slug = ID_SAFE.sub("-", a.title.lower()).strip("-")[:40]
    item = {
        "id": f"{t:%Y%m%d-%H%M}-{slug}",
        "title": a.title,
        "public_title": a.public_title,
        "detail": a.detail,
        "thread_ts": a.thread,
        "priority": a.priority,
        "filed": t.isoformat(timespec="seconds"),
        "tier": tier,
        "state": "open",
        "attempts": 0,
    }
    save_item(item)
    print(item["id"])
    return 0


def cmd_list(a):
    items = load_items()
    if a.json:
        print(json.dumps(items, indent=2))
        return 0
    if not items:
        print("worklist: empty")
        return 0
    for i in items:
        print(f"{i['id']}  [{i['state']}/p{i.get('priority', 2)}/"
              f"{i.get('attempts', 0)}try]  {i['title']}")
    return 0


def cmd_close(a, outcome):
    item = find(a.id)
    if not item:
        print(f"worklist: no open item {a.id!r}", file=sys.stderr)
        return 1
    retire(item, outcome, a.note)
    print(f"{a.id} → {outcome}")
    return 0


# ---------------------------------------------------------------- the pass
def reconcile(items):
    """A pass that died (timeout, crash, reboot) leaves its item `working`.
    Reopen it — up to MAX_ATTEMPTS, after which it's stuck and worth a word."""
    for i in items:
        if i.get("state") != "working":
            continue
        if i.get("attempts", 0) >= MAX_ATTEMPTS:
            i["state"] = "stuck"
        else:
            i["state"] = "open"
        save_item(i)
    return items


def wake_agent(item):
    """Wake headless Claude Code (Opus) on one item, in the thread it came
    from. Deliberately the same shape as poller.wake_agent — including its
    own isolated git worktree, never the shared repo checkout: a worklist
    wake and a Slack-triggered wake share the same singleton lock
    (poller.acquire_lock), so they can never run concurrently, but they DO
    run sequentially in the same directory unless each gets its own
    checkout — exactly the seam that let one wake's leftover branch
    contaminate another's PR (see poller.make_worktree). The woken agent
    reads RUNNER.md + policy.md and treats `kind: worklist` as its
    instruction."""
    mode = TIER_MODE.get(item.get("tier"), DEFAULT_MODE)
    brief = {
        "kind": "worklist",
        "channel": poller.CHANNEL,
        "thread_ts": item.get("thread_ts"),
        "tier": item.get("tier", "unknown"),
        "payload": {"item": item},
        "context": (poller.thread_context(item["thread_ts"])
                    if item.get("thread_ts") else []),
    }
    prompt = (
        "You are Space Race Claude, woken by race-agent/worklist.py for a daylight "
        "work pass — not by a Slack message. FIRST read race-agent/RUNNER.md "
        "and race-agent/policy.md and follow them exactly; the 'Daylight "
        "worklist' section of RUNNER.md governs this wake. Do the item below, "
        "end to end, and close it with worklist.py. Then handle this:\n\n"
        + json.dumps(brief, indent=2)
    )
    runs = os.path.join(poller.STATE_DIR, "runs")
    os.makedirs(runs, exist_ok=True)
    run_log = os.path.join(runs, f"worklist-{item['id']}-{os.getpid()}.log")
    env = poller.spawn_env(item.get("tier", "unknown"))
    # A random suffix, not just the item id + pid: reconcile() reopens a
    # timed-out item under the SAME id for the next daylight pass, so a
    # stable label would let that retry's make_worktree silently destroy a
    # still-pending resume worktree from the failed attempt.
    label = f"worklist-{item['id']}-{os.getpid()}-{uuid.uuid4().hex[:8]}"
    wt = None
    cleaned_up = False
    try:
        wt = poller.make_worktree(label)
        with open(run_log, "w") as out:
            subprocess.run(
                [poller.CLAUDE_BIN, "-p", prompt, "--model", poller.CLAUDE_MODEL,
                 "--permission-mode", mode],
                cwd=wt, stdout=out, stderr=subprocess.STDOUT,
                timeout=CLAUDE_TIMEOUT_S, check=True, env=env,
            )
        poller.log(f"worklist run ok ({item['id']}, {mode}) → {run_log}")
        return True
    except Exception as e:
        poller.log(f"worklist run FAILED ({item['id']}): {e} — see {run_log}")
        if wt is not None:
            preserved = poller.remove_worktree(wt)
            cleaned_up = True
            if preserved:
                poller.register_resume(item.get("thread_ts"), wt, "worklist")
        return False
    finally:
        if wt is not None and not cleaned_up:
            poller.remove_worktree(wt)


def run_pass():
    """One daylight pass: claim the oldest open item and work it. Silent when
    there's nothing to do — an empty queue must never cost anyone a message."""
    if not in_daylight():
        poller.log(f"worklist: {now():%H:%M} is outside the daylight window "
                   f"({DAY_START_H}:00–{DAY_END_H}:00); nothing started")
        return 0
    lock = poller.acquire_lock()
    if lock is None:
        poller.log("worklist: a Slack wake holds the lock; next pass")
        return 0
    items = reconcile(load_items())
    stuck = [i for i in items if i.get("state") == "stuck"
             and not i.get("reported")]
    for i in stuck:
        # The ONE case worth Andrew's attention — and it costs him one item
        # with a reason, not a list at bedtime.
        if i.get("thread_ts"):
            try:
                poller.post_message(
                    compose_stuck_notice(i, waiting_on_andrew(i)),
                    thread_ts=i["thread_ts"])
            except Exception as e:
                poller.log(f"worklist: stuck notice failed ({e})")
        i["reported"] = True
        save_item(i)
    todo = [i for i in items if i.get("state") == "open"]
    if not todo:
        poller.log("worklist: nothing open")
        return 0
    item = todo[0]
    item["state"] = "working"
    item["attempts"] = item.get("attempts", 0) + 1
    item["last_attempt"] = now().isoformat(timespec="seconds")
    save_item(item)
    poller.log(f"worklist: working {item['id']} (attempt {item['attempts']})")
    wake_agent(item)
    return 0


# ---------------------------------------------------------------- main
def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    p.add_argument("--run", action="store_true",
                   help="one daylight pass (launchd's entry point)")
    sub = p.add_subparsers(dest="cmd")

    a = sub.add_parser("add", help="file an item instead of telling Andrew")
    a.add_argument("--title", required=True)
    a.add_argument("--public-title", default=None,
                   help="the same thing in plain, non-ops language, for the "
                        "one message Andrew hears if it ever gets stuck (no "
                        "PR numbers, versions, filenames or ops words — "
                        "those are dropped and the notice goes generic)")
    a.add_argument("--detail", required=True,
                   help="enough for a fresh session to execute it cold")
    a.add_argument("--thread", default=None, help="Slack thread_ts it came from")
    a.add_argument("--priority", type=int, default=2, help="1 = first")

    sub.add_parser("list", help="what's queued").add_argument(
        "--json", action="store_true")

    for name, help_ in (("done", "it landed"), ("drop", "it's not worth doing")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("id")
        s.add_argument("--note", default="")

    args = p.parse_args(argv)
    if args.run:
        return run_pass()
    if args.cmd == "add":
        return cmd_add(args)
    if args.cmd == "list":
        return cmd_list(args)
    if args.cmd in ("done", "drop"):
        return cmd_close(args, "done" if args.cmd == "done" else "dropped")
    p.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
