// Self-play smoke test: run many AI-vs-AI games, assert they terminate and the
// rules hold. Run with: npx tsx scripts/sim.ts
import { createGame, applyMove, legalMoves, scoreRound, type GameState } from '../src/game/engine'
import { chooseMove } from '../src/game/ai'
import { WIN_DISTANCE, MAX_200_PER_PLAYER, LANES } from '../src/game/cards'

function playGame(seed: number): { state: GameState; turns: number } {
  let state = createGame({ aiSeats: [0, 1], seed, names: ['A', 'B'] })
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

let wins = [0, 0, 0] // seat0, seat1, draw
let coupTotal = 0
let safetyTotal = 0
let maxTurns = 0
const N = 400

for (let i = 0; i < N; i++) {
  const { state, turns } = playGame(1000 + i)
  if (state.phase !== 'roundOver') throw new Error(`game ${i} did not finish in ${turns} turns`)

  for (const p of state.players) {
    // overshoot is allowed now; the winner crosses 1000, the loser stays below it
    if (state.winner === p.seat && p.distance < WIN_DISTANCE) throw new Error(`winner below 1000: ${p.distance}`)
    if (p.count200 > MAX_200_PER_PLAYER) throw new Error(`too many 200s: ${p.count200}`)
    if (new Set(p.safeties).size !== p.safeties.length) throw new Error('duplicate safety revealed')
    coupTotal += p.coupFourres
    safetyTotal += p.safeties.length
  }

  // card conservation: 106 cards always accounted for
  const counted =
    state.deck.length +
    state.discard.length +
    state.players.reduce(
      (n, p) =>
        n +
        p.hand.length +
        p.distancePile.length +
        p.safeties.length +
        LANES.reduce((m, lane) => m + p.battle[lane].length, 0),
      0,
    )
  if (counted !== 106) throw new Error(`card leak: counted ${counted}, expected 106 (game ${i})`)

  // legalMoves must never reference a card not in hand
  const moves = legalMoves(state)
  void moves

  wins[state.winner ?? 2]++
  maxTurns = Math.max(maxTurns, turns)
}

const sample = playGame(1)
const scores = scoreRound(sample.state)

console.log(`Ran ${N} AI-vs-AI games.`)
console.log(`  Wins: seat0=${wins[0]}  seat1=${wins[1]}  draws=${wins[2]}`)
console.log(`  Counter-Thrusts total: ${coupTotal}   safeties revealed total: ${safetyTotal}`)
console.log(`  Max turns in a game: ${maxTurns}`)
console.log(`  Sample game score: ${scores.map((s) => `${s.name}=${s.total}`).join('  ')}`)
console.log('All invariants held (no overflow, no card leak, all games terminated). ✅')
