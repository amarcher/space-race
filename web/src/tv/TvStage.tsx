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

// A seat OWNED by a controller token is a human seat; an unowned seat is the AI's.
function aiSeatsFor(owned: Set<number>): number[] {
  return [0, 1].filter((s) => !owned.has(s))
}

function namesFor(owned: Set<number>): [string, string] {
  return [owned.has(0) ? 'Player 1' : 'Computer', owned.has(1) ? 'Player 2' : 'Computer']
}

function makeGame(owned: Set<number>): GameState {
  return createGame({ rules: loadRules(), names: namesFor(owned), aiSeats: aiSeatsFor(owned) })
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
  const [game, setGame] = useState<GameState>(() => makeGame(new Set()))
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [bindVersion, setBindVersion] = useState(0) // bumped on any binding/liveness change
  const [animating] = useState(false) // reserved (no flight animations on the stage yet)

  const clientRef = useRef<ArcadeClient | null>(null)
  // STABLE seat binding by persistent controller TOKEN (not the ephemeral WS id).
  const tokenSeatRef = useRef(new Map<string, number>()) // token -> seat (held for the whole game)
  const idTokenRef = useRef(new Map<number, string>()) // current connection id -> its token (from hello)
  const connectedIdsRef = useRef(new Set<number>()) // controller ids currently connected (roster)
  const gameRef = useRef(game)
  gameRef.current = game

  // Tokens whose connection id is currently present → the seats actually being
  // driven by a live human right now. A bound-but-disconnected seat is NOT live
  // (the AI fills it until that token reconnects).
  const liveSeats = (): Set<number> => {
    const liveTokens = new Set<string>()
    for (const id of connectedIdsRef.current) {
      const t = idTokenRef.current.get(id)
      if (t) liveTokens.add(t)
    }
    const seats = new Set<number>()
    for (const [tok, seat] of tokenSeatRef.current) if (liveTokens.has(tok)) seats.add(seat)
    return seats
  }

  // Build a fresh game whose NAMES come from seat ownership and whose isAI comes
  // from liveness (an owned-but-disconnected seat is played by the AI for now).
  const buildGame = (): GameState => {
    const owned = new Set(tokenSeatRef.current.values())
    const live = liveSeats()
    const ng = makeGame(owned)
    return { ...ng, players: ng.players.map((p) => ({ ...p, isAI: !live.has(p.seat) })) }
  }

  // Reflect the current bindings into the live game: rebuild names/seats if the
  // round hasn't started, else just flip each seat's isAI to match liveness so
  // progress is preserved. Bumps bindVersion to re-run the view-push + re-render.
  const reflectBindings = () => {
    const live = liveSeats()
    setGame((g) => {
      const fresh = g.log.length <= 1 && !g.players.some((p) => p.started || p.distance > 0)
      if (fresh) return buildGame()
      return { ...g, players: g.players.map((p) => ({ ...p, isAI: !live.has(p.seat) })) }
    })
    setBindVersion((v) => v + 1)
  }

  // ---- roster → connected-id set (NOTE: never frees a seat; seats stay bound to
  // their token for the whole game so a disconnect can't hand the hand to anyone) ----
  const onRoster = (roster: RosterEntry[]) => {
    const ids = new Set(roster.filter((c) => c.role === 'controller').map((c) => c.id))
    const prev = connectedIdsRef.current
    const same = ids.size === prev.size && [...ids].every((id) => prev.has(id))
    if (same) return // 30 Hz roster broadcast — only act on a real join/leave
    // drop id→token for ids that vanished (their seat stays bound to the token)
    for (const id of [...idTokenRef.current.keys()]) if (!ids.has(id)) idTokenRef.current.delete(id)
    connectedIdsRef.current = ids
    reflectBindings()
  }

  // Handle an inbound controller message (kept in a ref so the WS callback always
  // sees fresh state/bindings).
  const handleMsg = useCallbackRef((from: number, payload: unknown) => {
    const msg = payload as ControllerMsg
    if (!msg || typeof msg !== 'object') return

    if (msg.t === 'hello') {
      const token = typeof msg.token === 'string' && msg.token ? msg.token.slice(0, 64) : null
      if (!token) return // no token → no seat, and (critically) no view pushed
      connectedIdsRef.current.add(from)
      idTokenRef.current.set(from, token)
      let seat = tokenSeatRef.current.get(token)
      if (seat === undefined) {
        // Brand-new token: take the lowest FREE seat. A seat already owned by
        // another token (even one currently disconnected) is NEVER reassigned —
        // so a 3rd device with both seats taken gets no seat (spectator).
        const owned = new Set(tokenSeatRef.current.values())
        const free = [0, 1].find((s) => !owned.has(s))
        if (free === undefined) return // both seats occupied — ignore (spectator)
        seat = free
        tokenSeatRef.current.set(token, seat)
      }
      reflectBindings()
      clientRef.current?.sendToController(from, viewFor(gameRef.current, seat))
      return
    }

    if (msg.t === 'newRound') {
      if (gameRef.current.phase === 'roundOver') {
        setGame(buildGame())
        setBindVersion((v) => v + 1)
      }
      return
    }

    if (msg.t === 'move') {
      // Resolve this connection's seat via its token (never the raw id).
      const token = idTokenRef.current.get(from)
      const seat = token != null ? tokenSeatRef.current.get(token) : undefined
      if (seat === undefined) return
      // Validate AND apply inside the SAME updater so legality is checked against
      // the exact state we mutate (no TOCTOU between findLegal and applyMove).
      setGame((g) => {
        if (g.turn !== seat || g.phase === 'roundOver') return g
        const legal = findLegal(g, msg.move)
        return legal ? applyMove(g, legal) : g
      })
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

  // ---- push each SEATED controller its private view on every state change ----
  // Keyed by the controller's CURRENT id → token → seat. An id with no known
  // token (hasn't sent hello yet) is pushed NOTHING — so a freshly-connected
  // device can never be handed another seat's hand before it identifies itself.
  useEffect(() => {
    const c = clientRef.current
    if (!c) return
    for (const id of connectedIdsRef.current) {
      const token = idTokenRef.current.get(id)
      const seat = token != null ? tokenSeatRef.current.get(token) : undefined
      if (seat !== undefined) c.sendToController(id, viewFor(game, seat))
    }
  }, [game, bindVersion])

  // Derived each render (refs + bindVersion drive re-render): the seats with a
  // live human, and whether any phone is connected.
  const liveSeatSet = liveSeats()
  const hasController = liveSeatSet.size > 0
  void bindVersion // bindVersion is a render trigger for the ref-derived values above

  // ---- AI turn loop (fills any seat with no LIVE human; paused until a phone joins) ----
  useEffect(() => {
    if (!hasController || game.phase === 'roundOver' || animating) return
    const cur = game.players[game.turn]
    if (!cur.isAI) return // a live human seat — wait for the controller
    let delay = AI_DELAY
    if (game.phase === 'draw') delay = DRAW_DELAY
    else if (game.phase === 'scry') delay = SCRY_DELAY
    const fallback: Move =
      game.phase === 'scry'
        ? { type: 'pick', uid: game.scry![0].uid }
        : game.phase === 'draw'
          ? { type: 'draw', source: 'deck' }
          : { type: 'pass' }
    const t = setTimeout(() => setGame((g) => applyMove(g, chooseMove(g) ?? fallback)), delay)
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
          {status === 'open' ? `${liveSeatSet.size} player${liveSeatSet.size === 1 ? '' : 's'}` : status}
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
