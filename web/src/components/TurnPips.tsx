// DRAW TWO, PLAY TWO turn markers, word-free: two little card backs by the piles
// while you're drawing, two play arrows by your ship while you're moving. A lit
// marker is one you still have; a spent one goes hollow.
import './TurnPips.css'

export function TurnPips({ kind, left, total = 2 }: { kind: 'draw' | 'play'; left: number; total?: number }) {
  const label = kind === 'draw' ? `${left} of ${total} draws left` : `${left} of ${total} moves left`
  return (
    <span className={`pips pips--${kind}`} role="img" aria-label={label} title={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`pip ${i < left ? 'pip--on' : 'pip--off'}`} aria-hidden>
          {kind === 'play' && (
            <svg viewBox="0 0 16 16" width="100%" height="100%">
              <path d="M5 3 L12 8 L5 13 Z" fill="currentColor" />
            </svg>
          )}
        </span>
      ))}
    </span>
  )
}
