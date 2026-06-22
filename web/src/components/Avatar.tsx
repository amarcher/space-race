// Player avatars — round-cropped raster portraits (transparent PNG), sized to
// 1em so they track the surrounding font-size. A matched pair:
//   you → /ui/avatar-pilot.png  (kid astronaut)
//   cpu → /ui/avatar-rival.png  (robot rival)
import './Avatar.css'

export type Who = 'you' | 'cpu'

const SRC: Record<Who, string> = {
  you: '/ui/avatar-pilot.png',
  cpu: '/ui/avatar-rival.png',
}

interface AvatarProps {
  who: Who
  size?: number | string
  className?: string
}

export function Avatar({ who, size = '1em', className }: AvatarProps) {
  return (
    <img
      className={className ? `avatar ${className}` : 'avatar'}
      src={SRC[who]}
      alt=""
      aria-hidden
      draggable={false}
      style={{ width: size, height: size }}
    />
  )
}
