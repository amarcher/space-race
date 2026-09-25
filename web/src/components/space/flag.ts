// The space table is the game's table. `?table=classic` brings back the old
// board (kept while the new one beds in, and for side-by-side comparison).
export const SPACE_TABLE =
  typeof window === 'undefined' || new URLSearchParams(window.location.search).get('table') !== 'classic'
