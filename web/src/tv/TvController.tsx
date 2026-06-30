// TV CONTROLLER — the phone view.
//
// A lean, mobile-friendly private hand. It connects to the arcade daemon as a
// `controller`, receives its PRIVATE view (hand + legal moves) from the stage over
// the relay, and sends back engine Moves (select+commit, draw, scry pick, discard,
// burst). It holds NO game logic — the stage validates and applies everything. The
// big shared table lives on the TV; this is just your cards. Reuses Card.tsx.

import { useEffect, useRef, useState } from 'react'
import { CARD_DEFS } from '../game/cards'
import type { Move } from '../game'
import { Card } from '../components/Card'
import { ArcadeClient } from './arcadeClient'
import { arcadeOrigin } from './mode'
import type { ControllerMsg, ControllerView } from './protocol'
import './Tv.css'

const TOKEN_KEY = 'spacerace_tv_token'

/** A STABLE per-device identity that survives reconnects (Wi-Fi drops on phones
 * are constant). The stage binds a seat to this token, not the ephemeral WS
 * connection id — so a reconnect reclaims the SAME seat (and only that seat's
 * hand) instead of being remapped onto someone else's. */
function deviceToken(): string {
  // Explicit override (?token=…) — lets two controllers run on ONE machine/origin
  // (which otherwise share localStorage) and makes reconnect testing deterministic.
  // Tokens are seat-identity, not secrets, so this grants nothing a localStorage
  // edit wouldn't; the "occupied seat is never reassigned" rule still holds.
  try {
    const forced = new URLSearchParams(window.location.search).get('token')
    if (forced) return forced.slice(0, 64)
  } catch {
    /* ignore */
  }
  try {
    const existing = localStorage.getItem(TOKEN_KEY)
    if (existing) return existing
    const t =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tv-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(TOKEN_KEY, t)
    return t
  } catch {
    // private-mode / no storage: fall back to a session-stable token (no reclaim
    // across reloads, but still stable for this page's lifetime).
    return `tv-${Math.random().toString(36).slice(2)}`
  }
}

export function TvController() {
  const [view, setView] = useState<ControllerView | null>(null)
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [selected, setSelected] = useState<string | null>(null)
  const clientRef = useRef<ArcadeClient | null>(null)

  useEffect(() => {
    const token = deviceToken()
    const c = new ArcadeClient('controller', arcadeOrigin())
    clientRef.current = c
    c.onStatus(setStatus)
    // greet with the stable token on every (re)connect so the stage reclaims our seat
    c.onWelcome(() => c.sendToStage({ t: 'hello', token } satisfies ControllerMsg))
    c.onRelay((_from, payload) => setView(payload as ControllerView))
    return () => c.close()
  }, [])

  const send = (msg: ControllerMsg) => clientRef.current?.sendToStage(msg)
  const sendMove = (move: Move) => {
    send({ t: 'move', move })
    setSelected(null)
  }

  // clear a stale selection when it's no longer your turn / card gone
  useEffect(() => {
    if (!view) return
    if (!view.yourTurn || !view.hand.some((c) => c.uid === selected)) setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  if (status !== 'open' || !view) {
    return (
      <div className="ctl ctl--blank">
        <div className="ctl__spinner" aria-hidden />
        <p>{status === 'open' ? 'Waiting for the table…' : `Connecting (${status})…`}</p>
        <small>Make sure the TV stage is open.</small>
      </div>
    )
  }

  const playableSet = new Set(view.playable)
  const selectedCard = selected ? view.hand.find((c) => c.uid === selected) : undefined
  const selectedDef = selectedCard ? CARD_DEFS[selectedCard.kind] : undefined
  const selectedPlayable = selected ? playableSet.has(selected) : false
  const isHazard = selected ? view.hazardTargets.includes(selected) : false

  const playLabel = !selectedDef
    ? 'Play'
    : isHazard
      ? `Launch ${selectedDef.title} at ${view.oppName}`
      : selectedDef.isGo && !view.started
        ? 'Fire Ignition'
        : selectedDef.type === 'safety'
          ? `Reveal ${selectedDef.title}`
          : `Play ${selectedDef.title}`

  // ---- status line driving the phone ----
  const statusLine = view.winner != null
    ? view.winner === view.seat
      ? 'You win! 🚀'
      : `${view.oppName} wins`
    : view.scry
      ? view.catchUpScry
        ? 'Tailwind! Scout & take a card'
        : 'Scout the stars — take a card'
      : view.drawPhase
        ? 'Your turn — draw a card'
        : view.yourTurn
          ? view.mustDiscard
            ? 'Nothing playable — discard a card'
            : 'Your turn — play or discard'
          : `${view.oppName} is moving…`

  return (
    <div className="ctl">
      <header className="ctl__bar">
        <span className="ctl__me">{view.name}</span>
        <span className="ctl__dist">
          you {view.yourDistance} · {view.oppName} {view.oppDistance}
        </span>
      </header>

      <div className={`ctl__status ${view.yourTurn || view.drawPhase || view.scry ? 'ctl__status--go' : ''}`}>
        {statusLine}
      </div>

      {/* DRAW phase: pick a source */}
      {view.drawPhase && (
        <div className="ctl__draw">
          <button className="ctl__btn ctl__btn--draw" onClick={() => sendMove({ type: 'draw', source: 'deck' })}>
            Draw from deck ({view.deckCount})
          </button>
          {view.canDrawDiscard && view.topDiscard && (
            <button
              className="ctl__btn ctl__btn--draw2"
              onClick={() => sendMove({ type: 'draw', source: 'discard' })}
            >
              Take {CARD_DEFS[view.topDiscard.kind].title} from discard
            </button>
          )}
        </div>
      )}

      {/* SCRY phase: choose one revealed card */}
      {view.scry && (
        <div className="ctl__scry">
          {view.scry.map((c) => (
            <button key={c.uid} className="ctl__scrycard" onClick={() => sendMove({ type: 'pick', uid: c.uid })}>
              <Card kind={c.kind} size="sm" showName={false} />
            </button>
          ))}
        </div>
      )}

      {/* BURST (momentum) */}
      {view.canBurst && (
        <button className="ctl__btn ctl__btn--burst" onClick={() => sendMove({ type: 'burst' })}>
          ⚡ Breakaway — free jump
        </button>
      )}

      {/* HAND */}
      <div className="ctl__hand">
        {view.hand.map((c) => {
          const playable = playableSet.has(c.uid)
          return (
            <button
              key={c.uid}
              className={`ctl__card ${selected === c.uid ? 'ctl__card--sel' : ''} ${
                playable ? 'ctl__card--playable' : ''
              }`}
              onClick={() => view.yourTurn && setSelected((s) => (s === c.uid ? null : c.uid))}
              disabled={!view.yourTurn}
            >
              <Card kind={c.kind} size="sm" showName={false} muted={!playable && view.yourTurn} />
            </button>
          )
        })}
      </div>

      {/* COMMIT BAR */}
      {view.yourTurn && selected && (
        <div className="ctl__commit">
          <button
            className="ctl__btn ctl__btn--play"
            disabled={!selectedPlayable}
            onClick={() => {
              const move: Move = isHazard
                ? { type: 'play', uid: selected, targetSeat: view.seat === 0 ? 1 : 0 }
                : { type: 'play', uid: selected }
              sendMove(move)
            }}
          >
            {playLabel}
          </button>
          <button className="ctl__btn ctl__btn--discard" onClick={() => sendMove({ type: 'discard', uid: selected })}>
            Discard
          </button>
        </div>
      )}

      {/* NEW ROUND */}
      {view.winner != null && (
        <button className="ctl__btn ctl__btn--new" onClick={() => send({ t: 'newRound' })}>
          Play again
        </button>
      )}
    </div>
  )
}
