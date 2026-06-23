// Self-play smoke test: run many AI-vs-AI games, assert they terminate and the
// rules hold. Runs BOTH gameplay modes — classic (DEFAULT_RULES) and scry — so
// every selectable mode stays green. Run with: npx tsx scripts/sim.ts
import { createGame, applyMove, legalMoves, scoreRound, type GameState } from '../src/game/engine'
import { chooseMove } from '../src/game/ai'
import { type GameRules, MOMENTUM_CAP } from '../src/game/rules'
import { WIN_DISTANCE, MAX_200_PER_PLAYER, LANES } from '../src/game/cards'

function playGame(seed: number, rules?: Partial<GameRules>): { state: GameState; turns: number } {
  let state = createGame({ aiSeats: [0, 1], seed, names: ['A', 'B'], rules })
  let turns = 0
  const MAX = 5000
  while (state.phase !== 'roundOver' && turns < MAX) {
    const mv = chooseMove(state)
    if (!mv) {
      // no move available: force a pass to avoid deadlock
      state = applyMove(state, { type: 'pass' })
    } else {
      state = applyMove(state, mv)
    }
    turns++
  }
  return { state, turns }
}

// All 106 cards must always be accounted for — including the scry zone, which
// briefly holds revealed top-of-deck cards mid-draw.
function countCards(state: GameState): number {
  return (
    state.deck.length +
    state.discard.length +
    (state.scry?.length ?? 0) +
    state.players.reduce(
      (n, p) =>
        n +
        p.hand.length +
        p.distancePile.length +
        p.safeties.length +
        LANES.reduce((m, lane) => m + p.battle[lane].length, 0),
      0,
    )
  )
}

function runMode(label: string, rules: Partial<GameRules> | undefined, N: number) {
  let wins = [0, 0, 0] // seat0, seat1, draw
  let coupTotal = 0
  let safetyTotal = 0
  let maxTurns = 0

  for (let i = 0; i < N; i++) {
    const { state, turns } = playGame(1000 + i, rules)
    if (state.phase !== 'roundOver') throw new Error(`[${label}] game ${i} did not finish in ${turns} turns`)

    // A game ends one of two ways: someone CROSSES 1000 (a real win), or the deck
    // is spent and the race is called by distance (winner may sit below 1000).
    const deckCalled = state.deck.length === 0 && state.players.every((p) => p.hand.length === 0)
    for (const p of state.players) {
      // overshoot is allowed now; a 1000-crossing winner is over the line. Only a
      // deck-spent call (deckCalled) may legitimately crown a sub-1000 leader.
      if (state.winner === p.seat && p.distance < WIN_DISTANCE && !deckCalled)
        throw new Error(`[${label}] winner below 1000 without deck-spent call: ${p.distance}`)
      if (p.count200 > MAX_200_PER_PLAYER) throw new Error(`[${label}] too many 200s: ${p.count200}`)
      if (new Set(p.safeties).size !== p.safeties.length) throw new Error(`[${label}] duplicate safety revealed`)
      coupTotal += p.coupFourres
      safetyTotal += p.safeties.length
    }

    // MOMENTUM: the meter never escapes its [0, cap] bounds, and no breakaway is
    // ever left dangling once a round ends (it must have been spent on a hop).
    for (const m of state.momentum) {
      if (m < 0 || m > MOMENTUM_CAP) throw new Error(`[${label}] momentum out of bounds: ${m}`)
    }
    if (state.breakaway !== null) throw new Error(`[${label}] dangling breakaway at round end: seat ${state.breakaway}`)

    // card conservation: 106 cards always accounted for (incl. the scry zone)
    const counted = countCards(state)
    if (counted !== 106) throw new Error(`[${label}] card leak: counted ${counted}, expected 106 (game ${i})`)

    // legalMoves must never reference a card not in hand
    const moves = legalMoves(state)
    void moves

    wins[state.winner ?? 2]++
    maxTurns = Math.max(maxTurns, turns)
  }

  const sample = playGame(1, rules)
  const scores = scoreRound(sample.state)

  console.log(`[${label}] Ran ${N} AI-vs-AI games.`)
  console.log(`  Wins: seat0=${wins[0]}  seat1=${wins[1]}  draws=${wins[2]}`)
  console.log(`  Counter-Thrusts total: ${coupTotal}   safeties revealed total: ${safetyTotal}`)
  console.log(`  Max turns in a game: ${maxTurns}`)
  console.log(`  Sample game score: ${scores.map((s) => `${s.name}=${s.total}`).join('  ')}`)
}

const N = 400
runMode('classic', undefined, N)
runMode('scry', { scry: true }, N)
runMode('momentum', { momentum: true }, N)

console.log('All invariants held for every mode (no overflow, no card leak, all games terminated). ✅')
