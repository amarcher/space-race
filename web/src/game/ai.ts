// Greedy heuristic AI. Scores every legal move and plays the best one.
// Priority falls out of the numbers: win > keep moving > unblock > attack a
// rolling opponent > discard the most useless card. Safeties are hoarded for
// Counter-Thrusts (revealed automatically by the engine) rather than spent.

import { MAX_200_PER_PLAYER, WIN_DISTANCE, defOf, type CardDef, type CardInstance } from './cards'
import {
  activeHazard,
  canAttack,
  hazardsOn,
  isTrailing,
  legalMoves,
  speedLimited,
  SPEED_LIMIT_VALUE,
  type GameState,
  type Move,
  type PlayerState,
} from './engine'

/** How many distance cards this player could legally PLAY right now (respecting
 * the launch / block / speed-limit / 200-cap rules). Drives the momentum BURST
 * decision: the AI only spends its meter when it can chain a real double-jump. */
function playableDistanceCount(p: PlayerState): number {
  if (!p.started || activeHazard(p) !== null) return 0
  const slow = speedLimited(p)
  let n = 0
  for (const c of p.hand) {
    const def = defOf(c)
    if (def.type !== 'distance') continue
    const v = def.value ?? 0
    if (slow && v > SPEED_LIMIT_VALUE) continue
    if (v === 200 && p.count200 >= MAX_200_PER_PLAYER) continue
    n++
  }
  return n
}

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
  if (state.phase === 'scry') return chooseScry(state, moves)
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

/** SCRY: pick the revealed card that best fixes my situation right now. */
function chooseScry(state: GameState, moves: Move[]): Move {
  const me = state.players[state.turn]
  let best = moves[0]
  let bestScore = -Infinity
  for (const mv of moves) {
    if (mv.type !== 'pick') continue
    const card = (state.scry ?? []).find((c) => c.uid === mv.uid)
    if (!card) continue
    const score = scryValue(state, me, defOf(card))
    if (score > bestScore) {
      bestScore = score
      best = mv
    }
  }
  return best
}

/** How badly the current player wants to draw this exact card, given the board.
 * This is what makes scry feel smart: take the launch when stalled, the remedy
 * when blocked, the safety always, big mileage when rolling. */
function scryValue(state: GameState, me: PlayerState, def: CardDef): number {
  const opp = state.players[me.seat === 0 ? 1 : 0]
  const myHazards = hazardsOn(me) // every un-remedied hazard on me (incl. speed limit)
  const blocked = activeHazard(me) // a hard block (collision/fuel/engine/stop)
  const slow = speedLimited(me)
  const haveGo = me.hand.some((c) => defOf(c).isGo)
  const remaining = WIN_DISTANCE - me.distance

  switch (def.type) {
    case 'safety':
      // Permanent immunity + 100 ly + Slingshot potential. Always the top grab,
      // even more so if it covers a hazard sitting on me right now.
      return 100 + ((def.immuneTo ?? []).some((h) => myHazards.includes(h)) ? 30 : 0)

    case 'remedy': {
      // The launch card when I haven't started, or a Black-Hole clear.
      if (def.isGo) {
        if (!me.started) return haveGo ? 30 : 95 // need it to move at all
        if (blocked === 'black-hole') return 92 // dig out of a full stop
        return 28 // nice to bank, but I can already move
      }
      // A remedy I need to clear a hazard on me right now is huge — it's the
      // difference between rolling and being stuck.
      if (def.fixes != null && myHazards.includes(def.fixes)) {
        // clearing a hard block is worth more than lifting a speed limit
        return def.fixes === 'tractor-beam' ? 78 : 88
      }
      // Hold-for-later remedy: mild value (insurance against future hazards).
      return 24
    }

    case 'distance': {
      const v = def.value ?? 0
      // If I'm blocked or unlaunched, raw mileage does nothing this turn — I'd
      // rather have dug out. Down-weight it unless nothing else helps.
      if (!me.started || blocked) return 20 + v * 0.02
      // Can't bank a 3rd 200 — near-worthless.
      if (v === 200 && me.count200 >= MAX_200_PER_PLAYER) return 8
      // Under a speed limit only small hops are legal, so big cards stall.
      if (slow && v > SPEED_LIMIT_VALUE) return 22 + v * 0.02
      // Exact finisher? grab it. Otherwise prefer mileage that fits what's left.
      if (v >= remaining) return 90
      const overshoot = Math.max(0, v - remaining)
      return 40 + v * 0.18 - overshoot * 0.1
    }

    case 'hazard': {
      // Offense: worth most when the opponent is rolling and I can actually land
      // it. A hazard I can't play (opp blocked/immune) is dead weight to hold.
      const landable = canAttack(opp, def.kind)
      if (!landable) return 12
      const oppThreat = opp.distance >= 600 ? 14 : opp.started ? 8 : 2
      return 30 + (HAZARD_WEIGHT[def.kind] ?? 10) * 0.4 + oppThreat
    }
  }
  return 10
}

/** Take the top of the discard pile when it's clearly worth grabbing. */
function chooseDraw(state: GameState, moves: Move[]): Move {
  const fromDiscard = moves.find((m) => m.type === 'draw' && m.source === 'discard')
  const top = state.discard[state.discard.length - 1]
  if (fromDiscard && top) {
    const me = state.players[state.turn]
    const def = defOf(top)
    const need = hazardsOn(me) // all lanes, including a Tractor Beam throttle
    // Don't grab a remedy we can already cover from hand — better to draw blind.
    const haveFix = me.hand.some((c) => defOf(c).fixes != null && defOf(c).fixes === def.fixes)
    const haveGo = me.hand.some((c) => defOf(c).isGo)
    const worthIt =
      def.type === 'safety' || // never pass up a safety
      (def.type === 'remedy' && def.isGo && !me.started && !haveGo) || // grab Ignition to launch
      (def.type === 'remedy' && def.fixes != null && need.includes(def.fixes) && !haveFix) // the exact remedy we need, any lane
    // CATCH-UP VALVE: when trailing, a deck draw opens the valve (a peek-and-pick),
    // which is usually better than a single forced discard card — so only snatch
    // the discard when it's a safety (irreplaceable) or the launch we lack.
    if (worthIt) {
      if (isTrailing(state, me.seat)) {
        const mustGrab = def.type === 'safety' || (def.type === 'remedy' && def.isGo && !me.started && !haveGo)
        if (!mustGrab) return moves[0] // take the deck draw to open the valve instead
      }
      return fromDiscard
    }
  }
  return moves[0] // deck
}

function scoreMove(state: GameState, me: PlayerState, mv: Move): number {
  if (mv.type === 'pass') return -1000
  if (mv.type === 'draw') return 0

  if (mv.type === 'burst') {
    // MOMENTUM: spend the full meter only when it buys a REAL double-jump — i.e.
    // there are ≥2 playable distance cards to chain (one for the bonus hop, one
    // for the normal play). Score it just above a single distance play so the AI
    // bursts first, then plays both hops. With <2 distances it's not worth the
    // reset, so we score it below a plain distance play (the AI just hops once).
    const n = playableDistanceCount(me)
    if (n >= 2) return 160 // beats any single distance (max ~150) → press the lead
    return -50 // not a real swing right now; prefer the ordinary distance play
  }

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

/** How much the AI wants to keep a card (drives discard choice). Higher = hold. */
function keepValue(state: GameState, me: PlayerState, uid: string): number {
  const def = defOf(cardOf(me, uid))
  const opp = state.players[me.seat === 0 ? 1 : 0]
  const myHazards = hazardsOn(me)
  let v: number
  switch (def.type) {
    case 'safety':
      v = 100
      break
    case 'distance': {
      const dv = def.value ?? 0
      if (dv === 200 && me.count200 >= 2) v = 1 // can't play a 3rd 200 — dump it
      else v = 5 + dv * 0.05
      break
    }
    case 'remedy':
      if (def.fixes != null && myHazards.includes(def.fixes)) v = 12 // clears a hazard on me right now
      else if (def.isGo) v = me.started ? 3 : 9
      else v = 6
      break
    case 'hazard':
      v = canAttack(opp, def.kind) ? 7 : 1
      break
    default:
      v = 2
  }
  // Don't feed the opponent: whatever we discard lands face-up on top of the pile
  // for them to grab next turn. Hold cards that would immediately help them.
  return v + denyBonus(opp, def)
}

/** Extra reluctance to discard a card the opponent could pick up and use right away. */
function denyBonus(opp: PlayerState, def: CardDef): number {
  if (opp.distance >= WIN_DISTANCE) return 0
  switch (def.type) {
    case 'remedy':
      if (def.isGo && !opp.started) return 6 // would hand them their launch
      if (def.fixes != null && hazardsOn(opp).includes(def.fixes)) return 6 // would unblock them
      return 0
    case 'distance':
      return opp.started ? 1 : 0 // a moving opponent always welcomes free mileage
    default:
      return 0 // safeties they already can't be handed; hazards don't help them advance
  }
}
