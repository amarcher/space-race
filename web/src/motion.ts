// Shared motion primitives for the table: a reduced-motion check, a few tuning
// constants, and the screen-space rect type that the drag + flight layers trade
// in. Motion is ON by default; the only opt-out is the OS "reduce motion"
// preference (no in-game toggle), matching every other animation in the game.

export interface Rect {
  left: number
  top: number
  width: number
}

/** Read the OS reduced-motion preference live (so it honours a mid-game change). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Flight tween (deck/discard ↔ hand). Keep in sync with the CSS transition.
export const FLIGHT_MS = 460

// Crane-pull drag feel.
export const DRAG_THRESHOLD = 8 // px of travel before a press becomes a drag (vs a tap)
export const DRAG_SCALE = 1.12 // how much the lifted card grows
export const DRAG_LIFT = 0.5 // card rises by this fraction of its width above the cursor
export const DRAG_MAX_TILT = 16 // deg of velocity-driven sway
