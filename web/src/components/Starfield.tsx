import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../motion'
import './Starfield.css'

interface Star {
  x: number
  y: number
  z: number // 0 = far, 1 = near — drives size, speed, brightness, parallax
  r: number
  a: number
  tw: number // twinkle speed
  ph: number // twinkle phase
}

/**
 * Ambient drifting starfield behind the whole table — the depth bed everything
 * else sits on. A single 2D canvas (cheaper than WebGL on tablets): stars drift
 * slowly upward, twinkle, and parallax a touch with the pointer so the scene
 * reads as three-dimensional and is never fully static.
 *
 * Honors prefers-reduced-motion (draws a static field, no animation) and pauses
 * while the tab is hidden.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduced = prefersReducedMotion()
    let w = 0
    let h = 0
    let dpr = 1
    let stars: Star[] = []
    let raf = 0
    let last = 0
    let running = true
    let px = 0 // eased pointer parallax (-1..1)
    let py = 0
    let tx = 0 // target
    let ty = 0

    const build = () => {
      const n = Math.min(160, Math.round((w * h) / 13000))
      stars = Array.from({ length: n }, () => {
        const z = Math.random()
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          r: 0.4 + z * 1.7,
          a: 0.35 + z * 0.55,
          tw: 0.5 + Math.random() * 1.5,
          ph: Math.random() * Math.PI * 2,
        }
      })
    }

    const paint = (t: number, drift: number) => {
      px += (tx - px) * 0.05
      py += (ty - py) * 0.05
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#dfe6ff'
      for (const s of stars) {
        s.y -= (4 + s.z * 14) * drift
        if (s.y < -2) {
          s.y = h + 2
          s.x = Math.random() * w
        }
        const ox = px * (6 + s.z * 30)
        const oy = py * (6 + s.z * 30)
        const twinkle = reduced ? 1 : 0.7 + 0.3 * Math.sin((t / 1000) * s.tw + s.ph)
        ctx.globalAlpha = s.a * twinkle
        ctx.beginPath()
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const frame = (t: number) => {
      const dt = last ? Math.min(50, t - last) : 16
      last = t
      paint(t, dt / 1000)
      if (running) raf = requestAnimationFrame(frame)
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, (w * dpr) | 0)
      canvas.height = Math.max(1, (h * dpr) | 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
      if (reduced) paint(0, 0) // single static draw
    }

    const onPointer = (e: PointerEvent) => {
      if (reduced) return
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reduced && !running) {
        running = true
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.addEventListener('visibilitychange', onVisibility)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} className="starfield" aria-hidden />
}
