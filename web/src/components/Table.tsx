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
import { cardHeroVideo, cardVideo } from '../game/cardArt'
import { playSfx, toggleMuted } from '../audio/sfx'
import { useMuted } from '../audio/useMuted'
import { type BurstType, useBurstLayer } from './BurstLayer'
import { Card } from './Card'
import { Icon, type IconName } from './Icon'
import { Avatar } from './Avatar'
import { CardTakeover, type TakeoverVariant } from './CardTakeover'
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
const whoFor = (seat: number): 'you' | 'cpu' => (seat === 0 ? 'you' : 'cpu')
const LOG_ICON: Record<string, IconName> = {
  hazard: 'burst',
  remedy: 'wrench',
  safety: 'shield',
  distance: 'thrust',
  coup: 'bolt',
  win: 'trophy',
  info: 'dot',
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

// A fixed card-sized rect centred over a container (used for the opponent's
// draw/discard flights now that its face-down hand row is gone — cards fly
// to/from the opponent's board area at deck-card size instead).
function boardSlotRect(el: HTMLElement | null, width: number): Rect | null {
  if (!el) return null
  const b = el.getBoundingClientRect()
  return { left: b.left + b.width / 2 - width / 2, top: b.top + b.height / 2 - (width * 4) / 3 / 2, width }
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
  // full-screen hero takeover for headline plays (warp-200 + hazard/remedy/safety)
  const [takeover, setTakeover] = useState<{ src: string; variant: TakeoverVariant; key: number } | null>(null)
  const lastSlingId = useRef<number>(-1)
  // "draw first" nudge: set when you reach for a hand card before drawing — the
  // pile draw-cues blink fast for a couple seconds to pull your eye to the deck
  const [drawNudge, setDrawNudge] = useState(false)
  const drawNudgeTimer = useRef<number>()

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
  const muted = useMuted()

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
    const isPlayer = actor === 0
    const card = state.players[actor].hand.find((c) => c.uid === move.uid)
    const def = card ? CARD_DEFS[card.kind] : undefined
    if (!card || !def) return
    // a full-screen hero takeover plays the card's clip over the board, then
    // fades to REVEAL the (already-applied) board result. The board effects below
    // still fire underneath. Skipped under reduced motion.
    const heroClip = cardHeroVideo(card.kind) ?? cardVideo(card.kind, ['idle', 'hover'])
    const fireTakeover = (variant: TakeoverVariant) => {
      if (heroClip && !prefersReducedMotion()) setTakeover({ src: heroClip, variant, key: ++impactSeq.current })
    }

    if (def.type === 'distance') {
      window.dispatchEvent(new CustomEvent('spacerace:warp', { detail: { ly: def.value ?? 50 } }))
      // the big 200-ly jump earns a full-screen hyperwarp hero moment + whoosh —
      // but only for YOUR jump; the AI just moving isn't your cinematic moment
      if (def.value === 200) {
        if (isPlayer) fireTakeover('warp')
        playSfx('warp')
      } else {
        playSfx('distance')
      }
      return
    }
    const victimSeat = def.type === 'hazard' ? move.targetSeat ?? actor : actor
    const el = document.querySelector<HTMLElement>(victimSeat === 0 ? '[data-drop="self"]' : '[data-drop="opp"]')
    if (el) {
      const r = el.getBoundingClientRect()
      fireBurst(r.left + r.width / 2, r.top + r.height / 2, def.type as BurstType)
    }
    if (def.type === 'hazard') {
      triggerHit(victimSeat)
      // takeover for YOUR hazard, or for the AI hazarding YOU (getting hit is the
      // player's moment) — but NOT the AI's other plays
      if (isPlayer || victimSeat === 0) fireTakeover('hazard')
      playSfx('hazard')
    } else if (def.type === 'remedy') {
      setTimeout(() => triggerRecover(victimSeat), 150) // hit-pause beat
      if (isPlayer) fireTakeover('remedy') // the AI fixing its own ship isn't your moment
      playSfx('remedy')
    } else if (def.type === 'safety') {
      if (isPlayer) fireTakeover('safety')
      playSfx('safety')
    }
  }

  // Apply a move, but first fly the card between pile and hand so draws/discards
  // read as motion. Only draw/discard touch the piles — plays/passes commit
  // instantly. Honours reduced-motion by committing immediately.
  // `fromOverride` lets a crane-drop hand off the floating card's exact position.
  const animateAndCommit = (move: Move, fromOverride?: Rect) => {
    // a card sliding off a pile (draw or discard) gets a light flick/whoosh
    if (move.type === 'draw') playSfx('card-flick')
    else if (move.type === 'discard') playSfx('card-flick', { rate: 0.9 })
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

    // the opponent's hand row is gone — fly its draws/discards to/from its board
    const deckCardW = cardRectOf(deckRef.current)?.width ?? 120
    if (move.type === 'draw') {
      const source = move.source ?? 'deck'
      from = cardRectOf(source === 'discard' ? discardRef.current : deckRef.current)
      to = boardSlotRect(oppHandRef.current, deckCardW)
      faceDown = true // the AI's hand is hidden, so its draws arrive face-down
    } else {
      // discard: from the played card's slot (or the crane drop point) → discard pile
      const slotEl = document.querySelector<HTMLElement>(`.hand__slot[data-uid="${move.uid}"]`)
      from = fromOverride ?? (actor === 0 ? cardRectOf(slotEl) : boardSlotRect(oppHandRef.current, deckCardW))
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
    if (state.phase === 'roundOver') {
      setScoreboardOpen(true)
      playSfx('win') // a cheerful chime as the round resolves
    }
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
    // hold the loop during flights/slingshot (animating) AND while a full-screen
    // takeover is on screen, so the AI never moves until the clip concludes
    if (state.phase === 'roundOver' || animating || takeover) return
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
  }, [state, cur.isAI, animating, takeover])

  // ---- Slingshot hero animation: play it, and pause the loop while it runs ----
  useEffect(() => {
    const ev = state.lastSlingshot
    if (!ev || ev.id === lastSlingId.current) return
    // if the triggering hazard's full-screen takeover is still on screen, wait —
    // this effect re-runs when `takeover` clears, so the slingshot plays AFTER
    // the hazard moment, clearly sequential (never overlapping)
    if (takeover) return
    lastSlingId.current = ev.id
    setSlingshot(ev)
    setAnimating(true)
    playSfx('slingshot')
    const t = setTimeout(() => {
      setSlingshot(null)
      setAnimating(false)
    }, SLINGSHOT_MS)
    return () => clearTimeout(t)
  }, [state.lastSlingshot, takeover])

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

  const drawPhaseHuman = state.turn === 0 && state.phase === 'draw'
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
  // You poked a hand card but haven't drawn yet — flash the draw cues faster for
  // a beat to point you at the deck/discard. Restart the window on every poke.
  const nudgeToDraw = () => {
    if (!drawPhaseHuman || animating) return
    setDrawNudge(true)
    window.clearTimeout(drawNudgeTimer.current)
    drawNudgeTimer.current = window.setTimeout(() => setDrawNudge(false), 2400)
  }
  useEffect(() => () => window.clearTimeout(drawNudgeTimer.current), [])

  return (
    <div className={`table ${shaking ? 'table--shake' : ''} ${selectedUid && yourTurn ? 'table--committing' : ''}`}>
      <header className="table__bar">
        <h1>1000 Light-Years</h1>
        <div className="table__bar-actions">
          <button
            className="btn btn--icon"
            onClick={() => toggleMuted()}
            title={muted ? 'Unmute sound' : 'Mute sound'}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            aria-pressed={muted}
          >
            <Icon name={muted ? 'sound-off' : 'sound-on'} />
          </button>
          <button
            className={`btn btn--icon ${logOpen ? 'btn--icon-on' : ''}`}
            onClick={() => {
              playSfx('ui-click')
              setLogOpen((o) => !o)
            }}
            title="Game log"
            aria-label="Game log"
            aria-pressed={logOpen}
          >
            <Icon name="log" />
          </button>
          <button
            className="btn btn--icon"
            onClick={() => {
              playSfx('ui-click')
              newRound()
            }}
            title="New round"
            aria-label="New round"
          >
            <Icon name="restart" />
          </button>
          {onExit && (
            <button
              className="btn btn--icon"
              onClick={() => {
                playSfx('ui-click')
                onExit()
              }}
              title="Card gallery"
              aria-label="Card gallery"
            >
              <Icon name="cards" />
            </button>
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
        ref={oppHandRef}
        className={`dropzone ${dragUid ? (drop.opp ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
          hoverZone === 'opp' && drop.opp ? 'dropzone--hot' : ''
        }`}
      >
        <PlayerBoard
          player={opp}
          isOpponent
          who="cpu"
          active={state.turn === 1 && state.phase !== 'roundOver'}
          impact={impact?.seat === opp.seat ? impact.tone : null}
        />
        {drop.opp && (
          <span className="dropzone__tag dropzone__tag--hazard" aria-label="Drop to attack"><Icon name="burst" /></span>
        )}
      </div>

      <div className="table__center">
        <div
          ref={deckRef}
          className={`pile ${canDrawDeck ? 'pile--draw' : ''} ${drawNudge ? 'pile--nudge' : ''}`}
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
          } ${canDrawDiscard ? 'pile--draw' : ''} ${drawNudge ? 'pile--nudge' : ''} ${
            hideDiscardTop ? 'pile--ghost' : ''
          } ${mustDiscard ? 'pile--invite' : ''}`}
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
          <span className="pile__label" aria-label="Discard pile">{canDrawDiscard ? null : <Icon name="bin" size={16} />}</span>
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
          who="you"
          active={yourTurn}
          impact={impact?.seat === human.seat ? impact.tone : null}
        />
        {drop.self && <span className="dropzone__tag" aria-label="Drop to play"><Icon name="check" /></span>}
      </div>
      </div>

      {/* tap-catcher: with a card selected, tapping anywhere off the card + action
          bar returns it to the hand (clears the selection). Hidden during a drag
          so it never intercepts the crane drop hit-test. The hand sits above it,
          so tapping another card still re-selects, and the lifted card toggles. */}
      {selectedUid && yourTurn && !dragUid && (
        <div className="select-scrim" onClick={() => setSelectedUid(null)} aria-hidden />
      )}

      <div ref={handRef} className="hand-wrap" onPointerDownCapture={drawPhaseHuman ? nudgeToDraw : undefined}>
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
               {e.seat >= 0 && <span className="log__who"><Avatar who={whoFor(e.seat)} /></span>}
               <span className="log__icon"><Icon name={LOG_ICON[e.kind] ?? 'dot'} /></span>
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
               <Icon name={selectedDef.type === 'hazard' ? 'burst' : 'play'} />
             </button>
             <button
               className="btn btn--discard btn--bigicon"
               onClick={doDiscard}
               title="Discard"
               aria-label="Discard"
             >
               <Icon name="bin" />
             </button>
           </>
         )}
       </div>
      </div>

      <FlightLayer flights={flights} />
      <DragLayer drag={drag} />
      <canvas ref={burstRef} className="burst-layer" aria-hidden />
      {flash && <div key={flash.key} className={`impact-flash impact-flash--${flash.tone}`} aria-hidden />}
      {takeover && (
        <CardTakeover key={takeover.key} src={takeover.src} variant={takeover.variant} onDone={() => setTakeover(null)} />
      )}


      {slingshot && (
        <SlingshotOverlay event={slingshot} who={whoFor(slingshot.seat)} />
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
          <img className="scoreboard__reopen-img" src="/ui/trophy-hero.png" alt="" aria-hidden draggable={false} />
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
  // map the score-line glyphs returned by engine.ts (untouched) → bespoke SVG
  const scoreIcon: Record<string, IconName> = { '🚀': 'thrust', '🛡️': 'shield' }
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
          <img className="scoreboard__trophy-img" src="/ui/trophy-hero.png" alt="" aria-hidden draggable={false} />
          {state.winner != null && (
            <span className="scoreboard__winner"><Avatar who={whoFor(state.winner)} /></span>
          )}
        </div>
        <div className="scoreboard__cols">
          {scores.map((s) => (
            <div key={s.seat} className={`scorecol ${state.winner === s.seat ? 'scorecol--win' : ''}`}>
              <h3 aria-label={s.name}><Avatar who={whoFor(s.seat)} /></h3>
              <ul>
                {s.lines.map((l, i) => (
                  <li key={i} title={l.label}>
                    <span aria-hidden><Icon name={scoreIcon[l.icon] ?? 'thrust'} /></span>
                    <b>{l.points}</b>
                  </li>
                ))}
              </ul>
              <div className="scorecol__total" title="Total">
                <span aria-hidden><Icon name="trophy" /></span>
                <b>{s.total}</b>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn--play btn--bigicon btn--big" onClick={onNewRound} title="Play again" aria-label="Play again">
          <Icon name="restart" />
        </button>
      </div>
    </div>
  )
}
