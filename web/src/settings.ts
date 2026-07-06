// Persisted gameplay-mode preferences. The user-facing toggles live here; the
// chosen rules are read at NEW-game time and passed to createGame (which bakes
// them into the deterministic GameState).
//
// FACTORY default (fresh players, nothing persisted) = two-up scry: playtesting
// found it the strongest mode, so it's what new players get. DEFAULT_RULES in
// game/rules.ts stays all-off — it is the classic *baseline* the engine and sim
// harness regress against, not the shipped experience.
//
// We persist a Partial<GameRules> and resolve it against DEFAULT_RULES at read
// time, so anyone who has saved settings keeps exactly what they chose (and new
// flags added later default safely to off for existing users).

import { resolveRules, type GameRules } from './game/rules'

const STORAGE_KEY = 'spacerace:rules'

/** The out-of-the-box mode for players with no saved settings: scry on, at the
 * two-card reveal (scryReveal omitted → SCRY_REVEAL = 2). */
const FACTORY_RULES: Partial<GameRules> = { scry: true }

/** Read the persisted gameplay-mode preference, resolved to a full GameRules. */
export function loadRules(): GameRules {
  if (typeof localStorage === 'undefined') return resolveRules(FACTORY_RULES)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return resolveRules(FACTORY_RULES)
    const parsed = JSON.parse(raw) as Partial<GameRules>
    return resolveRules(parsed)
  } catch {
    return resolveRules(FACTORY_RULES)
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
