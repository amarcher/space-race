import { useEffect } from 'react'
import './HyperwarpTakeover.css'

/**
 * Full-screen hero moment for the 200-light-year jump: the warp-200 clip fills
 * the screen and pushes in like a dive into hyperspace, then fades back to the
 * board after ~2s (the starfield warp fires underneath at the same time). Rare
 * by design — only a warp-200 play earns it.
 */
export function HyperwarpTakeover({ src, onDone }: { src: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000) // matches the in/out animation
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="hyperwarp" aria-hidden>
      <video className="hyperwarp__video" src={src} autoPlay muted playsInline />
    </div>
  )
}
