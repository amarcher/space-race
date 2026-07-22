// Minimal typographic player identifier — replaces the retired raster avatars
// (kid astronaut / robot rival) everywhere a row or column needs to say whose
// it is. Small-caps wordmark, tinted per seat: you = the meter's cyan, cpu = a
// warm ember. Sized in em so it tracks the surrounding font-size like the
// avatars did.
import './PlayerTag.css'

export type Who = 'you' | 'cpu'

const TEXT: Record<Who, string> = { you: 'YOU', cpu: 'CPU' }

export function PlayerTag({ who, size, className }: { who: Who; size?: number | string; className?: string }) {
  return (
    <span
      className={`ptag ptag--${who}${className ? ` ${className}` : ''}`}
      style={size != null ? { fontSize: size } : undefined}
      aria-label={TEXT[who]}
    >
      {TEXT[who]}
    </span>
  )
}
