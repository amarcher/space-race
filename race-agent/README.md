# race-agent — the #space-race Slack channel into Andrew's Claude Code

A direct port of `smart-home/house-agent` — same architecture, same safety
spine — pointed at **#space-race** (`C0BQ3571U1Z`) and this repo. Same Slack
workspace as house-agent (**The Archers**), a different channel, and its own
dedicated app/tokens ("Space Race Claude") — nothing here is shared with
house-agent's credentials or state. Andrew (or anyone else who joins
#space-race) writes there; within a second or two, headless Claude Code on
the Mac — running **Opus**, with this repo's full context — picks the
thread up, does the work under [`policy.md`](policy.md), and replies
in-thread.

Delivery is **push**: the daemon holds an outbound Socket Mode WebSocket to
Slack (no inbound port, no tunnel — the "webhook" without a public
endpoint). Events only decide *when* to sweep; the sweep engine decides
*what happens*, so a duplicate/replayed event is at worst a no-op.

**What's different from house-agent**, and why — see the module docstrings
in `poller.py`/`daemon.py` for the full reasoning:
- Same workspace, different channel, separate app/tokens/state
  (`~/.space-race/race-agent/`, not `~/.smart-home/house-agent/`) — the two
  bots don't share anything and can be killed independently.
- **One trust tier**, not two: only Andrew (`U406UR8P4`) is privileged.
  #space-race currently has no other members; anyone who joins later reads
  as "unknown" until added — same as house-agent's fallback for strangers.
  See `policy.md` for how to add someone.
- **Every spawn runs `--model opus`**, not the CLI's configured default.
  house-agent runs plain `claude -p` (inherits Sonnet from
  `~/.claude/settings.json`); here `poller.py`/`worklist.py` pass
  `--model opus` explicitly (`CLAUDE_MODEL`, overridable via
  `RACE_AGENT_CLAUDE_MODEL` for the selftest seam).
- Professional/teammate tone in `policy.md`/`RUNNER.md` instead of
  house-agent's family voice, and an extra **live-money / production-store**
  policy class — this repo's store now runs live Stripe + Shippo (see
  `docs/store-ops.md`, `docs/store-wayfinder.md`), so anything touching that
  surface always needs Andrew's 👍, even on an andrew-tier run.

## Pieces

| File | Role |
|---|---|
| `daemon.py` | launchd KeepAlive process (pyenv python + slack_sdk): Socket Mode socket, acks events, flags a sweep on channel messages from anyone but the bot / Andrew's reactions. Catch-up sweep on every (re)connect + a 900 s fallback sweep for missed events. Re-execs itself onto changed sources (self-restart, content-hashed). |
| `poller.py` | The sweep engine (stdlib-only; run it by hand for one manual sweep): dedupe new human messages, react 👀 on the triggering message, wake `claude -p --model opus` — in a fresh `git worktree` cut from `origin/main`, never the shared repo — with the tier-tagged thread as context, check pending approvals for Andrew's 👍/👎. Dumb by design — it never interprets. |
| `worklist.py` | The daylight worklist — the agent's own queue. `add` files a found-but-not-now job (andrew-tier only); `--run` is one daylight pass (09:40/14:40): claim the oldest open item, spin up its own isolated worktree the same way `poller.py` does, and wake the agent on it. |
| `com.archer.race-daylight.plist` | The launchd calendar job for the worklist pass. |
| `policy.md` | **The access model.** Trust tier, intent classes, dispositions, approval mechanics, the live-money class. Re-read by the agent on every wake. |
| `RUNNER.md` | Mechanics for the woken agent: reply in-thread, request approvals via `pending/`, the daylight worklist, tone. |
| `com.archer.race-agent.plist` | The launchd contract (KeepAlive daemon, logs outside the repo). |
| `selftest.py` | Offline behavioral proof: stub Slack on loopback + a recorder stub for `claude`; no real tokens, no network, no agent spawn. Run it with `python3 race-agent/selftest.py`. |

## Order alerts (separate, already live in code)

`web/api/stripe-webhook.ts` posts to #space-race on every completed checkout
— buyer, quantity, shipping method — via a plain Slack **Incoming Webhook**
(`SLACK_ORDERS_WEBHOOK_URL`), not the bot token. This is intentionally
decoupled from the daemon below: it needs no Socket Mode connection, no
`BOT_USER`, nothing installed or running locally — just one Vercel env var.
See step 5 below; it can be turned on independently of (and before) the
interactive bot.

## Status: installed and running

The app, tokens, channel invite, and both launchd jobs are done (2026-08-14,
driven via browser with Andrew's live-in-session authorization). What's
left is one Vercel env var for order alerts — see step 5.

- **App**: "Space Race Claude", App ID `A0BQ3BA5E1Z`, The Archers workspace.
- **Bot user**: `U0BPU7AD9GF` (already in `poller.py`'s `BOT_USER`).
- **Tokens**: `~/.space-race/race-agent/slack_token.txt` (`xoxb-…`) and
  `slack_app_token.txt` (`xapp-1-…`, `connections:write`), mode 600, both
  verified live (`auth.test` and `apps.connections.open` both `ok: true`).
- **Bot invited to #space-race** — confirmed via `conversations.history`.
- **Watermark armed** with one manual `poller.py` sweep before the daemon
  started, so it never replayed the channel's join/bot-add backlog.
- **Both launchd jobs bootstrapped**: `com.archer.race-agent` is `running`
  (KeepAlive daemon, connected, did its catch-up sweep — see
  `~/.space-race/race-agent/launchd.out.log`); `com.archer.race-daylight` is
  loaded and idle until its 09:40/14:40 calendar slots.
- **Incoming Webhook for #space-race already generated** during install
  (Slack requires picking a channel for the `incoming-webhook` scope at
  OAuth time) — the URL just needs to land in Vercel as `SLACK_ORDERS_WEBHOOK_URL`
  (step 5) to turn order alerts on.
- **Worktree isolation, 45-minute cap, eyes-ack, and 👍-gated resume** landed
  2026-08-14 (see the incident section below) — `reactions:write` was added
  to the app's scopes and reinstalled for the eyes-ack to work; confirmed
  live via `auth.test`'s `X-OAuth-Scopes` response header. A second,
  unused Incoming Webhook URL was generated as a side effect of that
  reinstall (Slack's OAuth flow re-asks for a webhook channel on every
  reinstall) — harmless, just ignore it; the original webhook URL already
  in Vercel is still valid.

The steps below are kept as the reference/reinstall procedure (e.g. if the
app is ever recreated, or on a new Mac) — not a to-do list.

### 2026-08-14: worktree isolation, ported before race-agent ever hit it

A sibling port of this exact architecture — storybook-studio/fable-agent,
same house-agent pattern, stood up the same day — hit a real incident on its
first day live: every wake ran in the one shared repo checkout, with no
reset between wakes. Wake N (a real feature branch) finished and left the
checkout on its own feature branch; wake N+1 (a genuinely one-line fix, tier
andrew) branched from THAT instead of a clean `main`, and its PR
squash-merged wake N's entire unreviewed diff onto `main` as a stowaway.
Caught and reverted within ~12 minutes by a human watching the repo — pure
luck, not process.

race-agent shares the identical mechanism (nothing reset the checkout
between wakes either) and hadn't had a single live wake yet when the fix
landed, so this was ported preventatively rather than reactively. See
`poller.py`'s `make_worktree`/`remove_worktree`/`register_resume` — every
wake now runs in its own disposable worktree cut fresh from `origin/main`,
never the shared checkout; removed after a clean run, *preserved* (never
deleted) if a run leaves uncommitted or unpushed work behind, with a
👍-gated resume ask so that work is never silently lost (deleted) or
silently resumed (skipping Andrew's review) either. Proven against a real
local git repo + bare origin in `selftest.py`, not mocked — worktree
isolation, the dirty-work-survives case, the already-replied fallback
suppression, and the full resume round-trip are all separate scenarios
there. `worklist.py`'s wake_agent got the identical treatment even though
the upstream fable-agent template didn't extend it there — a worklist wake
and a Slack-triggered wake share the same singleton lock, so they run
sequentially in the same directory unless each gets its own checkout too.

One additional fix beyond the ported design: the worktree label was
originally `{thread_ts}-{kind}-{pid}}` — but a launchd daemon's pid is
stable for days, so a second wake in the *same* thread (a reply landing
while an earlier resume ask is still unanswered) would compute the
identical label, and `make_worktree`'s own "remove anything already at this
path" step would have silently destroyed the earlier wake's *preserved,
resume-pending* worktree. Caught by this repo's own selftest before it ever
shipped (comparing two same-thread wakes' worktree paths) — fixed by adding
a random suffix (`uuid.uuid4().hex[:8]`) to the label in both `poller.py`
and `worklist.py`.

### 1. Create the Slack app

Go to **api.slack.com/apps → Create New App → From an app manifest**, pick
**The Archers** workspace (the same one house-agent already runs in — this
creates a second, independent app, not a change to House Claude's), and
paste this (YAML tab):

```yaml
display_information:
  name: Space Race Claude
  description: Headless Claude Code for the space-race project — listens on #space-race
  background_color: "#1a1a2e"
features:
  bot_user:
    display_name: Space Race Claude
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - channels:history
      - groups:history
      - reactions:read
      - reactions:write
      - files:write
      - incoming-webhook
settings:
  event_subscriptions:
    bot_events:
      - message.channels
      - message.groups
      - reaction_added
  interactivity:
    is_enabled: false
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

Review, then **Create**.

### 2. Install it and collect tokens

- **OAuth & Permissions → Install to Workspace.** Approve it.
- Copy the **Bot User OAuth Token** (`xoxb-…`) from that same page.
- **Basic Information → App-Level Tokens → Generate Token and Scopes** →
  add scope `connections:write` → Generate. Copy the app token (`xapp-…`).
- Both tokens: save them as single-line files, outside the repo, mode 600:

```sh
mkdir -p ~/.space-race/race-agent
echo -n "xoxb-…" > ~/.space-race/race-agent/slack_token.txt
echo -n "xapp-…" > ~/.space-race/race-agent/slack_app_token.txt
chmod 600 ~/.space-race/race-agent/slack_token.txt ~/.space-race/race-agent/slack_app_token.txt
```

### 3. Invite the bot and find its user ID

- In #space-race: `/invite @Space Race Claude`.
- Find its Slack **user ID** (needed to stop the bot from waking on its own
  messages): `curl -sS -H "Authorization: Bearer $(cat ~/.space-race/race-agent/slack_token.txt)" https://slack.com/api/auth.test`
  — read `user_id` from the response.
- Paste that value into `poller.py`'s `BOT_USER = "REPLACE_ME_BOT_USER_ID"`
  (replacing the placeholder), committing the change.

### 4. Install the launchd jobs

```sh
cp race-agent/com.archer.race-agent.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.archer.race-agent.plist
cp race-agent/com.archer.race-daylight.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.archer.race-daylight.plist
# status / logs
launchctl print gui/$UID/com.archer.race-agent | head -20
tail -f ~/.space-race/race-agent/launchd.out.log
# uninstall (kill switch)
launchctl bootout gui/$UID/com.archer.race-agent
```

Runtime dep (already present on this Mac): `slack_sdk` in the pyenv
3.13.13 python (verified installed). No extra websocket package needed —
the SDK's builtin Socket Mode client covers it.

### 5. Turn on order alerts — **the one step not yet done**

The Incoming Webhook itself already exists (Slack generates one for whatever
channel you pick while installing the app — #space-race, in this case). What's
missing is wiring the URL into Vercel:

- Add it as a Vercel project env var: `SLACK_ORDERS_WEBHOOK_URL` = the webhook
  URL (Production + Preview, your call). `vercel env add` or the dashboard.
  (If the URL needs to be regenerated: **Incoming Webhooks → Add New Webhook
  to Workspace** → #space-race → copy it.)
- Nothing else to do — `web/api/stripe-webhook.ts` already checks for it and
  posts `🎲 New order — <buyer> bought <n> cop{y,ies}, shipping via
  <method>.` on every completed checkout, best-effort (a missing/broken
  webhook URL never fails the checkout webhook itself).

## Tiered spawn (the permission model, enforced in code)

The trust tier isn't just policy prose — it picks the spawned agent's
permission mode (`poller.py TIER_MODE`):

- a wake whose new messages are **all Andrew's**, or an **approval** wake
  (which exists only because Andrew reacted 👍/👎 to a specific registered
  ask): `--permission-mode bypassPermissions`
- **anything else**: `acceptEdits` — non-allowlisted tool calls fail fast
  and the agent routes the ask through the 👍 flow instead. Text in the
  channel can never conjure an ungated agent.

`policy.md` additionally requires Andrew's 👍 for anything touching the
live-money/production-store surface **even on an andrew-tier run** — that's
a policy-level check on top of the code-level permission gate, not a
replacement for it.

## State (outside the repo: `~/.space-race/race-agent/`)

- `slack_token.txt` / `slack_app_token.txt` — the secrets (see step 2).
- `state.json` — the watermark (`last_ts`) + tracked-thread watermarks. The
  **first ever sweep only arms the watermark** (no backlog replay).
- `pending/<ask_ts>.json` — approvals awaiting Andrew's reaction.
- `worklist/<id>.json` — queued daylight work; `worklist/done/` keeps every
  closed item.
- `daemon.status.json` — the daemon's heartbeat: which source files it is
  running, and that it is still ticking.
- `runs/*.log` — each agent run's transcript; `poller.lock` — the singleton;
  `launchd.{out,err}.log`.

## Design notes / limits (same as house-agent, see its README for the full rationale)

- One agent run at a time (flock singleton). Runs capped at 45 minutes; a
  timeout SIGKILLs the run. What happens next depends on what the run left
  behind: nothing → the plain fallback line; real uncommitted/unpushed work
  → the worktree is preserved and a 👍-gated resume ask is posted instead;
  already replied since the wake started → nothing extra, the agent already
  spoke for itself.
- Every wake — message, approval, worklist — runs in its own disposable
  `git worktree` cut from `origin/main`, never the shared repo checkout.
  See the 2026-08-14 incident section above.
- At-most-once: the watermark advances *before* the spawn.
- At-most-once across the two spawn paths too (`drop_answered`).
- The Slack app subscribes to `message.channels`, `message.groups`, and
  `reaction_added` — the loop keeps working if the channel is made private
  (the bot must be re-invited).
- The bot has **no `channels:join`** — it's only in channels a human invites
  it to.
- Approvals: only Andrew's (`U406UR8P4`) 👍/👎 reactions decide a pending
  ask; anyone else's reactions are ignored.
