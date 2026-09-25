// A tiny spring-physics world for the cards on the space table. Every card
// that moves (your hand, anything in flight) is a Body with damped springs on
// position, rotation, scale, lift (height off the surface) and flip. Positions
// are card CENTRES in viewport px. React only mounts/unmounts bodies; the rAF
// loop writes transforms straight to the DOM. Under reduced motion every spring
// snaps to its target, so cards still arrive (and callbacks still fire).

import { prefersReducedMotion } from '../../motion'

export interface Spring {
  k: number
  c: number
}

const POS: Spring = { k: 170, c: 19 } // slightly under-damped: a card overshoots a hair and settles
const DRAG: Spring = { k: 900, c: 48 } // follows the finger with a little lag
const ROT: Spring = { k: 240, c: 20 }
const SCALE: Spring = { k: 260, c: 22 }
const LIFT: Spring = { k: 180, c: 20 }
const FLIP: Spring = { k: 110, c: 15 }

export class Body {
  id: string
  kind: string | undefined
  w: number
  z = 10
  x: number
  y: number
  r: number
  s: number
  lift = 0
  flip: number
  vx = 0
  vy = 0
  vr = 0
  vs = 0
  vl = 0
  vf = 0
  tx: number
  ty: number
  tr: number
  ts: number
  tflip: number
  /** extra lift held while dragged / inspected */
  hold = 0
  /** y springs softer than x in flight, which bends the path into an arc */
  arc = 0.62
  dragging = false
  committing = false
  inspecting = false
  dim = false
  /** this card would get you moving again: it glows to say so */
  hint = false
  /** ms to wait at the spawn point before launching (staggered deals) */
  wait = 0
  arrived = true
  onArrive?: () => void
  el: HTMLElement | null = null

  constructor(o: { id: string; kind?: string; w: number; x: number; y: number; r?: number; s?: number; faceUp: boolean }) {
    this.id = o.id
    this.kind = o.kind
    this.w = o.w
    this.x = this.tx = o.x
    this.y = this.ty = o.y
    this.r = this.tr = o.r ?? 0
    this.s = this.ts = o.s ?? 1
    this.flip = this.tflip = o.faceUp ? 1 : 0
  }

  /** send the card somewhere; `onArrive` fires once it has settled there */
  goTo(t: { x: number; y: number; r?: number; s?: number; flip?: number }, onArrive?: () => void) {
    this.tx = t.x
    this.ty = t.y
    if (t.r !== undefined) this.tr = t.r
    if (t.s !== undefined) this.ts = t.s
    if (t.flip !== undefined) this.tflip = t.flip
    this.onArrive = onArrive
    this.arrived = false
  }
}

const step = (x: number, v: number, t: number, sp: Spring, dt: number, mul = 1): [number, number] => {
  const a = sp.k * mul * (t - x) - sp.c * Math.sqrt(mul) * v
  v += a * dt
  return [x + v * dt, v]
}

export class World {
  bodies = new Map<string, Body>()
  private listeners = new Set<() => void>()
  private raf = 0
  private last = 0
  private freezeUntil = 0

  add(b: Body) {
    this.bodies.set(b.id, b)
    this.emit()
    return b
  }
  remove(id: string) {
    if (this.bodies.delete(id)) this.emit()
  }
  /** hit-stop: freeze every card for a beat so an impact lands */
  freeze(ms: number) {
    this.freezeUntil = performance.now() + ms
  }
  subscribe(l: () => void) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }

  start() {
    const tick = (now: number) => {
      const dt = Math.min(0.034, (now - (this.last || now)) / 1000)
      this.last = now
      if (now >= this.freezeUntil) {
        // two substeps keep stiff drag springs stable on a slow frame
        for (let i = 0; i < 2; i++) this.stepAll(dt / 2, dt * 500)
      }
      this.bodies.forEach((b) => this.paint(b))
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }
  stop() {
    cancelAnimationFrame(this.raf)
  }

  private stepAll(dt: number, ms: number) {
    const snap = prefersReducedMotion()
    this.bodies.forEach((b) => {
      if (snap) {
        b.wait = 0
        b.x = b.tx
        b.y = b.ty
        b.r = b.tr
        b.s = b.ts
        b.flip = b.tflip
        b.lift = b.hold
        b.vx = b.vy = b.vr = b.vs = b.vl = b.vf = 0
      }
      if (b.wait > 0) {
        b.wait -= ms
        return
      }
      const dist = Math.hypot(b.tx - b.x, b.ty - b.y)
      const sp = b.dragging ? DRAG : POS
      ;[b.x, b.vx] = step(b.x, b.vx, b.tx, sp, dt)
      ;[b.y, b.vy] = step(b.y, b.vy, b.ty, sp, dt, b.dragging ? 1 : b.arc)
      // a moving card leans into its travel, like a real one sliding under a finger
      const lean = Math.max(-16, Math.min(16, b.vx * 0.014))
      ;[b.r, b.vr] = step(b.r, b.vr, b.tr + lean, ROT, dt)
      ;[b.s, b.vs] = step(b.s, b.vs, b.ts, SCALE, dt)
      // far from home = high off the table; it comes down as it arrives
      const autoLift = b.dragging ? 1 : Math.min(1, dist / 240)
      ;[b.lift, b.vl] = step(b.lift, b.vl, Math.max(autoLift, b.hold), LIFT, dt)
      ;[b.flip, b.vf] = step(b.flip, b.vf, b.tflip, FLIP, dt)
      if (!b.arrived && !b.dragging && dist < 1.5 && Math.hypot(b.vx, b.vy) < 24 && Math.abs(b.flip - b.tflip) < 0.04) {
        b.arrived = true
        const cb = b.onArrive
        b.onArrive = undefined
        cb?.()
      }
    })
  }

  private paint(b: Body) {
    const el = b.el
    if (!el) return
    const h = b.w * 1.4
    const sc = b.s * (1 + 0.1 * b.lift)
    el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - h / 2}px, 0) rotate(${b.r}deg) scale(${sc})`
    el.style.zIndex = String(b.dragging || b.inspecting ? 400 : b.committing ? 300 : b.z)
    el.style.setProperty('--lift', b.lift.toFixed(3))
    el.style.setProperty('--r', b.r.toFixed(2))
    el.style.setProperty('--flip', (1 - Math.max(0, Math.min(1, b.flip))).toFixed(3))
    el.classList.toggle('body--dim', b.dim)
    el.classList.toggle('body--hint', b.hint)
  }
}
