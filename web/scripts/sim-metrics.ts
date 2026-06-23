// Tier-1 quantitative harness for the gameplay-mode tournament.
//
// Runs a few hundred AI-vs-AI games per mode and emits the SWING metrics that
// operationalize the "parity until late / no momentum" complaint, so each mode
// is measured against the classic baseline captured by the SAME harness
// (self-normalized). Modes are selected via GameRules (the post-framework API) —
// the exact same binary produces every mode's numbers.
//
//   npx tsx scripts/sim-metrics.ts
//
// Reports, per mode: game length, decided-turn, lead-changes/game, comeback
// rate, plus a winrate sanity check — momentum vs classic side by side.
import { createGame, applyMove, type GameState } from '../src/game/engine'
import { chooseMove } from '../src/game/ai'
import { type GameRules } from '../src/game/rules'
import { WIN_DISTANCE } from '../src/game/cards'

const N = Number(process.env.N ?? 500)
const SEED0 = 1000

interface GameMetrics {
  turns: number
  winner: number | null
  winnerDistance: number
  loserDistance: number
  decidedTurn: number // ply after which the eventual winner never trailed again
  leadChanges: number
  comeback: boolean // winner was ever behind by >=200 ly after the opening
  bursts: number // MOMENTUM: breakaways spent across the game
}

function leader(state: GameState): number | null {
  const [a, b] = state.players
  if (a.distance === b.distance) return null
  return a.distance > b.distance ? 0 : 1
}

function playGame(seed: number, rules?: Partial<GameRules>): GameMetrics {
  let state = createGame({ aiSeats: [0, 1], seed, names: ['A', 'B'], rules })
  let turns = 0
  const MAX = 5000

  let leadChanges = 0
  let lastLeader: number | null = null
  let bursts = 0
  const leaderTrail: Array<{ ply: number; leader: number | null }> = []
  const maxDeficit = [0, 0]

  while (state.phase !== 'roundOver' && turns < MAX) {
    const mv = chooseMove(state)
    if (mv?.type === 'burst') bursts++
    state = mv ? applyMove(state, mv) : applyMove(state, { type: 'pass' })
    turns++

    const ld = leader(state)
    if (ld !== null && lastLeader !== null && ld !== lastLeader) leadChanges++
    if (ld !== null) lastLeader = ld
    leaderTrail.push({ ply: turns, leader: ld })

    if (turns > 6) {
      const [a, b] = state.players
      maxDeficit[0] = Math.max(maxDeficit[0], b.distance - a.distance)
      maxDeficit[1] = Math.max(maxDeficit[1], a.distance - b.distance)
    }
  }

  const winner = state.winner
  // decided-turn: the last ply at which the eventual winner was NOT the leader
  // (trailed or tied). The race "locks in" right after that ply. Led wire-to-wire ⇒ 0.
  let decidedTurn = 0
  if (winner !== null) {
    for (const { ply, leader: ld } of leaderTrail) {
      if (ld !== winner) decidedTurn = ply
    }
  }
  const comeback = winner !== null && maxDeficit[winner] >= 200

  return {
    turns,
    winner,
    winnerDistance: winner !== null ? state.players[winner].distance : 0,
    loserDistance: winner !== null ? state.players[winner === 0 ? 1 : 0].distance : 0,
    decidedTurn,
    leadChanges,
    comeback,
    bursts,
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function stdev(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

interface ModeAgg {
  label: string
  length: number
  decided: number
  decidedFrac: number
  leadCh: number
  comeback: string
  winrate: string
  draws: number
  bursts: number
}

function runMode(label: string, rules: Partial<GameRules> | undefined): ModeAgg {
  const games: GameMetrics[] = []
  for (let i = 0; i < N; i++) games.push(playGame(SEED0 + i, rules))

  const lengths = games.map((g) => g.turns)
  const decided = games.map((g) => g.decidedTurn)
  const decidedFrac = games.map((g) => (g.turns ? g.decidedTurn / g.turns : 0))
  const leadCh = games.map((g) => g.leadChanges)
  const comebacks = games.filter((g) => g.comeback).length
  const wins0 = games.filter((g) => g.winner === 0).length
  const draws = games.filter((g) => g.winner === null).length
  const burstsTotal = games.reduce((n, g) => n + g.bursts, 0)

  console.log(`\n=== [${label}]  N=${N} games ===`)
  console.log(`game length (ply):   mean ${mean(lengths).toFixed(1)}  sd ${stdev(lengths).toFixed(1)}  p10 ${quantile(lengths, 0.1)}  p50 ${quantile(lengths, 0.5)}  p90 ${quantile(lengths, 0.9)}`)
  console.log(`decided-turn (ply):  mean ${mean(decided).toFixed(1)}  sd ${stdev(decided).toFixed(1)}`)
  console.log(`decided-turn (frac): mean ${(100 * mean(decidedFrac)).toFixed(1)}%   (lower & more varied = later lock-in = better)`)
  console.log(`lead changes / game: mean ${mean(leadCh).toFixed(2)}  sd ${stdev(leadCh).toFixed(2)}   (HIGHER = swingier)`)
  console.log(`comeback rate:       ${pct(comebacks, games.length)}   (won from >=200 ly behind)`)
  console.log(`winrate seat0:       ${pct(wins0, games.length)}   draws ${draws}   (≈50% = balanced)`)
  console.log(`avg winner/loser ly: ${mean(games.map((g) => g.winnerDistance)).toFixed(0)} / ${mean(games.map((g) => g.loserDistance)).toFixed(0)}`)
  if (burstsTotal > 0) console.log(`breakaways spent:    ${burstsTotal} total  (${(burstsTotal / N).toFixed(2)}/game)`)

  return {
    label,
    length: mean(lengths),
    decided: mean(decided),
    decidedFrac: 100 * mean(decidedFrac),
    leadCh: mean(leadCh),
    comeback: pct(comebacks, games.length),
    winrate: pct(wins0, games.length),
    draws,
    bursts: burstsTotal,
  }
}

void WIN_DISTANCE

const classic = runMode('classic', undefined)
const scry = runMode('scry', { scry: true })
const momentum = runMode('momentum', { momentum: true })

// ---- side-by-side swing table: momentum vs classic --------------------------
console.log(`\n=== SWING TABLE — momentum vs classic baseline (N=${N}) ===`)
const rows: Array<[string, (m: ModeAgg) => string]> = [
  ['lead-changes/game', (m) => m.leadCh.toFixed(2)],
  ['comeback rate', (m) => m.comeback],
  ['decided-turn (ply)', (m) => m.decided.toFixed(1)],
  ['decided-turn (frac)', (m) => `${m.decidedFrac.toFixed(1)}%`],
  ['game length (ply)', (m) => m.length.toFixed(1)],
  ['winrate seat0', (m) => m.winrate],
]
const col = (s: string, w: number) => s.padEnd(w)
console.log(col('metric', 22) + col('classic', 12) + col('scry', 12) + col('momentum', 12))
for (const [name, get] of rows) {
  console.log(col(name, 22) + col(get(classic), 12) + col(get(scry), 12) + col(get(momentum), 12))
}
console.log(`\nmomentum breakaways: ${momentum.bursts} spent over ${N} games (${(momentum.bursts / N).toFixed(2)}/game)`)
