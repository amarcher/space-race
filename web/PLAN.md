# 1000 Light-Years — Web Game Plan

A browser version of *Milo's Space Race* (a Mille Bornes reskin). Built with
**Vite + React + TypeScript**. Cards are **pure full-bleed art** with rounded
corners; identity surfaces on hover/selection, never baked onto the image.

## Status

| Phase | What | State |
|---|---|---|
| 1 | Asset pipeline — artbin art → web WebP (`public/cards/`) | ✅ done |
| 2 | Scaffold (Vite/React/TS), data model, `Card`, gallery proof sheet | ✅ done |
| 3 | Game engine (pure, headless) + self-play sim (400 games, invariants hold) | ✅ done |
| 4 | AI opponent (greedy/heuristic) | ✅ done |
| 5 | Table UI — deck/discard, hand, boards, turn loop, action bar | ✅ done |
| 6 | Scoring screen + round/coup-fourré log + event toasts | ✅ done |
| 7 | (stretch) WebSocket multiplayer | ⬜ next |

Verify the engine anytime with: `npx tsx scripts/sim.ts`

Responsive: desktop fan + mobile snap-scroll hand; gallery 2-up on phones (verified).

### Done since MVP
- **Distance-card trail** on each board (overlapping mini warp cards) + animated meter.
- **Animations**: deal-in (hand), trail-in (distance), reveal-pop (safety/hazard),
  discard-pop, event toasts — all gated behind `prefers-reduced-motion`.
- **Crane drag** (`DragLayer` + `useCardDrag`): a hand card lifts off the fan and
  floats beneath the cursor with velocity-driven sway (MTG Arena feel). Pointer-based,
  replaces native DnD; tap-to-select stays as the accessible fallback. `touch-action:
  pan-x` keeps the mobile hand horizontally scrollable.
- **Pile flights** (`FlightLayer` + `useFlights`): draws (deck/discard→hand) and
  discards (hand→discard) tween between piles for both the human and the AI. The state
  commit is *deferred until the card lands* (`animateAndCommit` in `Table.tsx`), so a
  card is never in two places. Skipped under `prefers-reduced-motion` (no in-game toggle).

### Still worth polishing (post-MVP)
- **Difficulty tiers** for the AI (random / greedy / lookahead).
- Hazard **target selection** UI (trivial now at 2 players; needed for 3–4).
- Sound design.

Run: `cd web && npm install && npm run dev` → http://localhost:5180
Re-optimize art after changing `artbin/`: `npm run assets`.

## Architecture

```
web/
  scripts/build-assets.sh    artbin/*.jpg → public/cards/*.webp (720px, q82)
  public/cards/*.webp        19 faces + card-back
  src/
    game/
      cards.ts               ✅ defs, deck counts, deck builder, art URLs
      engine.ts              ⬜ pure reducer: GameState + applyMove + legalMoves
      ai.ts                  ⬜ chooseMove(state, seat) heuristic
      rng.ts                 ⬜ seeded shuffle (mulberry32) for reproducible deals
    components/
      Card.tsx / .css        ✅ full-bleed art card, hover/selected/back
      Gallery.tsx            ✅ deck proof sheet
      Table.tsx              ⬜ board: deck, discard, two tableaus, hand
      Tableau.tsx            ⬜ a player's battle/speed/distance/safety piles
      Hand.tsx               ⬜ player's hand, legal-move highlighting
    App.tsx                  ⬜ swap Gallery → Table once engine lands
```

## Game model (engine.ts)

State is a plain serializable object so it can later cross a WebSocket verbatim.

```
GameState {
  deck: CardInstance[]            // draw pile (top = end)
  discard: CardInstance[]
  players: [PlayerState, PlayerState]
  turn: 0 | 1
  phase: 'draw' | 'play' | 'roundOver'
  winner: number | null
  log: LogEntry[]
}
PlayerState {
  seat, name, isAI
  hand: CardInstance[]
  distance: number               // light-years travelled
  distancePile: CardInstance[]   // played distance cards (for display)
  started: boolean               // has played Ignition at least once
  hazard: string | null          // active hazard kind blocking movement
  safeties: string[]             // revealed safety kinds (permanent immunity)
  coupFourres: number            // counter-thrust count
  count200: number               // enforce MAX_200_PER_PLAYER
}
```

Move types: `draw`, `playDistance`, `playRemedy`, `playHazardOn(opponent)`,
`playSafety`, `discard`. `legalMoves(state)` drives both AI and UI highlighting.

### Rules to encode
- Turn = draw 1, then play-or-discard 1, then pass.
- Movement requires `started` (an Ignition played) AND `hazard === null`.
- Distance: blocked while a hazard is active; max two 200s per player; can't exceed 1000.
- Hazard onto opponent only if they lack the matching safety and aren't already hazarded;
  Black Hole also re-stops a started player.
- Remedy clears the matching hazard (Ignition clears Black Hole *and* serves as the go card).
- Safety: play anytime → permanent immunity (+100); auto-clears a matching active hazard.
- **Coup-fourré:** opponent plays your hazard while the matching safety is in your hand →
  reveal immediately, cancel the hazard, +300, draw a replacement, take initiative.
- Round ends at 1000 LY. Score: 1/LY, +100/safety, +300/coup-fourré, +400 first to 1000,
  +300 all-4-safeties. (Match play to a points target is a later extension.)

## AI (ai.ts)
Greedy heuristic priority: coup-fourré (forced) > play biggest safe distance >
remedy own hazard > play hazard on a moving opponent (prefer one they can't fix) >
play safety to bank points/clear > discard least-useful card. Add 1–2 difficulty
tiers later (random vs lookahead).

## Table UI (Table.tsx)
- Shared **deck** (face-down stack) + **discard** centre.
- Opponent tableau top, player tableau + **hand** (fanned) bottom.
- Deal animation: cards fly from deck to hands on new round.
- Click a hand card → legal targets highlight (own piles, or opponent for hazards).
- Banner/toast for hazards, remedies, safeties, and coup-fourré.
- Respect `prefers-reduced-motion`.

## WebSocket multiplayer (stretch)
Engine is already a pure reducer over serializable state. Add a thin Node `ws`
server that owns authoritative `GameState`, accepts `Move` messages, validates via
`legalMoves`, and broadcasts redacted state (hide opponent hands). Same engine runs
client-side for optimistic UI. Next.js API route or a standalone `ws` server both work.
```
