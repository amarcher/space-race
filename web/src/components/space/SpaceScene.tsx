// The space the race happens in: a photographic nebula plate (landscape or
// portrait, so it never stretches) with a live 3D starfield in front of it.
// The stars fly at your speed: every distance play fires the game's
// `spacerace:warp` event and they rush past in proportion to the jump (a 200
// is a full hyperwarp); stuck under a hazard, or not launched yet, they drift
// almost to a stop and the nebula dims. A tap on empty space sends a comet.
import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../../audio/sfx'
import { prefersReducedMotion } from '../../motion'

const PLATES = { land: '/space/space-land.webp', port: '/space/space-port.webp' }

interface Comet {
  id: number
  x: number
  y: number
  dx: number
  dy: number
}

export function SpaceScene({ land, stalled }: { land: boolean; stalled: boolean }) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [comets, setComets] = useState<Comet[]>([])
  const seq = useRef(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const speed = useRef({ base: 1, boost: 0 })

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  useEffect(() => {
    speed.current.base = stalled ? 0.06 : 1
  }, [stalled])

  // the same event the game has always fired on a distance play
  useEffect(() => {
    const onWarp = (e: Event) => {
      const ly = (e as CustomEvent<{ ly?: number }>).detail?.ly ?? 50
      speed.current.boost = ly >= 200 ? 90 : Math.min(30, 6 + ly / 8)
    }
    window.addEventListener('spacerace:warp', onWarp)
    return () => window.removeEventListener('spacerace:warp', onWarp)
  }, [])

  const comet = (x: number, y: number, dx: number, dy: number) => {
    const id = ++seq.current
    setComets((cs) => [...cs, { id, x, y, dx, dy }])
    window.setTimeout(() => setComets((cs) => cs.filter((c) => c.id !== id)), 1400)
  }

  // now and then a comet crosses on its own
  useEffect(() => {
    if (prefersReducedMotion()) return
    let t = 0
    const next = () => {
      t = window.setTimeout(() => {
        comet(Math.random() * vp.w * 0.4, Math.random() * vp.h * 0.3, vp.w * (0.4 + Math.random() * 0.4), vp.h * (0.1 + Math.random() * 0.3))
        next()
      }, 9000 + Math.random() * 10000)
    }
    next()
    return () => window.clearTimeout(t)
  }, [vp.w, vp.h])

  // the starfield
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = vp.w * dpr
    c.height = vp.h * dpr
    ctx.scale(dpr, dpr)
    const cx = vp.w / 2
    const cy = vp.h * 0.42
    const spread = Math.max(vp.w, vp.h)
    const mk = () => ({ x: (Math.random() - 0.5) * spread * 2, y: (Math.random() - 0.5) * spread * 2, z: Math.random() * 1000 + 1 })
    const pts = Array.from({ length: Math.round(Math.min(480, (vp.w * vp.h) / 2600)) }, mk)
    const still = prefersReducedMotion()
    let raf = 0
    let last = performance.now()
    let hidden = document.visibilityState === 'hidden'
    const onVis = () => {
      hidden = document.visibilityState === 'hidden'
      last = performance.now()
      if (!hidden && !still) raf = requestAnimationFrame(tick)
    }
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const sp = speed.current
      sp.boost *= Math.pow(0.18, dt) // a warp surge fades over about a second
      const v = still ? 0 : (sp.base + sp.boost) * 60
      ctx.clearRect(0, 0, vp.w, vp.h)
      for (const p of pts) {
        const z0 = p.z
        p.z -= v * dt
        if (p.z < 1) {
          Object.assign(p, mk(), { z: 1000 })
          continue
        }
        const x = cx + (p.x / p.z) * 190
        const y = cy + (p.y / p.z) * 190
        if (x < 0 || x > vp.w || y < 0 || y > vp.h) continue
        const px = cx + (p.x / z0) * 190
        const py = cy + (p.y / z0) * 190
        const lum = Math.min(1, (1000 - p.z) / 700)
        ctx.strokeStyle = `rgba(225,235,255,${0.25 + lum * 0.7})`
        ctx.lineWidth = 0.6 + lum * 1.6
        ctx.beginPath()
        // at cruise a star is a dot; in a warp it stretches into a streak
        ctx.moveTo(px - (x - px) * 2.5, py - (y - py) * 2.5)
        ctx.lineTo(x + 0.1, y + 0.1)
        ctx.stroke()
      }
      if (!still && !hidden) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [vp.w, vp.h])

  const onSky = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    comet(e.clientX, e.clientY, (Math.random() - 0.5) * vp.w, -vp.h * (0.3 + Math.random() * 0.3))
    playSfx('warp', { gain: 0.2, rate: 1.4 })
  }

  return (
    <div className={`space-scene ${stalled ? 'space-scene--stalled' : ''}`} onPointerDown={onSky}>
      <img className="space-scene__plate" src={land ? PLATES.land : PLATES.port} alt="" draggable={false} />
      <canvas ref={canvas} className="space-scene__stars" style={{ width: vp.w, height: vp.h }} />
      {comets.map((c) => (
        <span
          key={c.id}
          className="space-comet"
          style={
            {
              left: c.x,
              top: c.y,
              '--dx': `${c.dx}px`,
              '--dy': `${c.dy}px`,
              '--ang': `${Math.atan2(c.dy, c.dx)}rad`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
