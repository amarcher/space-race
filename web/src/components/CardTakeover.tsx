import { useEffect, useRef, useState } from 'react'
import { cardHeroVideo } from '../game/cardArt'
import './CardTakeover.css'

export type TakeoverVariant = 'warp' | 'hazard' | 'remedy' | 'safety'

// How long a takeover holds before it dismisses. A SHORT, fresh, time-capped
// single play — we do NOT play the whole ~4s clip. Tune here.
const PLAY_MS = 2500
const FADE_OUT_MS = 350 // matches .takeover--leaving in the CSS

// Above this viewport width we're on a desktop/wide layout (matches the 760px
// mobile/compact CSS breakpoint used elsewhere). On wide screens the standard
// 720×1280 clip softens when upscaled to fill the screen, so prefer the crisper
// `<kind>.hero.mp4` when one exists; mobile (≤760) always uses the standard clip.
const WIDE_MIN_PX = 761

// Per-kind framing for the cover-cropped takeover video. The clip is
// object-fit:cover and centred by default; a few cards put their key visual
// off-centre, so nudge object-position to keep it in frame. Tuned by eye.
const OBJECT_POSITION: Record<string, string> = {
  // ignition's green "go" button sits in the LOWER quadrant — anchor bottom-ish
  ignition: 'center 78%',
  // repair-drone's drone/key visual sits HIGH — anchor top-ish
  'repair-drone': 'center 28%',
}

/**
 * Full-screen hero takeover for a card play: the card's clip plays a SHORT,
 * fresh burst (from the start, ~PLAY_MS) over the board, then fades out and
 * unmounts to REVEAL the (already-applied) board result. It is NOT allowed to
 * play the full clip or resume from a prior position — each play starts fresh at
 * 0 and is time-capped. warp keeps its dive-zoom; hazard/remedy/safety get a
 * clean scale-in + a tasteful type tint (red / green / gold) + vignette.
 * Non-interactive, below the Slingshot hero (z 70). Skipped under reduced motion.
 */
export function CardTakeover({
  src,
  kind,
  variant = 'warp',
  onDone,
}: {
  /** Standard `<kind>.mp4` clip — always the fallback source. */
  src: string
  /** Card kind, used to opt into a hero clip + per-card framing. */
  kind?: string
  variant?: TakeoverVariant
  onDone: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [leaving, setLeaving] = useState(false)
  // Pick the source ONCE per play: on a wide viewport, prefer the crisper hero
  // clip when the kind ships one; otherwise (mobile, or no hero asset) use the
  // standard clip. Read width eagerly so the chosen <video src> is correct on
  // first paint — the takeover is short-lived and doesn't need to react to
  // mid-play resizes.
  const [chosenSrc] = useState(() => {
    const wide = typeof window !== 'undefined' && window.innerWidth >= WIDE_MIN_PX
    const hero = wide ? cardHeroVideo(kind) : undefined
    return hero ?? src
  })
  const objectPosition = (kind && OBJECT_POSITION[kind]) || undefined
  // read onDone via a ref so the effect can run exactly once (the parent passes
  // a fresh closure each render — depending on it would restart the timer)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Set `muted` as a true DOM PROPERTY the instant the element exists — BEFORE
  // the browser evaluates the autoplay gate or starts loading. React's `muted`
  // JSX attribute is unreliable, so without this iOS/Android treat the clip as
  // non-muted and BLOCK the gesture-less (AI-initiated) autoplay, surfacing a
  // native play button. The ref callback runs at commit, ahead of load.
  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el) {
      el.muted = true
      el.defaultMuted = true
    }
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true // belt-and-suspenders before play
    v.defaultMuted = true
    // Robust play: try eagerly AND once data is ready (a cold/uncached clip isn't
    // buffered yet — eager play() can reject before any frame, which on iOS shows
    // a play button). On any rejection, re-assert muted and retry once. We never
    // expose native controls, so the worst case is a still first frame, never a
    // tap-to-play affordance.
    const tryPlay = () => {
      v.muted = true
      const p = v.play?.()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          v.muted = true
          v.play?.().catch(() => {})
        })
      }
    }
    try {
      v.currentTime = 0
    } catch {
      /* not seekable yet — autoplay already starts at 0 */
    }
    tryPlay() // eager
    v.addEventListener('loadeddata', tryPlay) // when the first frame is decodable
    v.addEventListener('canplay', tryPlay) // when enough is buffered to start

    // dismiss after a short, fixed window — one play, no loop, not the full clip
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setLeaving(true) // trigger the fade-out, then unmount
      window.setTimeout(() => onDoneRef.current(), FADE_OUT_MS)
    }
    const t = window.setTimeout(finish, PLAY_MS)
    return () => {
      window.clearTimeout(t)
      v.removeEventListener('loadeddata', tryPlay)
      v.removeEventListener('canplay', tryPlay)
    }
    // run once on mount — onDone is read via the ref above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`takeover takeover--${variant} ${leaving ? 'takeover--leaving' : ''}`} aria-hidden>
      <video
        ref={setVideo}
        className="takeover__video"
        src={chosenSrc}
        style={objectPosition ? { objectPosition } : undefined}
        autoPlay
        muted
        playsInline
        preload="auto"
      />
      <span className="takeover__tint" />
    </div>
  )
}
