// Persisted gameplay-mode preferences. The user-facing toggles live here; the
// chosen rules are read at NEW-game time and passed to createGame (which bakes
// them into the deterministic GameState). DEFAULT = classic (every flag off).
//
// We persist a Partial<GameRules> and resolve it against DEFAULT_RULES at read
// time, so new flags added later default safely to off for existing users.

import { resolveRules, type GameRules } from './game/rules'

const STORAGE_KEY = 'spacerace:rules'

/** Read the persisted gameplay-mode preference, resolved to a full GameRules. */
export function loadRules(): GameRules {
  if (typeof localStorage === 'undefined') return resolveRules()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return resolveRules()
    const parsed = JSON.parse(raw) as Partial<GameRules>
    return resolveRules(parsed)
  } catch {
    return resolveRules()
  }
}

/** Persist the gameplay-mode preference. Applied to the NEXT new game/round. */
export function saveRules(rules: GameRules): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // ignore quota / privacy-mode failures — defaults are harmless
  }
}
