// The relay payload contract between the TV STAGE (authoritative game + AI) and a
// phone CONTROLLER (private hand + commit). Both travel as the `payload` of a
// directed relay message (to_controller / to_stage). The stage owns the real
// GameState and the engine; the controller is a thin private projection.

import type { CardInstance, GameRules, Move, Phase } from '../game'

/** stage → one controller: that seat's PRIVATE view, recomputed on every state
 * change. Only the fields a phone needs to render its hand + legal affordances —
 * never the opponent's hand. */
export interface ControllerView {
  seat: number
  name: string
  oppName: string
  phase: Phase
  /** play phase + it's your turn → you may play/discard from your hand */
  yourTurn: boolean
  /** draw phase + your turn → you must draw (deck / discard) */
  drawPhase: boolean
  /** scry/catch-up peek cards to choose one of (your turn only), else null */
  scry: CardInstance[] | null
  catchUpScry: boolean
  hand: CardInstance[]
  /** uids in hand currently playable as a `play` move */
  playable: string[]
  /** subset of `playable` that are hazards aimed at the opponent (label hint) */
  hazardTargets: string[]
  canDrawDeck: boolean
  canDrawDiscard: boolean
  topDiscard: CardInstance | null
  /** MOMENTUM: a full meter is spendable into a breakaway right now */
  canBurst: boolean
  /** drawn but holding nothing playable → must discard */
  mustDiscard: boolean
  yourDistance: number
  oppDistance: number
  winner: number | null
  started: boolean
  blocked: boolean
  deckCount: number
  rules: GameRules
}

/** controller → stage. `move` is an engine Move; the stage re-validates it against
 * legalMoves before applying (never trusts the phone). */
export type ControllerMsg =
  | { t: 'hello'; token: string } // identify (stable per-device token) + ask for my view
  | { t: 'move'; move: Move }
  | { t: 'newRound' }

/** A stage→controller relay payload is always a `ControllerView`. */
export type StagePayload = ControllerView
