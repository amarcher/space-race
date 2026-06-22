import { useEffect, useRef, useState } from 'react'
import './CardTakeover.css'

export type TakeoverVariant = 'warp' | 'hazard' | 'remedy' | 'safety'

const FADE_OUT_MS = 350 // matches .takeover--leaving in the CSS
const SAFETY_MS = 8000 // fallback if `ended` never fires (decode error / missing clip)

/**
 * Full-screen hero takeover for a card play: the card's clip plays ONCE over the
 * board, then — when the video ENDS — fades out and unmounts to REVEAL the
 * (already-applied) board result. warp keeps its dive-zoom; hazard/remedy/safety
 * get a clean scale-in + a tasteful type tint (red / green / gold) + vignette.
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
  // keep onDone reachable without re-running the effect (the parent passes a
  // fresh closure each render — depending on it would thrash the listener/timer)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const doneRef = useRef(false)

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      setLeaving(true) // trigger the fade-out, then unmount
      window.setTimeout(() => onDoneRef.current(), FADE_OUT_MS)
    }
    const v = videoRef.current
    v?.addEventListener('ended', finish)
    // play exactly once; the safety net only catches a clip that never ends
    const safety = window.setTimeout(finish, SAFETY_MS)
    return () => {
      v?.removeEventListener('ended', finish)
      window.clearTimeout(safety)
    }
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
