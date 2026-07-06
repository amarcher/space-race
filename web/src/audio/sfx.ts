// Web Audio SFX engine for Space Race.
//
// Design goals:
//  - ONE AudioContext, created + resumed lazily on the first user gesture
//    (browsers block audio before a gesture). We never new-up the context at
//    import time — that would trip the autoplay-policy warning.
//  - Each SFX is fetched + decodeAudioData'd once into an AudioBuffer; play()
//    fires it through a fresh AudioBufferSourceNode for low latency.
//  - A master GainNode carries a persisted MUTE (localStorage). Muting ramps the
//    master gain to 0; nothing else stops (sound ≠ motion — reduced-motion does
//    NOT mute, only the toggle does).
//  - Resilient: if a sound file isn't present yet (PR-1 ships before the assets),
//    fetch/decode just skips it and play() no-ops. Nothing throws.
//
// No words/UI on the play surface here — this is pure plumbing. The mute control
// is word-free SVG chrome in the header.

export type SfxName =
  | 'card-flick' // draw / card movement
  | 'distance' // thrust whoosh
  | 'hazard' // breakdown / impact
  | 'remedy' // repair / power restored
  | 'safety' // shield shimmer
  | 'warp' // hyperwarp / 200 takeover
  | 'slingshot' // coup-fourré stinger
  | 'win' // round victory chime (generic / legacy)
  | 'win-takeover' // full-screen WIN hero swell + bright hit (~3.8s hold)
  | 'lose-takeover' // full-screen LOSS hero — dignified, soft, NOT the win chime
  | 'ui-click' // soft UI click

const FILES: Record<SfxName, string> = {
  'card-flick': '/sfx/card-flick.mp3',
  distance: '/sfx/distance.mp3',
  hazard: '/sfx/hazard.mp3',
  remedy: '/sfx/remedy.mp3',
  safety: '/sfx/safety.mp3',
  warp: '/sfx/warp.mp3',
  slingshot: '/sfx/slingshot.mp3',
  win: '/sfx/win.mp3',
  'win-takeover': '/sfx/win-takeover.mp3',
  'lose-takeover': '/sfx/lose-takeover.mp3',
  'ui-click': '/sfx/ui-click.mp3',
}

// Per-SFX baseline level so the mix is tasteful out of the box: UI ticks sit
// quietly under the action, stingers/wins come through fuller. Tunable.
const BASE_GAIN: Record<SfxName, number> = {
  'card-flick': 0.5,
  distance: 0.7,
  hazard: 0.85,
  remedy: 0.7,
  safety: 0.7,
  warp: 0.9,
  slingshot: 0.95,
  win: 0.9,
  'win-takeover': 0.95,
  'lose-takeover': 0.8,
  'ui-click': 0.32,
}

const MUTE_KEY = 'sr-sfx-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<SfxName, AudioBuffer>()
let unlocked = false
let preloadStarted = false

let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  return ctx
}

async function preload(): Promise<void> {
  if (preloadStarted) return
  preloadStarted = true
  const c = ensureContext()
  if (!c) return
  await Promise.all(
    (Object.keys(FILES) as SfxName[]).map(async (name) => {
      try {
        const res = await fetch(FILES[name])
        if (!res.ok) return // asset not added yet — play(name) will simply no-op
        const arr = await res.arrayBuffer()
        const buf = await c.decodeAudioData(arr)
        buffers.set(name, buf)
      } catch {
        // missing or undecodable — skip silently, never throw
      }
    }),
  )
}

/**
 * Wire the first-gesture unlock (idempotent). Call once on app mount. The
 * AudioContext is created + resumed and the buffers begin decoding the instant
 * the user first interacts — well before any sound-producing action.
 */
export function initAudio(): void {
  if (typeof window === 'undefined') return
  const unlock = () => {
    if (unlocked) return
    unlocked = true
    ensureContext()?.resume().catch(() => {})
    void preload()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock)

  // a small debug/verification handle (harmless, word-free): lets the owner test
  // levels from the console and lets headless checks observe the engine
  ;(window as unknown as { __sfx?: unknown }).__sfx = {
    play: playSfx,
    isMuted,
    setMuted,
    toggleMuted,
    ctx: () => ctx,
    buffers: () => buffers,
  }
}

/**
 * Fire a one-shot SFX. No-ops when muted, before unlock, or when the buffer
 * isn't loaded. Each shot gets a small random playbackRate jitter so rapid
 * repeats (draws, hits) don't fatigue the ear.
 */
export function playSfx(name: SfxName, opts: { gain?: number; rate?: number } = {}): void {
  if (muted) return
  const c = ctx
  if (!c || !master) return
  const buf = buffers.get(name)
  if (!buf) return
  const src = c.createBufferSource()
  src.buffer = buf
  const jitter = 1 + (Math.random() - 0.5) * 0.08 // ±4%
  src.playbackRate.value = (opts.rate ?? 1) * jitter
  const g = c.createGain()
  g.gain.value = (opts.gain ?? 1) * BASE_GAIN[name]
  src.connect(g).connect(master)
  try {
    src.start()
  } catch {
    // a source can only start once; ignore any spurious double-start
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    // private mode / storage disabled — keep the in-memory state
  }
  if (master && ctx) {
    // short ramp avoids a click on toggle
    master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.012)
  }
  listeners.forEach((l) => l())
}

export function toggleMuted(): void {
  setMuted(!muted)
}

/** subscribe to mute changes (for React's useSyncExternalStore) */
export function subscribeMuted(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
