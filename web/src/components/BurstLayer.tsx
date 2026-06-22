import { useCallback, useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../motion'
import './BurstLayer.css'

export type BurstType = 'distance' | 'remedy' | 'hazard' | 'safety'

type Shape = 'dot' | 'streak' | 'smoke' | 'ring'

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
  shape: Shape
  /** ring only: radius growth in px per frame */
  spread: number
}

// Per-type colour vocabulary — keyed to the card-ring colours used elsewhere.
const PALETTE: Record<BurstType, string[]> = {
  distance: ['#9fd4ff', '#6fb7ff', '#ffffff'],
  remedy: ['#7bf5ad', '#4fe08b', '#d6fff0', '#7df0ff'],
  hazard: ['#fff3b0', '#ffd166', '#ff7a52', '#ff5a6e'],
  safety: ['#ffe79a', '#ffd93d', '#fff6cf'],
}
// dark debris/smoke thrown off by a hazard "breakdown"
const SMOKE = ['#6a6a78', '#52525e', '#3c3c46']

/**
 * A full-viewport canvas particle layer. `fire(x, y, type)` spawns a short,
 * card-themed burst:
 *  • distance → a blue thrust spray that shoots upward (acceleration);
 *  • remedy   → a green-cyan REPAIR surge — sparks + an expanding restored-power ring;
 *  • hazard   → a BREAKDOWN — electrical spark streaks + a dark debris/smoke puff;
 *  • safety   → a gold SHIELD flourish — an expanding forcefield ring + a big pop.
 * The rAF loop only runs while particles are alive, so it costs nothing at rest.
 * No-op under reduced motion.
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

      if (p.shape === 'ring') {
        // an expanding, fading hoop — restored-power / forcefield
        const r = p.size + p.life * p.spread
        ctx.globalAlpha = Math.max(0, k)
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2.4 * k + 0.6
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.stroke()
      } else if (p.shape === 'streak') {
        // an electric spark: a short line trailing along its velocity
        const len = Math.min(16, Math.hypot(p.vx, p.vy) * 2.2)
        ctx.globalAlpha = Math.max(0, k)
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.size * k + 0.5
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx / Math.max(0.01, Math.hypot(p.vx, p.vy)) * len, p.y - p.vy / Math.max(0.01, Math.hypot(p.vx, p.vy)) * len)
        ctx.stroke()
      } else if (p.shape === 'smoke') {
        // a soft dark puff that grows and thins — debris from the blowout
        const r = p.size * (1 + p.life * 0.08)
        ctx.globalAlpha = Math.max(0, k * 0.5)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.globalAlpha = Math.max(0, k)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    if (ps.length > 0) raf.current = requestAnimationFrame(tick)
    else running.current = false
  }, [])

  const fire = useCallback(
    (x: number, y: number, type: BurstType) => {
      if (prefersReducedMotion() || !ref.current) return
      const colors = PALETTE[type]
      const push = (p: Partial<Particle> & Pick<Particle, 'vx' | 'vy'>) =>
        parts.current.push({
          x,
          y,
          life: 0,
          max: 26 + Math.random() * 28,
          size: 2.2,
          color: colors[(Math.random() * colors.length) | 0],
          grav: 0.06,
          shape: 'dot',
          spread: 0,
          ...p,
        })

      if (type === 'distance') {
        // thrust: an upward spray (acceleration), narrow horizontal spread
        for (let i = 0; i < 22; i++) {
          push({
            vx: (Math.random() * 2 - 1) * 2.5,
            vy: -(2 + Math.random() * 4),
            grav: 0.05,
            size: 2.2,
          })
        }
      } else if (type === 'hazard') {
        // BREAKDOWN: a hot radial blast + electric spark streaks + a debris puff
        for (let i = 0; i < 30; i++) {
          const ang = (Math.PI * 2 * i) / 30 + Math.random() * 0.6
          const speed = 3 + Math.random() * 6
          push({
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            grav: 0.12,
            size: 2.8,
            max: 22 + Math.random() * 22,
            shape: Math.random() < 0.6 ? 'streak' : 'dot',
          })
        }
        // dark smoke/debris rising from the blown-out system
        for (let i = 0; i < 12; i++) {
          push({
            vx: (Math.random() * 2 - 1) * 1.6,
            vy: -(0.4 + Math.random() * 1.8),
            grav: -0.01,
            size: 5 + Math.random() * 6,
            max: 38 + Math.random() * 26,
            color: SMOKE[(Math.random() * SMOKE.length) | 0],
            shape: 'smoke',
          })
        }
      } else if (type === 'remedy') {
        // REPAIR surge: green-cyan sparks + an expanding "power restored" ring
        for (let i = 0; i < 22; i++) {
          const ang = (Math.PI * 2 * i) / 22 + Math.random() * 0.5
          const speed = 2 + Math.random() * 4
          push({
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            grav: 0.05,
            shape: Math.random() < 0.45 ? 'streak' : 'dot',
          })
        }
        push({ vx: 0, vy: 0, grav: 0, size: 6, max: 26, spread: 3.4, shape: 'ring', color: '#7df0ff' })
      } else if (type === 'safety') {
        // SHIELD flourish: an expanding gold forcefield ring + a big celebratory pop
        for (let i = 0; i < 32; i++) {
          const ang = (Math.PI * 2 * i) / 32 + Math.random() * 0.5
          const speed = 2 + Math.random() * 5
          push({
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 1,
            grav: 0.04,
            size: 2.4,
          })
        }
        push({ vx: 0, vy: 0, grav: 0, size: 8, max: 30, spread: 4, shape: 'ring', color: '#ffd93d' })
        push({ vx: 0, vy: 0, grav: 0, size: 5, max: 24, spread: 2.6, shape: 'ring', color: '#fff6cf' })
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
