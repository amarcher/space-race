// Gameplay-mode METRICS harness — the empirical backbone of the fork tournament.
// Where sim.ts proves modes are *legal* (termination, conservation, invariants),
// this measures whether a mode is *better*: does the game stay live, swing more,
// and decide later — WITHOUT erasing skill.
//
// Run: npx tsx scripts/sim-metrics.ts            (default table: classic vs modes)
//      npx tsx scripts/sim-metrics.ts --sweep    (threshold/strength knee sweep)
//
// Two complementary lenses, because a rubber-band's whole risk is randomizing
// outcomes:
//   1. MIRROR (same AI both seats): comeback rate, lead-changes/game, decided-turn,
//      length. Self-normalized against the classic baseline run in the same harness.
//   2. SKILL (strong AI vs a deliberately weaker AI): the stronger player's
//      winrate. The valve should SOFTEN blowouts, so this dips a little — but it
//      must NOT collapse toward 50/50, or the valve has erased skill.

import { createGame, applyMove, legalMoves, type GameState, type Move } from '../src/game/engine'
import { chooseMove } from '../src/game/ai'
import { mulberry32 } from '../src/game/rng'
import { type GameRules } from '../src/game/rules'
import { WIN_DISTANCE } from '../src/game/cards'

type Picker = (state: GameState) => Move | null

/** The strong baseline player: the shipping heuristic AI. */
const strong: Picker = (s) => chooseMove(s)

/** A deliberately weaker player: most of the time it plays the heuristic move, but
 * with probability `noise` it plays a RANDOM legal move instead. This is a clean,
 * monotone skill dial — higher noise = worse play — so a strong-vs-weak matchup
 * has a known "better player" we can check the valve doesn't randomize away. */
function makeWeak(noise: number, seed: number): Picker {
  const rng = mulberry32(seed)
  return (s) => {
    const moves = legalMoves(s)
    if (moves.length === 0) return null
    if (rng() < noise) return moves[Math.floor(rng() * moves.length)]
    return chooseMove(s)
  }
}

interface GameTrace {
  winner: number | null
  turns: number
  /** per full-turn distance lead of seat0 over seat1 (sampled at each turn start) */
  leadSeries: number[]
  /** the turn index at which the eventual winner took a lead they never lost */
  decidedTurn: number
}

function playTraced(seed: number, rules: Partial<GameRules> | undefined, p0: Picker, p1: Picker): GameTrace {
  let state = createGame({ aiSeats: [0, 1], seed, names: ['A', 'B'], rules })
  let turns = 0
  const MAX = 5000
  const leadSeries: number[] = []
  // sample the lead once per "draw phase" (the start of a player's full turn)
  let lastSampledTurnOwner = -1
  while (state.phase !== 'roundOver' && turns < MAX) {
    if (state.phase === 'draw' && state.turn !== lastSampledTurnOwner) {
      leadSeries.push(state.players[0].distance - state.players[1].distance)
      lastSampledTurnOwner = state.turn
    }
    const picker = state.turn === 0 ? p0 : p1
    const mv = picker(state)
    state = applyMove(state, mv ?? { type: 'pass' })
    turns++
  }
  // final lead sample
  leadSeries.push(state.players[0].distance - state.players[1].distance)

  const winner = state.winner
  // decided-turn: last index where the lead's sign flipped to (and stayed) the
  // winner's favour. If the winner led wire-to-wire, that's turn 0; a late flip
  // means a real comeback. Expressed as a fraction of the game length so modes of
  // different lengths compare fairly.
  let decidedTurn = 0
  if (winner !== null) {
    const sign = winner === 0 ? 1 : -1
    for (let i = leadSeries.length - 1; i >= 0; i--) {
      if (Math.sign(leadSeries[i]) !== sign) {
        decidedTurn = i + 1
        break
      }
    }
  }
  return { winner, turns, leadSeries, decidedTurn }
}

/** number of times the sign of the lead changes over the game (lead changes). */
function leadChanges(series: number[]): number {
  let changes = 0
  let prevSign = 0
  for (const v of series) {
    const s = Math.sign(v)
    if (s !== 0 && prevSign !== 0 && s !== prevSign) changes++
    if (s !== 0) prevSign = s
  }
  return changes
}

/** A comeback = the eventual winner was, at some point, trailing by ≥ COMEBACK_GAP
 * light-years. (A real "I was losing and clawed back" arc, not noise.) */
const COMEBACK_GAP = 200
function wasComeback(t: GameTrace): boolean {
  if (t.winner === null) return false
  const sign = t.winner === 0 ? 1 : -1
  // winner's lead = sign * series value; trailing by ≥ gap means that's ≤ -gap
  return t.leadSeries.some((v) => sign * v <= -COMEBACK_GAP)
}

interface MirrorMetrics {
  label: string
  n: number
  comebackRate: number
  leadChangesPerGame: number
  decidedTurnFrac: number
  avgTurns: number
  seat0WinRate: number
}

function mirror(label: string, rules: Partial<GameRules> | undefined, N: number): MirrorMetrics {
  let comebacks = 0
  let leadChangeTotal = 0
  let decidedFracTotal = 0
  let turnsTotal = 0
  let seat0Wins = 0
  let decided = 0
  for (let i = 0; i < N; i++) {
    const t = playTraced(7000 + i, rules, strong, strong)
    if (wasComeback(t)) comebacks++
    leadChangeTotal += leadChanges(t.leadSeries)
    if (t.winner !== null) {
      decidedFracTotal += t.decidedTurn / Math.max(1, t.leadSeries.length - 1)
      decided++
      if (t.winner === 0) seat0Wins++
    }
    turnsTotal += t.turns
  }
  return {
    label,
    n: N,
    comebackRate: comebacks / N,
    leadChangesPerGame: leadChangeTotal / N,
    decidedTurnFrac: decidedFracTotal / Math.max(1, decided),
    avgTurns: turnsTotal / N,
    seat0WinRate: seat0Wins / Math.max(1, decided),
  }
}

/** Strong-vs-weak skill check: the stronger AI sits in BOTH seats across two halves
 * (to cancel any seat bias) facing the weaker one. Returns the strong player's
 * overall winrate. A fair game (no rubber band) ≈ baseline; a valve that softens
 * but preserves skill drops it only modestly; ~50% = the valve randomized the game. */
function skill(rules: Partial<GameRules> | undefined, N: number, noise: number): number {
  let strongWins = 0
  let decided = 0
  for (let i = 0; i < N; i++) {
    // first half: strong = seat0; second half: strong = seat1 (seat-balanced)
    const strongSeat = i < N / 2 ? 0 : 1
    const weak = makeWeak(noise, 50000 + i)
    const p0 = strongSeat === 0 ? strong : weak
    const p1 = strongSeat === 0 ? weak : strong
    const t = playTraced(9000 + i, rules, p0, p1)
    if (t.winner !== null) {
      decided++
      if (t.winner === strongSeat) strongWins++
    }
  }
  return strongWins / Math.max(1, decided)
}

function pct(x: number): string {
  return (x * 100).toFixed(1) + '%'
}

function printMirrorTable(rows: MirrorMetrics[], baseline: MirrorMetrics) {
  console.log('\n=== MIRROR (same AI both seats) — liveness/swinginess ===')
  console.log(
    ['mode', 'comeback', 'leadChg/g', 'decided@', 'avgTurns', 'seat0win'].map((s) => s.padEnd(13)).join(''),
  )
  for (const r of rows) {
    const delta = (v: number, b: number, p = false) => {
      const d = v - b
      if (Math.abs(d) < 1e-9) return ''
      const sign = d > 0 ? '+' : ''
      return ` (${sign}${p ? (d * 100).toFixed(1) + 'pt' : d.toFixed(2)})`
    }
    const cells = [
      r.label,
      pct(r.comebackRate) + (r === baseline ? '' : delta(r.comebackRate, baseline.comebackRate, true)),
      r.leadChangesPerGame.toFixed(2) + (r === baseline ? '' : delta(r.leadChangesPerGame, baseline.leadChangesPerGame)),
      r.decidedTurnFrac.toFixed(3) + (r === baseline ? '' : delta(r.decidedTurnFrac, baseline.decidedTurnFrac)),
      r.avgTurns.toFixed(1),
      pct(r.seat0WinRate),
    ]
    console.log(cells.map((s, i) => (i === 0 ? s.padEnd(13) : s.padEnd(13))).join(''))
  }
  console.log('\n  comeback↑  leadChg↑  decided@↑ (winner clinched it LATER) = livelier, less decided-early.')
  console.log('  decided@ is a FRACTION of game length (0=wire-to-wire, 1=last turn).')
}

function printSkillTable(rows: { label: string; rules: Partial<GameRules> | undefined }[], N: number) {
  console.log('\n=== SKILL (strong AI vs noisy weak AI) — winrate must NOT collapse to 50% ===')
  console.log(['mode', 'noise=15%', 'noise=30%', 'noise=50%'].map((s) => s.padEnd(13)).join(''))
  for (const r of rows) {
    const cells = [r.label, pct(skill(r.rules, N, 0.15)), pct(skill(r.rules, N, 0.3)), pct(skill(r.rules, N, 0.5))]
    console.log(cells.map((s) => s.padEnd(13)).join(''))
  }
  console.log('\n  Strong player should stay well above 50% in every mode. A drop toward 50% = valve too strong.')
}

function defaultTable() {
  const N = 600
  const SKILL_N = 400
  const modes: { label: string; rules: Partial<GameRules> | undefined }[] = [
    { label: 'classic', rules: undefined },
    { label: 'scry', rules: { scry: true } },
    { label: 'catchUp', rules: { catchUp: true } },
    { label: 'scry+catchUp', rules: { scry: true, catchUp: true } },
  ]
  const mirrorRows = modes.map((m) => mirror(m.label, m.rules, N))
  printMirrorTable(mirrorRows, mirrorRows[0])
  printSkillTable(modes, SKILL_N)
  console.log(`\n(WIN_DISTANCE=${WIN_DISTANCE}, mirror N=${N}/mode, skill N=${SKILL_N}/mode/noise)`)
}

/** Real knee sweep over the two valve tunables (deficit threshold × peek width),
 * exposed as rule overrides so we sweep WITHOUT editing the engine. For each
 * setting we print the liveness signal (comeback, lead-changes) AND the skill
 * winrate at a fixed noise — so the knee is "most liveness lift for the least
 * skill erosion". */
function sweep() {
  const N = 500
  const SKILL_N = 400
  const NOISE = 0.3
  const baseMirror = mirror('classic', undefined, N)
  const baseSkill = skill(undefined, SKILL_N, NOISE)
  console.log('\n=== CATCH-UP VALVE SWEEP (classic + valve) ===')
  console.log(`baseline classic: comeback=${pct(baseMirror.comebackRate)}  leadChg/g=${baseMirror.leadChangesPerGame.toFixed(
    2,
  )}  decided@=${baseMirror.decidedTurnFrac.toFixed(3)}  | skill@noise${NOISE * 100}=${pct(baseSkill)}`)
  console.log(
    ['deficit', 'reveal', 'comeback', 'leadChg/g', 'decided@', 'skillWin'].map((s) => s.padEnd(11)).join(''),
  )
  const deficits = [150, 200, 250, 300, 400]
  const reveals = [2, 3]
  for (const reveal of reveals) {
    for (const deficit of deficits) {
      const rules: Partial<GameRules> = { catchUp: true, catchUpDeficit: deficit, catchUpReveal: reveal }
      const m = mirror(`d${deficit}r${reveal}`, rules, N)
      const sk = skill(rules, SKILL_N, NOISE)
      const cells = [
        String(deficit),
        String(reveal),
        pct(m.comebackRate),
        m.leadChangesPerGame.toFixed(2),
        m.decidedTurnFrac.toFixed(3),
        pct(sk),
      ]
      console.log(cells.map((s) => s.padEnd(11)).join(''))
    }
  }
  console.log('\n  Knee = the row with the biggest comeback/leadChg lift whose skillWin stays well above 50%.')
  console.log(`  Shipped default: deficit=250, reveal=2.`)
}

if (process.argv.includes('--sweep')) sweep()
else defaultTable()
