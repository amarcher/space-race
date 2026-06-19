// Greedy heuristic AI. Scores every legal move and plays the best one.
// Priority falls out of the numbers: win > keep moving > unblock > attack a
// rolling opponent > discard the most useless card. Safeties are hoarded for
// Counter-Thrusts (revealed automatically by the engine) rather than spent.

import { WIN_DISTANCE, defOf, type CardInstance } from './cards'
import { activeHazard, canAttack, legalMoves, type GameState, type Move, type PlayerState } from './engine'

const HAZARD_WEIGHT: Record<string, number> = {
  'black-hole': 28,
  'tractor-beam': 22,
  'busted-thruster': 14,
  'empty-tank': 14,
  'asteroid-strike': 12,
}

export function chooseMove(state: GameState): Move | null {
  const moves = legalMoves(state)
  if (moves.length === 0) return null
  if (state.phase === 'draw') return chooseDraw(state, moves)

  const me = state.players[state.turn]
  let best: Move | null = null
  let bestScore = -Infinity
  for (const mv of moves) {
    const score = scoreMove(state, me, mv)
    if (score > bestScore) {
      bestScore = score
      best = mv
    }
  }
  return best
}

function cardOf(me: PlayerState, uid: string): CardInstance {
  return me.hand.find((c) => c.uid === uid)!
}

/** Take the top of the discard pile when it's clearly worth grabbing. */
function chooseDraw(state: GameState, moves: Move[]): Move {
  const fromDiscard = moves.find((m) => m.type === 'draw' && m.source === 'discard')
  const top = state.discard[state.discard.length - 1]
  if (fromDiscard && top) {
    const me = state.players[state.turn]
    const def = defOf(top)
    const hzr = activeHazard(me)
    const worthIt =
      def.type === 'safety' || // never pass up a safety
      (def.type === 'remedy' && def.isGo && !me.started) || // grab Ignition to launch
      (def.type === 'remedy' && hzr != null && def.fixes === hzr) // the exact remedy we need
    if (worthIt) return fromDiscard
  }
  return moves[0] // deck
}

function scoreMove(state: GameState, me: PlayerState, mv: Move): number {
  if (mv.type === 'pass') return -1000
  if (mv.type === 'draw') return 0

  const def = defOf(cardOf(me, mv.uid))
  const hzr = activeHazard(me)

  if (mv.type === 'discard') {
    // less useful card -> higher (less negative) discard score
    return -100 - keepValue(state, me, mv.uid)
  }

  switch (def.type) {
    case 'distance': {
      const v = def.value ?? 0
      if (me.distance + v >= WIN_DISTANCE) return 1000 // winning move
      return 50 + v * 0.5
    }
    case 'remedy': {
      if (def.isGo) return me.started ? 75 : 80 // clear a Black Hole, or launch
      return 72 // legal only when it clears an active hazard/speed-limit in its lane
    }
    case 'safety': {
      if (hzr && (def.immuneTo ?? []).includes(hzr)) return 65 // unblock via safety when no remedy
      return 18 // otherwise low priority — bank the mileage only when idle (hold for a Slingshot)
    }
    case 'hazard':
      return 40 + (HAZARD_WEIGHT[def.kind] ?? 10)
  }
  return 0
}

/** How much the AI wants to keep a card (drives discard choice). */
function keepValue(state: GameState, me: PlayerState, uid: string): number {
  const def = defOf(cardOf(me, uid))
  const hzr = activeHazard(me)
  switch (def.type) {
    case 'safety':
      return 100
    case 'distance': {
      const v = def.value ?? 0
      if (v === 200 && me.count200 >= 2) return 1 // can't play a 3rd 200 — dump it
      return 5 + v * 0.05
    }
    case 'remedy':
      if (def.isGo) return me.started ? (hzr === 'black-hole' ? 9 : 3) : 9
      return 6
    case 'hazard': {
      const opp = state.players[me.seat === 0 ? 1 : 0]
      return canAttack(opp, def.kind) ? 7 : 1
    }
  }
  return 2
}
