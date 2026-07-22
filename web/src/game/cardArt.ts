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
// Keep clips short (~2–4s), seamless, and small (these run on low-power tablets).

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

// Asset version — BUMP whenever a clip/poster is re-exported (same convention as
// WinTakeover's ASSET_V). These URLs are runtime-cached CacheFirst by the service
// worker for 30 days, so replacing a file's bytes at the same URL (e.g. the
// warp-25 regeneration) never reaches returning visitors without a new cache key.
const ASSET_V = '?v=2'

/** kind → state → asset URL. Missing entries simply fall back to the static webp. */
export const CARD_VIDEO: Partial<Record<string, Partial<Record<CardArtState, string>>>> =
  Object.fromEntries(
    CLIP_KINDS.map((kind) => {
      const url = `/cards/video/${kind}.mp4${ASSET_V}`
      return [kind, { idle: url, hover: url }]
    }),
  )

const CLIP_KIND_SET = new Set(CLIP_KINDS)

// Kinds that ship a higher-res, full-screen "hero" clip for the takeover moment.
// The standard <kind>.mp4 is 720×1280 and softens when upscaled to fill a big
// screen; drop a crisper `/cards/video/<kind>.hero.mp4` in and add the kind here
// to opt it in. (new-thruster has no hero clip yet → falls back to standard.)
const HERO_KINDS = new Set<string>([
  // hazards
  'asteroid-strike', 'empty-tank', 'busted-thruster', 'tractor-beam', 'black-hole',
  // remedies
  'repair-drone', 'fuel-cell', 'new-thruster', 'beam-cutter', 'ignition',
  // safeties
  'ace-pilot', 'antimatter-fuel-cell', 'diamond-thruster', 'rescue-shuttle',
  // distance
  'warp-200',
])

/** A dedicated full-screen hero clip for a kind, if it has one (else undefined →
 *  the takeover falls back to the standard cardVideo clip). */
export function cardHeroVideo(kind: string | undefined): string | undefined {
  if (!kind || !HERO_KINDS.has(kind)) return undefined
  return `/cards/video/${kind}.hero.mp4${ASSET_V}`
}

// Safety kinds that ship a dedicated ~8s SLINGSHOT cinematic — the full-screen
// "you dodged it" hero clip played (in place of the hazard-hit takeover) the
// instant that safety pulls off a Slingshot. Add a kind here once its
// `<kind>.slingshot.mp4` (+ `.slingshot.hero.mp4`) clips exist; kinds not listed
// fall back to the built-in DOM Slingshot overlay.
const SLINGSHOT_CLIP_KINDS = new Set<string>(['ace-pilot', 'antimatter-fuel-cell', 'diamond-thruster'])

// A safety that dodges MORE than one hazard (Rescue Shuttle → Tractor Beam +
// Black Hole) can ship a HAZARD-SPECIFIC clip that's preferred over the generic
// one when that exact hazard was dodged. Key `${safety}:${hazard}`; the asset is
// `<safety>.vs-<hazard>.slingshot.mp4` (+ `.slingshot.hero.mp4`). Falls back to
// the generic `<safety>.slingshot.*` (SLINGSHOT_CLIP_KINDS) when absent.
const SLINGSHOT_HAZARD_CLIPS = new Set<string>([
  'rescue-shuttle:black-hole',
  'rescue-shuttle:tractor-beam',
])

/** Resolve the asset basename for a Slingshot clip: prefer a hazard-specific
 *  `<safety>.vs-<hazard>.slingshot`, else the generic `<safety>.slingshot`, else
 *  undefined (→ caller falls back to the DOM overlay). */
function slingshotBase(safety: string | undefined, hazard?: string): string | undefined {
  if (safety && hazard && SLINGSHOT_HAZARD_CLIPS.has(`${safety}:${hazard}`))
    return `${safety}.vs-${hazard}.slingshot`
  if (safety && SLINGSHOT_CLIP_KINDS.has(safety)) return `${safety}.slingshot`
  return undefined
}

/** The standard-res (720×1280, mobile) Slingshot cinematic for a safety dodging
 *  `hazard`, if one ships — else undefined (→ caller falls back to the overlay). */
export function cardSlingshotVideo(safety: string | undefined, hazard?: string): string | undefined {
  const base = slingshotBase(safety, hazard)
  return base ? `/cards/video/${base}.mp4${ASSET_V}` : undefined
}

/** The crisp hero-res (1080×1920, wide) Slingshot cinematic for the pairing. */
export function cardSlingshotHeroVideo(safety: string | undefined, hazard?: string): string | undefined {
  const base = slingshotBase(safety, hazard)
  return base ? `/cards/video/${base}.hero.mp4${ASSET_V}` : undefined
}

/**
 * The clip's first frame, exported as a still. Using frame-0 as BOTH the static
 * <img> and the <video> poster means the still and the motion share identical
 * 9:16 framing/crop at every resolution — so the hover swap has no zoom/jump.
 * Returns undefined for kinds without a clip (→ keep the regular 3:4 webp).
 */
export function cardPoster(kind: string | undefined): string | undefined {
  if (!kind || !CLIP_KIND_SET.has(kind)) return undefined
  return `/cards/video/${kind}.poster.webp${ASSET_V}`
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
