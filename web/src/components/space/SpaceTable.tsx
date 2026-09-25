// THE SPACE TABLE: the game's presentation, adrift in open space.
//
// A photographic nebula with a live starfield (SpaceScene), the printed cards
// at their real 5:7 shape, sized off BOTH viewport dimensions so they fill a
// phone or a desktop, and every card that moves driven by spring physics
// (physics.ts). No mats, no slots: your area is a race track, the card you're
// flying under (a green light, or the hazard that has you stuck, which is the
// loudest thing on screen), and the safeties you've collected. The rival is
// one compact strip.
//
// This file is presentation + touch only. <Table> still owns the game: it
// passes the state and the actions in, and flies cards through the same World
// when a move commits (see Table's spaceAnimateAndCommit).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CARD_DEFS } from '../../game/cards'
import { activeHazard, hazardTurnsLeft, SPEED_LIMIT_VALUE, speedLimited, type GameState, type Move, type PlayerState } from '../../game'
import { MOMENTUM_CAP } from '../../game/rules'
import { playSfx } from '../../audio/sfx'
import * as haptics from '../../native/haptics'
import { GameLog } from '../GameLog'
import { Icon } from '../Icon'
import { MomentumMeter } from '../MomentumMeter'
import { TurnPips } from '../TurnPips'
import { RaceTrack } from '../RaceTrack'
import { HEAL_BARS, HealCountdown, healHue } from '../PlayerBoard'
import { Body, World } from './physics'
import { SpaceScene } from './SpaceScene'
import './SpaceTable.css'

export const CARD_BACK = '/cards/card-back-printed.webp'
export const printedFace = (kind?: string) => (kind ? `/cards/printed/${kind}.webp` : CARD_BACK)

type Zone = 'self' | 'opp' | 'discard'

// ── sizes from BOTH viewport dimensions, so desktop cards are desktop-sized ──
function readSizes() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const land = vw / vh > 1.15
  const clamp = (lo: number, v: number, hi: number) => Math.round(Math.max(lo, Math.min(v, hi)))
  return {
    vw,
    vh,
    land,
    handW: land ? clamp(96, vh * 0.2, 210) : clamp(78, vw * 0.26, 132),
    statusW: land ? clamp(96, vh * 0.21, 210) : clamp(84, vw * 0.3, 150),
    pileW: land ? clamp(90, vh * 0.17, 170) : clamp(74, vw * 0.21, 120),
    rivalW: land ? clamp(48, vh * 0.075, 80) : clamp(38, vw * 0.105, 62),
  }
}
export type SpaceSizes = ReturnType<typeof readSizes>
export function useSpaceSizes(): SpaceSizes {
  const [s, set] = useState(readSizes)
  useEffect(() => {
    const on = () => set(readSizes())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return s
}

export const centreOf = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null
}
const inside = (el: Element | null, x: number, y: number) => {
  const r = el?.getBoundingClientRect()
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

/** Where a card played onto `seat` comes to rest: a distance card dives into the
 *  ship on the track, a safety joins the row, anything else lands on the status. */
export function landingPoint(seat: number, kind: string) {
  const area = document.querySelector(`[data-area="${seat === 0 ? 'you' : 'rival'}"]`)
  if (!area) return null
  const d = CARD_DEFS[kind]
  const q = (s: string) => area.querySelector(`[data-slot="${s}"]`)
  const slot =
    d.type === 'distance'
      ? (area.querySelector('.race__ship') ?? q('track'))
      : d.type === 'safety'
        ? q('next')
        : d.lane === 'restraint'
          ? (q('limit') ?? q('status'))
          : q('status')
  const c = centreOf(slot)
  if (!c) return null
  // a distance card shrinks into the track; the rest settle at the slot's card size
  const w = d.type === 'distance' ? 0 : (slot?.querySelector('img')?.getBoundingClientRect().width || c.w)
  return { x: c.x, y: c.y, w }
}

/** a player's situation, as their area shows it */
function situation(p: PlayerState) {
  const hz = activeHazard(p)
  const limited = speedLimited(p)
  if (hz) return { tone: 'blocked' as const, card: hz as string | undefined, limited }
  if (!p.started) return { tone: 'docked' as const, card: undefined, limited }
  return { tone: limited ? ('limited' as const) : ('go' as const), card: p.battle.stop.at(-1)?.kind ?? 'ignition', limited }
}
const trackState = (tone: ReturnType<typeof situation>['tone']) =>
  tone === 'docked' ? 'dormant' : tone === 'blocked' ? 'blocked' : tone === 'limited' ? 'limited' : 'cruising'

/** the cards in your hand that would get you moving again right now */
function fixers(p: PlayerState): Set<string> {
  const hz = activeHazard(p)
  const want = new Set<string>()
  if (!p.started) want.add('ignition')
  if (hz) {
    const d = CARD_DEFS[hz]
    if (d.fixedBy) want.add(d.fixedBy)
    d.protectedBy?.forEach((k) => want.add(k))
  }
  if (speedLimited(p)) {
    want.add('beam-cutter')
    want.add('rescue-shuttle')
  }
  return new Set(p.hand.filter((c) => want.has(c.kind)).map((c) => c.uid))
}

export interface SpacePlay {
  world: World
  /** where your next drawn card flies in from */
  spawnFrom: React.MutableRefObject<'deck' | 'discard'>
  deckRef: React.RefObject<HTMLDivElement>
  discardRef: React.RefObject<HTMLDivElement>
  oppHandRef: React.RefObject<HTMLDivElement>
  moves: Move[]
  yourTurn: boolean
  animating: boolean
  drawPhaseHuman: boolean
  canDrawDeck: boolean
  canDrawDiscard: boolean
  drawFrom: (source: 'deck' | 'discard') => void
  drawNudge: boolean
  nudgeToDraw: () => void
  mustDiscard: boolean
  hideDiscardTop: boolean
  impact: { seat: number; tone: 'hit' | 'recover' } | null
  /** the card you've picked up to read (tap), with Play / Discard under it */
  selectedUid: string | null
  setSelectedUid: (uid: string | null) => void
  selectedPlay: Extract<Move, { type: 'play' }> | undefined
  playLabel: string
  doPlay: () => void
  doDiscard: () => void
  /** a card released over a zone (or flicked): Table decides the move */
  onDrop: (uid: string, zone: Zone) => boolean
  humanCanBurst: boolean
  doBurst: () => void
  // header / menu
  muted: boolean
  onToggleMute: () => void
  logOpen: boolean
  onToggleLog: () => void
  onSettings: () => void
  onRestart: () => void
  onGallery?: () => void
  onTitleTap: () => void
}

// ── your area ──────────────────────────────────────────────────────────────
function YourArea({ game, p, impact, active, children }: { game: GameState; p: PlayerState; impact: string; active: boolean; children?: React.ReactNode }) {
  const s = situation(p)
  const hz = activeHazard(p)
  const healLeft = hz ? hazardTurnsLeft(game.rules.selfHeal, p, CARD_DEFS[hz].lane!) : null
  const healing = healLeft != null && healLeft > 0
  return (
    <section
      className={`sp-you sp-you--${s.tone} ${active ? 'sp-you--active' : ''} ${impact}`}
      data-area="you"
      data-drop="self"
      aria-label={`You: ${p.distance} light-years`}
    >
      <div className="sp-track" data-slot="track">
        <RaceTrack distance={p.distance} trail={p.trail} pile={p.distancePile} state={trackState(s.tone)} isOpponent={false} />
      </div>
      <div className="sp-you__row">
        {/* what you're flying under: a green light, or the hazard that has you stuck */}
        <div
          className={`sp-status ${healing ? 'stack--healing' : ''}`}
          data-slot="status"
          style={healing ? ({ '--heal-hue': healHue(healLeft!, HEAL_BARS) } as React.CSSProperties) : undefined}
        >
          {s.card && (
            <img className="sp-card sp-status__card" src={printedFace(s.card)} alt={CARD_DEFS[s.card].title} draggable={false} key={s.card + p.battle.stop.length} />
          )}
          {s.tone === 'go' && <span className="sp-status__go" aria-hidden />}
          {healing && <HealCountdown left={healLeft!} max={HEAL_BARS} />}
        </div>
        {s.limited && (
          <div className="sp-limit" data-slot="limit" aria-label={`Speed limited to ${SPEED_LIMIT_VALUE}`}>
            <img className="sp-card" src={printedFace('tractor-beam')} alt="Tractor Beam" draggable={false} />
            <span className="sp-limit__cap">≤{SPEED_LIMIT_VALUE}</span>
          </div>
        )}
        <div className="sp-safeties">
          {p.safeties.map((k) => (
            <div className={`sp-safety ${p.coupSafeties?.includes(k) ? 'sp-safety--sling' : ''}`} key={k} title={CARD_DEFS[k].title}>
              <img className="sp-card" src={printedFace(k)} alt={CARD_DEFS[k].title} draggable={false} />
            </div>
          ))}
          <span className="sp-safety sp-safety--next" data-slot="next" />
        </div>
        {children && <div className="sp-you__pips">{children}</div>}
      </div>
    </section>
  )
}

// ── the rival: one strip ───────────────────────────────────────────────────
function RivalStrip({ p, handRef, impact, active }: { p: PlayerState; handRef: React.RefObject<HTMLDivElement>; impact: string; active: boolean }) {
  const s = situation(p)
  return (
    <section
      className={`sp-rival sp-rival--${s.tone} ${active ? 'sp-rival--active' : ''} ${impact}`}
      data-area="rival"
      data-drop="opp"
      aria-label={`${p.name}: ${p.distance} light-years`}
    >
      <div className="sp-rival__status" data-slot="status">
        {s.card && <img className="sp-card" src={printedFace(s.card)} alt={CARD_DEFS[s.card].title} draggable={false} />}
      </div>
      <div className="sp-rival__mid">
        <div data-slot="track">
          <RaceTrack distance={p.distance} trail={p.trail} pile={p.distancePile} state={trackState(s.tone)} isOpponent />
        </div>
        <div className="sp-rival__safeties">
          {p.safeties.map((k) => (
            <img key={k} className="sp-card" src={printedFace(k)} alt={CARD_DEFS[k].title} draggable={false} />
          ))}
          <span data-slot="next" className="sp-rival__next" />
        </div>
      </div>
      <div className="sp-rival__hand" ref={handRef} aria-label={`${p.hand.length} cards in hand`}>
        {p.hand.slice(0, 3).map((c, i) => (
          <img key={c.uid} className="sp-card" src={CARD_BACK} alt="" style={{ '--i': i } as React.CSSProperties} draggable={false} />
        ))}
        <span className="sp-rival__count">{p.hand.length}</span>
      </div>
    </section>
  )
}

// ── the table ──────────────────────────────────────────────────────────────
export function SpaceTable({ game, play, shaking }: { game: GameState; play: SpacePlay; shaking: boolean }) {
  const sz = useSpaceSizes()
  const { world } = play
  useSyncExternalStore(
    (l) => world.subscribe(l),
    () => world.bodies.size,
  )
  const [menu, setMenu] = useState(false)
  const [drag, setDrag] = useState<{ uid: string; legal: Partial<Record<Zone, true>>; over: Zone | null } | null>(null)

  const human = game.players[0]
  const opp = game.players[1]
  const over = game.phase === 'roundOver'
  const youRef = useRef<HTMLElement | null>(null)
  const oppAreaRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    youRef.current = document.querySelector('[data-area="you"]')
    oppAreaRef.current = document.querySelector('[data-area="rival"]')
  })

  const legalFor = useCallback(
    (uid: string): Partial<Record<Zone, true>> => {
      const out: Partial<Record<Zone, true>> = {}
      if (!play.yourTurn) return out
      for (const m of play.moves) {
        if (m.type === 'play' && m.uid === uid) out[m.targetSeat === opp.seat ? 'opp' : 'self'] = true
      }
      out.discard = true
      return out
    },
    [play.moves, play.yourTurn, opp.seat],
  )

  // ── the hand: a fanned arc along the bottom ──
  const handTargets = useCallback(
    (n: number) => {
      const W = sz.handW
      const H = W * 1.4
      const cx = sz.vw / 2
      const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0
      const cy = sz.vh - H * 0.46 - safeBottom
      const R = W * 5.5
      const room = Math.min(sz.vw - 24, sz.land ? W * 7.2 : sz.vw) - W - 20
      const gap = Math.min(W * 0.8, room / Math.max(1, n - 1))
      const step = Math.asin(Math.min(1, gap / R))
      return Array.from({ length: n }, (_, i) => {
        const a = (i - (n - 1) / 2) * step
        return { x: cx + R * Math.sin(a), y: cy + R * (1 - Math.cos(a)), r: (a * 180) / Math.PI }
      })
    },
    [sz],
  )
  const homeOf = useCallback(
    (b: Body) => {
      const hand = game.players[0].hand
      const i = hand.findIndex((c) => c.uid === b.id)
      if (i >= 0) b.goTo({ ...handTargets(hand.length)[i], s: 1, flip: 1 })
    },
    [game, handTargets],
  )

  // one body per card in your hand; newcomers fly in from the pile they came off
  const dealt = useRef(false)
  useLayoutEffect(() => {
    const hand = human.hand
    const ts = handTargets(hand.length)
    const fromDiscard = play.spawnFrom.current === 'discard'
    const origin = centreOf(fromDiscard ? play.discardRef.current : play.deckRef.current) ?? { x: sz.vw / 2, y: sz.vh / 2 }
    const ids = new Set(hand.map((c) => c.uid))
    let newcomers = 0
    hand.forEach((c, i) => {
      let b = world.bodies.get(c.uid)
      if (!b) {
        b = world.add(new Body({ id: c.uid, kind: c.kind, w: sz.handW, x: origin.x, y: origin.y, s: sz.pileW / sz.handW, faceUp: fromDiscard }))
        b.wait = dealt.current ? 0 : newcomers * 110
        newcomers++
      }
      b.z = 20 + i
      b.w = sz.handW
      if (!b.dragging && !b.committing && !b.inspecting) b.goTo({ ...ts[i], s: 1, flip: 1 })
    })
    dealt.current = hand.length > 0
    play.spawnFrom.current = 'deck'
    world.bodies.forEach((b) => {
      if (!ids.has(b.id) && !b.committing && !b.id.startsWith('fly:')) world.remove(b.id)
    })
  }, [human.hand, handTargets, sz, world, play.spawnFrom, play.deckRef, play.discardRef])

  // a new deal re-deals from the deck with a stagger
  useEffect(() => {
    if (human.hand.length === 0) dealt.current = false
  }, [human.hand.length])

  // dim what you can't play; make the cards that would unstick you glow
  useEffect(() => {
    const fix = play.yourTurn ? fixers(human) : new Set<string>()
    const playable = new Set(play.moves.filter((m) => m.type === 'play').map((m) => (m as { uid: string }).uid))
    human.hand.forEach((c) => {
      const b = world.bodies.get(c.uid)
      if (!b) return
      b.dim = play.yourTurn && !playable.has(c.uid)
      b.hint = fix.has(c.uid) && !b.dim
    })
  }, [human, play.moves, play.yourTurn, world])

  // tap-to-read: the selected card lifts to the middle; deselect puts it back
  useEffect(() => {
    world.bodies.forEach((b) => {
      if (b.id.startsWith('fly:') || b.committing) return
      const want = b.id === play.selectedUid
      if (want && !b.inspecting) {
        b.inspecting = true
        b.hold = 0.6
        b.goTo({ x: sz.vw / 2, y: sz.vh * 0.42, r: 0, s: Math.min(sz.vw * 0.6, (sz.vh * 0.5) / 1.4) / b.w })
      } else if (!want && b.inspecting) {
        b.inspecting = false
        b.hold = 0
        homeOf(b)
      }
    })
  }, [play.selectedUid, world, sz, homeOf])

  // ── touch: drag to play, flick up to play, tap to read ──
  const zoneAt = (x: number, y: number): Zone | null =>
    inside(oppAreaRef.current, x, y) ? 'opp' : inside(youRef.current, x, y) ? 'self' : inside(play.discardRef.current, x, y) ? 'discard' : null
  const press = useRef<{ id: string; x0: number; y0: number; ox: number; oy: number; hist: { y: number; t: number }[] } | null>(null)
  const onDown = (b: Body, e: React.PointerEvent) => {
    if (b.committing || over) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    press.current = { id: b.id, x0: e.clientX, y0: e.clientY, ox: e.clientX - b.x, oy: e.clientY - b.y, hist: [] }
    if (play.drawPhaseHuman) play.nudgeToDraw()
  }
  const onMove = (b: Body, e: React.PointerEvent) => {
    const p = press.current
    if (!p || p.id !== b.id) return
    p.hist.push({ y: e.clientY, t: performance.now() })
    if (p.hist.length > 6) p.hist.shift()
    if (!b.dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 8 && !b.inspecting) {
      if (!play.yourTurn || play.animating) return
      b.dragging = true
      b.hold = 1
      b.ts = 1.1
      b.tr = 0
      setDrag({ uid: b.id, legal: legalFor(b.id), over: null })
      playSfx('card-flick', { gain: 0.3, rate: 1.25 })
      haptics.cardPick()
    }
    if (b.dragging) {
      // the card rides above the thumb so it's never hidden under it
      b.tx = e.clientX - p.ox * 0.4
      b.ty = e.clientY - p.oy * 0.4 - sz.handW * 0.3
      const z = zoneAt(e.clientX, e.clientY)
      setDrag((d) => (d && d.over !== z ? { ...d, over: z } : d))
    }
  }
  const onUp = (b: Body, e: React.PointerEvent) => {
    const p = press.current
    press.current = null
    if (!p || p.id !== b.id) return
    if (!b.dragging) {
      if (b.committing) return
      playSfx('card-flick', { gain: 0.3, rate: 1.1 })
      play.setSelectedUid(play.selectedUid === b.id ? null : b.id)
      return
    }
    const legal = legalFor(b.id)
    const h = p.hist
    const v = h.length > 1 ? (h[h.length - 1].y - h[0].y) / Math.max(1, h[h.length - 1].t - h[0].t) : 0
    setDrag(null)
    b.ts = 1
    const z = zoneAt(e.clientX, e.clientY)
    // a quick upward flick plays the card where it naturally goes
    const flick: Zone | null = v < -1.1 ? (legal.self ? 'self' : legal.opp ? 'opp' : null) : null
    const to = z && legal[z] ? z : flick
    b.dragging = false
    b.hold = 0
    if (to && play.onDrop(b.id, to)) return
    homeOf(b)
  }
  const onKey = (b: Body, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      play.setSelectedUid(play.selectedUid === b.id ? null : b.id)
    }
  }

  const dropState = (z: Zone) => (!drag || !drag.legal[z] ? '' : drag.over === z ? 'sp-drop sp-drop--hot' : 'sp-drop')
  const fxFor = (seat: number) => (play.impact?.seat === seat ? (play.impact.tone === 'hit' ? 'sp-fx-hit' : 'sp-fx-heal') : '')
  const discardTop = play.hideDiscardTop ? game.discard.slice(0, -1) : game.discard
  const top = discardTop.at(-1)
  const me = situation(human)
  const bodies = [...world.bodies.values()]
  const selected = play.selectedUid ? human.hand.find((c) => c.uid === play.selectedUid) : undefined

  const closeMenu = () => setMenu(false)
  const menuItem = (icon: Parameters<typeof Icon>[0]['name'], label: string, run: () => void, on = false) => (
    <button
      className={on ? 'on' : ''}
      onClick={() => {
        run()
        if (label !== 'Sound') closeMenu()
      }}
    >
      <Icon name={icon} />
      <small>{label}</small>
    </button>
  )

  return (
    <div
      className={`sp ${sz.land ? 'sp--land' : 'sp--port'} ${shaking ? 'sp--shake' : ''} ${over ? 'sp--over' : ''}`}
      style={
        {
          '--hand-w': `${sz.handW}px`,
          '--status-w': `${sz.statusW}px`,
          '--pile-w': `${sz.pileW}px`,
          '--rival-w': `${sz.rivalW}px`,
        } as React.CSSProperties
      }
    >
      <SpaceScene land={sz.land} stalled={!over && (me.tone === 'blocked' || me.tone === 'docked')} />

      <header className="sp-bar">
        <h1 className="sp-bar__mark" onClick={play.onTitleTap}>
          Space Race
        </h1>
        <button className="sp-bar__menu" aria-label="Menu" aria-expanded={menu} onClick={() => (playSfx('ui-click'), setMenu((v) => !v))}>
          <span />
          <span />
          <span />
        </button>
      </header>

      <main className="sp-table">
        <RivalStrip p={opp} handRef={play.oppHandRef} impact={`${fxFor(opp.seat)} ${dropState('opp')}`} active={game.turn === opp.seat && !over} />

        <div className="sp-piles">
          <div
            className={`sp-deck ${play.canDrawDeck ? 'sp-deck--live' : ''} ${play.drawNudge && play.canDrawDeck ? 'sp-deck--nudge' : ''}`}
            ref={play.deckRef}
            onClick={() => play.canDrawDeck && play.drawFrom('deck')}
            role="button"
            tabIndex={play.canDrawDeck ? 0 : -1}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && play.canDrawDeck && play.drawFrom('deck')}
            aria-label={`Draw from the deck (${game.deck.length} left)`}
          >
            {game.deck.length > 0 && <img className="sp-card sp-pile__card" src={CARD_BACK} alt="" draggable={false} />}
            <span className="sp-deck__count">{game.deck.length}</span>
          </div>
          <div
            className={`sp-discard ${play.canDrawDiscard ? 'sp-discard--live' : ''} ${play.mustDiscard ? 'sp-discard--invite' : ''} ${dropState('discard')}`}
            ref={play.discardRef}
            data-drop="discard"
            onClick={() => play.canDrawDiscard && play.drawFrom('discard')}
            role="button"
            tabIndex={play.canDrawDiscard ? 0 : -1}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && play.canDrawDiscard && play.drawFrom('discard')}
            aria-label={top ? `Discard pile: ${CARD_DEFS[top.kind].title}` : 'Discard pile'}
          >
            {discardTop.slice(-3).map((c, i, arr) => (
              <img
                key={c.uid}
                className="sp-card sp-pile__card"
                src={printedFace(c.kind)}
                alt=""
                draggable={false}
                style={{ rotate: `${(i - arr.length + 1) * 5 + 3}deg` }}
              />
            ))}
            {!top && <span className="sp-discard__ring" />}
          </div>
          {game.rules.drawTwo && play.drawPhaseHuman && (
            <span className="sp-piles__pips">
              <TurnPips kind="draw" left={game.drawsLeft ?? 1} />
            </span>
          )}
        </div>

        <YourArea game={game} p={human} impact={`${fxFor(human.seat)} ${dropState('self')}`} active={game.turn === human.seat && !over}>
          {game.rules.drawTwo && play.yourTurn && <TurnPips kind="play" left={game.actionsLeft ?? 1} />}
        </YourArea>

        {game.rules.momentum && (
          <div className="sp-momentum">
            <MomentumMeter
              charge={game.momentum[0]}
              cap={MOMENTUM_CAP}
              spendable={play.humanCanBurst}
              isOpponent={false}
              onBurst={play.doBurst}
            />
          </div>
        )}
      </main>

      <div className="sp-bodies">
        {selected && <div className="sp-scrim" onClick={() => play.setSelectedUid(null)} />}
        {bodies.map((b) => {
          const mine = !b.id.startsWith('fly:')
          return (
            <div
              key={b.id}
              className="sp-body"
              style={{ width: b.w }}
              ref={(el) => {
                b.el = el
              }}
              role={mine ? 'button' : undefined}
              tabIndex={mine ? 0 : -1}
              aria-label={mine && b.kind ? `${CARD_DEFS[b.kind].title}: ${CARD_DEFS[b.kind].subtitle}` : undefined}
              onPointerDown={mine ? (e) => onDown(b, e) : undefined}
              onPointerMove={mine ? (e) => onMove(b, e) : undefined}
              onPointerUp={mine ? (e) => onUp(b, e) : undefined}
              onPointerCancel={mine ? (e) => onUp(b, e) : undefined}
              onKeyDown={mine ? (e) => onKey(b, e) : undefined}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="sp-body__shadow" />
              <span className="sp-body__card">
                <img className="sp-card sp-body__face" src={printedFace(b.kind)} alt="" draggable={false} />
                <img className="sp-card sp-body__back" src={CARD_BACK} alt="" draggable={false} />
                <span className="sp-body__gloss" />
              </span>
            </div>
          )
        })}
        {/* reading a card: big Play / Discard under it, for anyone who'd rather tap than drag */}
        {selected && play.yourTurn && (
          <div className="sp-actions">
            <button className="sp-actions__play" onClick={play.doPlay} disabled={!play.selectedPlay || play.animating} aria-label={play.playLabel} title={play.playLabel}>
              <Icon name={play.selectedPlay && CARD_DEFS[selected.kind].type === 'hazard' ? 'burst' : 'play'} />
            </button>
            <button className="sp-actions__discard" onClick={play.doDiscard} disabled={play.animating} aria-label="Discard" title="Discard">
              <Icon name="bin" />
            </button>
          </div>
        )}
      </div>

      {menu && (
        <>
          <div className="sp-menu-scrim" onClick={closeMenu} />
          <div className="sp-menu" role="dialog" aria-label="Menu">
            {menuItem(play.muted ? 'sound-off' : 'sound-on', 'Sound', play.onToggleMute, !play.muted)}
            {menuItem('log', 'Log', play.onToggleLog, play.logOpen)}
            {play.onGallery && menuItem('cards', 'Cards', play.onGallery)}
            {menuItem('gear', 'Settings', play.onSettings)}
            {menuItem('restart', 'New race', play.onRestart)}
          </div>
        </>
      )}

      {play.logOpen && (
        <aside className="sp-log" aria-label="Game log">
          <button className="sp-log__close" onClick={play.onToggleLog} aria-label="Close the log">
            ×
          </button>
          <GameLog log={game.log} />
        </aside>
      )}
    </div>
  )
}

