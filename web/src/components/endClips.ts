// The win / loss hero clips, preloaded in FULL before the race ends.
//
// A warm HTTP cache isn't enough: on a slow connection the <video> still
// negotiates byte ranges when the takeover mounts, so the celebration stalls
// (seen on a phone at 5G-but-weak signal). Instead both clips for this viewport
// are fetched whole into Blobs once the race is far enough along to end soon,
// and the takeover plays from the in-memory object URL: zero network at the
// moment it matters. ~1MB each on phones, ~3-6MB on wide screens.

// BUMP whenever a clip/poster is re-exported (stale byte ranges otherwise).
const ASSET_V = '?v=5'
const WIDE_MIN_PX = 768

export const END_POSTER = {
  win: `/win/win-poster.jpg${ASSET_V}`,
  lose: `/win/lose-poster.jpg${ASSET_V}`,
}

const clipUrl = (outcome: 'win' | 'lose'): string => {
  const wide = typeof window !== 'undefined' && window.innerWidth >= WIDE_MIN_PX
  return `/win/${outcome}-hero${wide ? '.hero' : ''}.mp4${ASSET_V}`
}

const blobs = new Map<string, string>()
const pending = new Set<string>()

/** Fetch both outcome clips for this viewport into memory, once each. */
export function warmEndClips(): void {
  if (typeof window === 'undefined') return
  for (const outcome of ['win', 'lose'] as const) {
    const url = clipUrl(outcome)
    if (blobs.has(url) || pending.has(url)) continue
    pending.add(url)
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => blobs.set(url, URL.createObjectURL(b)))
      .catch(() => {})
      .finally(() => pending.delete(url))
  }
}

/** The src to play: the in-memory copy when it's ready, else the network URL. */
export const endClipSrc = (outcome: 'win' | 'lose'): string => {
  const url = clipUrl(outcome)
  return blobs.get(url) ?? url
}
