// Page choreography for the scroll-craft store: the race track, the hero
// planes, the dealt hand, and the Black Hole frame. The engine (scrollcraft.js)
// owns acts, cues and the scrub clip; this owns everything bespoke.
//
// The engine has no teardown, so this runs once per page load and the store
// stays mounted (hidden) while the checkout view is up. `relayout` re-measures
// after it is shown again.
import './scrollcraft.js'

interface ScrollCraftInstance {
  layout(): void
}
declare global {
  interface Window {
    ScrollCraft: {
      mount(root: Element): ScrollCraftInstance
    }
  }
}

interface Play {
  card: string
  ly: number
  at: number
  label: string
  stuck?: boolean
}
interface Turn {
  el: HTMLElement
  plays: Play[]
}

export interface ScrollStoreHandle {
  relayout(): void
  jumpToOrder(): void
}

const CARD_URL = (card: string) => `/shop/scroll/printed/${card}.webp`
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const P = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--sc-p')) || 0

let handle: ScrollStoreHandle | null = null

export function runScrollStore(root: HTMLElement): ScrollStoreHandle {
  if (handle) return handle
  const engine = window.ScrollCraft.mount(root)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T

  // ---- the track: every turn commits its cards once its act passes `at` ----
  const turns: Turn[] = Array.from(root.querySelectorAll<HTMLElement>('[data-turn]'), (el) => ({
    el,
    plays: JSON.parse(el.dataset.turn!) as Play[],
  }))
  const finish = turns[turns.length - 1]
  const trackEl = $('.track')
  const hand = $('[data-hand]')
  const totalEl = $('[data-total]')
  const fill = $('[data-fill]')
  const ship = $('[data-ship]')
  const line = $('.track__line')
  let lastKey = ''

  // Where a play lands, in document scroll. Pinned acts: top + at * travel.
  function playY(t: Turn, at: number) {
    const el = t.el
    const h = el.offsetHeight
    const top = el.getBoundingClientRect().top + scrollY
    const pinned = /scrub|pin|pan/.test(el.dataset.scAct ?? '')
    return pinned ? top + at * Math.max(h - innerHeight, 1) : top - innerHeight + at * (h + innerHeight)
  }

  function renderTrack() {
    const played: { c: Play; t: Turn; i: number }[] = []
    turns.forEach((t) => {
      const live = t.el.style.getPropertyValue('--sc-p') !== ''
      const p = P(t.el)
      t.plays.forEach((c, i) => {
        let passed = live ? p >= c.at || c.at === 0 : false
        // An act the reader has scrolled wholly past reads p = 1.
        if (!live && t.el.getBoundingClientRect().bottom < 0) passed = true
        if (passed) played.push({ c, t, i })
      })
    })
    const done = P(finish.el) > 0.3
    document.documentElement.classList.toggle('is-finished', done)
    trackEl.inert = done
    const key = played.map((x) => x.c.card + x.c.ly).join('|') + played.length
    if (key === lastKey) return
    const prev = hand.children.length
    hand.innerHTML = ''
    let total = 0
    let stuck = false
    played.forEach((x, n) => {
      total += x.c.ly
      if (x.c.stuck) stuck = true
      if (x.c.card === 'rescue-shuttle' || (x.c.card === 'ignition' && n > 0)) stuck = false
      const a = document.createElement('a')
      a.className = 'chip' + (n >= prev ? ' is-new' : '')
      a.href = '#' + x.t.el.id
      a.style.setProperty('--r', ((n * 37) % 11) - 5 + 'deg')
      a.setAttribute('aria-label', `${x.c.label}, turn ${turns.indexOf(x.t) + 1}`)
      a.dataset.turn = String(turns.indexOf(x.t))
      a.dataset.i = String(x.i)
      const img = document.createElement('img')
      img.src = CARD_URL(x.c.card)
      img.alt = ''
      img.width = 600
      img.height = 840
      a.appendChild(img)
      hand.appendChild(a)
    })
    totalEl.textContent = total.toLocaleString('en-US')
    fill.style.setProperty('--f', (total / 1000).toFixed(3))
    ship.style.setProperty('--x', ((line.clientWidth * total) / 1000).toFixed(1) + 'px')
    ship.classList.toggle('is-stuck', stuck)
    lastKey = key
  }

  // Jumping from a chip lands on the scroll where that card was played, so the
  // track the reader arrives at is the track they clicked.
  hand.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLElement>('.chip')
    if (!a) return
    e.preventDefault()
    const t = turns[Number(a.dataset.turn)]
    scrollTo({ top: playY(t, t.plays[Number(a.dataset.i)].at) + 4, behavior: reduce ? 'instant' : 'smooth' })
  })
  const jumpToOrder = (smooth = false) =>
    scrollTo({ top: playY(finish, 0.4), behavior: smooth && !reduce ? 'smooth' : 'instant' })
  root.querySelectorAll('[data-jump="order"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault()
      jumpToOrder(true)
    }),
  )
  addEventListener('resize', () => {
    lastKey = ''
  })

  // Controls inside pinned acts: park the act where their cue is open.
  finish.el.addEventListener('focusin', () => {
    if (P(finish.el) < 0.3) jumpToOrder()
  })
  const hero = $('#turn-1')
  hero.addEventListener('focusin', () => {
    if (P(hero) > 0.3) scrollTo({ top: 0, behavior: 'instant' })
  })

  // ---- hero planes, the dealt hand, the Black Hole frame ----
  const depth: Record<string, HTMLElement> = {}
  hero.querySelectorAll<HTMLElement>('[data-depth]').forEach((el) => {
    depth[el.dataset.depth!] = el
  })
  const fanEl = $('#turn-2')
  const fan = Array.from(root.querySelectorAll<HTMLElement>('[data-fan] .card'))
  const bhEl = $('#turn-5')
  const bh = $('[data-bh]')
  const play = $('[data-play]')
  if (reduce) $<HTMLImageElement>('[data-bh] .sc-stage__poster').src = '/shop/scroll/peak-rm.jpg'
  let mx = 0
  let my = 0
  let tx = 0
  let ty = 0
  if (fine && !reduce)
    addEventListener(
      'pointermove',
      (e) => {
        tx = (e.clientX / innerWidth) * 2 - 1
        ty = (e.clientY / innerHeight) * 2 - 1
      },
      { passive: true },
    )

  function heroFrame() {
    const p = reduce ? 0 : P(hero)
    mx += (tx - mx) * 0.08
    my += (ty - my) * 0.08
    const vh = innerHeight / 100
    // The plate and everything resting on it share one transform, so the box
    // and cards never slide against the wood. Depth comes from the box turning,
    // the lamp glow drifting on its own, and the copy holding still.
    depth.room.style.transform = depth.ground.style.transform =
      `translate3d(${mx * -8}px,${p * -6 * vh + my * -4}px,0) scale(${1 + p * 0.05})`
    depth.glow.style.transform = `translate3d(${mx * -10}px,${p * -5 * vh}px,0)`
    depth.glow.style.opacity = (1 - p * 0.5).toFixed(3)
    depth.box.style.setProperty('--ry', (-30 + p * 42 + mx * 7).toFixed(2) + 'deg')
  }
  function fanFrame() {
    const p = reduce ? 1 : P(fanEl)
    const n = fan.length
    const narrow = innerWidth < 860
    fan.forEach((c, i) => {
      const f = ease(clamp((p - 0.04 - i * 0.035) / 0.34, 0, 1))
      const rise = ((1 - f) * 70).toFixed(2) + 'svh'
      if (narrow) {
        // Two rows of three: six readable faces fit a phone, a fan of six does not.
        const col = (i % 3) - 1
        const row = Math.floor(i / 3) - 1
        const w = c.offsetWidth
        c.style.transformOrigin = '50% 50%'
        c.style.transform = `translate3d(${(col * w * 1.06 * f).toFixed(1)}px, calc(${(row * w * 1.46 * f).toFixed(1)}px + ${rise}), 0) rotate(${(col * 3 * f).toFixed(2)}deg)`
      } else {
        // A flat, long arc: each face overlaps the next by ~10%, so the
        // printed distance numbers stay whole.
        c.style.transformOrigin = '50% 420%'
        c.style.transform = `translate3d(0,${rise},0) rotate(${((i - (n - 1) / 2) * 10.5 * f).toFixed(2)}deg)`
      }
    })
  }
  function bhFrame() {
    const p = reduce ? 1 : P(bhEl)
    const g = ease(clamp((p - 0.02) / 0.24, 0, 1))
    bh.style.setProperty('--g-scale', (0.34 + 0.66 * g).toFixed(4))
    bh.style.setProperty('--g-inset', (10.6 * (1 - g)).toFixed(3) + '%')
    bh.style.setProperty('--g-r', (3.4 - 2.2 * g).toFixed(2) + '%')
    bh.style.setProperty('--g-r2', (2.4 - 1.6 * g).toFixed(2) + '%')
    bh.style.setProperty('--g-card', (1 - clamp((p - 0.025) / 0.06, 0, 1)).toFixed(3))
    bh.style.setProperty('--halo', (0.2 + 0.8 * g).toFixed(3))
    // Your Rescue Shuttle flies up from the hand, lands on the Black Hole,
    // then bursts outward as the clip's shuttle breaks free.
    const fly = ease(clamp((p - 0.34) / 0.1, 0, 1))
    const burst = clamp((p - 0.49) / 0.07, 0, 1)
    play.style.transform = `translate3d(0,${((1 - fly) * 75).toFixed(2)}svh,0) rotate(${(-16 + 13 * fly).toFixed(2)}deg) scale(${(1 + burst * 0.55).toFixed(3)})`
    play.style.opacity = p < 0.34 ? '0' : (1 - burst).toFixed(3)
    play.style.setProperty('--play-glow', (fly * (1 - burst)).toFixed(3))
    bh.style.setProperty('--g-scrim', clamp((p - 0.04) / 0.1, 0, 1).toFixed(3))
  }
  function loop() {
    // Hidden behind the checkout view: nothing here is on screen.
    if (!root.hidden) {
      heroFrame()
      fanFrame()
      bhFrame()
      renderTrack()
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  handle = {
    relayout() {
      engine.layout()
      lastKey = ''
    },
    jumpToOrder: () => jumpToOrder(),
  }
  return handle
}
