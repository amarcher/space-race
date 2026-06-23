// Idle-warm the full-screen "hero" takeover clips into the browser/SW cache
// BEFORE a takeover needs them, so the clip plays instantly instead of stalling
// on a play-time fetch. The PWA service worker already runtime-caches
// /cards/video/*.mp4 (CacheFirst), so a plain fetch() persists each clip.
//
// Pure presentation/perf: no game state, no engine coupling.

// every hero URL we've already kicked off this session — dedupe so a clip is
// fetched at most once (the module lives for the page's lifetime)
const requested = new Set<string>()

/** Run on idle so warming never competes with rendering/interaction. */
function onIdle(fn: () => void): void {
  const w = window as unknown as {
    scheduler?: { postTask?: (cb: () => void, opts?: { priority?: string }) => unknown }
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  }
  if (typeof w.scheduler?.postTask === 'function') {
    w.scheduler.postTask(fn, { priority: 'background' })
  } else if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(fn, { timeout: 2000 })
  } else {
    window.setTimeout(fn, 200)
  }
}

/**
 * Warm the given hero-clip URLs into cache, once each, on idle. Falsy/duplicate
 * URLs are skipped. A failed fetch is un-marked so a later pass can retry.
 */
export function preloadHeroClips(urls: ReadonlyArray<string | undefined>): void {
  if (typeof window === 'undefined') return
  const fresh = Array.from(new Set(urls.filter((u): u is string => !!u && !requested.has(u))))
  if (fresh.length === 0) return
  fresh.forEach((u) => requested.add(u)) // mark up-front so concurrent passes don't double-fetch
  onIdle(() => {
    for (const url of fresh) {
      // a GET lands it in the SW CacheFirst (/cards/video) + the HTTP cache
      fetch(url).catch(() => {
        requested.delete(url) // allow a retry on a later hand change
      })
    }
  })
}
