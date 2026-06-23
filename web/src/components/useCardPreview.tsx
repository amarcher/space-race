import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Card } from './Card'
import './useCardPreview.css'

const POP_W = 116 // floating card preview width (px); height follows 3:4

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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const close = useCallback(() => {
    setPos(null)
    if (activeClose === close) activeClose = null
  }, [])

  const openAt = useCallback(
    (target: HTMLElement | null) => {
      const r = target?.getBoundingClientRect()
      if (!r) return
      if (activeClose && activeClose !== close) activeClose()
      activeClose = close
      const cardH = (POP_W * 4) / 3
      const vw = window.innerWidth
      const left = Math.max(8, Math.min(r.left + r.width / 2 - POP_W / 2, vw - POP_W - 8))
      // prefer above the trigger; flip below if there isn't room
      const top = r.top > cardH + 18 ? r.top - cardH - 12 : r.bottom + 12
      setPos({ left, top })
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
          <div className="card-pop" style={{ left: pos.left, top: pos.top, width: POP_W }} aria-hidden>
            <Card kind={kind} size="md" ambient showName={false} />
          </div>,
          document.body,
        )
      : null

  return { handlers, popover, open: !!pos }
}
