import { useCallback, useEffect, useRef } from 'react'
import { CARD_GLARE_MAX, CARD_TILT_MAX, prefersReducedMotion } from '../motion'

/**
 * Pointer-driven 3D tilt + foil glare for an interactive card. Returns a ref to
 * attach to the card element and the pointer handlers that drive it. The card
 * leans toward the pointer and a holographic highlight tracks the cursor; both
 * ease back to rest on leave. Everything is written as CSS custom properties so
 * the composited transform/opacity stay on the GPU.
 *
 * Disabled (no-op handlers) for non-interactive cards and when the OS asks for
 * reduced motion — so drag/flight clones and the board never tilt.
 */
export function useCardTilt(enabled: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const raf = useRef(0)

  const set = useCallback((rx: number, ry: number, mx: number, my: number, glare: number) => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tilt-x', `${rx}deg`)
    el.style.setProperty('--tilt-y', `${ry}deg`)
    el.style.setProperty('--mx', `${mx}%`)
    el.style.setProperty('--my', `${my}%`)
    el.style.setProperty('--glare', `${glare}`)
  }, [])

  const rest = useCallback(() => {
    cancelAnimationFrame(raf.current)
    set(0, 0, 50, 50, 0)
  }, [set])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el || prefersReducedMotion()) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width // 0..1 across the card
      const py = (e.clientY - r.top) / r.height
      const nx = px * 2 - 1 // -1..1 from centre
      const ny = py * 2 - 1
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() =>
        // pointer right → lean right (rotateY+); pointer down → top tips back (rotateX-)
        set(-ny * CARD_TILT_MAX, nx * CARD_TILT_MAX, px * 100, py * 100, CARD_GLARE_MAX),
      )
    },
    [set],
  )

  // drop any in-flight frame if the card unmounts mid-tilt
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const handlers = enabled
    ? { onPointerMove, onPointerLeave: rest, onPointerDown: rest, onPointerCancel: rest }
    : undefined

  return { ref, handlers }
}
