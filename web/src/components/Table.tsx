import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_DEFS, type CardInstance } from '../game/cards'
import {
  applyMove,
  canBurst,
  chooseMove,
  createGame,
  drawReveal,
  legalMoves,
  scoreRound,
  type GameRules,
  type GameState,
  type Move,
  type SlingshotEvent,
} from '../game'
import { MOMENTUM_CAP } from '../game/rules'
import { loadRules } from '../settings'
import { Settings } from './Settings'
import { cardHeroVideo, cardVideo } from '../game/cardArt'
import { preloadClips } from '../preloadHero'
import { playSfx, toggleMuted } from '../audio/sfx'
import * as haptics from '../native/haptics'
import { useBackHandler } from '../native/backButton'
import { useMuted } from '../audio/useMuted'
import { type BurstType, useBurstLayer } from './BurstLayer'
import { Card } from './Card'
import { Icon, type IconName } from './Icon'
import { Avatar } from './Avatar'
import { CardTakeover, type TakeoverVariant } from './CardTakeover'
import { DragLayer, useCardDrag } from './DragLayer'
import { FlightLayer, useFlights } from './FlightLayer'
import { whoFor } from './GameLog'
import { SlingshotOverlay } from './SlingshotOverlay'
import { TableView } from './TableView'
import { WinTakeover } from './WinTakeover'
import { prefersReducedMotion, type Rect } from '../motion'
import './Table.css'

const DRAW_DELAY = 480
const AI_DELAY = 780
const SLINGSHOT_MS = 2800
// SCRY: the AI "reads" the revealed cards for a beat before picking one.
const SCRY_DELAY = 620

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

// ── Dev preview trigger ─────────────────────────────────────────────────────
// ?win=human  → immediately mount WinTakeover with human-wins sample data
// ?win=ai     → immediately mount WinTakeover with AI-wins sample data
// Inert when the param is absent; safe to leave in (it gates on the real game
// state so it can't accidentally fire during a real round).
function buildPreviewState(winner: 0 | 1): GameState {
  const s = createGame()
  s.phase = 'roundOver'
  s.winner = winner
  // Human: 1000 ly — 200+200+200+200+100+100 in distance pile, 2 coups, 2 safeties
  s.players[0].distance = 1000
  s.players[0].coupFourres = 2
  s.players[0].safeties = ['ace-pilot', 'diamond-thruster']
  s.players[0].distancePile = [
    { uid: 'd1', kind: 'warp-200' }, { uid: 'd2', kind: 'warp-200' },
    { uid: 'd3', kind: 'warp-200' }, { uid: 'd4', kind: 'warp-200' },
    { uid: 'd5', kind: 'warp-100' }, { uid: 'd6', kind: 'warp-100' },
  ]
  // AI: 475 ly — 200+200+75 in pile, 0 coups
  s.players[1].distance = 475
  s.players[1].coupFourres = 0
  s.players[1].safeties = []
  s.players[1].distancePile = [
    { uid: 'e1', kind: 'warp-200' }, { uid: 'e2', kind: 'warp-200' },
    { uid: 'e3', kind: 'warp-75' },
  ]
  return s
}

const WIN_PREVIEW_PARAM = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('win')
  : null

// ?catchup=demo → start a catch-up-valve game with YOU already ~500 ly behind, so
// your very next deck draw opens the valve (the gold "tailwind" chooser). A dev /
// playtest seam to feel the telegraph instantly; inert when the param is absent.
const CATCHUP_DEMO = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('catchup') === 'demo'
  : false
function buildCatchUpDemoGame(): GameState {
  const s = createGame({ rules: { catchUp: true } })
  s.players[1].distance = 500 // CPU sprints ahead → you're 500 ly behind (>200 deficit)
  s.players[1].started = true
  s.turn = 0
  s.phase = 'draw' // your draw will open the valve
  return s
}

// ── Dev preview trigger: ?momentum=N ────────────────────────────────────────
// Starts a MOMENTUM game with the human's meter pre-charged to N, both ships
// launched, and a couple of warp cards in hand — so the spendable gold gauge +
// breakaway double-jump are reachable in one tap (no full game to grind first).
// Inert unless the param is present; only seeds the human, never alters rules.
const MOMENTUM_PREVIEW_PARAM = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('momentum')
  : null

function seedMomentumPreview(charge: number): GameState {
  const s = createGame({ rules: { momentum: true } })
  const [me, opp] = s.players
  me.started = true
  opp.started = true
  s.momentum[0] = Math.max(0, Math.min(MOMENTUM_CAP, charge))
  // guarantee the human holds playable warps so canBurst is satisfied
  me.hand = [
    { uid: 'pm-w1', kind: 'warp-75' },
    { uid: 'pm-w2', kind: 'warp-100' },
    { uid: 'pm-w3', kind: 'warp-75' },
    ...me.hand.slice(3),
  ]
  s.phase = 'play' // skip straight to the human's play phase
  s.turn = 0
  return s
}

// ?selfheal=demo → start a self-healing-hazards game with YOU already launched and
// blocked by a Busted Thruster (aged so the paralysis timer reads its first tick),
// holding warps you can't use until the lane recovers. A dev / playtest seam to
// feel the countdown ring + the release burst instantly; inert when absent.
const SELFHEAL_DEMO = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('selfheal') === 'demo'
  : false
function buildSelfHealDemoGame(): GameState {
  const s = createGame({ rules: { selfHeal: true } })
  const [me, opp] = s.players
  me.started = true
  opp.started = true
  // a blocking hazard already on you, freshly aged to its first victim turn → the
  // paralysis timer renders at full (3 turns left) and counts down as you discard.
  me.battle.engine = [{ uid: 'sh-hz', kind: 'busted-thruster', hazardAge: 1 }]
  me.hand = [
    { uid: 'sh-w1', kind: 'warp-100' },
    { uid: 'sh-w2', kind: 'warp-75' },
    ...me.hand.slice(2),
  ]
  s.phase = 'play' // straight to your play phase — you'll have to discard while blocked
  s.turn = 0
  return s
}

/** Build the initial game state, honoring any dev-preview URL param (momentum
 * meter / catch-up valve / self-heal demos), else a normal new game from saved rules. */
function buildInitialGame(): GameState {
  if (MOMENTUM_PREVIEW_PARAM != null)
    return seedMomentumPreview(Number(MOMENTUM_PREVIEW_PARAM) || MOMENTUM_CAP)
  if (CATCHUP_DEMO) return buildCatchUpDemoGame()
  if (SELFHEAL_DEMO) return buildSelfHealDemoGame()
  return createGame({ rules: loadRules() })
}

export function Table({
  onExit,
  onStateChange,
}: {
  onExit?: () => void
  /** ADDITIVE: called with the live GameState on every change. Used ONLY by the
   * phone (`?mode=tv-play`) to broadcast state to a spectating TV. Undefined for
   * the normal app → the effect below is a no-op, so behaviour/appearance are
   * byte-for-byte unchanged. */
  onStateChange?: (game: GameState) => void
}) {
  // the persisted gameplay-mode preference; applied to NEW games (never mutated
  // mid-game — flipping a toggle takes effect on the next new round).
  const [rules, setRules] = useState<GameRules>(() => loadRules())
  const [state, setState] = useState<GameState>(() => buildInitialGame())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [slingshot, setSlingshot] = useState<SlingshotEvent | null>(null)
  const [animating, setAnimating] = useState(false)
  // hide the top discard while it's flying off into someone's hand (no double image)
  const [hideDiscardTop, setHideDiscardTop] = useState(false)
  // the freshly-drawn hand card stays hidden until its flight lands on it
  const [incomingUid, setIncomingUid] = useState<string | null>(null)
  // ── preview mode: ?win=human or ?win=ai on mount ──
  // Holds the synthetic GameState for preview; null = normal play mode.
  const [previewState, setPreviewState] = useState<GameState | null>(null)

  // win takeover: shown immediately on roundOver; dismissed to start a new round.
  // If the player wants to peek at the final board first, they can use scoreboard.
  const [winTakeoverShown, setWinTakeoverShown] = useState(false)
  // the end-of-round scoreboard can be dismissed to inspect the final board
  const [scoreboardOpen, setScoreboardOpen] = useState(false)
  // the game log is tucked away in a dropdown, summoned from the header
  const [logOpen, setLogOpen] = useState(false)

  // Android Back closes an open menu-style overlay (settings / scoreboard / log)
  // instead of exiting the app; each only intercepts while it's actually open, so
  // Back falls through to the app root (double-tap-to-exit) when none are up.
  // See src/native/backButton.ts. No-op on web/iOS.
  useBackHandler(() => { setLogOpen(false); return true }, logOpen)
  useBackHandler(() => { setScoreboardOpen(false); return true }, scoreboardOpen)
  useBackHandler(() => { setSettingsOpen(false); return true }, settingsOpen)
  // transient impact feel: a screen shake, a full-screen flash, and a per-board
  // hit-recoil / recovery-spring (keyed so the same board can re-trigger)
  const [shaking, setShaking] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'hit' | 'recover'; key: number } | null>(null)
  const [impact, setImpact] = useState<{ seat: number; tone: 'hit' | 'recover'; key: number } | null>(null)
  const impactSeq = useRef(0)
  // full-screen hero takeover for headline plays (warp-200 + hazard/remedy/safety)
  const [takeover, setTakeover] = useState<{ src: string; kind: string; variant: TakeoverVariant; key: number } | null>(
    null,
  )
  const lastSlingId = useRef<number>(-1)
  const lastHealId = useRef<number>(-1)
  // the deck size of a brand-fresh deal (captured on mount) — used to tell an
  // untouched deal from a game actually in progress for the unload guard
  const freshDeckLen = useRef(state.deck.length)
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

  // ADDITIVE phone→TV broadcast: publish the live state to a spectating TV on
  // every change. No-op (and renders nothing) when onStateChange is undefined —
  // i.e. for the normal app — so this is byte-for-byte invisible there.
  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  // MOMENTUM mode: per-board gauge data (null = mode off → no gauge rendered).
  // The human's gauge becomes a tappable SPEND when canBurst is true.
  const momentumOn = state.rules.momentum
  const humanCanBurst = momentumOn && yourTurn && !animating && canBurst(state, 0)

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
    // Standard clip is the always-available fallback; CardTakeover upgrades to a
    // crisper `<kind>.hero.mp4` itself on wide viewports when the kind ships one.
    const standardClip = cardVideo(card.kind, ['idle', 'hover'])
    const fireTakeover = (variant: TakeoverVariant) => {
      if (standardClip && !prefersReducedMotion())
        setTakeover({ src: standardClip, kind: card.kind, variant, key: ++impactSeq.current })
    }

    if (def.type === 'distance') {
      window.dispatchEvent(new CustomEvent('spacerace:warp', { detail: { ly: def.value ?? 50 } }))
      // ONLY the big 200-ly jump earns the full-screen hyperwarp hero moment —
      // and only for YOUR jump; the AI just moving isn't your cinematic moment.
      // Smaller warps stay sfx-only (the owner's explicit call: the takeover is
      // the 200's signature).
      if (def.value === 200) {
        if (isPlayer) fireTakeover('warp')
        playSfx('warp')
        if (isPlayer) haptics.boost()
      } else {
        playSfx('distance')
        if (isPlayer) haptics.cardDrop()
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
      // buzz for your own hit or the AI hazarding YOU — getting knocked is the
      // moment worth feeling; the AI's unrelated plays aren't
      if (isPlayer || victimSeat === 0) haptics.hazardHit()
    } else if (def.type === 'remedy') {
      setTimeout(() => triggerRecover(victimSeat), 150) // hit-pause beat
      if (isPlayer) fireTakeover('remedy') // the AI fixing its own ship isn't your moment
      playSfx('remedy')
      if (isPlayer) haptics.remedyPlay()
    } else if (def.type === 'safety') {
      if (isPlayer) fireTakeover('safety')
      playSfx('safety')
      if (isPlayer) haptics.cardDrop()
    }
  }

  // Apply a move, but first fly the card between pile and hand so draws/discards
  // read as motion. Only draw/discard touch the piles — plays/passes commit
  // instantly. Honours reduced-motion by committing immediately.
  // `fromOverride` lets a crane-drop hand off the floating card's exact position.
  // bare state commit, no flight (used for a scry deck-draw → chooser, and the
  // AI's scry pick — neither has a single card to fly off a pile)
  const commit = (move: Move) => setState((s) => applyMove(s, move))

  // SCRY / CATCH-UP: a deck-draw that will reveal into the chooser (not land one
  // card in hand) just commits — there's no single flyer. The pick is the
  // satisfying motion. drawReveal>1 covers BOTH plain scry and the catch-up valve
  // opening for a trailing player. Discard-source draws still fly normally.
  const isScryDeckDraw = (move: Move) =>
    move.type === 'draw' &&
    (move.source ?? 'deck') === 'deck' &&
    state.deck.length > 1 &&
    drawReveal(state, state.turn) > 1

  const animateAndCommit = (move: Move, fromOverride?: Rect) => {
    if (isScryDeckDraw(move)) {
      playSfx('card-flick')
      commit(move)
      return
    }
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

  // pop the win takeover (and scoreboard backup) each time a round ends
  useEffect(() => {
    if (state.phase !== 'roundOver') return
    // if the WINNING play has its own full-screen card takeover still on screen
    // (e.g. a game-winning safety or warp-200), wait — this effect re-runs when
    // `takeover` clears, so the win takeover plays AFTER that card animation
    // finishes instead of cutting it off. (Mirrors the slingshot deferral below.)
    if (takeover) return
    setWinTakeoverShown(true)
    setScoreboardOpen(false) // scoreboard stays hidden until takeover is done
    // NOTE: the win/loss takeover audio is fired by WinTakeover itself on mount,
    // by variant (win-takeover swell vs. lose-takeover tone), so win and loss
    // sound DISTINCT. We deliberately do NOT play the generic `win` chime here —
    // it used to fire for BOTH outcomes (win and loss sounded identical).
  }, [state.phase, takeover])

  // ?win=human / ?win=ai preview trigger — fires once on mount, only in dev
  // (the URL param check is module-level so it's evaluated at parse time, zero runtime
  // cost when absent). Gates on previewState===null so it only fires once even if
  // StrictMode double-invokes the effect.
  useEffect(() => {
    if (!WIN_PREVIEW_PARAM) return
    const winner = WIN_PREVIEW_PARAM === 'ai' ? 1 : 0
    setPreviewState(buildPreviewState(winner as 0 | 1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    if (state.phase === 'scry' && cur.isAI) {
      // AI peeks and picks the card it needs (no flight — happens "in its head").
      delay = SCRY_DELAY
      action = () => commit(chooseMove(state) ?? { type: 'pick', uid: state.scry![0].uid })
    } else if (state.phase === 'draw' && cur.isAI) {
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
    haptics.coupFourre() // the showiest reversal — always worth a heavy buzz
    const t = setTimeout(() => {
      setSlingshot(null)
      setAnimating(false)
    }, SLINGSHOT_MS)
    return () => clearTimeout(t)
  }, [state.lastSlingshot, takeover])

  // ---- Self-healing hazards: a blocking hazard recovered on its own ----------
  // The paralysis timer just ran out → make the RELEASE unmistakable and causal:
  // fire the same green recovery spring + chime a real remedy plays PLUS a green
  // "snap-free" burst right over the freed board, so it reads as "the timer
  // expired and the lane opened," never a silent state flip.
  useEffect(() => {
    const ev = state.lastHeal
    if (!ev || ev.id === lastHealId.current) return
    lastHealId.current = ev.id
    triggerRecover(ev.seat)
    playSfx('remedy')
    if (ev.seat === 0) haptics.remedyPlay() // your lane freed itself
    const el = document.querySelector<HTMLElement>(ev.seat === 0 ? '[data-drop="self"]' : '[data-drop="opp"]')
    if (el) {
      const r = el.getBoundingClientRect()
      fireBurst(r.left + r.width / 2, r.top + r.height / 2, 'remedy')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastHeal])

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
    haptics.cardDrop()
    animateAndCommit({ type: 'discard', uid: selectedUid })
    setSelectedUid(null)
  }
  // MOMENTUM: spend the full meter for a BREAKAWAY. Fire a gold burst over the
  // player's board + a sound so the spend is visceral, then commit — the turn
  // stays open and the next distance hop is the free one.
  const doBurst = () => {
    if (!humanCanBurst) return
    setSelectedUid(null)
    const el = document.querySelector<HTMLElement>('[data-drop="self"]')
    if (el) {
      const r = el.getBoundingClientRect()
      fireBurst(r.left + r.width / 2, r.top + r.height / 2, 'safety') // gold burst
    }
    playSfx('warp') // a charged whoosh — momentum unleashed
    haptics.boost()
    commit({ type: 'burst' })
  }
  const newRound = () => {
    setSelectedUid(null)
    setWinTakeoverShown(false)
    setScoreboardOpen(false)
    // re-read the persisted preference so a settings change applies to this round
    const fresh = loadRules()
    setRules(fresh)
    setState(createGame({ rules: fresh }))
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

  // Warn before leaving/refreshing with a game actually IN PROGRESS (state is
  // in-memory and lost). Gate it: not over, and meaningfully touched — a card has
  // moved off the deck, the log grew past the opening line, or someone is moving.
  // A brand-fresh untouched deal stays silent. This effect lives in <Table>, which
  // only mounts in the game view, so the gallery never triggers it.
  const gameInProgress =
    state.phase !== 'roundOver' &&
    (state.deck.length !== freshDeckLen.current ||
      state.log.length > 1 ||
      state.players.some((p) => p.started || p.distance > 0 || p.safeties.length > 0))
  useEffect(() => {
    if (!gameInProgress) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // required by some browsers to actually show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [gameInProgress])

  // Idle-warm the takeover clips BEFORE a takeover needs them so it plays
  // instantly (no cold-fetch stall / iOS play button on the gesture-less AI path).
  // The key changes only when the relevant kinds change; preloadClips dedupes.
  const heroPreloadKey = useMemo(() => {
    const mine = human.hand.map((c) => c.kind)
    const aiHazards = opp.hand.filter((c) => CARD_DEFS[c.kind]?.type === 'hazard').map((c) => c.kind)
    return `${mine.join(',')}|${aiHazards.join(',')}`
  }, [human.hand, opp.hand])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const aiHazards = opp.hand.filter((c) => CARD_DEFS[c.kind]?.type === 'hazard')
    if (window.innerWidth > 760) {
      // WIDE: the takeover upgrades to the crisp hero clip — warm those. YOUR
      // takeover-kind hand cards (hazard/remedy/safety/warp-200) + the AI's
      // hazards (the AI only fires a takeover for a hazard-on-you, per #52).
      preloadClips([
        ...human.hand.map((c) => cardHeroVideo(c.kind)),
        ...aiHazards.map((c) => cardHeroVideo(c.kind)),
      ])
    } else {
      // MOBILE: the takeover uses the STANDARD clip. The AI's hazard cards render
      // face-down and are never hovered/selected, so their clip is NEVER cached —
      // the gesture-less AI-hazard-on-you takeover would fetch it COLD and (on
      // iOS) surface a native play button. Warm the AI's hazard standard clips so
      // the takeover plays from cache. (Your own plays carry a user gesture, so
      // their takeover autoplays even cold — no need to warm those on mobile.)
      preloadClips(aiHazards.map((c) => cardVideo(c.kind, ['idle'])))
    }
    // human.hand/opp.hand are captured via heroPreloadKey (their relevant kinds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroPreloadKey])

  const canDrawDeck = drawPhaseHuman && !animating && state.deck.length > 0
  const canDrawDiscard = drawPhaseHuman && !animating && state.discard.length > 0
  const drawFrom = (source: 'deck' | 'discard') => {
    if (!drawPhaseHuman || animating) return
    haptics.cardPick()
    animateAndCommit({ type: 'draw', source })
  }

  // SCRY: the human is peeking at the top of the deck and must pick one card.
  const scryPhaseHuman = state.turn === 0 && state.phase === 'scry'
  const pickScry = (uid: string) => {
    if (!scryPhaseHuman || animating) return
    playSfx('card-flick')
    haptics.cardPick()
    commit({ type: 'pick', uid })
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
    <div className={`table ${shaking ? 'table--shake' : ''}`}>
      <header className="table__bar">
        <h1>Space Race</h1>
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
            className={`btn btn--icon ${settingsOpen ? 'btn--icon-on' : ''}`}
            onClick={() => {
              playSfx('ui-click')
              setSettingsOpen(true)
            }}
            title="Settings"
            aria-label="Settings"
            aria-pressed={settingsOpen}
          >
            <Icon name="gear" />
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

      <TableView
        game={state}
        showLog={logOpen}
        play={{
          oppHandRef,
          deckRef,
          discardRef,
          handRef,
          dragUid,
          hoverZone,
          drop,
          impact,
          canDrawDeck,
          canDrawDiscard,
          drawFrom,
          drawNudge,
          hideDiscardTop,
          mustDiscard,
          drawPhaseHuman,
          nudgeToDraw,
          yourTurn,
          humanCanBurst,
          doBurst,
          selectedUid,
          setSelectedUid,
          playableUids,
          incomingUid,
          cardDrag,
          selectedDef,
          selectedKind,
          selectedPlay,
          playLabel,
          doPlay,
          doDiscard,
        }}
      />

      <FlightLayer flights={flights} />
      <DragLayer drag={drag} />
      <canvas ref={burstRef} className="burst-layer" aria-hidden />
      {flash && <div key={flash.key} className={`impact-flash impact-flash--${flash.tone}`} aria-hidden />}
      {takeover && (
        <CardTakeover
          key={takeover.key}
          src={takeover.src}
          kind={takeover.kind}
          variant={takeover.variant}
          onDone={() => setTakeover(null)}
        />
      )}


      {slingshot && (
        <SlingshotOverlay event={slingshot} who={whoFor(slingshot.seat)} />
      )}

      {/* SCRY: the human peeks the top of the deck and picks one card. */}
      {scryPhaseHuman && state.scry && (
        <ScryChooser cards={state.scry} onPick={pickScry} disabled={animating} catchUp={state.catchUpScry} />
      )}

      {settingsOpen && (
        <Settings
          rules={rules}
          onChange={setRules}
          onClose={() => setSettingsOpen(false)}
          gameInProgress={gameInProgress}
        />
      )}

      {/* ?win=human / ?win=ai preview takeover — mounts over the live game board.
          Dismiss clears the preview (reload to re-trigger). Never fires during a real
          round because previewState is only set from the URL param, not from game logic. */}
      {previewState && (
        <WinTakeover
          key="preview"
          state={previewState}
          onDone={() => setPreviewState(null)}
          onDismiss={() => setPreviewState(null)}
        />
      )}

      {/* Win takeover: shown first on roundOver; player hits play-again to start a new round.
          Alternatively they can dismiss it and inspect the board, then open scoreboard. */}
      {!previewState && state.phase === 'roundOver' && winTakeoverShown && (
        <WinTakeover
          state={state}
          onDone={newRound}
          onDismiss={() => {
            setWinTakeoverShown(false)
            setScoreboardOpen(true)
          }}
        />
      )}
      {/* Scoreboard: shown after the takeover if the player wants to inspect the board */}
      {state.phase === 'roundOver' && !winTakeoverShown && scoreboardOpen && (
        <Scoreboard state={state} onNewRound={newRound} onClose={() => setScoreboardOpen(false)} />
      )}
      {state.phase === 'roundOver' && !winTakeoverShown && !scoreboardOpen && (
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

/**
 * SCRY chooser: the top-of-deck cards revealed face-up. Tap one to take it; the
 * rest slide back under the deck. Word-free — a scout/telescope glyph + a row of
 * real cards + a pulsing "pick me" ring. A 5-year-old reads it as "choose one".
 */
function ScryChooser({
  cards,
  onPick,
  disabled,
  catchUp,
}: {
  cards: CardInstance[]
  onPick: (uid: string) => void
  disabled: boolean
  /** the catch-up valve opened this peek (trailing player) → word-free tailwind
   * telegraph: a warm glow + extra revealed cards, so the boost reads as a gift. */
  catchUp?: boolean
}) {
  // a soft chime the first time a catch-up peek appears, so the boost is felt
  useEffect(() => {
    if (catchUp) playSfx('safety', { rate: 1.15 })
  }, [catchUp])
  return (
    <div
      className={`scry ${catchUp ? 'scry--catchup' : ''}`}
      role="dialog"
      aria-label="Choose a card from the top of the deck"
    >
      <div className="scry__backdrop" aria-hidden />
      {catchUp && <div className="scry__tailwind" aria-hidden />}
      <div className="scry__panel">
        <div className="scry__badge" aria-hidden>
          <Icon name="cards" />
        </div>
        <div className="scry__row">
          {cards.map((c) => (
            <button
              key={c.uid}
              type="button"
              className="scry__pick"
              onClick={() => !disabled && onPick(c.uid)}
              disabled={disabled}
              aria-label={`Take ${CARD_DEFS[c.kind].title}`}
            >
              <Card kind={c.kind} size="md" showName={false} />
              <span className="scry__plus" aria-hidden>
                <Icon name="check" />
              </span>
            </button>
          ))}
        </div>
      </div>
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
