# Playtest-driven gameplay fork tournament

Reusable `/goal` prompt + harness spec for finding a rules fork of Space Race that
feels **more compelling than the Mille Bornes clone** — more agency, fewer stuck
turns, earlier/more frequent momentum swings — without losing the kid-first,
word-free, icon/motion/color readability bar.

Run one fork (or one A/B pair) per loop. Each fork is a **candidate to replace the
clone**, never auto-merged to `main`.

---

## The problem to solve

The current game is a faithful Mille Bornes ("melee-born") clone. It feels like
parity for too long: players sit at rough equality until the very late game, and a
player can get permanently **stuck** (dead hand / blocked lane / nothing useful to
draw) with no agency to dig out. Find a rules fork that makes the game feel like
**YOU drive the outcome**.

This goal **deliberately changes game rules** — unlike every prior loop, you MAY
and WILL edit `web/src/game/engine.ts`, `cards.ts`, and `ai.ts`. But:

- Each fork lives in its **own git worktree / branch** `fork/<name>`. NEVER merge a
  fork to `main`. `main` stays the current clone until the owner picks a winner.
- Every fork must keep `web/scripts/sim.ts` **green**: games terminate, card
  conservation holds (adjust the expected total if you add/remove cards), no
  invariant throws.
- **Teach the AI (`ai.ts`)** each fork's new options, or the playtest is
  meaningless — it'd play the new mechanic as if it doesn't exist.

---

## The forks to test

**Group A (owner's):**

- **A1 Structured multi-pile draw** — separate Mileage / Remedy / Hazard decks;
  draw from the one matching your need.
- **A2 Priced draw** — a cheaper general deck vs a pricier "targeted" deck with a
  much higher chance of the card you need (pay tempo for relevance).
- **A3 Composition splits** — one pile = remedy+hazard+safety, another = pure
  mileage; OR one = pure mileage, one = mileage+safeties.
- **A4 Discard-fan draw** — discard pile is fanned; draw from the last ~3 discards
  instead of blind off the deck.
- **A5 Self-healing hazards** — hazards auto-expire after N turns (the block
  recovers itself); you're never permanently stuck on a lane. *(Owner is keen on
  this "change the hazard lanes" direction.)*

**Group B (designed for this goal):**

- **B1 Scry / peek-and-pick** — on draw, reveal the top 2–3 of the deck and choose
  one. Pure agency, no composition change. Cleanest anti-"stuck" lever.
- **B2 Mulligan economy** — spend a turn to ditch K cards and draw K fresh.
- **B3 Catch-up valve (rubber band)** — the trailing player gets an edge (extra
  draw / richer pile). Attacks "parity till late" from the loser's side. Tune hard
  so it doesn't erase skill; A/B against B4.
- **B4 Momentum / breakaway meter** — a banked resource (consecutive clean miles,
  coups, safeties) you SPEND for a burst: double distance, free remedy, guaranteed
  targeted draw. Rewards pressing a lead.
- **B5 Open river draft** — 3 shared face-up cards; draw one, it refills. Visible,
  contested draws.
- **B6 Hazard-as-currency** — convert an unwanted hazard in hand into a token you
  spend to buy a targeted draw or cancel an incoming hazard.

Per loop, take **ONE** fork (or one tightly-related A/B pair like B3 vs B4) to a
polished, tuned, AI-aware, playable state. Don't half-build six.

---

## Two-tier playtest harness (build once, reuse every loop)

### Tier 1 — quantitative, fast, cheap (extend `web/scripts/sim.ts`)

Run a few hundred AI-vs-AI games per fork **and on the baseline clone**, emit
metrics that operationalize the complaint. **Measure each fork against a baseline
captured by the same harness** (self-normalized — sidesteps cross-harness drift):

- **decided turn** — the turn after which the eventual winner never lost the lead.
  Proxy for "parity until late." Want EARLIER and more varied.
- **lead changes / game** — dynamism / swinginess.
- **stuck-turn %** — turns where a player had no useful play and was forced to
  discard/pass. Agency killer. Want LOWER.
- **live-choice %** — turns with >1 genuinely useful legal move. Agency. Want HIGHER.
- **comeback rate** — fraction of games won from a meaningful deficit.
- **game-length distribution + variance** — too short = swingy noise, too long =
  grind.

Report a fork-vs-baseline table.

### Tier 2 — qualitative, the watching agent (the heart of this)

Spin up the dev server and **play the fork in a real browser, human-vs-AI** — you
take the human seat. Narrate **first-person, in the moment**, what a player
actually sees and feels ("finally had a real choice — felt good" / "three turns
blocked, tuned out" / "AI swung it back, didn't see that coming"). Play several
full games per fork. Then score 1–5 + prose on:

- **Agency** — do my choices drive the outcome?
- **Anti-stuck** — can I always do something to improve my position?
- **Dynamism / swing** — does the lead move? stay tense?
- **Engagement vs rote** — invigorating, or routine/mechanical?
- **Parity curve** — still deadlocked until the end?
- **Readability** — legible to a 5-year-old non-reader (icon/color/motion, no words
  on the play surface)?

Also propose **UI/interface** changes that make the fork feel fresh — what should
the multi-pile / river / meter / scry actually LOOK and FEEL like (prototype if
cheap). A great mechanic with an illegible UI fails the kid-readability bar.

---

## Converge, don't just sample

Per fork, form an opinion of its **ideal** version, then ITERATE toward it (tune
numbers, fix the AI, refine the UI), re-run both tiers, and assess: did this
iteration fully enact the changes wanted? Close the loop until the fork is the best
version of itself.

---

## Per-fork deliverable

A self-contained candidate that could **replace** the clone:

- `fork/<name>` branch, `sim.ts` green, AI fork-aware, UI legible.
- `web/docs/forks/<name>.md`: Tier-1 metric table vs baseline, Tier-2 first-person
  playtest log + rubric scores, UI direction, and a blunt verdict — is this MORE
  FUN than the clone, and why?
- Update `web/docs/forks/LEADERBOARD.md` — ranking every fork tested so far.

End state: one or more forks that are clear, defensible candidates to become the new
default — a **better** game than the clone, not just a different one.

---

## Constraints & coordination

- Keep the kid-first, word-free, icon/motion/color readability bar (see auto-memory
  `mtga-overhaul-goal`, `space-race-web-game`). A mechanic you can't explain to a
  non-reader through visuals is disqualified.
- **One agent per worktree; forks in separate worktrees.** Two agents in the shared
  tree previously caused a duplicate-PR + HEAD-switch clobber.
- **Parallel browser testing:** each agent uses a **distinct vite port** and its
  **own** Chrome instance/profile. Do NOT `pkill` the shared `chrome-devtools` MCP
  server (an over-broad pkill killed it for the whole session). Prefer launching
  your own Chrome with a unique `--remote-debugging-port` + `--user-data-dir` and
  driving it over CDP.
- Card-art changes are deferred — the owner is happy to iterate art later once the
  gameplay direction is felt out. Do NOT block a fork on new art; reuse existing
  art / CSS / SVG for any new UI.
- Be honest in the playtest log. A boring or broken fork ranks low — a negative
  result is a real result.
