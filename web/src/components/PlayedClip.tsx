import { useEffect } from 'react'
import './PlayedClip.css'

/**
 * A one-shot card-art flourish: when a card with a `played` clip is committed,
 * the clip pops centre-stage, plays once, and fades out. Non-interactive
 * overlay — it never blocks the board underneath.
 */
export function PlayedClip({ src, onDone }: { src: string; onDone: () => void }) {
  useEffect(() => {
    // safety net in case the video never fires 'ended' (decode error, etc.)
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="playedclip" aria-hidden>
      <video
        className="playedclip__video"
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
        onError={onDone}
      />
    </div>
  )
}
