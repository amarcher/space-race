// MOMENTUM meter — a word-free charging gauge shown per player.
//
// A row of forward-chevron pips fills as the player banks momentum (one pip per
// clean distance play). When the meter tops out AND it's spendable (the human
// can chain a breakaway), the whole gauge ignites gold and turns into a tappable
// SPEND affordance — a pulsing double-chevron "GO AGAIN" burst. No text: a
// 5-year-old reads "charge up → it glows → press the rocket to blast twice".
//
// Mounted only in MOMENTUM mode; classic/scry never render it.
import './MomentumMeter.css'

interface MomentumMeterProps {
  /** banked charge, 0..cap */
  charge: number
  /** full meter = cap pips */
  cap: number
  /** the human may spend it right now (full + has a distance to chain) → glows + tappable */
  spendable: boolean
  /** true on the opponent's gauge — render-only, never tappable */
  isOpponent: boolean
  /** spend the meter for a breakaway (only wired when spendable) */
  onBurst?: () => void
}

/** A single forward chevron pip (»-style) — empty, filling, or fully lit. */
function Pip({ state }: { state: 'empty' | 'lit' }) {
  return (
    <span className={`momentum__pip momentum__pip--${state}`} aria-hidden>
      <svg viewBox="0 0 16 24" width="100%" height="100%">
        <path d="M3 3 L12 12 L3 21" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function MomentumMeter({ charge, cap, spendable, isOpponent, onBurst }: MomentumMeterProps) {
  const full = charge >= cap
  const pips = Array.from({ length: cap }, (_, i) => (i < charge ? 'lit' : 'empty') as 'lit' | 'empty')
  const cls = `momentum ${full ? 'momentum--full' : ''} ${spendable ? 'momentum--spendable' : ''} ${
    isOpponent ? 'momentum--opp' : ''
  }`
  const label = spendable
    ? 'Momentum full — tap to break away'
    : full
      ? 'Momentum full'
      : `Momentum ${charge} of ${cap}`

  // Spendable → a real button (the SPEND affordance). Otherwise an inert gauge.
  if (spendable) {
    return (
      <button type="button" className={cls} onClick={onBurst} aria-label={label} title={label}>
        <span className="momentum__pips">
          {pips.map((s, i) => (
            <Pip key={i} state={s} />
          ))}
        </span>
        {/* the "go again" burst sigil that appears when ready to spend */}
        <span className="momentum__spark" aria-hidden>
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <path d="M4 4 L13 12 L4 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4 L20 12 L11 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    )
  }

  return (
    <span className={cls} aria-label={label} title={label} role="img">
      <span className="momentum__pips">
        {pips.map((s, i) => (
          <Pip key={i} state={s} />
        ))}
      </span>
    </span>
  )
}
