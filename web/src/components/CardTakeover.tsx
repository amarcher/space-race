import { useEffect } from 'react'
import './CardTakeover.css'

export type TakeoverVariant = 'warp' | 'hazard' | 'remedy' | 'safety'

const DURATION = 2000 // matches the CSS in/out animation

/**
 * Full-screen hero takeover for a card play: the card's clip fills the screen
 * for ~2s, then fades back to REVEAL the (already-updated) board. warp keeps its
 * dive-zoom; hazard/remedy/safety get a clean scale-in + a tasteful type tint
 * (red / green / gold). Non-interactive, sits below the Slingshot hero (z 70).
 * Skipped entirely under prefers-reduced-motion (see CSS).
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
  useEffect(() => {
    const t = setTimeout(onDone, DURATION)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className={`takeover takeover--${variant}`} aria-hidden>
      <video className="takeover__video" src={src} autoPlay muted playsInline loop />
      <span className="takeover__tint" />
    </div>
  )
}
