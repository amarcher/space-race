// Greedy heuristic AI. Scores every legal move and plays the best one.
// Priority falls out of the numbers: win > keep moving > unblock > attack a
// rolling opponent > discard the most useless card. Safeties are hoarded for
// Counter-Thrusts (revealed automatically by the engine) rather than spent.

import { CARD_DEFS, MAX_200_PER_PLAYER, WIN_DISTANCE, defOf, type CardDef, type CardInstance } from './cards'
import {
  activeHazard,
  canAttack,
  canHop,
  hazardsOn,
  hazardTurnsLeft,
  isTrailing,
  legalMoves,
  speedLimited,
  SPEED_LIMIT_VALUE,
  type GameState,
  type Move,
  type PlayerState,
} from './engine'

/** SELF-HEAL-aware: turns left until the block this remedy would `fix` recovers on
 * its own (null if self-heal is off / it isn't a self-healing blocking lane). Lets
 * the AI avoid wasting a remedy/draw on a block that's about to clear anyway. */
function selfHealTurnsForRemedy(state: GameState, p: PlayerState, def: CardDef): number | null {
  if (!state.rules.selfHeal || def.fixes == null) return null
  const lane = CARD_DEFS[def.fixes]?.lane
  if (!lane) return null
  return hazardTurnsLeft(state.rules.selfHeal, p, lane)
}

/** How many distance cards this player could legally PLAY right now (respecting
 * the launch / block / speed-limit / 200-cap rules). Drives the momentum BURST
 * decision: the AI only spends its meter when it can chain a real double-jump. */
function playableDistanceCount(p: PlayerState, exactFinish: boolean): number {
  if (!p.started || activeHazard(p) !== null) return 0
  let n = 0
  for (const c of p.hand) {
    const def = defOf(c)
    if (def.type === 'distance' && canHop(p, def.value ?? 0, exactFinish)) n++
  }
  return n
}

/** PRECISION APPROACH: would playing `uid` strand us just short of the line?
 *
 * This is the skill the exact-finish mode is really about. Only the SHORT tail
 * matters: leaving a gap of 200+ is fine (plenty of draws left to cover it), but
 * closing to a 25/50/75 gap you hold no small card for means idling at the
 * threshold, discarding 100s, while the rival flies past. */
function strandsFinish(me: PlayerState, uid: string, played: number): boolean {
  const left = WIN_DISTANCE - me.distance - played
  if (left <= 0 || left >= 200) return false
  return !me.hand.some((c) => {
    if (c.uid === uid) return false // this is the card we're spending
    const def = defOf(c)
    return def.type === 'distance' && (def.value ?? 0) <= left
  })
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
      // PRECISION APPROACH: the landing card is the prize and anything bigger
      // than the gap is literally unplayable from here — never spend a pick on it.
      if (state.rules.exactFinish) {
        if (v === remaining) return 96
        if (v > remaining) return 6
        return 40 + v * 0.18
      }
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
    // SELF-HEAL: don't spend a draw grabbing a remedy for a block that recovers on
    // its own next turn anyway — better to draw blind for something with a future.
    const healTL = selfHealTurnsForRemedy(state, me, def)
    const aboutToHeal = healTL != null && healTL <= 1
    const worthIt =
      def.type === 'safety' || // never pass up a safety
      (def.type === 'remedy' && def.isGo && !me.started && !haveGo) || // grab Ignition to launch
      (def.type === 'remedy' && def.fixes != null && need.includes(def.fixes) && !haveFix && !aboutToHeal) // the exact remedy we need, any lane
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
    const n = playableDistanceCount(me, state.rules.exactFinish)
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
      let score = 50 + v * 0.5
      // PRECISION APPROACH: a hop that closes the gap to something we can't land
      // on is worse than a shorter one that keeps the approach open.
      if (state.rules.exactFinish && strandsFinish(me, mv.uid, v)) score -= 28
      // NAVIGATOR'S LEDGER: burning a hyperwarp forfeits the Safe Trip bonus, so
      // once the finish is realistically in reach a 200 costs more than it gains.
      if (state.rules.ledgerScoring && v === 200 && me.count200 === 0 && me.distance >= 500) score -= 32
      return score
    }
    case 'remedy': {
      if (def.isGo) return me.started ? 75 : 80 // clear a Black Hole, or launch
      return 72 // legal only when it clears an active hazard/speed-limit in its lane
    }
    case 'safety': {
      if (hzr && (def.immuneTo ?? []).includes(hzr)) return 65 // unblock via safety when no remedy
      // Otherwise low priority — hold for a Slingshot. In the LEDGER the reveal
      // wins no ground at all (it's pure points, banked either way), so there's
      // even less reason to cash it early and forfeit the doubling.
      return state.rules.ledgerScoring ? 10 : 18
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
      const gap = WIN_DISTANCE - me.distance
      if (dv === 200 && me.count200 >= MAX_200_PER_PLAYER) v = 1 // can't play a 3rd 200 — dump it
      // PRECISION APPROACH: a card bigger than the gap can NEVER be played again
      // this round — it's the first thing to throw. Conversely the short hops are
      // the landing gear: once the line is in sight, hoard them.
      else if (state.rules.exactFinish && dv > gap) v = 0
      else if (state.rules.exactFinish && dv <= SPEED_LIMIT_VALUE && gap <= 300) v = 16
      else v = 5 + dv * 0.05
      break
    }
    case 'remedy': {
      const healTL = selfHealTurnsForRemedy(state, me, def)
      if (def.fixes != null && myHazards.includes(def.fixes)) {
        // Clears a hazard on me right now — but worth less to hoard if that block
        // is about to recover on its own (the remedy then saves fewer turns).
        v = healTL != null && healTL <= 1 ? 7 : 12
      } else if (def.isGo) v = me.started ? 3 : 9
      else v = 6
      break
    }
    case 'hazard':
      v = canAttack(opp, def.kind) ? 7 : 1
      break
    default:
      v = 2
  }
  // Don't feed the opponent: whatever we discard lands face-up on top of the pile
  // for them to grab next turn. Hold cards that would immediately help them.
  return v + denyBonus(opp, def, state.rules.exactFinish)
}

/** Extra reluctance to discard a card the opponent could pick up and use right away. */
function denyBonus(opp: PlayerState, def: CardDef, exactFinish: boolean): number {
  if (opp.distance >= WIN_DISTANCE) return 0
  switch (def.type) {
    case 'remedy':
      if (def.isGo && !opp.started) return 6 // would hand them their launch
      if (def.fixes != null && hazardsOn(opp).includes(def.fixes)) return 6 // would unblock them
      return 0
    case 'distance': {
      // PRECISION APPROACH: mileage they can't legally land is no gift at all —
      // and a card that exactly fills their gap is the last thing to hand them.
      if (exactFinish) {
        const gap = WIN_DISTANCE - opp.distance
        const dv = def.value ?? 0
        if (dv > gap) return 0
        if (dv === gap) return 8
      }
      return opp.started ? 1 : 0 // a moving opponent always welcomes free mileage
    }
    default:
      return 0 // safeties they already can't be handed; hazards don't help them advance
  }
}
