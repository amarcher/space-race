// Pure, serializable game engine for 1000 Light-Years.
// No React, no DOM — just GameState + legalMoves + applyMove + scoring.
// Designed so the exact same state object can later cross a WebSocket.

import {
  CARD_DEFS,
  HAND_SIZE,
  LANES,
  MAX_200_PER_PLAYER,
  SAFETY_MILEAGE,
  SLINGSHOT_MILEAGE,
  WIN_DISTANCE,
  buildDeck,
  defOf,
  type CardDef,
  type CardInstance,
  type Lane,
} from './cards'
import { mulberry32, shuffle } from './rng'
import { MOMENTUM_CAP, resolveRules, SCRY_REVEAL, type GameRules } from './rules'

export interface PlayerState {
  seat: number
  name: string
  isAI: boolean
  hand: CardInstance[]
  distance: number
  distancePile: CardInstance[]
  started: boolean // has fired Ignition at least once (green light)
  /** per-lane stacks of played hazards/remedies/ignition — kept in front of the
   * player (cards stay in play). A remedy lands on top of the hazard it fixes. */
  battle: Record<Lane, CardInstance[]>
  safeties: string[] // revealed safety kinds (permanent immunity)
  coupFourres: number
  count200: number
}

const emptyBattle = (): Record<Lane, CardInstance[]> =>
  Object.fromEntries(LANES.map((l) => [l, []])) as unknown as Record<Lane, CardInstance[]>

export type Phase = 'draw' | 'scry' | 'play' | 'roundOver'

export type LogKind = 'hazard' | 'remedy' | 'safety' | 'distance' | 'coup' | 'win' | 'info'

export interface LogEntry {
  id: number
  seat: number
  text: string
  kind: LogKind
}

export interface SlingshotEvent {
  id: number
  seat: number // the defender who pulled off the Slingshot
  attacker: number
  hazardKind: string
  safetyKind: string
}

export interface GameState {
  deck: CardInstance[]
  discard: CardInstance[]
  players: PlayerState[]
  turn: number
  phase: Phase
  winner: number | null
  log: LogEntry[]
  logSeq: number
  /** set the moment a Slingshot resolves, so the UI can play the hero animation */
  lastSlingshot: SlingshotEvent | null
  /** the selected gameplay-mode rules, baked in at createGame so the state stays
   * deterministic + serializable. ALL rule-dependent logic reads this — never a
   * global. Classic = DEFAULT_RULES (every flag off). */
  rules: GameRules
  /** SCRY mode: the top-of-deck cards revealed for the current player to pick one
   * of. Non-null only while `phase === 'scry'`. The mover is `state.turn`. */
  scry: CardInstance[] | null
  /** MOMENTUM mode: each player's banked charge [seat0, seat1], 0..MOMENTUM_CAP.
   * A clean distance play banks +1; a `burst` spends a full meter. Always present
   * + serializable; stays at [0,0] in modes where momentum is off. */
  momentum: [number, number]
  /** MOMENTUM mode: the seat currently owed ONE bonus distance play (a BREAKAWAY,
   * just spent via `burst`). While set, that seat's next distance play does NOT
   * end the turn — it clears this flag instead, granting the free double-jump.
   * Null whenever no breakaway is pending. */
  breakaway: number | null
}

export type Move =
  | { type: 'draw'; source?: 'deck' | 'discard' }
  | { type: 'pick'; uid: string } // SCRY: take one of the revealed top-of-deck cards
  | { type: 'play'; uid: string; targetSeat?: number }
  | { type: 'burst' } // MOMENTUM: spend a full meter for a BREAKAWAY (a bonus distance play)
  | { type: 'discard'; uid: string }
  | { type: 'pass' }

const other = (seat: number): number => (seat === 0 ? 1 : 0)

const topOf = (pile: CardInstance[]): CardInstance | undefined => pile[pile.length - 1]

// The restraint lane (Tractor Beam) is a *speed limit*, not a full stop: it caps
// you to short hops and can sit on top of a separate blocking hazard.
const BLOCKING_LANES: Lane[] = ['collision', 'fuel', 'engine', 'stop']
const SPEED_LANE: Lane = 'restraint'
export const SPEED_LIMIT_VALUE = 50

export const isImmune = (p: PlayerState, hazardKind: string): boolean => {
  const haz = CARD_DEFS[hazardKind]
  return (haz.protectedBy ?? []).some((s) => p.safeties.includes(s))
}

/** A safety that covers the Stop lane (Black Hole) also acts as a green light. */
const grantsGreenLight = (def: CardDef): boolean =>
  def.type === 'safety' && (def.immuneTo ?? []).includes('black-hole')

/** The active (un-remedied, un-immune) hazard kind on a lane, or null. */
const topHazardOfLane = (p: PlayerState, lane: Lane): string | null => {
  const top = topOf(p.battle[lane])
  if (top) {
    const def = defOf(top)
    if (def.type === 'hazard' && !isImmune(p, def.kind)) return def.kind
  }
  return null
}

/** The hazard currently *blocking* this player (collision/fuel/engine/stop), or null. */
export const activeHazard = (p: PlayerState): string | null => {
  for (const lane of BLOCKING_LANES) {
    const h = topHazardOfLane(p, lane)
    if (h) return h
  }
  return null
}

/** Every un-remedied, un-immune hazard kind currently on this player — across all
 * five lanes, so this includes the Tractor Beam speed limit as well as the four
 * blocking hazards. Drives the AI's "which remedy do I actually need?" choices. */
export const hazardsOn = (p: PlayerState): string[] => {
  const out: string[] = []
  for (const lane of LANES) {
    const h = topHazardOfLane(p, lane)
    if (h) out.push(h)
  }
  return out
}

/** Whether a Tractor Beam is throttling this player (distances capped at 50). */
export const speedLimited = (p: PlayerState): boolean => topHazardOfLane(p, SPEED_LANE) !== null

/** Whether this player could legally PLAY a distance card right now (started, not
 * blocked, holds a card whose value clears the speed-limit / 200-cap rules). The
 * momentum BURST is only offered when this is true, so it's never a dead button. */
export const canPlayDistance = (p: PlayerState): boolean => {
  if (!p.started || activeHazard(p) !== null) return false
  const slow = speedLimited(p)
  return p.hand.some((c) => {
    const def = defOf(c)
    if (def.type !== 'distance') return false
    const v = def.value ?? 0
    if (slow && v > SPEED_LIMIT_VALUE) return false
    if (v === 200 && p.count200 >= MAX_200_PER_PLAYER) return false
    return true
  })
}

/** MOMENTUM: is this player's meter full and spendable into a BREAKAWAY burst? */
export const canBurst = (s: GameState, seat: number): boolean =>
  s.rules.momentum &&
  s.phase === 'play' &&
  s.turn === seat &&
  s.breakaway === null &&
  s.momentum[seat] >= MOMENTUM_CAP &&
  canPlayDistance(s.players[seat])

/** Can `attacker`'s hand hazard `target` right now? (ignores Slingshot) */
export const canAttack = (target: PlayerState, hazardKind: string): boolean => {
  if (!target.started || isImmune(target, hazardKind) || target.distance >= WIN_DISTANCE) return false
  const lane = CARD_DEFS[hazardKind].lane!
  // Tractor Beam (speed limit) can be applied even over a blocking hazard, as
  // long as they aren't already speed-limited. Blocking hazards need a clear lane.
  if (lane === SPEED_LANE) return topHazardOfLane(target, SPEED_LANE) === null
  return activeHazard(target) === null
}

export interface NewGameOptions {
  names?: [string, string]
  aiSeats?: number[]
  seed?: number
  /** gameplay-mode rules to bake into this game (classic if omitted). */
  rules?: Partial<GameRules>
}

export function createGame(opts: NewGameOptions = {}): GameState {
  const seed = opts.seed ?? (Date.now() >>> 0)
  const rng = mulberry32(seed)
  const deck = shuffle(buildDeck(), rng)
  const names = opts.names ?? ['You', 'Computer']
  const aiSeats = opts.aiSeats ?? [1]

  const players: PlayerState[] = [0, 1].map((seat) => ({
    seat,
    name: names[seat],
    isAI: aiSeats.includes(seat),
    hand: [],
    distance: 0,
    distancePile: [],
    started: false,
    battle: emptyBattle(),
    safeties: [],
    coupFourres: 0,
    count200: 0,
  }))

  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of players) p.hand.push(deck.pop()!)
  }

  return {
    deck,
    discard: [],
    players,
    turn: 0,
    phase: 'draw',
    winner: null,
    logSeq: 1,
    lastSlingshot: null,
    rules: resolveRules(opts.rules),
    scry: null,
    momentum: [0, 0],
    breakaway: null,
    log: [{ id: 0, seat: -1, text: `Race to ${WIN_DISTANCE} light-years. ${names[0]} launches first.`, kind: 'info' }],
  }
}

export function legalMoves(state: GameState): Move[] {
  if (state.phase === 'roundOver') return []
  const me = state.players[state.turn]

  if (state.phase === 'scry') {
    // SCRY: pick exactly one of the revealed top-of-deck cards.
    return (state.scry ?? []).map((c) => ({ type: 'pick', uid: c.uid }))
  }

  if (state.phase === 'draw') {
    // Draw from the deck, or take the top of the discard pile instead. Once the
    // deck is empty we stop offering draws (end-game: play/discard until stuck)
    // so discard-recycling can't loop forever.
    if (state.deck.length === 0) return [{ type: 'draw', source: 'deck' }]
    const moves: Move[] = [{ type: 'draw', source: 'deck' }]
    if (state.discard.length > 0) moves.push({ type: 'draw', source: 'discard' })
    return moves
  }

  const moves: Move[] = []
  const opp = state.players[other(state.turn)]
  const hzr = activeHazard(me)
  const slow = speedLimited(me)

  for (const card of me.hand) {
    const def = defOf(card)
    switch (def.type) {
      case 'distance':
        // overshoot is allowed; while speed-limited only ≤50 ly hops are legal
        if (
          me.started &&
          !hzr &&
          (!slow || (def.value ?? 0) <= SPEED_LIMIT_VALUE) &&
          (def.value !== 200 || me.count200 < MAX_200_PER_PLAYER)
        ) {
          moves.push({ type: 'play', uid: card.uid })
        }
        break
      case 'remedy':
        if (def.isGo) {
          if (!me.started || hzr === 'black-hole') moves.push({ type: 'play', uid: card.uid })
        } else {
          const laneHzr = topHazardOfLane(me, def.lane!)
          if (laneHzr && CARD_DEFS[laneHzr].fixedBy === def.kind) moves.push({ type: 'play', uid: card.uid })
        }
        break
      case 'safety':
        moves.push({ type: 'play', uid: card.uid })
        break
      case 'hazard':
        if (canAttack(opp, def.kind)) moves.push({ type: 'play', uid: card.uid, targetSeat: opp.seat })
        break
    }
  }

  // MOMENTUM: a full, spendable meter unlocks the BREAKAWAY burst (a bonus
  // distance play). Offered only when there's actually a distance to follow with.
  if (canBurst(state, state.turn)) moves.push({ type: 'burst' })

  for (const card of me.hand) moves.push({ type: 'discard', uid: card.uid })
  return moves
}

function pushLog(s: GameState, seat: number, text: string, kind: LogKind) {
  s.log.push({ id: s.logSeq++, seat, text, kind })
}

function endTurn(s: GameState) {
  if (s.phase === 'roundOver') return
  // stalemate: nobody can draw and nobody can act
  if (s.deck.length === 0 && s.players.every((p) => p.hand.length === 0)) {
    finishByDistance(s)
    return
  }
  s.turn = other(s.turn)
  s.phase = 'draw'
}

function winRound(s: GameState, seat: number) {
  s.winner = seat
  s.phase = 'roundOver'
  pushLog(s, seat, `${s.players[seat].name} reaches ${WIN_DISTANCE} light-years and wins the round!`, 'win')
}

function finishByDistance(s: GameState) {
  s.phase = 'roundOver'
  const [a, b] = s.players
  s.winner = a.distance === b.distance ? null : a.distance > b.distance ? a.seat : b.seat
  pushLog(s, -1, 'The deck is spent — the race is called.', 'info')
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase === 'roundOver') return state
  const s: GameState = structuredClone(state)
  const me = s.players[s.turn]

  if (move.type === 'pass') {
    endTurn(s)
    return s
  }

  if (move.type === 'draw') {
    if (move.source === 'discard' && s.discard.length > 0) {
      // The top of the discard is already face-up — no scry there, just take it.
      const card = s.discard.pop()!
      me.hand.push(card)
      pushLog(s, me.seat, `${me.name} takes ${defOf(card).title} from the discard pile.`, 'info')
      s.phase = 'play'
      return s
    }
    if (s.deck.length > 0) {
      // SCRY seam: reveal the top N cards and let the player pick one (resolved in
      // the 'pick' branch). Needs ≥2 cards to be a real choice — deck ≤1 falls
      // through to the classic blind draw.
      if (s.rules.scry && s.deck.length > 1) {
        const n = Math.min(SCRY_REVEAL, s.deck.length)
        s.scry = s.deck.splice(s.deck.length - n, n).reverse() // top-of-deck first
        s.phase = 'scry'
        return s
      }
      me.hand.push(s.deck.pop()!)
    }
    s.phase = 'play'
    return s
  }

  if (move.type === 'pick') {
    // SCRY: take the chosen revealed card; the leftovers return to the BOTTOM of
    // the deck (predictable cycle, no deck-composition change).
    if (s.phase !== 'scry' || !s.scry) return state
    const pickIdx = s.scry.findIndex((c) => c.uid === move.uid)
    if (pickIdx < 0) return state
    const [picked] = s.scry.splice(pickIdx, 1)
    me.hand.push(picked)
    const leftovers = s.scry
    s.scry = null
    if (leftovers.length) s.deck.unshift(...leftovers) // unshift = under the deck (top is array end)
    pushLog(s, me.seat, `${me.name} scouts the stars and takes ${defOf(picked).title}.`, 'info')
    s.phase = 'play'
    return s
  }

  if (move.type === 'burst') {
    // MOMENTUM: spend a full meter for a BREAKAWAY — drain the charge to 0 and owe
    // this player one bonus distance play. The turn stays open (same mover) so
    // their next distance hop is free; playing it clears `breakaway`.
    if (!canBurst(s, s.turn)) return state
    s.momentum[me.seat] = 0
    s.breakaway = me.seat
    pushLog(s, me.seat, `${me.name} hits a BREAKAWAY — momentum unleashed for a free jump!`, 'coup')
    return s
  }

  const idx = me.hand.findIndex((c) => c.uid === move.uid)
  if (idx < 0) return state
  const card = me.hand[idx]
  const def = defOf(card)

  if (move.type === 'discard') {
    me.hand.splice(idx, 1)
    s.discard.push(card)
    pushLog(s, me.seat, `${me.name} discards ${def.title}.`, 'info')
    endTurn(s)
    return s
  }

  // move.type === 'play'
  switch (def.type) {
    case 'distance': {
      me.hand.splice(idx, 1)
      me.distancePile.push(card)
      me.distance += def.value ?? 0
      if (def.value === 200) me.count200++
      pushLog(s, me.seat, `${me.name} warps ${def.value} ly — now at ${me.distance}.`, 'distance')
      if (me.distance >= WIN_DISTANCE) {
        winRound(s, me.seat)
        return s
      }
      // MOMENTUM: a BREAKAWAY (burst just spent) keeps the turn OPEN for one bonus
      // distance hop — this is that hop, so consume the flag and DON'T end the turn
      // (the player gets to play again immediately → the free double-jump).
      if (s.rules.momentum && s.breakaway === me.seat) {
        s.breakaway = null
        return s
      }
      // Otherwise a clean distance play BANKS +1 charge (capped), then the turn ends.
      if (s.rules.momentum && s.momentum[me.seat] < MOMENTUM_CAP) s.momentum[me.seat]++
      endTurn(s)
      return s
    }

    case 'remedy': {
      const laneHzr = topHazardOfLane(me, def.lane!) // the hazard this remedy is clearing, if any
      me.hand.splice(idx, 1)
      // remedy stays in play — laid on top of the hazard's lane pile
      me.battle[def.lane!].push(card)
      if (def.isGo && !me.started) {
        me.started = true
        pushLog(s, me.seat, `${me.name} fires Ignition — engines hot.`, 'remedy')
      } else if (laneHzr && CARD_DEFS[laneHzr].fixedBy === def.kind) {
        pushLog(s, me.seat, `${me.name} clears ${CARD_DEFS[laneHzr].title} with ${def.title}.`, 'remedy')
      } else {
        pushLog(s, me.seat, `${me.name} plays ${def.title}.`, 'remedy')
      }
      endTurn(s)
      return s
    }

    case 'safety': {
      me.hand.splice(idx, 1)
      me.safeties.push(def.kind)
      me.distance += SAFETY_MILEAGE // revealing a safety also moves you forward
      // Rescue Shuttle covers the Stop lane → it doubles as a green light, so it
      // launches you even if you never fired Ignition.
      if (grantsGreenLight(def)) me.started = true
      // immunity is now permanent; any matching hazard already on a lane simply
      // stops blocking (activeHazard ignores immune lanes). Cards stay in play.
      pushLog(s, me.seat, `${me.name} reveals ${def.title} — immune, +${SAFETY_MILEAGE} ly (now ${me.distance}).`, 'safety')
      if (me.distance >= WIN_DISTANCE) {
        winRound(s, me.seat)
        return s
      }
      endTurn(s)
      return s
    }

    case 'hazard': {
      const target = s.players[move.targetSeat ?? other(s.turn)]
      me.hand.splice(idx, 1)

      // Slingshot (formerly coup-fourré): target holds the matching safety →
      // instantly reveals it, the hazard is discarded, +200 ly, then they draw
      // and take their turn.
      const safetyIdx = target.hand.findIndex((c) => (defOf(c).immuneTo ?? []).includes(def.kind))
      if (safetyIdx >= 0) {
        const safetyCard = target.hand[safetyIdx]
        const sdef = defOf(safetyCard)
        target.hand.splice(safetyIdx, 1)
        target.safeties.push(sdef.kind)
        target.coupFourres++
        target.distance += SLINGSHOT_MILEAGE
        if (grantsGreenLight(sdef)) target.started = true // Rescue Shuttle also launches you
        s.discard.push(card) // the hazard is sent to the discard pile
        if (s.deck.length > 0) target.hand.push(s.deck.pop()!) // replacement draw
        pushLog(
          s,
          target.seat,
          `SLINGSHOT! ${target.name} dodges ${def.title} with ${sdef.title}. +${SLINGSHOT_MILEAGE} ly (now ${target.distance}).`,
          'coup',
        )
        s.lastSlingshot = {
          id: s.logSeq,
          seat: target.seat,
          attacker: me.seat,
          hazardKind: def.kind,
          safetyKind: sdef.kind,
        }
        if (target.distance >= WIN_DISTANCE) {
          winRound(s, target.seat)
          return s
        }
        s.turn = target.seat // initiative swings to the defender, who takes a turn
        s.phase = 'draw'
        return s
      }

      target.battle[def.lane!].push(card)
      pushLog(s, me.seat, `${me.name} hits ${target.name} with ${def.title}.`, 'hazard')
      endTurn(s)
      return s
    }
  }

  return s
}

export interface ScoreLine {
  label: string
  icon: string
  points: number
}
export interface PlayerScore {
  seat: number
  name: string
  lines: ScoreLine[]
  total: number
}

export function scoreRound(state: GameState): PlayerScore[] {
  // Score is light-years travelled. Safeties/slingshots are already folded into
  // p.distance as mileage, so we just break the total back out for display.
  return state.players.map((p) => {
    const travel = p.distancePile.reduce((n, c) => n + (defOf(c).value ?? 0), 0)
    const safetyMileage = p.distance - travel
    const lines: ScoreLine[] = [{ label: `Travel · ${travel} ly`, icon: '🚀', points: travel }]
    if (safetyMileage > 0)
      lines.push({ label: `Safety mileage · ${safetyMileage} ly`, icon: '🛡️', points: safetyMileage })
    return { seat: p.seat, name: p.name, lines, total: p.distance }
  })
}
