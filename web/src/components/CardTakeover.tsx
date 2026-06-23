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
  const videoRef = useRef<HTMLVideoElement>(null)
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

  useEffect(() => {
    // start the clip FRESH from the beginning (never resume a prior position)
    const v = videoRef.current
    if (v) {
      // CRITICAL for mobile autoplay: React's `muted` JSX attribute does NOT
      // reliably set the DOM `.muted` PROPERTY, so iOS/Android treat the clip as
      // non-muted and BLOCK autoplay when the AI (no user gesture) triggers a
      // takeover — surfacing a native play button. Force the property here so a
      // muted + playsInline clip autoplays gesture-free.
      v.muted = true
      v.defaultMuted = true
      try {
        v.currentTime = 0
      } catch {
        /* not seekable yet — autoplay already starts at 0 */
      }
      v.play?.().catch(() => {})
    }
    // dismiss after a short, fixed window — one play, no loop, not the full clip
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setLeaving(true) // trigger the fade-out, then unmount
      window.setTimeout(() => onDoneRef.current(), FADE_OUT_MS)
    }
    const t = window.setTimeout(finish, PLAY_MS)
    return () => window.clearTimeout(t)
    // run once on mount — onDone is read via the ref above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`takeover takeover--${variant} ${leaving ? 'takeover--leaving' : ''}`} aria-hidden>
      <video
        ref={videoRef}
        className="takeover__video"
        src={chosenSrc}
        style={objectPosition ? { objectPosition } : undefined}
        autoPlay
        muted
        playsInline
      />
      <span className="takeover__tint" />
    </div>
  )
}
