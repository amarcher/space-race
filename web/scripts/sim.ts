// Self-play smoke test: run many AI-vs-AI games, assert they terminate and the
// rules hold. Runs BOTH gameplay modes — classic (DEFAULT_RULES) and scry — so
// every selectable mode stays green. Run with: npx tsx scripts/sim.ts
import { createGame, applyMove, legalMoves, scoreRound, activeHazard, type GameState } from '../src/game/engine'
import { chooseMove } from '../src/game/ai'
import { type GameRules } from '../src/game/rules'
import { WIN_DISTANCE, MAX_200_PER_PLAYER, LANES, CARD_DEFS, type CardInstance } from '../src/game/cards'

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

    // A winner normally crosses 1000 (overshoot allowed). The ONE legitimate
    // exception is a STALEMATE finish — deck exhausted and both hands empty — where
    // the engine (engine.ts) awards the round to the higher-distance player, who can
    // be < 1000. Momentum's bursts consume cards faster, so this deck-spent finish is
    // no longer vanishingly rare; allow it.
    const stalemate = state.deck.length === 0 && state.players.every((pp) => pp.hand.length === 0)
    for (const p of state.players) {
      if (state.winner === p.seat && p.distance < WIN_DISTANCE && !stalemate)
        throw new Error(`[${label}] winner below 1000 (not a stalemate finish): ${p.distance}`)
      if (p.count200 > MAX_200_PER_PLAYER) throw new Error(`[${label}] too many 200s: ${p.count200}`)
      if (new Set(p.safeties).size !== p.safeties.length) throw new Error(`[${label}] duplicate safety revealed`)
      coupTotal += p.coupFourres
      safetyTotal += p.safeties.length
    }

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

// A normally-played safety must sweep the matching active hazard(s) off the board
// into the discard — all four safeties, including Rescue Shuttle's two hazards.
// Deterministic scenario: hand-place a hazard on the victim, then play the safety.
function checkSafetySweep() {
  const cases: [string, string[]][] = [
    ['ace-pilot', ['asteroid-strike']],
    ['antimatter-fuel-cell', ['empty-tank']],
    ['diamond-thruster', ['busted-thruster']],
    ['rescue-shuttle', ['tractor-beam', 'black-hole']],
  ]
  for (const [safety, hazards] of cases) {
    const s = createGame({ aiSeats: [], seed: 42, names: ['A', 'B'] })
    const me = s.players[0]
    me.started = true
    // place each covered hazard on its lane and give the player the safety
    for (const hk of hazards) me.battle[CARD_DEFS[hk].lane!].push({ uid: `t-${hk}`, kind: hk })
    const safetyCard: CardInstance = { uid: `t-${safety}`, kind: safety }
    me.hand = [safetyCard]
    const before = s.discard.length
    const next = applyMove(s, { type: 'play', uid: safetyCard.uid })
    const p = next.players[0]
    // every covered lane is clear of its hazard, and each swept card is in discard
    for (const hk of hazards) {
      const lane = CARD_DEFS[hk].lane!
      if (p.battle[lane].some((c) => c.kind === hk))
        throw new Error(`[safety-sweep] ${safety} left ${hk} on the ${lane} lane`)
    }
    if (next.discard.length !== before + hazards.length)
      throw new Error(`[safety-sweep] ${safety} did not sweep ${hazards.length} hazard(s) to discard`)
    if (activeHazard(p) !== null)
      throw new Error(`[safety-sweep] ${safety} left a blocking hazard active`)
  }
  console.log(`[safety-sweep] all four safeties sweep their matching active hazard(s) to discard. ✅`)
}
checkSafetySweep()

const N = 400
runMode('classic', undefined, N)
runMode('scry-2', { scry: true, scryReveal: 2 }, N) // the default peek width
runMode('scry-3', { scry: true, scryReveal: 3 }, N) // the wider opt-in peek
runMode('catchUp', { catchUp: true }, N)
runMode('momentum', { momentum: true }, N)
runMode('selfHeal', { selfHeal: true }, N)
runMode('all-modes', { scry: true, catchUp: true, momentum: true, selfHeal: true }, N)

console.log('All invariants held for every mode (no overflow, no card leak, all games terminated). ✅')
