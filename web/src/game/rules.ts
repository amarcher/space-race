// Gameplay-mode rules — the serializable, deterministic switchboard for the
// game's selectable variants.
//
// Each rule flag toggles one self-contained rule delta in the engine (a clean
// seam, never scattered). The resolved rules are BAKED INTO GameState at
// createGame, so the same state object stays deterministic and serializable
// (it crosses the WebSocket boundary by design) and the sim harness can run any
// mode by passing `rules`. There is NO mutable module-level config — read the
// rules off `state.rules`, never a global.
//
// To add the NEXT mode: add one flag here (+ DEFAULT_RULES entry), branch on
// `state.rules.<flag>` at ONE engine seam, and add one settings toggle row.

export interface GameRules {
  /**
   * SCRY draw: a deck draw reveals the top 3 cards and the player PICKS one; the
   * two unpicked cards go to the BOTTOM of the deck. Pure agency lever — it
   * changes only how easily you reach cards, not deck composition. Deck ≤ 1
   * falls back to a blind draw.
   */
  scry: boolean
  /**
   * MOMENTUM meter: each clean distance play BANKS +1 charge (per player, capped
   * at MOMENTUM_CAP). When the meter is full and you hold a playable distance
   * card, a `burst` move unlocks a BREAKAWAY — one bonus distance play this turn
   * (a free double-jump) — then the meter resets to 0. Manufactures the swing the
   * base game lacks and rewards pressing a lead. Pure additive lever: it changes
   * only how OFTEN a roller gets to move, never deck composition.
   */
  momentum: boolean
}

/** Classic Mille Bornes — every mode flag off. The regression-critical baseline. */
export const DEFAULT_RULES: GameRules = {
  scry: false,
  momentum: false,
}

/** How many top-of-deck cards a scry draw reveals. */
export const SCRY_REVEAL = 3

/** Charges the momentum meter banks before a BREAKAWAY burst unlocks. */
export const MOMENTUM_CAP = 3

/** Resolve a partial rules override against the classic defaults. */
export function resolveRules(partial?: Partial<GameRules>): GameRules {
  return { ...DEFAULT_RULES, ...partial }
}
