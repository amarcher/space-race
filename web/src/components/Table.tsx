import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_DEFS } from '../game/cards'
import {
  applyMove,
  chooseMove,
  createGame,
  legalMoves,
  scoreRound,
  type GameState,
  type Move,
  type SlingshotEvent,
} from '../game'
import { Card } from './Card'
import { Hand } from './Hand'
import { PlayerBoard } from './PlayerBoard'
import { SlingshotOverlay } from './SlingshotOverlay'
import './Table.css'

const DRAW_DELAY = 480
const AI_DELAY = 780
const TOAST_MS = 2200
const TOAST_KINDS = new Set(['win', 'safety']) // 'coup' gets the full-screen Slingshot animation instead
const SLINGSHOT_MS = 2800

// Icon vocabulary — the UI leans on pictures so a non-reader can follow along.
const AVATAR = { you: '🧑‍🚀', cpu: '🤖' }
const LOG_ICON: Record<string, string> = {
  hazard: '💥',
  remedy: '🔧',
  safety: '🛡️',
  distance: '🚀',
  coup: '⚡',
  win: '🏆',
  info: '·',
}

export function Table({ onExit }: { onExit?: () => void }) {
  const [state, setState] = useState<GameState>(() => createGame())
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [dragUid, setDragUid] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [slingshot, setSlingshot] = useState<SlingshotEvent | null>(null)
  const [animating, setAnimating] = useState(false)
  const lastLogId = useRef<number>(-1)
  const lastSlingId = useRef<number>(-1)

  const human = state.players[0]
  const opp = state.players[1]
  const cur = state.players[state.turn]
  const yourTurn = state.turn === 0 && state.phase === 'play'

  const moves = useMemo(() => legalMoves(state), [state])
  const playableUids = useMemo(
    () => new Set(moves.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play').map((m) => m.uid)),
    [moves],
  )

  // ---- automated turn loop: deal/draw + AI moves ----
  useEffect(() => {
    if (state.phase === 'roundOver' || animating) return // hold the loop during the Slingshot animation
    let action: (() => void) | null = null
    let delay = 0

    if (state.phase === 'draw' && cur.isAI) {
      // AI draws itself (deck or top of discard, per its heuristic).
      delay = DRAW_DELAY
      action = () =>
        setState((s) => {
          if (s.phase !== 'draw' || !s.players[s.turn].isAI) return s
          const mv = chooseMove(s) ?? { type: 'draw', source: 'deck' as const }
          return applyMove(s, mv)
        })
    } else if (state.phase === 'play' && cur.isAI) {
      delay = AI_DELAY
      action = () =>
        setState((s) => {
          if (s.phase !== 'play' || !s.players[s.turn].isAI) return s
          const mv = chooseMove(s) ?? { type: 'pass' }
          return applyMove(s, mv)
        })
    }
    if (!action) return
    const t = setTimeout(action, delay)
    return () => clearTimeout(t)
  }, [state, cur.isAI, animating])

  // ---- Slingshot hero animation: play it, and pause the loop while it runs ----
  useEffect(() => {
    const ev = state.lastSlingshot
    if (!ev || ev.id === lastSlingId.current) return
    lastSlingId.current = ev.id
    setSlingshot(ev)
    setAnimating(true)
    const t = setTimeout(() => {
      setSlingshot(null)
      setAnimating(false)
    }, SLINGSHOT_MS)
    return () => clearTimeout(t)
  }, [state.lastSlingshot])

  // clear stale selection when it stops being your move
  useEffect(() => {
    if (!yourTurn) setSelectedUid(null)
  }, [yourTurn])

  // transient banner for the biggest events
  useEffect(() => {
    const last = state.log[state.log.length - 1]
    if (!last || last.id === lastLogId.current) return
    lastLogId.current = last.id
    if (TOAST_KINDS.has(last.kind)) {
      setToast(last.text)
      const t = setTimeout(() => setToast(null), TOAST_MS)
      return () => clearTimeout(t)
    }
  }, [state.log])

  const selectedKind = selectedUid ? human.hand.find((c) => c.uid === selectedUid)?.kind : undefined
  const selectedDef = selectedKind ? CARD_DEFS[selectedKind] : undefined
  const selectedPlay = selectedUid
    ? moves.find((m): m is Extract<Move, { type: 'play' }> => m.type === 'play' && m.uid === selectedUid)
    : undefined

  const playLabel = (() => {
    if (!selectedDef) return 'Play'
    if (selectedDef.type === 'hazard') return `Launch ${selectedDef.title} at ${opp.name}`
    if (selectedDef.type === 'safety') return `Reveal ${selectedDef.title}`
    if (selectedDef.isGo && !human.started) return 'Fire Ignition'
    return `Play ${selectedDef.title}`
  })()

  const doPlay = () => {
    if (!selectedPlay) return
    setState((s) => applyMove(s, selectedPlay))
    setSelectedUid(null)
  }
  const doDiscard = () => {
    if (!selectedUid) return
    setState((s) => applyMove(s, { type: 'discard', uid: selectedUid }))
    setSelectedUid(null)
  }
  const newRound = () => {
    setSelectedUid(null)
    setState(createGame())
  }

  // ---- drag-and-drop: drag a hand card onto a board (play) or the discard pile ----
  const dragMove = dragUid
    ? moves.find((m): m is Extract<Move, { type: 'play' }> => m.type === 'play' && m.uid === dragUid)
    : undefined
  const drop = {
    self: !!dragMove && dragMove.targetSeat === undefined, // distance/remedy/safety → own board
    opp: !!dragMove && dragMove.targetSeat === opp.seat, // hazard → opponent
    discard: yourTurn && !!dragUid, // any card → discard pile
  }
  const allowDrop = (ok: boolean) => (e: React.DragEvent) => {
    if (ok) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }
  const doDrop = (zone: 'self' | 'opp' | 'discard') => {
    if (!dragUid) return
    if (zone === 'discard' && drop.discard) setState((s) => applyMove(s, { type: 'discard', uid: dragUid }))
    else if (zone === 'self' && drop.self && dragMove) setState((s) => applyMove(s, dragMove))
    else if (zone === 'opp' && drop.opp && dragMove) setState((s) => applyMove(s, dragMove))
    setDragUid(null)
    setSelectedUid(null)
  }

  const myTurn = state.turn === 0 && state.phase !== 'roundOver'
  const drawPhaseHuman = state.turn === 0 && state.phase === 'draw'
  const statusIcon = state.phase === 'roundOver' ? '' : myTurn ? '👇' : '💭'
  const statusLabel = state.phase === 'roundOver' ? '' : myTurn ? 'Your turn' : `${cur.name} is thinking`
  const topDiscard = state.discard[state.discard.length - 1]
  const recentLog = state.log.slice(-7).reverse()

  const canDrawDeck = drawPhaseHuman && state.deck.length > 0
  const canDrawDiscard = drawPhaseHuman && state.discard.length > 0
  const drawFrom = (source: 'deck' | 'discard') => {
    if (!drawPhaseHuman) return
    setState((s) => applyMove(s, { type: 'draw', source }))
  }

  return (
    <div className="table">
      <header className="table__bar">
        <h1>1000 Light-Years</h1>
        <span className="table__status" title={statusLabel} aria-label={statusLabel}>
          {statusIcon} {yourTurn && <span className="table__status-you">{AVATAR.you}</span>}
        </span>
        <div className="table__bar-actions">
          <button className="btn btn--icon" onClick={newRound} title="New round" aria-label="New round">🔄</button>
          {onExit && (
            <button className="btn btn--icon" onClick={onExit} title="Card gallery" aria-label="Card gallery">🃏</button>
          )}
        </div>
      </header>

      <div className="table__body">
       <div className="table__main">
      <div
        className={`dropzone ${dragUid ? (drop.opp ? 'dropzone--ok' : 'dropzone--dim') : ''}`}
        onDragOver={allowDrop(drop.opp)}
        onDrop={() => doDrop('opp')}
      >
        <PlayerBoard
          player={opp}
          isOpponent
          avatar={AVATAR.cpu}
          active={state.turn === 1 && state.phase !== 'roundOver'}
        />
        {drop.opp && (
          <span className="dropzone__tag dropzone__tag--hazard" aria-label="Drop to attack">💥</span>
        )}
      </div>

      <div className="table__opp-hand" aria-label={`${opp.name} holds ${opp.hand.length} cards`}>
        {opp.hand.map((c) => (
          <Card key={c.uid} faceDown size="sm" />
        ))}
      </div>

      <div className="table__center">
        <div
          className={`pile ${canDrawDeck ? 'pile--draw' : ''}`}
          title={canDrawDeck ? 'Tap to draw' : undefined}
        >
          <Card faceDown size="md" onClick={canDrawDeck ? () => drawFrom('deck') : undefined} />
          <span className="pile__count">{state.deck.length}</span>
          <span className="pile__label">{canDrawDeck ? '👆' : ''}</span>
        </div>
        <div
          className={`pile dropzone ${dragUid ? (drop.discard ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
            canDrawDiscard ? 'pile--draw' : ''
          }`}
          onDragOver={allowDrop(drop.discard)}
          onDrop={() => doDrop('discard')}
          title={canDrawDiscard ? 'Tap to take this card' : undefined}
        >
          {topDiscard ? (
            <Card
              key={topDiscard.uid}
              kind={topDiscard.kind}
              size="md"
              showName={false}
              onClick={canDrawDiscard ? () => drawFrom('discard') : undefined}
            />
          ) : (
            <div className="pile__empty" />
          )}
          <span className="pile__label" aria-label="Discard pile">{canDrawDiscard ? '👆' : '🗑️'}</span>
        </div>
      </div>

      <div
        className={`dropzone ${dragUid ? (drop.self ? 'dropzone--ok' : 'dropzone--dim') : ''}`}
        onDragOver={allowDrop(drop.self)}
        onDrop={() => doDrop('self')}
      >
        <PlayerBoard player={human} isOpponent={false} avatar={AVATAR.you} active={yourTurn} />
        {drop.self && <span className="dropzone__tag" aria-label="Drop to play">✅</span>}
      </div>

      <Hand
        player={human}
        playableUids={playableUids}
        selectedUid={selectedUid}
        draggingUid={dragUid}
        yourTurn={yourTurn}
        onSelect={(uid) => setSelectedUid((cur) => (cur === uid ? null : uid))}
        onDragStart={(uid) => {
          setDragUid(uid)
          setSelectedUid(uid)
        }}
        onDragEnd={() => setDragUid(null)}
      />

      {yourTurn && playableUids.size === 0 && (
        <p className="table__hint" aria-label="Drag a card to the trash to discard">👆🗑️</p>
      )}
       </div>

       <aside className="table__log" aria-label="Game log">
         <ul className="log">
           {recentLog.map((e) => (
             <li key={e.id} className={`log__line log__line--${e.kind}`} title={e.text}>
               {e.seat >= 0 && <span className="log__who">{e.seat === 0 ? AVATAR.you : AVATAR.cpu}</span>}
               <span className="log__icon">{LOG_ICON[e.kind]}</span>
             </li>
           ))}
         </ul>
       </aside>
      </div>

      <div className={`actionbar ${selectedUid && yourTurn ? 'actionbar--show' : ''}`}>
        {selectedDef && selectedKind && (
          <>
            <span className="actionbar__thumb">
              <Card kind={selectedKind} size="sm" showName={false} />
            </span>
            <button
              className="btn btn--play btn--bigicon"
              onClick={doPlay}
              disabled={!selectedPlay}
              title={playLabel}
              aria-label={playLabel}
            >
              {selectedDef.type === 'hazard' ? '💥' : '▶️'}
            </button>
            <button
              className="btn btn--discard btn--bigicon"
              onClick={doDiscard}
              title="Discard"
              aria-label="Discard"
            >
              🗑️
            </button>
          </>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {slingshot && (
        <SlingshotOverlay event={slingshot} avatar={slingshot.seat === 0 ? AVATAR.you : AVATAR.cpu} />
      )}

      {state.phase === 'roundOver' && <Scoreboard state={state} onNewRound={newRound} />}
    </div>
  )
}

function Scoreboard({ state, onNewRound }: { state: GameState; onNewRound: () => void }) {
  const scores = scoreRound(state)
  const avatarFor = (seat: number) => (seat === 0 ? AVATAR.you : AVATAR.cpu)
  return (
    <div className="scoreboard">
      <div className="scoreboard__card">
        <div className="scoreboard__trophy" aria-label={state.winner != null ? `${state.players[state.winner].name} wins` : 'Round over'}>
          🏆{state.winner != null && <span className="scoreboard__winner">{avatarFor(state.winner)}</span>}
        </div>
        <div className="scoreboard__cols">
          {scores.map((s) => (
            <div key={s.seat} className={`scorecol ${state.winner === s.seat ? 'scorecol--win' : ''}`}>
              <h3 aria-label={s.name}>{avatarFor(s.seat)}</h3>
              <ul>
                {s.lines.map((l, i) => (
                  <li key={i} title={l.label}>
                    <span aria-hidden>{l.icon}</span>
                    <b>{l.points}</b>
                  </li>
                ))}
              </ul>
              <div className="scorecol__total" title="Total">
                <span aria-hidden>🏆</span>
                <b>{s.total}</b>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn--play btn--bigicon btn--big" onClick={onNewRound} title="Play again" aria-label="Play again">
          🔄
        </button>
      </div>
    </div>
  )
}
