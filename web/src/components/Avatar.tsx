// Player avatars. These are the two RASTER SLOTS — clean inline-SVG placeholders
// for now; swap each for an <img> when the owner drops the art in:
//   you → /ui/avatar-pilot.png   (kid astronaut/pilot)
//   cpu → /ui/avatar-rival.png   (robot/AI rival)
// Sized to 1em so they track the surrounding font-size; characterful colours so
// the two read as distinct even as placeholders.

import './Avatar.css'

export type Who = 'you' | 'cpu'

interface AvatarProps {
  who: Who
  size?: number | string
  className?: string
}

export function Avatar({ who, size = '1em', className }: AvatarProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    className: className ? `avatar ${className}` : 'avatar',
    'aria-hidden': true,
    focusable: false,
  }
  if (who === 'you') {
    // astronaut helmet: dome + visor + glint
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="13" fill="#dfe7f5" stroke="#aab6cf" strokeWidth="1.5" />
        <path d="M16 6.5a9.5 9.5 0 0 1 9.3 7.6c.3 1.6-1 3-2.6 3H9.3c-1.6 0-2.9-1.4-2.6-3A9.5 9.5 0 0 1 16 6.5z" fill="#16243f" />
        <ellipse cx="12" cy="12.5" rx="2.2" ry="3" fill="#7fd6ff" opacity="0.8" />
        <path d="M10 24c1.8 1.4 3.8 2 6 2s4.2-.6 6-2" fill="none" stroke="#aab6cf" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  // robot rival: antenna + head + glowing eyes + grille
  return (
    <svg {...common}>
      <line x1="16" y1="3" x2="16" y2="7" stroke="#8c7bff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.8" fill="#b9a8ff" />
      <rect x="5.5" y="7" width="21" height="18" rx="5" fill="#2a2c44" stroke="#8c7bff" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="2.4" fill="#7df0ff" />
      <circle cx="20" cy="15" r="2.4" fill="#7df0ff" />
      <path d="M11 20.5h10" stroke="#6a6e92" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
