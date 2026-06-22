import { useCallback, useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../motion'
import './BurstLayer.css'

export type BurstType = 'distance' | 'remedy' | 'hazard' | 'safety'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  grav: number
}

// Per-type colour vocabulary — keyed to the card-ring colours used elsewhere.
const PALETTE: Record<BurstType, string[]> = {
  distance: ['#9fd4ff', '#6fb7ff', '#ffffff'],
  remedy: ['#7bf5ad', '#4fe08b', '#d6fff0'],
  hazard: ['#ff7a52', '#ff5a6e', '#ffd166'],
  safety: ['#ffe79a', '#ffd93d', '#fff6cf'],
}

/**
 * A full-viewport canvas particle layer. `fire(x, y, type)` spawns a short
 * burst whose flavour depends on the card type — a blue thrust spray for
 * distance, a green repair sparkle for remedies, a hot radial blast for
 * hazards, a big gold pop for safeties. The rAF loop only runs while particles
 * are alive, so it costs nothing at rest. No-op under reduced motion.
 */
export function useBurstLayer() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const parts = useRef<Particle[]>([])
  const raf = useRef(0)
  const running = useRef(false)
  const dpr = useRef(1)

  const size = useCallback(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    dpr.current = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.max(1, (window.innerWidth * dpr.current) | 0)
    c.height = Math.max(1, (window.innerHeight * dpr.current) | 0)
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
  }, [])

  const tick = useCallback(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) {
      running.current = false
      return
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const ps = parts.current
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life += 1
      const k = 1 - p.life / p.max
      if (k <= 0) {
        ps.splice(i, 1)
        continue
      }
      p.vy += p.grav
      p.vx *= 0.96
      p.vy *= 0.96
      p.x += p.vx
      p.y += p.vy
      ctx.globalAlpha = Math.max(0, k)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (ps.length > 0) raf.current = requestAnimationFrame(tick)
    else running.current = false
  }, [])

  const fire = useCallback(
    (x: number, y: number, type: BurstType) => {
      if (prefersReducedMotion() || !ref.current) return
      const colors = PALETTE[type]
      const n = type === 'safety' ? 36 : type === 'hazard' ? 32 : 22
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6
        let speed = 2 + Math.random() * 4
        let vx = Math.cos(ang) * speed
        let vy = Math.sin(ang) * speed
        let grav = 0.06
        if (type === 'distance') {
          // a thrust spray that shoots upward (acceleration), narrow horizontal spread
          vx = (Math.random() * 2 - 1) * 2.5
          vy = -(2 + Math.random() * 4)
          grav = 0.05
        } else if (type === 'hazard') {
          speed = 3 + Math.random() * 5 // hotter, faster radial blast
          vx = Math.cos(ang) * speed
          vy = Math.sin(ang) * speed
          grav = 0.12
        } else if (type === 'safety') {
          speed = 2 + Math.random() * 5 // big celebratory pop, slight upward bias
          vx = Math.cos(ang) * speed
          vy = Math.sin(ang) * speed - 1
          grav = 0.04
        }
        parts.current.push({
          x,
          y,
          vx,
          vy,
          life: 0,
          max: 26 + Math.random() * 28,
          size: type === 'hazard' ? 2.7 : 2.2,
          color: colors[(Math.random() * colors.length) | 0],
          grav,
        })
      }
      if (!running.current) {
        running.current = true
        size()
        raf.current = requestAnimationFrame(tick)
      }
    },
    [size, tick],
  )

  useEffect(() => {
    size()
    const onResize = () => size()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf.current)
      running.current = false
    }
  }, [size])

  return { ref, fire }
}
