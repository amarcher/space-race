// TV STAGE — the authoritative second-screen display.
//
// This is the big shared table on the TV. It OWNS the real GameState and runs the
// EXISTING engine + AI verbatim (src/game/*) — no logic is reimplemented. Phones
// are thin CONTROLLERS: each connects to the arcade daemon, the stage hands it a
// seat, and on every state change the stage pushes that controller its PRIVATE
// view (its hand + legal moves) over the directed relay path. A controller's move
// comes back over the relay, is re-validated against legalMoves (never trusted),
// and applied through the same applyMove reducer a local click would use.
//
// Reuses PlayerBoard / Card for rendering — minus the local hand interaction,
// which now lives on the phone. With NO `?mode=` flag this file never mounts.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCallbackRef } from './useCallbackRef'
import {
  activeHazard,
  applyMove,
  chooseMove,
  createGame,
  legalMoves,
  scoreRound,
  type GameState,
  type Move,
} from '../game'
import { MOMENTUM_CAP } from '../game/rules'
import { loadRules } from '../settings'
import { PlayerBoard } from '../components/PlayerBoard'
import { Card } from '../components/Card'
import { ArcadeClient, type RelayRoomState, type RosterEntry } from './arcadeClient'
import { arcadeHttpOrigin, arcadeOrigin } from './mode'
import type { ControllerMsg, ControllerView } from './protocol'
import './Tv.css'

const DRAW_DELAY = 520
const SCRY_DELAY = 640
const AI_DELAY = 820

// AI plays any seat with no controller; a seat a phone holds is human.
function aiSeatsFor(assign: Map<number, number>): number[] {
  const humans = new Set(assign.values())
  return [0, 1].filter((s) => !humans.has(s))
}

function namesFor(assign: Map<number, number>): [string, string] {
  const humans = new Set(assign.values())
  return [humans.has(0) ? 'Player 1' : 'Computer', humans.has(1) ? 'Player 2' : 'Computer']
}

function makeGame(assign: Map<number, number>): GameState {
  return createGame({ rules: loadRules(), names: namesFor(assign), aiSeats: aiSeatsFor(assign) })
}

/** Canonicalize an untrusted controller move against the current legal set, or
 * null if it isn't legal right now (wrong phase/turn/card → rejected). */
function findLegal(g: GameState, m: unknown): Move | null {
  if (!m || typeof m !== 'object') return null
  const mv = m as Record<string, unknown>
  for (const legal of legalMoves(g)) {
    if (legal.type !== mv.type) continue
    if (legal.type === 'draw') {
      if ((legal.source ?? 'deck') === ((mv.source as string) ?? 'deck')) return legal
      continue
    }
    if (legal.type === 'pick' || legal.type === 'play' || legal.type === 'discard') {
      if (legal.uid === mv.uid) return legal
      continue
    }
    // pass / burst — type match is enough
    return legal
  }
  return null
}

/** Build a seat's PRIVATE controller view from the authoritative state. */
function viewFor(g: GameState, seat: number): ControllerView {
  const me = g.players[seat]
  const opp = g.players[seat === 0 ? 1 : 0]
  const myTurn = g.turn === seat && g.phase !== 'roundOver'
  const moves = myTurn ? legalMoves(g) : []
  const plays = moves.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play')
  const playable = plays.map((m) => m.uid)
  return {
    seat,
    name: me.name,
    oppName: opp.name,
    phase: g.phase,
    yourTurn: myTurn && g.phase === 'play',
    drawPhase: myTurn && g.phase === 'draw',
    scry: myTurn && g.phase === 'scry' ? g.scry : null,
    catchUpScry: g.catchUpScry,
    hand: me.hand,
    playable,
    hazardTargets: plays.filter((m) => m.targetSeat != null).map((m) => m.uid),
    canDrawDeck: myTurn && g.phase === 'draw' && moves.some((m) => m.type === 'draw' && (m.source ?? 'deck') === 'deck'),
    canDrawDiscard: myTurn && g.phase === 'draw' && moves.some((m) => m.type === 'draw' && m.source === 'discard'),
    topDiscard: g.discard[g.discard.length - 1] ?? null,
    canBurst: myTurn && moves.some((m) => m.type === 'burst'),
    mustDiscard: myTurn && g.phase === 'play' && playable.length === 0,
    yourDistance: me.distance,
    oppDistance: opp.distance,
    winner: g.winner,
    started: me.started,
    blocked: activeHazard(me) != null,
    deckCount: g.deck.length,
    rules: g.rules,
  }
}

export function TvStage() {
  const [assign, setAssign] = useState<Map<number, number>>(() => new Map())
  const [game, setGame] = useState<GameState>(() => makeGame(new Map()))
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [animating] = useState(false) // reserved (no flight animations on the stage yet)

  const clientRef = useRef<ArcadeClient | null>(null)
  const assignRef = useRef(assign)
  assignRef.current = assign
  const gameRef = useRef(game)
  gameRef.current = game

  const hasController = assign.size > 0

  // Apply a validated move and let the broadcast effect repush views.
  const apply = (move: Move) => setGame((g) => applyMove(g, move))

  // ---- roster → seat assignment (controllers in id order get seats 0,1) ----
  const onRoster = (roster: RosterEntry[]) => {
    const controllers = roster.filter((c) => c.role === 'controller').sort((a, b) => a.id - b.id)
    const next = new Map<number, number>()
    controllers.slice(0, 2).forEach((c, i) => next.set(c.id, i))
    // changed?
    const same =
      next.size === assignRef.current.size && [...next].every(([k, v]) => assignRef.current.get(k) === v)
    if (same) return
    assignRef.current = next
    setAssign(next)
    const humans = new Set(next.values())
    setGame((g) => {
      // If the game hasn't started yet, rebuild it cleanly so seat names + which
      // seats are AI match the new roster (e.g. the first phone joining seat 0
      // turns "Computer vs Computer" into "Player 1 vs Computer"). Once a round is
      // underway, only flip ownership so progress isn't lost.
      const fresh = g.log.length <= 1 && !g.players.some((p) => p.started || p.distance > 0)
      if (fresh) return makeGame(next)
      return { ...g, players: g.players.map((p) => ({ ...p, isAI: !humans.has(p.seat) })) }
    })
  }

  // Handle an inbound controller message (kept in a ref so the WS callback always
  // sees fresh state/assignment).
  const handleMsg = useCallbackRef((from: number, payload: unknown) => {
    const msg = payload as ControllerMsg
    if (!msg || typeof msg !== 'object') return
    const g = gameRef.current
    const seat = assignRef.current.get(from)
    if (msg.t === 'hello') {
      if (seat != null) clientRef.current?.sendToController(from, viewFor(g, seat))
      return
    }
    if (msg.t === 'newRound') {
      if (g.phase === 'roundOver') setGame(makeGame(assignRef.current))
      return
    }
    if (msg.t === 'move') {
      if (seat == null || g.turn !== seat || g.phase === 'roundOver') return
      const legal = findLegal(g, msg.move)
      if (legal) apply(legal)
    }
  })

  // ---- open the WS once ----------------------------------------------------
  useEffect(() => {
    // best-effort: make sure the daemon is on the relay app so its broadcast
    // `state` is the client roster (seat assignment depends on it). Harmless if
    // it's already relay; the WS reconnect covers a missing daemon.
    fetch(`${arcadeHttpOrigin()}/app?name=relay`).catch(() => {})
    const c = new ArcadeClient('stage', arcadeOrigin())
    clientRef.current = c
    c.onStatus(setStatus)
    c.onState((s: RelayRoomState) => onRoster(s.clients ?? []))
    c.onRelay((from, payload) => handleMsg(from, payload))
    return () => c.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- push each seated controller its private view on every state change ---
  useEffect(() => {
    const c = clientRef.current
    if (!c) return
    for (const [clientId, seat] of assign) c.sendToController(clientId, viewFor(game, seat))
  }, [game, assign])

  // ---- AI turn loop (only seats with no controller; paused until a phone joins) ----
  useEffect(() => {
    if (!hasController || game.phase === 'roundOver' || animating) return
    const cur = game.players[game.turn]
    if (!cur.isAI) return // a human seat — wait for the controller
    let delay = AI_DELAY
    if (game.phase === 'draw') delay = DRAW_DELAY
    else if (game.phase === 'scry') delay = SCRY_DELAY
    const fallback: Move =
      game.phase === 'scry'
        ? { type: 'pick', uid: game.scry![0].uid }
        : game.phase === 'draw'
          ? { type: 'draw', source: 'deck' }
          : { type: 'pass' }
    const t = setTimeout(() => apply(chooseMove(game) ?? fallback), delay)
    return () => clearTimeout(t)
  }, [game, hasController, animating])

  const momentumOn = game.rules.momentum
  const recentLog = useMemo(() => game.log.slice(-14).reverse(), [game.log])
  const cur = game.players[game.turn]
  const turnLabel =
    game.phase === 'roundOver'
      ? game.winner != null
        ? `${game.players[game.winner].name} wins!`
        : 'Round over'
      : `${cur.name}'s turn — ${game.phase}`

  const scores = game.phase === 'roundOver' ? scoreRound(game) : null

  return (
    <div className="tv">
      <header className="tv__bar">
        <h1 className="tv__title">1000 Light-Years</h1>
        <div className="tv__turn">{turnLabel}</div>
        <div className={`tv__conn tv__conn--${status}`} title={`arcade: ${arcadeOrigin()}`}>
          {status === 'open' ? `${assign.size} player${assign.size === 1 ? '' : 's'}` : status}
        </div>
      </header>

      {!hasController && (
        <div className="tv__wait">
          <p>Open the controller on your phone to play:</p>
          <code className="tv__url">{arcadeHttpOrigin()}/controller.html (Space Race: add ?mode=tv-controller)</code>
          <p className="tv__hint">Point your phone browser at the game URL with <b>?mode=tv-controller</b>.</p>
        </div>
      )}

      <div className="tv__boards">
        <PlayerBoard
          player={game.players[1]}
          isOpponent
          who="cpu"
          active={game.turn === 1 && game.phase !== 'roundOver'}
          momentum={momentumOn ? { charge: game.momentum[1], cap: MOMENTUM_CAP } : null}
          selfHeal={game.rules.selfHeal}
        />

        <div className="tv__center">
          <div className="tv__pile">
            <Card faceDown size="md" />
            <span className="tv__pilecount">{game.deck.length}</span>
          </div>
          <div className="tv__pile">
            {game.discard.length > 0 ? (
              <Card kind={game.discard[game.discard.length - 1].kind} size="md" showName={false} />
            ) : (
              <div className="tv__pile-empty" />
            )}
          </div>
        </div>

        <PlayerBoard
          player={game.players[0]}
          isOpponent={false}
          who="you"
          active={game.turn === 0 && game.phase !== 'roundOver'}
          momentum={momentumOn ? { charge: game.momentum[0], cap: MOMENTUM_CAP } : null}
          selfHeal={game.rules.selfHeal}
        />
      </div>

      {scores && (
        <div className="tv__scores">
          {scores.map((s) => (
            <div key={s.seat} className={`tv__score ${game.winner === s.seat ? 'tv__score--win' : ''}`}>
              <b>{s.name}</b>
              <span>{s.total} ly</span>
            </div>
          ))}
        </div>
      )}

      <aside className="tv__log" aria-label="Game log">
        <ul>
          {recentLog.map((e) => (
            <li key={e.id} className={`tv__log-${e.kind}`}>
              {e.text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
