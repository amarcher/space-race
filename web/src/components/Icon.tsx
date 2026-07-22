// Bespoke inline-SVG icon vocabulary — replaces the emoji glyphs across the play
// surface. Every icon draws in `currentColor` so callers theme it via CSS color
// (and it scales/animates cleanly). No words, no emoji, no runtime deps.
import './Icon.css'

export type IconName =
  | 'burst' // hazard / attack (a system blowout)
  | 'wrench' // remedy (repair)
  | 'shield' // safety
  | 'thrust' // distance (acceleration)
  | 'bolt' // coup-fourré / slingshot
  | 'trophy' // win
  | 'play' // commit a card
  | 'bin' // discard / trash
  | 'check' // valid "drop to play" confirmation
  | 'restart' // new round
  | 'cards' // card gallery
  | 'log' // game log
  | 'gate' // finish line
  | 'ship' // meter progress marker (placeholder for the ship-marker raster)
  | 'dot' // neutral log entry
  | 'sound-on' // audio on (speaker + waves)
  | 'sound-off' // audio muted (speaker + x)
  | 'gear' // settings
  | 'share' // share the win (box + up arrow)

interface IconProps {
  name: IconName
  /** pixel size (square); defaults to 1em so it tracks font-size */
  size?: number | string
  className?: string
}

export function Icon({ name, size = '1em', className }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: className ? `icon ${className}` : 'icon',
    'aria-hidden': true,
    focusable: false,
  }
  switch (name) {
    case 'burst':
      // a jagged impact / explosion star (filled)
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 1.5l2.5 6.2 6-3.1-3.1 6 6.2 2.4-6.2 2.4 3.1 6-6-3.1L12 22.5l-2.5-6.2-6 3.1 3.1-6L1.4 11l6.2-2.4-3.1-6 6 3.1z" />
        </svg>
      )
    case 'wrench':
      return (
        <svg {...common}>
          <path d="M15.5 6.5a3.5 3.5 0 0 1-4.6 4.6L5 17l2 2 5.9-5.9a3.5 3.5 0 0 0 4.6-4.6l-2 2-2-2z" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2.5l7 2.6v5.4c0 4.6-3 8.4-7 10.1-4-1.7-7-5.5-7-10.1V5.1z" />
        </svg>
      )
    case 'thrust':
      // a rocket nose + thrust flame, pointing up (acceleration)
      return (
        <svg {...common}>
          <path d="M12 2.5c3 2.2 4.5 5.4 4.5 9 0 1.6-.4 3-1 4.2H8.5c-.6-1.2-1-2.6-1-4.2 0-3.6 1.5-6.8 4.5-9z" />
          <path d="M9.6 19.5c.6 1 1.4 1.8 2.4 2.4 1-.6 1.8-1.4 2.4-2.4" />
          <circle cx="12" cy="9.5" r="1.6" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M13 2L4.5 13.2H11l-1.6 8.8L20 9.4h-6.6z" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
          <path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 7.6 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16.4 10" />
          <path d="M12 13v3M9 20h6M10 20l.5-4h3l.5 4" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M7 4.5l13 7.5-13 7.5z" />
        </svg>
      )
    case 'share':
      // iOS-style share: an outbox tray with a card lifting up out of it
      return (
        <svg {...common}>
          <path d="M12 3v12M8.5 6.5L12 3l3.5 3.5" />
          <path d="M7 10.5H5.5v9h13v-9H17" />
        </svg>
      )
    case 'bin':
      return (
        <svg {...common}>
          <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M4.5 12.5l5 5 10-11" strokeWidth={2.6} />
        </svg>
      )
    case 'restart':
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-2.4-5.7" />
          <path d="M20 3.5V8h-4.5" />
        </svg>
      )
    case 'cards':
      return (
        <svg {...common}>
          <rect x="3.5" y="6.5" width="10" height="14" rx="2" transform="rotate(-10 8.5 13.5)" />
          <rect x="10.5" y="4.5" width="10" height="14" rx="2" transform="rotate(8 15.5 11.5)" />
        </svg>
      )
    case 'log':
      // a ship's journal: a document page with text lines (was three bare
      // lines, which read as a hamburger menu)
      return (
        <svg {...common}>
          <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
          <path d="M14 2.5V8h5.5" />
          <path d="M8.5 12.5h7M8.5 16.5h7" />
        </svg>
      )
    case 'gate':
      // a finish gate / checkered destination marker
      return (
        <svg {...common}>
          <path d="M6 3v18M6 4h13l-2.5 4L19 12H6" />
        </svg>
      )
    case 'ship':
      // a side-profile rocket pointing right, riding the progress meter
      return (
        <svg {...common}>
          <path d="M3 12c4-.3 6-1 8.5-3.2C14 6.6 17 6 21 6c0 4-1 6.4-3.2 8.5C15.5 16.7 7 15.8 3 12z" />
          <path d="M11 13.5L8 19M13.5 11L19 8" />
          <circle cx="14.5" cy="9.5" r="1.4" />
        </svg>
      )
    case 'dot':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'sound-on':
      // a speaker cone with two sound waves
      return (
        <svg {...common}>
          <path d="M4 9.5h3l4-3v11l-4-3H4z" />
          <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18 6.7a8 8 0 0 1 0 10.6" />
        </svg>
      )
    case 'sound-off':
      // the same speaker cone, waves replaced by an X (muted)
      return (
        <svg {...common}>
          <path d="M4 9.5h3l4-3v11l-4-3H4z" />
          <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
        </svg>
      )
    case 'gear':
      // a proper settings cog — toothed outer ring + hub (the previous
      // hub-and-spokes glyph read as a sun/brightness control)
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return null
  }
}
