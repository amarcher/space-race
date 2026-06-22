// Animated card art manifest.
//
// Every card always has a static `/cards/<art>.webp` (see cards.ts) as its base
// and fallback. On top of that, a card *kind* may declare looping/one-shot video
// clips per interaction STATE, and the card view swaps to the clip when that
// state is active (see Card.tsx). Drop new assets in by adding an entry here —
// no component changes needed.
//
// Convention for asset URLs (served from web/public): `/cards/video/<kind>-<state>.<ext>`.
// Use a web-friendly, loop-clean codec — VP9/WebM (alpha supported) or H.264/MP4.
// Keep clips short (~2–4s), seamless, and small (these run on kids' tablets).

export type CardArtState =
  | 'idle' // ambient loop — the card is "alive" at rest
  | 'hover' // a livelier loop while the card is hovered / selected
  | 'played' // a one-shot flourish when the card is committed (reserved; not yet wired)

/** kind → state → asset URL. Empty entries simply fall back to the static webp. */
export const CARD_VIDEO: Partial<Record<string, Partial<Record<CardArtState, string>>>> = {
  // Demo: the hyperwarp card breathes (slow push into the tunnel). Generated from
  // the static art as a placeholder — replace with the real Veo clip.
  'warp-200': { idle: '/cards/video/warp-200-idle.webm' },
  // Owner's Veo assets land here, e.g.:
  // 'black-hole': { idle: '/cards/video/black-hole-idle.webm', hover: '/cards/video/black-hole-hover.webm' },
}

/**
 * Resolve the best available clip for a kind given a priority of states
 * (e.g. ['hover','idle'] while hovered). Returns undefined → use the static art.
 */
export function cardVideo(kind: string | undefined, prefer: CardArtState[]): string | undefined {
  if (!kind) return undefined
  const m = CARD_VIDEO[kind]
  if (!m) return undefined
  for (const s of prefer) {
    const url = m[s]
    if (url) return url
  }
  return undefined
}
