// Keep the game in progress across a page reload IN THIS TAB ONLY.
//
// Phones discard backgrounded tabs and reload them on return, which used to
// deal a fresh game. sessionStorage is scoped to the tab (and survives its
// reloads) but is never shared with other tabs, so two tabs can each hold
// their own game. A finished round isn't restored: the next load deals fresh.
import type { GameState } from '../game'

const KEY = 'spacerace:game'
const VERSION = 1

export function loadTabGame(): GameState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as { v: number; state: GameState }
    if (saved.v !== VERSION || !saved.state?.players || saved.state.phase === 'roundOver') return null
    return saved.state
  } catch {
    return null
  }
}

export function saveTabGame(state: GameState): void {
  try {
    if (state.phase === 'roundOver') sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify({ v: VERSION, state }))
  } catch {
    // private mode / storage full: the game just won't survive a reload
  }
}
