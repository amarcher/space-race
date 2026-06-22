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
import { cardVideo } from '../game/cardArt'
import { type BurstType, useBurstLayer } from './BurstLayer'
import { Card } from './Card'
import { HyperwarpTakeover } from './HyperwarpTakeover'
import { DragLayer, useCardDrag } from './DragLayer'
import { FlightLayer, useFlights } from './FlightLayer'
import { Hand } from './Hand'
import { PlayerBoard } from './PlayerBoard'
import { SlingshotOverlay } from './SlingshotOverlay'
import { prefersReducedMotion, type Rect } from '../motion'
import './Table.css'

const DRAW_DELAY = 480
const AI_DELAY = 780
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

// Screen-space rect of the .card inside an anchor element (deck/discard pile).
function cardRectOf(el: HTMLElement | null): Rect | null {
  if (!el) return null
  const card = (el.querySelector('.card') as HTMLElement | null) ?? el
  const r = card.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width }
}

// A card-sized landing rect centred in a hand container (cards land here on draw).
function landingRect(el: HTMLElement | null): Rect | null {
  if (!el) return null
  const inner = el.querySelector('.card') as HTMLElement | null
  const box = el.getBoundingClientRect()
  const w = inner ? inner.getBoundingClientRect().width : box.width * 0.4
  const h = (w * 4) / 3
  return { left: box.left + box.width / 2 - w / 2, top: box.top + box.height / 2 - h / 2, width: w }
}

export function Table({ onExit }: { onExit?: () => void }) {
  const [state, setState] = useState<GameState>(() => createGame())
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [slingshot, setSlingshot] = useState<SlingshotEvent | null>(null)
  const [animating, setAnimating] = useState(false)
  // hide the top discard while it's flying off into someone's hand (no double image)
  const [hideDiscardTop, setHideDiscardTop] = useState(false)
  // the freshly-drawn hand card stays hidden until its flight lands on it
  const [incomingUid, setIncomingUid] = useState<string | null>(null)
  // the end-of-round scoreboard can be dismissed to inspect the final board
  const [scoreboardOpen, setScoreboardOpen] = useState(false)
  // the game log is tucked away in a dropdown, summoned from the header
  const [logOpen, setLogOpen] = useState(false)
  // transient impact feel: a screen shake, a full-screen flash, and a per-board
  // hit-recoil / recovery-spring (keyed so the same board can re-trigger)
  const [shaking, setShaking] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'hit' | 'recover'; key: number } | null>(null)
  const [impact, setImpact] = useState<{ seat: number; tone: 'hit' | 'recover'; key: number } | null>(null)
  const impactSeq = useRef(0)
  // full-screen hero takeover for the rare 200-ly hyperwarp
  const [hyperwarp, setHyperwarp] = useState<{ src: string; key: number } | null>(null)
  const lastSlingId = useRef<number>(-1)

  // DOM anchors for pile↔hand flights
  const deckRef = useRef<HTMLDivElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<HTMLDivElement>(null)
  const oppHandRef = useRef<HTMLDivElement>(null)

  const { flights, fly } = useFlights()
  const { ref: burstRef, fire: fireBurst } = useBurstLayer()

  const human = state.players[0]
  const opp = state.players[1]
  const cur = state.players[state.turn]
  const yourTurn = state.turn === 0 && state.phase === 'play'

  const moves = useMemo(() => legalMoves(state), [state])
  const playableUids = useMemo(
    () => new Set(moves.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play').map((m) => m.uid)),
    [moves],
  )

  // A hazard slams a ship: jolt the whole table, flash red, and recoil the
  // victim's board.
  const triggerHit = (victimSeat: number) => {
    const key = ++impactSeq.current
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
    setFlash({ tone: 'hit', key })
    setTimeout(() => setFlash((f) => (f?.key === key ? null : f)), 240)
    setImpact({ seat: victimSeat, tone: 'hit', key })
    setTimeout(() => setImpact((im) => (im?.key === key ? null : im)), 480)
  }
  // A remedy clears the hazard: after a beat (hit-pause) the ship springs back
  // to life with a green bloom.
  const triggerRecover = (seat: number) => {
    const key = ++impactSeq.current
    setFlash({ tone: 'recover', key })
    setTimeout(() => setFlash((f) => (f?.key === key ? null : f)), 260)
    setImpact({ seat, tone: 'recover', key })
    setTimeout(() => setImpact((im) => (im?.key === key ? null : im)), 600)
  }

  // Visceral "effect when played" for a play move: a distance hop jumps the
  // starfield into a hyperspace warp (length scaled to the light-years); a
  // hazard slams the victim's ship (shake + red flash + recoil + burst); a
  // remedy clears it (burst, then a beat, then a recovery spring); a safety
  // pops a gold burst.
  const firePlayEffect = (move: Extract<Move, { type: 'play' }>) => {
    const actor = state.turn
    const card = state.players[actor].hand.find((c) => c.uid === move.uid)
    const def = card ? CARD_DEFS[card.kind] : undefined
    if (!card || !def) return
    if (def.type === 'distance') {
      window.dispatchEvent(new CustomEvent('spacerace:warp', { detail: { ly: def.value ?? 50 } }))
      // the big 200-ly jump earns a full-screen hyperwarp hero moment
      if (def.value === 200 && !prefersReducedMotion()) {
        const clip = cardVideo(card.kind, ['idle', 'hover'])
        if (clip) setHyperwarp({ src: clip, key: ++impactSeq.current })
      }
      return
    }
    const victimSeat = def.type === 'hazard' ? move.targetSeat ?? actor : actor
    const el = document.querySelector<HTMLElement>(victimSeat === 0 ? '[data-drop="self"]' : '[data-drop="opp"]')
    if (el) {
      const r = el.getBoundingClientRect()
      fireBurst(r.left + r.width / 2, r.top + r.height / 2, def.type as BurstType)
    }
    if (def.type === 'hazard') triggerHit(victimSeat)
    else if (def.type === 'remedy') setTimeout(() => triggerRecover(victimSeat), 150) // hit-pause beat
  }

  // Apply a move, but first fly the card between pile and hand so draws/discards
  // read as motion. Only draw/discard touch the piles — plays/passes commit
  // instantly. Honours reduced-motion by committing immediately.
  // `fromOverride` lets a crane-drop hand off the floating card's exact position.
  const animateAndCommit = (move: Move, fromOverride?: Rect) => {
    if (prefersReducedMotion() || (move.type !== 'draw' && move.type !== 'discard')) {
      if (move.type === 'play') firePlayEffect(move)
      setState((s) => applyMove(s, move))
      return
    }
    const actor = state.turn

    // Your own draw: it's the very card off the pile that joins your hand. Commit
    // first (so the card has a real slot), then fly that card from the pile into
    // its slot — flipping face-up off the deck — and reveal it on landing. This
    // keeps it one continuous card instead of a generic flyer + a separate pop-in.
    if (move.type === 'draw' && actor === 0) {
      const source = move.source ?? 'deck'
      const from = cardRectOf(source === 'discard' ? discardRef.current : deckRef.current)
      const drawn = source === 'discard' ? state.discard[state.discard.length - 1] : state.deck[state.deck.length - 1]
      if (!from || !drawn) {
        setState((s) => applyMove(s, move))
        return
      }
      setAnimating(true)
      if (source === 'discard') setHideDiscardTop(true)
      setIncomingUid(drawn.uid) // the new hand card stays hidden until the flight lands
      setState((s) => applyMove(s, move))
      requestAnimationFrame(() => {
        const slot = document.querySelector<HTMLElement>(`.hand__slot[data-uid="${drawn.uid}"]`)
        const to = cardRectOf(slot) ?? landingRect(handRef.current)
        if (!to) {
          setIncomingUid(null)
          setHideDiscardTop(false)
          setAnimating(false)
          return
        }
        fly({ from, to, kind: drawn.kind, flip: source === 'deck' }).then(() => {
          setIncomingUid(null)
          setHideDiscardTop(false)
          setAnimating(false)
        })
      })
      return
    }

    // Everything else (AI draws → its hidden hand, and any discard) flies a card
    // and defers the commit until it lands, so it's never shown in two places.
    let from: Rect | null = null
    let to: Rect | null = null
    let kind: string | undefined
    let faceDown = false

    if (move.type === 'draw') {
      const source = move.source ?? 'deck'
      from = cardRectOf(source === 'discard' ? discardRef.current : deckRef.current)
      to = landingRect(oppHandRef.current)
      faceDown = true // the AI's hand is hidden, so its draws arrive face-down
    } else {
      // discard: from the played card's slot (or the crane drop point) → discard pile
      const slotEl = document.querySelector<HTMLElement>(`.hand__slot[data-uid="${move.uid}"]`)
      from = fromOverride ?? (actor === 0 ? cardRectOf(slotEl) : cardRectOf(oppHandRef.current))
      to = cardRectOf(discardRef.current)
      kind = state.players[actor].hand.find((c) => c.uid === move.uid)?.kind
    }

    if (!from || !to) {
      setState((s) => applyMove(s, move))
      return
    }
    setAnimating(true)
    fly({ from, to, kind, faceDown }).then(() => {
      setState((s) => applyMove(s, move))
      setAnimating(false)
    })
  }

  // pop the scoreboard open each time a round ends (it can then be dismissed)
  useEffect(() => {
    if (state.phase === 'roundOver') setScoreboardOpen(true)
  }, [state.phase])

  // Esc dismisses the scoreboard so the final board is visible underneath
  useEffect(() => {
    if (!scoreboardOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScoreboardOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scoreboardOpen])

  // ---- automated turn loop: deal/draw + AI moves ----
  useEffect(() => {
    if (state.phase === 'roundOver' || animating) return // hold the loop during animations
    let action: (() => void) | null = null
    let delay = 0

    if (state.phase === 'draw' && cur.isAI) {
      // AI draws itself (deck or top of discard, per its heuristic).
      delay = DRAW_DELAY
      action = () => animateAndCommit(chooseMove(state) ?? { type: 'draw', source: 'deck' as const })
    } else if (state.phase === 'play' && cur.isAI) {
      delay = AI_DELAY
      action = () => animateAndCommit(chooseMove(state) ?? { type: 'pass' as const })
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
    animateAndCommit(selectedPlay)
    setSelectedUid(null)
  }
  const doDiscard = () => {
    if (!selectedUid) return
    animateAndCommit({ type: 'discard', uid: selectedUid })
    setSelectedUid(null)
  }
  const newRound = () => {
    setSelectedUid(null)
    setState(createGame())
  }

  // ---- crane drag: lift a hand card to the cursor, drop it on a board or the discard ----
  const zoneAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.closest('[data-drop]')?.getAttribute('data-drop') ?? null
  }
  const handleDrop = (uid: string, zone: string | null, rect: Rect) => {
    const mv = moves.find((m): m is Extract<Move, { type: 'play' }> => m.type === 'play' && m.uid === uid)
    if (zone === 'discard' && yourTurn) {
      animateAndCommit({ type: 'discard', uid }, rect)
    } else if (zone === 'self' && mv && mv.targetSeat === undefined) {
      animateAndCommit(mv)
    } else if (zone === 'opp' && mv && mv.targetSeat === opp.seat) {
      animateAndCommit(mv)
    }
    // an invalid release just lets the ghosted card fade back into the hand
    setSelectedUid(null)
  }
  const cardDrag = useCardDrag({ zoneAt, onDrop: handleDrop, enabled: yourTurn && !animating })

  const drag = cardDrag.drag
  const dragUid = drag?.uid ?? null
  const hoverZone = cardDrag.zone // raw zone currently under the cursor
  const dragMove = dragUid
    ? moves.find((m): m is Extract<Move, { type: 'play' }> => m.type === 'play' && m.uid === dragUid)
    : undefined
  // which zones this card may legally land on (drives the glow while dragging)
  const drop = {
    self: !!dragMove && dragMove.targetSeat === undefined, // distance/remedy/safety → own board
    opp: !!dragMove && dragMove.targetSeat === opp.seat, // hazard → opponent
    discard: yourTurn && !!dragUid, // any card → discard pile
  }

  const myTurn = state.turn === 0 && state.phase !== 'roundOver'
  const drawPhaseHuman = state.turn === 0 && state.phase === 'draw'
  // turn cue: bespoke animated indicator (no emoji) — energetic "go" pulse on
  // your turn, a calm three-dot "thinking" loop while the opponent decides
  const turnState = state.phase === 'roundOver' ? 'over' : myTurn ? 'you' : 'think'
  const statusLabel = state.phase === 'roundOver' ? '' : myTurn ? 'Your turn' : `${cur.name} is thinking`
  // you've drawn but hold nothing playable → must discard; invite the discard pile
  const mustDiscard = yourTurn && playableUids.size === 0
  const topDiscard = state.discard[state.discard.length - 1]
  const recentLog = state.log.slice(-18).reverse()

  const canDrawDeck = drawPhaseHuman && !animating && state.deck.length > 0
  const canDrawDiscard = drawPhaseHuman && !animating && state.discard.length > 0
  const drawFrom = (source: 'deck' | 'discard') => {
    if (!drawPhaseHuman || animating) return
    animateAndCommit({ type: 'draw', source })
  }

  return (
    <div className={`table ${shaking ? 'table--shake' : ''}`}>
      <header className="table__bar">
        <h1>1000 Light-Years</h1>
        <span className="table__status" title={statusLabel} aria-label={statusLabel}>
          {turnState !== 'over' && (
            <span className={`turn-cue turn-cue--${turnState}`} aria-hidden>
              {turnState === 'think' ? (
                <>
                  <i /><i /><i />
                </>
              ) : (
                <i />
              )}
            </span>
          )}
          {yourTurn && <span className="table__status-you">{AVATAR.you}</span>}
        </span>
        <div className="table__bar-actions">
          <button
            className={`btn btn--icon ${logOpen ? 'btn--icon-on' : ''}`}
            onClick={() => setLogOpen((o) => !o)}
            title="Game log"
            aria-label="Game log"
            aria-pressed={logOpen}
          >
            📜
          </button>
          <button className="btn btn--icon" onClick={newRound} title="New round" aria-label="New round">🔄</button>
          {onExit && (
            <button className="btn btn--icon" onClick={onExit} title="Card gallery" aria-label="Card gallery">🃏</button>
          )}
        </div>
      </header>

      <div className="table__body">
       <div className="table__main">
      {/* the board recedes onto a perspective plane for depth; the hand stays
          flat below it (outside this wrapper) so it reads face-on to the player */}
      <div className="table__plane">
      <div
        data-drop="opp"
        className={`dropzone ${dragUid ? (drop.opp ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
          hoverZone === 'opp' && drop.opp ? 'dropzone--hot' : ''
        }`}
      >
        <PlayerBoard
          player={opp}
          isOpponent
          avatar={AVATAR.cpu}
          active={state.turn === 1 && state.phase !== 'roundOver'}
          impact={impact?.seat === opp.seat ? impact.tone : null}
        />
        {drop.opp && (
          <span className="dropzone__tag dropzone__tag--hazard" aria-label="Drop to attack">💥</span>
        )}
      </div>

      <div className="table__opp-hand" ref={oppHandRef} aria-label={`${opp.name} holds ${opp.hand.length} cards`}>
        {opp.hand.map((c) => (
          <Card key={c.uid} faceDown size="sm" />
        ))}
      </div>

      <div className="table__center">
        <div
          ref={deckRef}
          className={`pile ${canDrawDeck ? 'pile--draw' : ''}`}
          title={canDrawDeck ? 'Tap to draw' : undefined}
        >
          <Card faceDown size="md" onClick={canDrawDeck ? () => drawFrom('deck') : undefined} />
          <span className="pile__count">{state.deck.length}</span>
          {/* drawability is shown by the bespoke pulsing ring on .pile--draw (CSS) */}
        </div>
        <div
          ref={discardRef}
          data-drop="discard"
          className={`pile dropzone ${dragUid ? (drop.discard ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
            hoverZone === 'discard' && drop.discard ? 'dropzone--hot' : ''
          } ${canDrawDiscard ? 'pile--draw' : ''} ${hideDiscardTop ? 'pile--ghost' : ''} ${
            mustDiscard ? 'pile--invite' : ''
          }`}
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
          <span className="pile__label" aria-label="Discard pile">{canDrawDiscard ? '' : '🗑️'}</span>
        </div>
      </div>

      <div
        data-drop="self"
        className={`dropzone ${dragUid ? (drop.self ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
          hoverZone === 'self' && drop.self ? 'dropzone--hot' : ''
        }`}
      >
        <PlayerBoard
          player={human}
          isOpponent={false}
          avatar={AVATAR.you}
          active={yourTurn}
          impact={impact?.seat === human.seat ? impact.tone : null}
        />
        {drop.self && <span className="dropzone__tag" aria-label="Drop to play">✅</span>}
      </div>
      </div>

      <div ref={handRef}>
        <Hand
          player={human}
          playableUids={playableUids}
          selectedUid={selectedUid}
          draggingUid={dragUid}
          incomingUid={incomingUid}
          yourTurn={yourTurn}
          onSelect={(uid) => setSelectedUid((c) => (c === uid ? null : uid))}
          onDragStart={(e, uid) => cardDrag.begin(e, uid, human.hand.find((c) => c.uid === uid)?.kind ?? '')}
          wasDragged={cardDrag.wasDragged}
        />
      </div>

       </div>

       {logOpen && (
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
       )}

       {/* commit panel: lives in the left gutter (mirrors the log) so it stays
           clear of a screen-bottom dictation/HUD overlay */}
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
      </div>

      <FlightLayer flights={flights} />
      <DragLayer drag={drag} />
      <canvas ref={burstRef} className="burst-layer" aria-hidden />
      {flash && <div key={flash.key} className={`impact-flash impact-flash--${flash.tone}`} aria-hidden />}
      {hyperwarp && (
        <HyperwarpTakeover key={hyperwarp.key} src={hyperwarp.src} onDone={() => setHyperwarp(null)} />
      )}


      {slingshot && (
        <SlingshotOverlay event={slingshot} avatar={slingshot.seat === 0 ? AVATAR.you : AVATAR.cpu} />
      )}

      {state.phase === 'roundOver' && scoreboardOpen && (
        <Scoreboard state={state} onNewRound={newRound} onClose={() => setScoreboardOpen(false)} />
      )}
      {state.phase === 'roundOver' && !scoreboardOpen && (
        <button
          className="scoreboard__reopen"
          onClick={() => setScoreboardOpen(true)}
          title="Show results"
          aria-label="Show results"
        >
          🏆
        </button>
      )}
    </div>
  )
}

function Scoreboard({
  state,
  onNewRound,
  onClose,
}: {
  state: GameState
  onNewRound: () => void
  onClose: () => void
}) {
  const scores = scoreRound(state)
  const avatarFor = (seat: number) => (seat === 0 ? AVATAR.you : AVATAR.cpu)
  return (
    // click the backdrop (outside the card) to dismiss and inspect the final board
    <div className="scoreboard" onClick={onClose}>
      <div className="scoreboard__card" onClick={(e) => e.stopPropagation()}>
        <button
          className="scoreboard__close"
          onClick={onClose}
          title="Close (view the board)"
          aria-label="Close results and view the board"
        >
          ✕
        </button>
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
