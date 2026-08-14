# RUNNER — how a woken Space Race Claude session operates

*You (the headless agent) were spawned by `race-agent/poller.py` with a JSON
brief: `kind` ("message", "approval", or "worklist"), `channel`, `thread_ts`,
`payload`, and `context` (the recent thread, each entry tagged `who` = a
policy tier). Read `race-agent/policy.md` first — it decides what you may do
for whom. This file is the mechanics. It's a direct port of
smart-home/house-agent's RUNNER.md for this project's Slack channel and repo.*

## Ground rules

- You have the full project harness: the repo, its docs (`docs/store-ops.md`,
  `docs/store-wayfinder.md`, etc.), and the gates. Use them exactly as an
  interactive session would.
- **Always reply in the thread** (`thread_ts` from the brief) — the thread is
  the request, the interrogation, and the confirmation. Never leave a wake
  unanswered: act, ask, or explain. Take that literally — the poller no
  longer hands you a message an earlier run already answered
  (`drop_answered`), so "someone else may have covered this" is not a reason
  to stay quiet. If it reached you, it is yours.
- One wake = one thread. Don't roam the channel or other threads.

## Replying (Slack Web API, bot token)

```sh
TOK=$(cat ~/.space-race/race-agent/slack_token.txt)
curl -sS -H "Authorization: Bearer $TOK" \
  --data-urlencode "channel=<channel>" \
  --data-urlencode "thread_ts=<thread_ts>" \
  --data-urlencode "text=<your reply>" \
  https://slack.com/api/chat.postMessage
```

Preview images/screenshots: upload with `files.uploadV2` (`files:write` is
granted) — but never post one that contains a secret, token, or customer PII.

## Requesting Andrew's approval

When policy.md says an action needs Andrew's 👍 (code changes, destructive
actions, and — always, no exceptions — anything touching the live-money /
production-store surface):

1. Post the ask **in-thread**: what will change, why, and exactly what is
   irreversible or customer-facing if it's the live-money class. Capture the
   returned message `ts` (that's `ask_ts`).
2. Register it for the poller — write
   `~/.space-race/race-agent/pending/<ask_ts>.json`:

```json
{"ask_ts": "<ts of your ask message>",
 "thread_ts": "<the thread>",
 "summary": "one line of what was requested",
 "action": "what to do on approval (enough for a fresh session to execute)"}
```

3. End your session. The poller watches reactions; Andrew's 👍/👎 wakes a
   fresh session with `kind: "approval"` and the verdict. On `approved`,
   execute `action` exactly as written and confirm in-thread; on `denied`,
   acknowledge gracefully in-thread and stand down.

**You don't need to do any of this for a run that ran out of time.** If the
45-minute cap kills you mid-task with real work still on your branch, the
poller notices on its own (`remove_worktree`'s dirty/unpushed check),
preserves your worktree instead of deleting it, and posts its own 👍-gated
resume ask naming your branch — see `register_resume` in `poller.py`. If
Andrew reacts 👍, you'll be woken again in that exact worktree, on that
exact branch, with a note telling you so; run `git status`/`git log` first
to reorient before doing anything else.

## Doing work

- **Repo changes**: feature branch, small commits, the repo's current check
  green (`npm run build` under `web/` as of this writing — confirm what
  exists before claiming coverage), PR. Merge only within the repo's
  existing authorization rules.
- **You're always running in your own isolated `git worktree`**, cut fresh
  from `origin/main` for this one wake — never the shared repo checkout, and
  never another wake's leftover branch or in-progress build. Branch, commit,
  push, open a PR exactly as you would anywhere else; nothing about that
  workflow changes because of the worktree.
- **Don't get guillotined silently.** The poller caps a run at 45 minutes
  and SIGKILLs it — a build + gate can approach that. So for anything that
  touches the repo: (1) post a one-line in-thread ack when you start ("On
  it — looking into that now"), and (2) push your branch and open the PR *as
  soon as you have one coherent commit*, then keep iterating on it. That way
  a timeout leaves a visible PR to finish, never a stranded local branch and
  a silent thread — and see the resume note above for what happens if you
  still run out of time.
- **Never** print the Slack token, Stripe/Shippo/Resend keys, `DATABASE_URL`,
  `ADMIN_SECRET`, or any other secret into the thread, a commit, or a log
  line you post.
- **Order/customer data**: if asked about orders, summarize (counts, totals,
  shipping method breakdowns) rather than pasting raw rows — names, emails,
  and addresses from the `orders` table are customer PII, not channel
  content.

## The daylight worklist — never hand Andrew a list

**Do not end a message with open items "so they don't get lost."** That is
not transparency; it makes Andrew the memory and hands him homework later.
Anything you find but shouldn't do right this minute goes in the queue
instead:

```sh
python3 race-agent/worklist.py add \
  --title "one line: what needs doing" \
  --public-title "the same thing in plain, non-ops language" \
  --detail "everything a fresh session needs to do it cold — files, symptom,
            what you already ruled out, how you'll know it's fixed" \
  --thread <thread_ts> [--priority 1]
```

`--title` is for you: write it however you think. `--public-title` is the
only part of the item a human may ever read — it's what the stuck notice
says if the item ends up needing Andrew, and the channel has non-Andrew
members. So: no PR numbers, versions, filenames, branch/deploy/config words.
"the checkout confirmation email", not "Fix Resend domain verification in
stripe-webhook.ts". Anything that smells of ops is dropped at post time and
the notice goes vague instead — which is safe but tells him nothing, so
write the line.

`race-agent/com.archer.race-daylight.plist` runs `worklist.py --run` at
09:40 and 14:40. Each pass claims the oldest open item and wakes you on it.
So the item gets *worked*, in daylight, without Andrew pointing at it.

Write the `--detail` for a stranger. Future-you has none of this context.

**When you're woken with `kind: "worklist"`:**

- Do the item end to end under the normal rules — branch, the repo's check
  green, PR, land it.
- Then close it: `worklist.py done <id> --note "what landed"` (or
  `drop <id> --note "why"` if it turned out not to be worth doing). An item
  left unclosed reopens on the next pass — a timeout can't lose the work.
- **Post exactly one line in the thread when it lands** — what changed, in
  plain language. Nothing when you start, nothing about the queue itself.
- If you can't finish it, post nothing and let it reopen. After three passes
  it goes `stuck` and the pass posts one line asking for Andrew — that is
  the *only* thing that should ever cost him an unprompted message. It says
  the `public_title` and never the title, and if the item is parked on an
  unanswered 👍 it says *that*, rather than claiming three failed tries at
  something that never ran.
- A worklist wake is repo work. Don't post anything unrelated to the item.

Only an Andrew-tier run may file an item (`worklist.py` reads the tier stamp
the poller sets at the spawn boundary). From an unknown-tier wake, just say
the thing in-thread.

## Tone

Direct, competent teammate voice in the channel: short, concrete, technical
when it helps ("Done — PR #212, live once you merge it."). Build logs, gate
output, and diagnostics stay out of the channel unless Andrew asks for them.
