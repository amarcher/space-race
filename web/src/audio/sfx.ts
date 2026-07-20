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
let analyser: AnalyserNode | null = null
const buffers = new Map<SfxName, AudioBuffer>()
let unlocked = false
let preloadStarted = false
let playCount = 0 // successful playSfx starts — for the hidden debug panel
let fetchFails = 0 // sfx files that failed to fetch/decode during preload
let lastLoadError = '' // exact stage + error of the most recent preload failure

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
  // master → analyser → destination: the analyser taps the final mix so the
  // hidden debug panel can SHOW output signal even when nothing is audible
  analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  master.connect(analyser)
  analyser.connect(ctx.destination)
  return ctx
}

async function preload(): Promise<void> {
  if (preloadStarted) return
  preloadStarted = true
  const c = ensureContext()
  if (!c) return
  await Promise.all(
    (Object.keys(FILES) as SfxName[]).map(async (name) => {
      let stage = 'fetch'
      try {
        const res = await fetch(FILES[name])
        // status 0 is NOT a failure here: WKWebView reports responses from
        // Capacitor's custom-scheme handler (capacitor://localhost) with
        // status 0 even though the body arrives intact. Only real HTTP errors
        // (404 etc.) mean the asset is missing — let decode judge the bytes.
        if (!res.ok && res.status !== 0) {
          fetchFails++
          lastLoadError = `${name}: fetch status ${res.status}`
          return // asset not added yet — play(name) will simply no-op
        }
        stage = 'arrayBuffer'
        const arr = await res.arrayBuffer()
        stage = `decode(${arr.byteLength}B)`
        const buf = await c.decodeAudioData(arr)
        buffers.set(name, buf)
      } catch (e) {
        fetchFails++ // missing or undecodable — skip silently, never throw
        lastLoadError = `${name}@${stage}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`
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
  // iOS WebKit does NOT grant audio activation on touch-START events — only on
  // touchend / click / mousedown / keydown. The old one-shot unlock listened on
  // pointerdown/touchstart and removed itself after the FIRST event, so on an
  // iPhone the first touch "unlocked" nothing (resume() rejected, listeners
  // gone) and the app was silent forever — while Chrome, which grants
  // activation on pointerdown, worked fine. So: listen on the activation-
  // granting events too, and DON'T stand down until a resume actually sticks.
  const EVENTS = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'click', 'keydown'] as const
  const cleanup = () => EVENTS.forEach((e) => window.removeEventListener(e, unlock))
  const unlock = () => {
    if (unlocked) return
    const c = ensureContext()
    if (!c) {
      cleanup() // WebAudio unsupported — nothing to unlock
      return
    }
    void preload() // fetch/decode needs no gesture; start it on the first try
    // classic WebKit kick: starting a (silent) source inside the gesture is the
    // most reliable unlock across WKWebView versions
    try {
      const kick = c.createBufferSource()
      kick.buffer = c.createBuffer(1, 1, 22050)
      kick.connect(c.destination)
      kick.start(0)
    } catch {
      /* already unlocked or transient — resume() below decides */
    }
    void c
      .resume()
      .then(() => {
        if (c.state === 'running' && !unlocked) {
          unlocked = true
          cleanup()
        }
      })
      .catch(() => {})
  }
  EVENTS.forEach((e) => window.addEventListener(e, unlock))

  // iOS suspends (or "interrupt"s — a WebKit-only state) the AudioContext when
  // the app backgrounds or a call/Siri takes the output, and never resumes it on
  // its own. Re-resume whenever we come back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
      ctx.resume().catch(() => {})
    }
  })

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
    playCount++
  } catch {
    // a source can only start once; ignore any spurious double-start
  }
}

// ---- hidden diagnostics (see components/AudioDebug.tsx) --------------------

/** Snapshot of every audio-pipeline stage, for the hidden debug panel. */
export function audioDebugState() {
  return {
    ctxState: ctx ? ctx.state : 'not-created',
    sampleRate: ctx?.sampleRate ?? 0,
    unlocked,
    buffers: buffers.size,
    fetchFails,
    muted,
    masterGain: master?.gain.value ?? -1,
    plays: playCount,
    lastLoadError,
  }
}

/** RMS of the FINAL mix right now (0 = digital silence, -1 = no context). If
 *  this moves while the device stays silent, the fault is OS output routing —
 *  not the web audio pipeline. */
export function audioDebugRms(): number {
  if (!analyser) return -1
  const arr = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(arr)
  let sum = 0
  for (const v of arr) sum += v * v
  return Math.sqrt(sum / arr.length)
}

/** A pure-oscillator beep THROUGH the master chain — no fetch, no decode, no
 *  buffers. Isolates output from the asset pipeline. */
export function audioDebugBeep(): void {
  const c = ensureContext()
  if (!c || !master) return
  void c.resume().catch(() => {})
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.value = 660
  g.gain.value = 0.5
  o.connect(g).connect(master)
  o.start()
  o.stop(c.currentTime + 0.4)
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
