import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Card } from './Card'
import './useCardPreview.css'

const POP_W = 116 // floating card preview width (px); height follows 3:4
const ASPECT = 4 / 3 // card height / width
const GAP = 10 // displacement between the trigger and the preview
const MARGIN = 8 // keep this far from the viewport edge

// module-scoped: the closer for whichever preview is currently open, so a newly
// opened one dismisses it — at most ONE preview on screen at a time (robust to a
// missed pointerleave / pointerup). Shared across every useCardPreview caller.
let activeClose: (() => void) | null = null

interface PreviewHandlers {
  onPointerEnter: (e: ReactPointerEvent) => void
  onPointerLeave: (e: ReactPointerEvent) => void
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: () => void
  onFocus: (e: { currentTarget: HTMLElement }) => void
  onBlur: () => void
}

/**
 * Reveal a card — animated — on hover (desktop) or press-and-hold (mobile),
 * anchored to whatever element carries the returned `handlers`. The preview is a
 * fixed-position `<Card ambient>` portalled to <body> and clamped on-screen.
 * Pass a null/undefined kind for rows that don't resolve to a card: the handlers
 * become inert and no popover renders. (Originally built for the How-to-Play
 * hazard tracks, #45; reused by the game log.)
 */
export function useCardPreview(kind: string | null | undefined): {
  handlers: Partial<PreviewHandlers>
  popover: React.ReactNode
  open: boolean
} {
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)

  const close = useCallback(() => {
    setPos(null)
    if (activeClose === close) activeClose = null
  }, [])

  // Tooltip-style placement: the card must be DISPLACED from the trigger with a
  // gap and must NEVER overlap the trigger's rect — you have to see BOTH the word
  // and the card. Pick the first side with room (beside → right, then left, then
  // above, then below); clamp fully on-screen; if nothing fits at full size,
  // scale the card down on the roomier vertical side (never centred over the word).
  const openAt = useCallback(
    (target: HTMLElement | null) => {
      const r = target?.getBoundingClientRect()
      if (!r) return
      if (activeClose && activeClose !== close) activeClose()
      activeClose = close

      const vw = window.innerWidth
      const vh = window.innerHeight
      let w = POP_W
      let h = w * ASPECT
      // never exceed the viewport
      if (h > vh - 2 * MARGIN) { h = vh - 2 * MARGIN; w = h / ASPECT }
      if (w > vw - 2 * MARGIN) { w = vw - 2 * MARGIN; h = w * ASPECT }

      const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - w - MARGIN))
      const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - h - MARGIN))
      const besideY = clampY(r.top + r.height / 2 - h / 2) // centred on the trigger, on-screen
      const centeredX = clampX(r.left + r.width / 2 - w / 2)

      // free space on each side, outside the trigger rect (minus the gap + margin)
      const roomRight = vw - r.right - GAP - MARGIN
      const roomLeft = r.left - GAP - MARGIN
      const roomAbove = r.top - GAP - MARGIN
      const roomBelow = vh - r.bottom - GAP - MARGIN

      let left: number
      let top: number
      if (roomRight >= w) {
        left = r.right + GAP
        top = besideY
      } else if (roomLeft >= w) {
        left = r.left - GAP - w
        top = besideY
      } else if (roomAbove >= h) {
        left = centeredX
        top = r.top - GAP - h
      } else if (roomBelow >= h) {
        left = centeredX
        top = r.bottom + GAP
      } else {
        // last resort: the vertical side with more room, scaled to fit (rows are
        // short, so above/below almost always works) — still above/below, so the
        // word is never covered
        const above = roomAbove >= roomBelow
        h = Math.max(56, Math.min(h, (above ? roomAbove : roomBelow)))
        w = h / ASPECT
        left = clampX(r.left + r.width / 2 - w / 2)
        top = above ? r.top - GAP - h : r.bottom + GAP
      }
      setPos({ left, top, width: Math.round(w) })
    },
    [close],
  )

  // tidy up if this preview is still the active one when it unmounts
  useEffect(() => close, [close])

  const handlers: Partial<PreviewHandlers> = kind
    ? {
        onPointerEnter: (e) => e.pointerType === 'mouse' && openAt(e.currentTarget as HTMLElement),
        onPointerLeave: (e) => e.pointerType === 'mouse' && close(),
        onPointerDown: (e) => e.pointerType !== 'mouse' && openAt(e.currentTarget as HTMLElement),
        onPointerUp: (e) => e.pointerType !== 'mouse' && close(),
        onPointerCancel: close,
        onFocus: (e) => openAt(e.currentTarget),
        onBlur: close,
      }
    : {}

  const popover =
    pos && kind
      ? createPortal(
          <div className="card-pop" style={{ left: pos.left, top: pos.top, width: pos.width }} aria-hidden>
            <Card kind={kind} size="md" ambient showName={false} />
          </div>,
          document.body,
        )
      : null

  return { handlers, popover, open: !!pos }
}
