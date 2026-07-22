// Persisted INTERFACE preferences — presentation/flow niceties, distinct from
// the gameplay-mode rules in settings.ts. Unlike rules (which bake into a
// GameState at new-game time), prefs apply immediately.
//
// Persisted as a Partial so flags added later default safely for existing users.

const STORAGE_KEY = 'spacerace:prefs'
const GAMES_KEY = 'spacerace:gamesPlayed'

/** Finished rounds after which card-name overlays auto-hide (when enabled). */
export const LABEL_HIDE_GAMES = 10

export interface Prefs {
  /** hide the card-name overlays once LABEL_HIDE_GAMES rounds have been played
   * — by then you know the cards by art. Off = labels always show. */
  autoHideLabels: boolean
  /** start your draw phase automatically (from the deck) when the discard pile
   * is empty — there's no pickup decision to make. Off by default so new
   * players still learn that a turn begins with a draw. */
  autoDraw: boolean
}

export const DEFAULT_PREFS: Prefs = {
  autoHideLabels: true,
  autoDraw: false,
}

export function loadPrefs(): Prefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/** Lifetime finished-round count (drives the label auto-hide). */
export function loadGamesPlayed(): number {
  if (typeof localStorage === 'undefined') return 0
  const n = Number(localStorage.getItem(GAMES_KEY))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Record one finished round; returns the new count. */
export function bumpGamesPlayed(): number {
  const next = loadGamesPlayed() + 1
  try {
    localStorage.setItem(GAMES_KEY, String(next))
  } catch {
    // ignore
  }
  return next
}
