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

// Every card currently ships a single `/cards/video/<kind>.mp4` that serves as
// the hover/idle loop AND the played one-shot. To enable a card, drop its mp4
// in web/public/cards/video/ and add the kind here. (For a dedicated one-shot,
// give the kind an explicit entry below instead of listing it here.)
const CLIP_KINDS = [
  'warp-25', 'warp-50', 'warp-75', 'warp-100', 'warp-200',
  'asteroid-strike', 'empty-tank', 'busted-thruster', 'tractor-beam', 'black-hole',
  'repair-drone', 'fuel-cell', 'new-thruster', 'beam-cutter', 'ignition',
  'ace-pilot', 'antimatter-fuel-cell', 'diamond-thruster', 'rescue-shuttle',
]

/** kind → state → asset URL. Missing entries simply fall back to the static webp. */
export const CARD_VIDEO: Partial<Record<string, Partial<Record<CardArtState, string>>>> =
  Object.fromEntries(
    CLIP_KINDS.map((kind) => {
      const url = `/cards/video/${kind}.mp4`
      return [kind, { idle: url, hover: url, played: url }]
    }),
  )

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
