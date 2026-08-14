#!/usr/bin/env python3
"""Offline race-agent selftest — proves the #space-race poller BEFORE it ever
touches Slack or spawns a real agent. No network, no real token, no `claude`.

A right-sized port of smart-home/house-agent's selftest.py for this project:
same seam pattern (stub Slack API on loopback + a recorder stub for `claude`,
all via RACE_AGENT_* env overrides), a smaller scenario set matched to what's
actually different here (single trust tier, Opus on every spawn, a different
workspace/channel) — PLUS the worktree-isolation regression suite ported from
storybook-studio/fable-agent (2026-08-14 incident: see poller.py's
make_worktree docstring). The worktree scenarios run against a REAL local
git repo + bare "origin" (a few `git init`/`git init --bare`/`git push`
calls in fixture setup) — not a mocked filesystem — because that's the exact
seam a mock would paper over.

Contract pins first:
  * both plists point at daemon.py/worklist.py that exist, with WorkingDirectory
    == REPO and logs under STATE_DIR (outside the repo)
  * poller.py's CHANNEL/ANDREW/TIER_MODE/CLAUDE_MODEL/CLAUDE_TIMEOUT_S pins:
    bypassPermissions is reachable ONLY from the andrew tier; every spawn
    uses --model opus; the run cap is 45 (not 30) minutes
  * both token files default to STATE_DIR outside the repo (the house-agent
    2026-07-03 git-clean class)
  * the worktree machinery (make_worktree/remove_worktree/register_resume)
    exists in both poller.py and worklist.py's import of it

Then the behavioral proof against a stub Slack API, a stub `claude` binary
that records its argv/cwd instead of running, and a real git repo + bare
origin:
  1. seams wired — token/state/API/claude/repo all redirected
  2. first sweep only ARMS the watermark: a channel with backlog spawns
     nothing
  3. a new message from Andrew wakes the agent once, tier "andrew",
     --permission-mode bypassPermissions, --model opus, in an ISOLATED
     worktree containing origin/main's content, acked with an eyes
     reaction, cleaned up after
  4. a new message from anyone else wakes the agent once, tier "unknown",
     --permission-mode acceptEdits
  5. a repeat sweep with nothing new spawns nothing (dedupe)
  6. the bot's own messages and bot_id messages (any bot integration)
     never wake the agent
  7. thread replies (invisible to channel history) are picked up via the
     tracked-thread watermark
  8. singleton: a held lock skips the sweep
  9. approvals: Andrew's 👍 wakes the agent with verdict approved and clears
     the pending file; his 👎 → denied; a NON-Andrew 👍 decides nothing
 10. worktree isolation: two separate wakes never share a worktree directory
 11. a wake that leaves uncommitted work has its worktree PRESERVED, not
     deleted
 12. a run that already replied since it started never gets the generic
     fallback stacked on top
 13. a run that fails AND leaves real work behind gets a 👍-gated resume ask
     (not the fallback); Andrew's 👍 resumes it IN THE SAME worktree; a
     resume that resolves its own leftover gets cleanly removed after
 14. a failing spawn with no leftover work posts the plain fallback and the
     watermark still advances (no poison loop)
 15. worklist: `add` refuses outside an andrew-tier run; MAX_ATTEMPTS trips
     `stuck`; the ops-vocabulary guard drops a title-shaped public_title;
     a worklist wake also runs in its own isolated worktree

Exit 0 = pass; non-zero with a RACE-AGENT SELFTEST FAIL line otherwise.
"""
import http.server
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))


def fail(msg):
    print(f"RACE-AGENT SELFTEST FAIL: {msg}")
    sys.exit(1)


def ok(msg):
    print(f"  ok: {msg}")


def _git(args, cwd=None):
    """Fixture-setup git call — fails loudly rather than silently producing
    a broken fixture the worktree scenarios would then pass against for the
    wrong reason."""
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"selftest fixture setup failed: git {args} (cwd={cwd}) — {r.stderr}")
    return r


# ------------------------------------------------------------ contract pins
def check_contract():
    import poller

    if poller.CHANNEL != "C0BQ3571U1Z":
        fail(f"poller.CHANNEL is {poller.CHANNEL!r}, expected #space-race's id")
    if poller.ANDREW != "U406UR8P4":
        fail(f"poller.ANDREW is {poller.ANDREW!r}, expected Andy's user id")
    if poller.TIER_MODE != {"andrew": "bypassPermissions"}:
        fail(f"TIER_MODE must map ONLY andrew to bypassPermissions, got "
             f"{poller.TIER_MODE!r}")
    if poller.DEFAULT_MODE != "acceptEdits":
        fail(f"DEFAULT_MODE is {poller.DEFAULT_MODE!r}, expected acceptEdits "
             f"(anything non-andrew must run permission-gated)")
    if poller.TIERS.get(poller.ANDREW) != "andrew":
        fail("ANDREW must map to tier 'andrew' in TIERS")
    if os.environ.get("RACE_AGENT_CLAUDE_MODEL") is None and poller.CLAUDE_MODEL != "opus":
        fail(f"CLAUDE_MODEL default is {poller.CLAUDE_MODEL!r}, expected 'opus' "
             f"(every race-agent spawn must run Opus, not the CLI default)")
    if poller.CLAUDE_TIMEOUT_S != 45 * 60:
        fail(f"CLAUDE_TIMEOUT_S is {poller.CLAUDE_TIMEOUT_S!r}, expected 45 "
             f"minutes — safe to raise from 30 only because worktree "
             f"isolation means a longer cap no longer risks cross-wake "
             f"contamination")
    repo_root = os.path.dirname(BASE)
    if os.path.commonpath([os.path.abspath(poller.TOKEN_FILE), repo_root]) == repo_root \
            and os.environ.get("RACE_AGENT_TOKEN_FILE") is None:
        fail("TOKEN_FILE default must live outside the repo tree")
    for fn in ("make_worktree", "remove_worktree", "register_resume", "add_reaction"):
        if not hasattr(poller, fn):
            fail(f"poller.py lost {fn}() — the worktree-isolation fix "
                 f"(storybook-studio/fable-agent, 2026-08-14) is missing")

    for plist_name, entry in (("com.archer.race-agent.plist", "daemon.py"),
                              ("com.archer.race-daylight.plist", "worklist.py")):
        path = os.path.join(BASE, plist_name)
        if not os.path.isfile(path):
            fail(f"missing {plist_name}")
        text = open(path).read()
        if f"race-agent/{entry}" not in text:
            fail(f"{plist_name} doesn't reference race-agent/{entry}")
        if "/Users/archer/Programs/space-race</string>" not in text:
            fail(f"{plist_name} WorkingDirectory doesn't point at the repo")
        if "/Users/archer/.space-race/race-agent/" not in text:
            fail(f"{plist_name} logs aren't under the outside-repo state dir")

    poller_src = open(os.path.join(BASE, "poller.py")).read()
    worklist_src = open(os.path.join(BASE, "worklist.py")).read()
    if poller_src.count("bypassPermissions") != 1:
        fail("bypassPermissions appears outside TIER_MODE in poller.py — "
             "the only path to an ungated agent must be the andrew tier")
    if worklist_src.count("bypassPermissions") != 1:
        fail("bypassPermissions appears outside TIER_MODE in worklist.py")
    if "poller.make_worktree(" not in worklist_src:
        fail("worklist.py's wake_agent no longer isolates its wake in a "
             "worktree — a worklist wake and a Slack wake share the same "
             "singleton lock, so they run sequentially in the same "
             "directory unless each gets its own checkout")
    ok("contract pins")


# ------------------------------------------------------------ stub Slack
class _State:
    def __init__(self):
        self.messages = []   # list of dict: ts, user, bot_id, text, thread_ts, subtype
        self.reactions = {}  # ts -> [{"name": ..., "users": [...]}]
        # Real wall-clock, not a fixed epoch: fetch_new() compares tracked
        # threads against datetime.now() and expires anything older than
        # THREAD_TTL_S (48h) — a fixed-past base would evict every tracked
        # thread before the test ever polls its replies.
        self._n = time.time()

    def next_ts(self):
        self._n += 1
        return f"{self._n:.6f}"

    def add_message(self, user=None, bot_id=None, text="", thread_ts=None,
                    subtype=None):
        ts = self.next_ts()
        self.messages.append({"ts": ts, "user": user, "bot_id": bot_id,
                              "text": text, "thread_ts": thread_ts or ts,
                              "subtype": subtype})
        return ts

    def add_reaction(self, ts, name, user):
        self.reactions.setdefault(ts, []).append({"name": name, "users": [user]})


class StubSlack(http.server.BaseHTTPRequestHandler):
    state: _State = None

    def log_message(self, *a):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        params = {k: v[0] for k, v in urllib.parse.parse_qs(body).items()}
        method = self.path.strip("/")
        st = StubSlack.state
        out = {"ok": True}

        if method == "conversations.history":
            oldest = float(params.get("oldest", "0"))
            msgs = [m for m in st.messages
                    if m["thread_ts"] == m["ts"] and float(m["ts"]) > oldest]
            out["messages"] = msgs
        elif method == "conversations.replies":
            tts = params["ts"]
            oldest = float(params.get("oldest", "0"))
            msgs = [m for m in st.messages
                    if m["thread_ts"] == tts and float(m["ts"]) > oldest]
            out["messages"] = sorted(msgs, key=lambda m: m["ts"])
        elif method == "chat.postMessage":
            ts = st.add_message(bot_id="Bstub", text=params.get("text", ""),
                                thread_ts=params.get("thread_ts"))
            out["ts"] = ts
        elif method == "reactions.get":
            ts = params["timestamp"]
            out["message"] = {"reactions": st.reactions.get(ts, [])}
        elif method == "reactions.add":
            ts_ = params["timestamp"]
            name = params.get("name")
            existing = st.reactions.setdefault(ts_, [])
            if any(r["name"] == name for r in existing):
                out = {"ok": False, "error": "already_reacted"}
            else:
                existing.append({"name": name, "users": ["Bstub"]})
        else:
            out = {"ok": False, "error": "unhandled_method"}

        payload = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def start_stub_slack(state):
    StubSlack.state = state
    srv = http.server.HTTPServer(("127.0.0.1", 0), StubSlack)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}"


# Recorder stub for `claude`: logs argv/cwd/git-state at spawn time (not
# afterward, which races against a clean run's own worktree cleanup), and —
# controlled by env vars the test sets per-scenario — can leave uncommitted
# work behind, clean up a prior run's leftover, reply in-thread the way a
# real woken agent does, or exit non-zero.
CLAUDE_STUB = """#!/usr/bin/env python3
import json, os, sys, urllib.parse, urllib.request
rec = os.environ.get("RACE_AGENT_TEST_RECORDER")
if rec:
    with open(rec, "a") as f:
        f.write(json.dumps({
            "argv": sys.argv[1:], "cwd": os.getcwd(),
            "has_git": os.path.exists(".git"),
            "has_marker": os.path.exists("MARKER.txt"),
        }) + "\\n")
if os.environ.get("RACE_AGENT_TEST_CLAUDE_DIRTY"):
    open(os.path.join(os.getcwd(), "leftover.txt"), "w").write("uncommitted\\n")
if os.environ.get("RACE_AGENT_TEST_CLAUDE_RESOLVE"):
    p = os.path.join(os.getcwd(), "leftover.txt")
    if os.path.exists(p):
        os.remove(p)
reply_thread = os.environ.get("RACE_AGENT_TEST_CLAUDE_REPLY")
if reply_thread:
    body = urllib.parse.urlencode({
        "channel": "TESTCHANNEL", "thread_ts": reply_thread,
        "text": "done - deployed it and tried it once",
    }).encode()
    urllib.request.urlopen(urllib.request.Request(
        os.environ["RACE_AGENT_API"] + "/chat.postMessage", data=body),
        timeout=10).read()
sys.exit(int(os.environ.get("RACE_AGENT_TEST_CLAUDE_EXIT", "0")))
"""


def make_claude_stub(tmp):
    path = os.path.join(tmp, "claude-stub.py")
    with open(path, "w") as f:
        f.write(CLAUDE_STUB)
    os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
    return path


def recorded_runs(recorder):
    if not os.path.exists(recorder):
        return []
    return [json.loads(l) for l in open(recorder) if l.strip()]


def clear_test_flags():
    for k in ("RACE_AGENT_TEST_CLAUDE_EXIT", "RACE_AGENT_TEST_CLAUDE_DIRTY",
              "RACE_AGENT_TEST_CLAUDE_RESOLVE", "RACE_AGENT_TEST_CLAUDE_REPLY"):
        os.environ.pop(k, None)


# ------------------------------------------------------------ fixture
def setup_fixture():
    """A REAL local git repo + bare 'origin' (not a mocked filesystem) so
    make_worktree()'s `git fetch origin main` / `git worktree add --detach
    <path> origin/main` genuinely runs, fully offline. This is the exact
    mechanism the worktree-isolation fix is a regression test for: a fixture
    that isn't real git would let a worktree bug pass silently."""
    tmp = tempfile.mkdtemp(prefix="race-agent-selftest-")
    state_dir = os.path.join(tmp, "state")
    fake_repo = os.path.join(tmp, "repo")
    origin_bare = os.path.join(tmp, "origin.git")
    _git(["init", "--bare", "-q", "-b", "main", origin_bare])
    _git(["init", "-q", "-b", "main", fake_repo])
    open(os.path.join(fake_repo, "MARKER.txt"), "w").write("origin/main content\n")
    _git(["add", "MARKER.txt"], cwd=fake_repo)
    _git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "seed"],
         cwd=fake_repo)
    _git(["remote", "add", "origin", origin_bare], cwd=fake_repo)
    _git(["push", "-q", "origin", "main"], cwd=fake_repo)

    recorder = os.path.join(tmp, "runs.jsonl")
    claude_stub = make_claude_stub(tmp)
    slack_state = _State()
    srv, api_base = start_stub_slack(slack_state)

    os.environ["RACE_AGENT_STATE_DIR"] = state_dir
    os.environ["RACE_AGENT_TOKEN_FILE"] = os.path.join(tmp, "token.txt")
    os.environ["RACE_AGENT_API"] = api_base
    os.environ["RACE_AGENT_CLAUDE_BIN"] = claude_stub
    os.environ["RACE_AGENT_REPO"] = fake_repo
    os.environ["RACE_AGENT_TEST_RECORDER"] = recorder
    with open(os.environ["RACE_AGENT_TOKEN_FILE"], "w") as f:
        f.write("xoxb-stub")

    sys.path.insert(0, BASE)
    for m in ("poller", "worklist"):
        sys.modules.pop(m, None)
    import poller
    import worklist

    return {
        "tmp": tmp, "fake_repo": fake_repo, "state_dir": state_dir,
        "recorder": recorder, "slack_state": slack_state, "srv": srv,
        "poller": poller, "worklist": worklist,
    }


def teardown_fixture(fx):
    fx["srv"].shutdown()
    shutil.rmtree(fx["tmp"], ignore_errors=True)


# ------------------------------------------------------------ behavioral
def run_behavioral(fx):
    poller = fx["poller"]
    slack_state = fx["slack_state"]
    recorder = fx["recorder"]
    fake_repo = fx["fake_repo"]

    ok("seams wired (state dir, token file, Slack API, claude binary, real "
       "git repo + bare origin all redirected)")

    ANDREW, OTHER, BOT = poller.ANDREW, "U_OTHER_PERSON", poller.BOT_USER

    # 1) backlog exists before the first sweep — must not replay it
    slack_state.add_message(user=OTHER, text="pre-existing backlog message")
    poller.main()
    if recorded_runs(recorder):
        fail("first sweep spawned an agent on backlog instead of only arming")
    ok("first sweep only arms the watermark")

    # 2) Andrew's message wakes the agent, tier andrew, opus, bypassPermissions,
    #    in an isolated worktree off origin/main, acked with an eyes reaction,
    #    cleaned up after
    open(recorder, "w").close()
    ts_a = slack_state.add_message(user=ANDREW, text="ship it")
    poller.main()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"expected exactly 1 spawn for Andrew's message, got {len(runs)}")
    argv = runs[0]["argv"]
    if "--model" not in argv or argv[argv.index("--model") + 1] != "opus":
        fail(f"spawn argv missing --model opus: {argv}")
    if argv[argv.index("--permission-mode") + 1] != "bypassPermissions":
        fail(f"Andrew-tier spawn wasn't bypassPermissions: {argv}")
    wt1 = runs[0]["cwd"]
    if os.path.realpath(wt1) in (os.path.realpath(fake_repo), fake_repo):
        fail(f"agent ran directly in the shared repo, not an isolated "
             f"worktree — the exact seam the 2026-08-14 fable-agent "
             f"incident exploited: {wt1}")
    if not runs[0]["has_git"]:
        fail(f"agent's cwd {wt1} was not a git checkout at all")
    if not runs[0]["has_marker"]:
        fail(f"worktree {wt1} didn't contain origin/main's content — "
             f"make_worktree didn't actually check out origin/main")
    if os.path.exists(wt1):
        fail(f"a clean (non-dirty) wake's worktree must be removed after "
             f"the run, still exists: {wt1}")
    if not any(r["name"] == "eyes" for r in slack_state.reactions.get(ts_a, [])):
        fail("no eyes-reaction ack was added on the triggering message")
    ok("Andrew's message wakes the agent: tier andrew, opus, "
       "bypassPermissions, isolated worktree off origin/main, eyes ack, "
       "cleaned up after")

    # 3) someone else's message wakes the agent gated
    open(recorder, "w").close()
    slack_state.add_message(user=OTHER, text="what's the deploy status")
    poller.main()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"expected exactly 1 spawn for the other person's message, got {len(runs)}")
    if runs[0]["argv"][runs[0]["argv"].index("--permission-mode") + 1] != "acceptEdits":
        fail("non-Andrew message must spawn permission-gated (acceptEdits)")
    ok("a non-Andrew message wakes the agent permission-gated")

    # 4) repeat sweep, nothing new
    open(recorder, "w").close()
    poller.main()
    if recorded_runs(recorder):
        fail("a sweep with no new messages spawned an agent")
    ok("dedupe: nothing new spawns nothing")

    # 5) bot's own / integration messages never wake the agent
    open(recorder, "w").close()
    slack_state.add_message(user=BOT, text="I already said this")
    slack_state.add_message(bot_id="B_GITHUB", text="PR #1 opened")
    poller.main()
    if recorded_runs(recorder):
        fail("bot/integration messages woke the agent")
    ok("the bot's own messages and integration posts never wake the agent")

    # 6) thread replies picked up via tracked-thread watermark
    open(recorder, "w").close()
    reply_thread = ts_a
    slack_state.add_message(user=ANDREW, text="reply in thread",
                            thread_ts=reply_thread)
    poller.main()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"expected exactly 1 spawn for a tracked-thread reply, got {len(runs)}")
    wt2 = runs[0]["cwd"]
    ok("thread replies are picked up via the tracked-thread watermark")

    # 7) singleton lock
    lock = poller.acquire_lock()
    if lock is None:
        fail("could not acquire the lock the first time")
    second = poller.acquire_lock()
    if second is not None:
        fail("a second concurrent acquire_lock() succeeded — singleton broken")
    lock.close()
    ok("singleton lock: a second concurrent acquire is refused")

    # 8) approvals
    open(recorder, "w").close()
    os.makedirs(poller.pending_dir(), exist_ok=True)
    ask_ts = slack_state.add_message(bot_id="Bstub", text="ok to deploy?",
                                     thread_ts=reply_thread)
    with open(os.path.join(poller.pending_dir(), f"{ask_ts}.json"), "w") as f:
        json.dump({"ask_ts": ask_ts, "thread_ts": reply_thread,
                   "summary": "deploy", "action": "deploy it"}, f)
    slack_state.add_reaction(ask_ts, "+1", OTHER)  # must be ignored
    poller.main()
    if recorded_runs(recorder):
        fail("a non-Andrew reaction decided a pending approval")
    if not os.path.exists(os.path.join(poller.pending_dir(), f"{ask_ts}.json")):
        fail("the pending file was consumed by a non-Andrew reaction")
    slack_state.add_reaction(ask_ts, "+1", ANDREW)
    open(recorder, "w").close()
    poller.main()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"expected exactly 1 approval spawn, got {len(runs)}")
    if os.path.exists(os.path.join(poller.pending_dir(), f"{ask_ts}.json")):
        fail("the pending file wasn't cleared after Andrew's decision")
    ok("approvals: only Andrew's reaction decides, and clears the pending file")

    # 9) worktree isolation across wakes: two separate wakes never share a dir
    if wt1 == wt2:
        fail(f"two separate wakes shared the same worktree directory — "
             f"the exact seam the 2026-08-14 fable-agent incident "
             f"exploited: {wt2}")
    ok("worktree: each wake gets its own fresh checkout off origin/main, "
       "never a sibling wake's leftover directory")

    # 10) a wake that leaves uncommitted work has its worktree PRESERVED
    os.environ["RACE_AGENT_TEST_CLAUDE_DIRTY"] = "1"
    open(recorder, "w").close()
    slack_state.add_message(user=ANDREW, text="worktree isolation check, "
                                                "goes sideways")
    poller.main()
    clear_test_flags()
    runs = recorded_runs(recorder)
    wtC = runs[0]["cwd"]
    if not os.path.exists(wtC) or not os.path.exists(
            os.path.join(wtC, "leftover.txt")):
        fail(f"a wake that left uncommitted work must have its worktree "
             f"PRESERVED, not deleted — the only copy of that work just "
             f"got destroyed: {wtC}")
    ok("worktree: uncommitted leftover work survives — never silently "
       "deleted along with its worktree")
    shutil.rmtree(wtC, ignore_errors=True)  # tidy up before the next checks

    # 11) a run that already replied since it started never gets the
    #     generic fallback stacked on top
    os.environ["RACE_AGENT_TEST_CLAUDE_EXIT"] = "1"
    thread_spoke = slack_state.add_message(user=ANDREW, text="already-spoke check")
    os.environ["RACE_AGENT_TEST_CLAUDE_REPLY"] = thread_spoke
    before_posted = len(slack_state.messages)
    poller.main()
    clear_test_flags()
    posted_texts = [m.get("text", "") for m in slack_state.messages[before_posted:]]
    if not any("done - deployed it" in t for t in posted_texts):
        fail(f"the stub's own in-thread reply never landed: {posted_texts}")
    if any("ran long and had to stop" in t for t in posted_texts):
        fail(f"a run that already replied since it started still got the "
             f"fallback line stacked on top: {posted_texts}")
    ok("fallback: suppressed when the agent already replied since the wake "
       "started — no confusing 'ran long' line on a finished job")

    # 12) a run that fails AND leaves real work behind gets a 👍-gated resume
    #     ask instead of the generic fallback; Andrew's 👍 resumes it IN THE
    #     SAME preserved worktree
    shutil.rmtree(poller.pending_dir(), ignore_errors=True)
    os.environ["RACE_AGENT_TEST_CLAUDE_EXIT"] = "1"
    os.environ["RACE_AGENT_TEST_CLAUDE_DIRTY"] = "1"
    resume_thread = slack_state.add_message(user=ANDREW, text="resume check")
    before_posted = len(slack_state.messages)
    open(recorder, "w").close()
    poller.main()
    clear_test_flags()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"expected exactly 1 spawn for the resume-ask check, got {len(runs)}")
    failed_wt = runs[0]["cwd"]
    posted_texts = [m.get("text", "") for m in slack_state.messages[before_posted:]]
    if any("ran long and had to stop" in t for t in posted_texts):
        fail("a run that left real work behind must NOT get the generic "
             "fallback — it gets a 👍-gated resume ask instead")
    if not any("React 👍" in t for t in posted_texts):
        fail(f"no resume ask was posted for a run that left real work "
             f"behind: {posted_texts}")
    pend_files = [f for f in os.listdir(poller.pending_dir()) if f.endswith(".json")]
    if len(pend_files) != 1:
        fail(f"expected exactly one pending resume-ask file, got {pend_files}")
    resume_pending = json.load(open(os.path.join(poller.pending_dir(), pend_files[0])))
    # realpath both sides: macOS resolves /var -> /private/var through
    # os.getcwd() inside the stub subprocess but not necessarily through
    # plain string concatenation in poller.py's own wt variable — same
    # directory, two spellings.
    if os.path.realpath(resume_pending.get("resume_worktree", "")) != \
            os.path.realpath(failed_wt):
        fail(f"pending resume file doesn't point at the preserved worktree: "
             f"{resume_pending}")
    if not os.path.exists(os.path.join(failed_wt, "leftover.txt")):
        fail(f"the worktree the resume ask points at lost its leftover "
             f"work: {failed_wt}")

    # Andrew's 👍 on the resume ask — this run resolves its own leftover and
    # succeeds, so the worktree should be cleanly removed after
    os.environ["RACE_AGENT_TEST_CLAUDE_RESOLVE"] = "1"
    slack_state.add_reaction(resume_pending["ask_ts"], "+1", ANDREW)
    open(recorder, "w").close()
    poller.main()
    clear_test_flags()
    runs = recorded_runs(recorder)
    if len(runs) != 1:
        fail(f"Andrew's 👍 must wake exactly one resume run, got {len(runs)}")
    if os.path.realpath(runs[0]["cwd"]) != os.path.realpath(failed_wt):
        fail(f"the resume run must run IN THE SAME preserved worktree, not "
             f"a fresh one — got {runs[0]['cwd']!r}, expected {failed_wt!r}")
    if not runs[0]["has_marker"]:
        fail("the resumed run's worktree lost origin/main's content")
    if os.path.exists(failed_wt):
        fail(f"a resume that resolved its own leftover and succeeded must "
             f"have its worktree cleaned up, still exists: {failed_wt}")
    if os.path.exists(os.path.join(poller.pending_dir(),
                                    f"{resume_pending['ask_ts']}.json")):
        fail("the decided resume-ask pending file must be removed")
    ok("resume: a run that leaves real work behind gets a 👍-gated ask "
       "naming its branch, never the generic fallback; Andrew's 👍 resumes "
       "it in the SAME worktree, cleaned up once it lands")

    # 13) a failing spawn with NO leftover work posts the plain fallback and
    #     the watermark still advances (no poison loop)
    os.environ["RACE_AGENT_TEST_CLAUDE_EXIT"] = "1"
    before = poller.load_state()["last_ts"]
    slack_state.add_message(user=ANDREW, text="this one will fail cleanly")
    poller.main()
    clear_test_flags()
    after = poller.load_state()["last_ts"]
    if after == before:
        fail("watermark didn't advance despite a failed spawn — poison-loop risk")
    if not any(m.get("bot_id") == "Bstub" and "ran long" in m.get("text", "")
               for m in slack_state.messages):
        fail("no fallback line was posted after a failed spawn with no "
             "leftover work")
    ok("a failing spawn with no leftover work posts the plain fallback and "
       "the watermark still advances")


def run_worklist(fx):
    poller, worklist = fx["poller"], fx["worklist"]
    tmp = tempfile.mkdtemp(prefix="race-agent-selftest-worklist-")
    os.environ["RACE_AGENT_STATE_DIR"] = tmp
    os.environ.pop("RACE_AGENT_TIER", None)

    class Args:
        title = "fix the checkout confirmation email"
        public_title = "the checkout confirmation email"
        detail = "enough context for a fresh session"
        thread = "1700000000.000000"
        priority = 2

    rc = worklist.cmd_add(Args())
    if rc == 0:
        fail("worklist.add succeeded without an andrew-tier run")
    os.environ["RACE_AGENT_TIER"] = "andrew"
    rc = worklist.cmd_add(Args())
    if rc != 0:
        fail("worklist.add refused an andrew-tier run")
    ok("worklist add: refuses without the andrew tier stamp, allows with it")

    items = worklist.load_items()
    if len(items) != 1:
        fail(f"expected 1 queued item, got {len(items)}")
    item = items[0]
    item["state"] = "working"
    item["attempts"] = worklist.MAX_ATTEMPTS
    worklist.save_item(item)
    reconciled = worklist.reconcile(worklist.load_items())
    if reconciled[0]["state"] != "stuck":
        fail("an item at MAX_ATTEMPTS wasn't marked stuck on reconcile")
    ok("worklist reconcile: MAX_ATTEMPTS trips stuck")

    ops_titled = {"public_title": "Fix PR #212 in stripe-webhook.ts"}
    if worklist.public_subject(ops_titled) is not None:
        fail("an ops-vocabulary public_title wasn't dropped")
    plain = {"public_title": "the checkout confirmation email"}
    if worklist.public_subject(plain) != "the checkout confirmation email":
        fail("a plain public_title was altered or dropped")
    ok("worklist stuck notice: ops-vocabulary guard drops title-shaped text")

    # a worklist wake also isolates itself in a worktree — it shares the
    # poller's singleton lock but not automatically its worktree machinery,
    # so this is a real check, not a restatement of the poller scenarios.
    fresh = dict(item, id="wt-check", state="open", attempts=0,
                 thread_ts=None, tier="andrew")
    worklist.save_item(fresh)
    open(fx["recorder"], "w").close()
    worklist.wake_agent(fresh)
    runs = recorded_runs(fx["recorder"])
    if len(runs) != 1:
        fail(f"expected exactly 1 spawn for the worklist worktree check, "
             f"got {len(runs)}")
    wwt = runs[0]["cwd"]
    if os.path.realpath(wwt) in (os.path.realpath(fx["fake_repo"]), fx["fake_repo"]):
        fail(f"worklist wake ran directly in the shared repo, not an "
             f"isolated worktree: {wwt}")
    if not runs[0]["has_marker"]:
        fail(f"worklist worktree {wwt} didn't contain origin/main's content")
    if os.path.exists(wwt):
        fail(f"a clean worklist wake's worktree must be removed after the "
             f"run, still exists: {wwt}")
    ok("worklist wakes also run in their own isolated worktree, off "
       "origin/main, cleaned up after")

    shutil.rmtree(tmp, ignore_errors=True)


def main():
    check_contract()
    fx = setup_fixture()
    try:
        run_behavioral(fx)
        run_worklist(fx)
    finally:
        teardown_fixture(fx)
    print("RACE-AGENT SELFTEST: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
