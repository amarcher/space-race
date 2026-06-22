import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DRAG_LIFT,
  DRAG_MAX_TILT,
  DRAG_SCALE,
  DRAG_THRESHOLD,
  prefersReducedMotion,
  type Rect,
} from '../motion'
import { Card } from './Card'
import './DragLayer.css'

export interface DragInfo {
  uid: string
  kind: string
  x: number // pointer position (client coords)
  y: number
  w: number // card width at rest
  tilt: number // velocity-driven sway, deg
}

interface PressState {
  uid: string
  kind: string
  startX: number
  startY: number
  w: number
  lastX: number
  lastT: number
  tilt: number
  dragging: boolean
  onMove: (e: PointerEvent) => void
  onUp: (e: PointerEvent) => void
}

interface UseCardDragOpts {
  /** raw drop-zone id under a point, or null */
  zoneAt: (x: number, y: number) => string | null
  /** fired on a real drag release; rect is where the floating card ended up */
  onDrop: (uid: string, zone: string | null, rect: Rect) => void
  /** whether a press is allowed to begin a drag at all */
  enabled: boolean
}

/**
 * Pointer-driven "crane" drag for hand cards. A press that travels past a small
 * threshold lifts the card out of the hand to float beneath the cursor (see
 * DragLayer); shorter presses fall through to the card's normal click → select.
 * A drag that crosses the threshold is recorded so the trailing click can be
 * suppressed by the hand (see `wasDragged`).
 */
export function useCardDrag({ zoneAt, onDrop, enabled }: UseCardDragOpts) {
  const [drag, setDrag] = useState<DragInfo | null>(null)
  const [zone, setZone] = useState<string | null>(null)
  const pressRef = useRef<PressState | null>(null)
  const draggedRef = useRef(false)

  // keep the latest callbacks reachable from the long-lived window listeners
  const cbRef = useRef({ zoneAt, onDrop })
  cbRef.current = { zoneAt, onDrop }

  const begin = useCallback(
    (e: React.PointerEvent, uid: string, kind: string) => {
      if (!enabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const cardEl = (e.currentTarget as HTMLElement).querySelector('.card') as HTMLElement | null
      const r = (cardEl ?? (e.currentTarget as HTMLElement)).getBoundingClientRect()
      draggedRef.current = false

      const press: PressState = {
        uid,
        kind,
        startX: e.clientX,
        startY: e.clientY,
        w: r.width,
        lastX: e.clientX,
        lastT: performance.now(),
        tilt: 0,
        dragging: false,
        onMove: () => {},
        onUp: () => {},
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', press.onMove)
        window.removeEventListener('pointerup', press.onUp)
        window.removeEventListener('pointercancel', press.onUp)
      }

      press.onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - press.startX
        const dy = ev.clientY - press.startY
        if (!press.dragging) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
          press.dragging = true
          draggedRef.current = true
        }
        const now = performance.now()
        const vx = (ev.clientX - press.lastX) / Math.max(1, now - press.lastT)
        press.lastX = ev.clientX
        press.lastT = now
        const target = Math.max(-DRAG_MAX_TILT, Math.min(DRAG_MAX_TILT, vx * 90))
        press.tilt = press.tilt * 0.7 + target * 0.3
        setDrag({ uid: press.uid, kind: press.kind, x: ev.clientX, y: ev.clientY, w: press.w, tilt: press.tilt })
        setZone(cbRef.current.zoneAt(ev.clientX, ev.clientY))
      }

      press.onUp = (ev: PointerEvent) => {
        cleanup()
        pressRef.current = null
        setDrag(null)
        setZone(null)
        if (press.dragging) {
          const vw = press.w * DRAG_SCALE
          const cx = ev.clientX
          const cy = ev.clientY - press.w * DRAG_LIFT
          const rect: Rect = { left: cx - vw / 2, top: cy - (vw * 4) / 3 / 2, width: vw }
          cbRef.current.onDrop(press.uid, cbRef.current.zoneAt(ev.clientX, ev.clientY), rect)
        }
      }

      pressRef.current = press
      window.addEventListener('pointermove', press.onMove, { passive: true })
      window.addEventListener('pointerup', press.onUp)
      window.addEventListener('pointercancel', press.onUp)
    },
    [enabled],
  )

  // tidy listeners if we unmount mid-drag
  useEffect(() => {
    return () => {
      const p = pressRef.current
      if (!p) return
      window.removeEventListener('pointermove', p.onMove)
      window.removeEventListener('pointerup', p.onUp)
      window.removeEventListener('pointercancel', p.onUp)
    }
  }, [])

  const wasDragged = useCallback(() => draggedRef.current, [])

  return { drag, zone, begin, wasDragged }
}

function DragCard({ drag }: { drag: DragInfo }) {
  // animate the lift on mount (0 → raised) for the "crane pulls it up" feel
  const [up, setUp] = useState(prefersReducedMotion())
  useEffect(() => {
    const r = requestAnimationFrame(() => setUp(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const lift = up ? drag.w * DRAG_LIFT : 0
  const scale = up ? DRAG_SCALE : 1

  return (
    <div className="draglayer__pos" style={{ left: `${drag.x}px`, top: `${drag.y}px` }}>
      <div
        className="draglayer__card"
        style={{
          width: `${drag.w}px`,
          transform: `translate(-50%, -50%) translateY(${-lift}px) scale(${scale}) rotate(${drag.tilt}deg)`,
        }}
      >
        <Card kind={drag.kind} size="md" showName={false} noHover />
      </div>
    </div>
  )
}

export function DragLayer({ drag }: { drag: DragInfo | null }) {
  return (
    <div className="draglayer" aria-hidden>
      {drag && <DragCard drag={drag} />}
    </div>
  )
}
