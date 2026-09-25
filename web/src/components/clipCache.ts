// Full-screen takeover clips, held WHOLE in memory before they're needed.
//
// A warm HTTP cache isn't enough on a slow phone connection: the <video> still
// negotiates byte ranges when the takeover mounts, and the screen sits blank.
// Clips the game decides are relevant (see clipWarm.ts) are fetched whole into
// Blobs, and the takeover plays from the object URL: no network at the moment
// it matters. Needed-now clips jump the queue; memory is capped, dropping the
// least recently wanted clips first.

const wide = () => typeof window !== 'undefined' && window.innerWidth >= 761
const CAP_BYTES = () => (wide() ? 160 : 48) * 1024 * 1024
const CONCURRENCY = 2

interface Entry {
  url: string
  obj?: string
  bytes: number
  lastWanted: number
}

const entries = new Map<string, Entry>()
const queue: { url: string; urgent: boolean }[] = []
let inflight = 0

function pump() {
  while (inflight < CONCURRENCY && queue.length) {
    const i = queue.findIndex((q) => q.urgent)
    const { url } = queue.splice(i >= 0 ? i : 0, 1)[0]
    const e = entries.get(url)
    if (!e || e.obj) continue
    inflight++
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        const cur = entries.get(url)
        if (!cur) return
        cur.obj = URL.createObjectURL(b)
        cur.bytes = b.size
        evict()
      })
      .catch(() => entries.delete(url)) // a later pass retries
      .finally(() => {
        inflight--
        pump()
      })
  }
}

function evict() {
  let total = [...entries.values()].reduce((a, e) => a + e.bytes, 0)
  const oldest = [...entries.values()].filter((e) => e.obj).sort((a, b) => a.lastWanted - b.lastWanted)
  for (const e of oldest) {
    if (total <= CAP_BYTES()) break
    URL.revokeObjectURL(e.obj!)
    entries.delete(e.url)
    total -= e.bytes
  }
}

/** Want these clips in memory. `urgent` ones (playable this turn) go first. */
export function warmClips(urls: ReadonlyArray<string | undefined>, urgent = false): void {
  if (typeof window === 'undefined') return
  const now = performance.now()
  for (const url of urls) {
    if (!url) continue
    const e = entries.get(url)
    if (e) {
      e.lastWanted = now
      const q = queue.find((x) => x.url === url)
      if (q && urgent) q.urgent = true
      continue
    }
    entries.set(url, { url, bytes: 0, lastWanted: now })
    queue.push({ url, urgent })
  }
  pump()
}

/** Posters are tiny: just let the image cache hold them. */
const posters = new Set<string>()
export function warmPosters(urls: ReadonlyArray<string | undefined>): void {
  for (const url of urls) {
    if (!url || posters.has(url)) continue
    posters.add(url)
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}

/** The src to play: the in-memory copy when it's ready, else the network URL. */
export const clipSrc = (url: string): string => entries.get(url)?.obj ?? url
