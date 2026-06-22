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
    let warp = 0 // current hyperspace intensity (0..1)
    let warpTarget = 0 // a jump sets this; it ramps warp up then decays away

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
      // ramp warp up toward the jump's target, then let the target decay so the
      // streaks bloom fast and ease back to the calm drift (a hyperspace jump).
      warp += (warpTarget - warp) * 0.3
      warpTarget *= 0.9
      if (warp < 0.004 && warpTarget < 0.004) warp = warpTarget = 0
      const streaking = warp > 0.06
      // vanishing point the streaks radiate from (matches the tunnel card art)
      const cx = w / 2
      const cy = h * 0.45

      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'
      for (const s of stars) {
        if (streaking) {
          // hyperspace: fly outward from the vanishing point and trail a line
          // back toward it — longer/faster the nearer the star and bigger the jump.
          const dx = s.x - cx
          const dy = s.y - cy
          const dist = Math.hypot(dx, dy) || 1
          const ux = dx / dist
          const uy = dy / dist
          const spd = (dist * 0.05 + 4) * warp * (0.6 + s.z)
          s.x += ux * spd
          s.y += uy * spd
          if (s.x < -30 || s.x > w + 30 || s.y < -30 || s.y > h + 30) {
            const a = Math.random() * Math.PI * 2
            const rr = Math.random() * 50
            s.x = cx + Math.cos(a) * rr
            s.y = cy + Math.sin(a) * rr
          }
          const len = Math.min(dist, warp * (24 + s.z * 90))
          ctx.globalAlpha = Math.min(1, 0.5 + warp * 0.5)
          ctx.strokeStyle = '#eaf0ff'
          ctx.lineWidth = Math.max(0.6, s.r * 1.2)
          ctx.beginPath()
          ctx.moveTo(s.x - ux * len, s.y - uy * len)
          ctx.lineTo(s.x, s.y)
          ctx.stroke()
        } else {
          s.y -= (4 + s.z * 14) * drift
          if (s.y < -2) {
            s.y = h + 2
            s.x = Math.random() * w
          }
          const ox = px * (6 + s.z * 30)
          const oy = py * (6 + s.z * 30)
          const twinkle = reduced ? 1 : 0.7 + 0.3 * Math.sin((t / 1000) * s.tw + s.ph)
          ctx.globalAlpha = s.a * twinkle
          ctx.fillStyle = '#dfe6ff'
          ctx.beginPath()
          ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    // a distance play asks the field to jump forward; intensity scales with the
    // light-years travelled (a 25 hop is a flicker, a 200 hop is a full streak).
    const onWarp = (e: Event) => {
      const ly = (e as CustomEvent<{ ly: number }>).detail?.ly ?? 50
      warpTarget = Math.max(warpTarget, 0.4 + Math.min(1, ly / 200) * 0.6)
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
      window.addEventListener('spacerace:warp', onWarp)
      document.addEventListener('visibilitychange', onVisibility)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('spacerace:warp', onWarp)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} className="starfield" aria-hidden />
}
