import { useEffect, useRef, useState } from 'react'
import './CardTakeover.css'

export type TakeoverVariant = 'warp' | 'hazard' | 'remedy' | 'safety'

// How long a takeover holds before it dismisses. A SHORT, fresh, time-capped
// single play — we do NOT play the whole ~4s clip. Tune here.
const PLAY_MS = 2500
const FADE_OUT_MS = 350 // matches .takeover--leaving in the CSS

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
  variant = 'warp',
  onDone,
}: {
  src: string
  variant?: TakeoverVariant
  onDone: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [leaving, setLeaving] = useState(false)
  // read onDone via a ref so the effect can run exactly once (the parent passes
  // a fresh closure each render — depending on it would restart the timer)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    // start the clip FRESH from the beginning (never resume a prior position)
    const v = videoRef.current
    if (v) {
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
      <video ref={videoRef} className="takeover__video" src={src} autoPlay muted playsInline />
      <span className="takeover__tint" />
    </div>
  )
}
