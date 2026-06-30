// TV second-screen mode detection + arcade-daemon origin config.
//
// The whole feature is GATED behind the `?mode=` URL flag: with NO flag the app
// renders EXACTLY as today (App.tsx returns the normal game untouched). Only
// `?mode=tv-stage` (the TV) and `?mode=tv-controller` (a phone) opt into the
// second-screen build.

export type TvMode = 'tv-stage' | 'tv-controller' | null

function param(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

/** The active TV mode, or null for the normal single-screen game. */
export function tvMode(): TvMode {
  const m = param('mode')
  return m === 'tv-stage' || m === 'tv-controller' ? m : null
}

/**
 * Base WS origin of the arcade daemon, e.g. "ws://192.168.4.38:8771".
 * Resolution order:
 *   1. ?arcade=host[:port]  (explicit override; bare host defaults to :8771)
 *   2. same hostname as the page, port 8771  (Vite dev on the LAN → daemon)
 * The daemon's Origin allow-list passes us by hostname (localhost / LAN IP), so a
 * cross-origin connect from the Vite/Vercel page is accepted.
 */
export function arcadeOrigin(): string {
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  const override = param('arcade')
  if (override) {
    const host = override.includes(':') ? override : `${override}:8771`
    return `${proto}${host}`
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return `${proto}${host}:8771`
}

/** HTTP form of the same origin — used only to print the controller URL hint. */
export function arcadeHttpOrigin(): string {
  return arcadeOrigin().replace(/^ws/, 'http')
}
