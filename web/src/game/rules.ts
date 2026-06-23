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
   * CATCH-UP VALVE (rubber band): the TRAILING player gets a small, legible
   * edge so blowouts stay live and the underdog keeps agency. When a player's
   * distance deficit exceeds CATCHUP_DEFICIT at the start of their deck draw,
   * that single draw becomes a mini-scry — reveal the top CATCHUP_REVEAL cards,
   * PICK one, the rest go to the bottom. It's a BETTER-SELECTION edge (not free
   * cards, not free mileage), so it softens the loss without erasing skill or
   * changing deck composition. Localized at the exact same draw seam as scry.
   *
   * When `scry` is ALSO on the leader already scrys 3 every draw, so the valve
   * instead bumps the trailing player's reveal to CATCHUP_REVEAL_BOOST (a wider
   * peek) — keeping the underdog's edge meaningful even in scry mode.
   */
  catchUp: boolean

  /** Catch-up tuning override (light-years deficit to open the valve). Optional so
   * the metrics harness can SWEEP it; omitted → CATCHUP_DEFICIT default. */
  catchUpDeficit?: number
  /** Catch-up tuning override (trailing-player peek width, classic mode). Optional
   * so the harness can sweep it; omitted → CATCHUP_REVEAL default. */
  catchUpReveal?: number

  /**
   * MOMENTUM meter: each clean distance play BANKS +1 charge (per player, capped
   * at MOMENTUM_CAP). When the meter is full and you hold a playable distance
   * card, a `burst` move unlocks a BREAKAWAY — one bonus distance play this turn
   * (a free double-jump) — then the meter resets to 0. Manufactures the swing the
   * base game lacks and rewards pressing a lead. Pure additive lever: it changes
   * only how OFTEN a roller gets to move, never deck composition.
   */
  momentum: boolean

  /**
   * SELF-HEALING HAZARDS: every BLOCKING hazard (collision/fuel/engine/stop — NOT
   * the Tractor-Beam speed limit) carries a hidden age that ticks at the start of
   * each of the VICTIM's turns. After SELF_HEAL_N of the victim's turns under it
   * the block recovers on its own — the card sweeps to the discard pile and the
   * lane opens — so you are never PERMANENTLY stuck on a lane. The real remedy
   * still clears it INSTANTLY (this turn, vs waiting up to 3 turns), so remedies
   * still matter; coup-fourré / immunity interactions are unchanged. Card
   * conservation is preserved (healed hazards → discard). Fixes the "stuck with
   * no agency" arc problem without changing deck composition.
   */
  selfHeal: boolean
}

/** Classic Mille Bornes — every mode flag off. The regression-critical baseline. */
export const DEFAULT_RULES: GameRules = {
  scry: false,
  catchUp: false,
  momentum: false,
  selfHeal: false,
}

/** How many top-of-deck cards a scry draw reveals. */
export const SCRY_REVEAL = 3

// ---- Catch-up Valve tuning (swept in scripts/sim-metrics.ts --sweep) ----
/** Default distance deficit (light-years) a player must be behind by for the valve
 * to open on their draw. ~one big jump behind. This is the SWEPT knee (see
 * sim-metrics --sweep): at d=200/reveal=2 the mirror comeback rate jumps from
 * 27.8%→41.6% while the strong-vs-weak skill winrate holds at 79.5% (baseline
 * 79.0%) — i.e. it softens blowouts WITHOUT eroding skill. */
export const CATCHUP_DEFICIT = 200
/** Default top-of-deck cards the trailing player reveals (classic mode). */
export const CATCHUP_REVEAL = 2
/** When scry is also on, the trailing player's reveal widens to this. */
export const CATCHUP_REVEAL_BOOST = 4

/** Charges the momentum meter banks before a BREAKAWAY burst unlocks. */
export const MOMENTUM_CAP = 3

/** SELF-HEALING HAZARDS: how many of the victim's own turns a blocking hazard sits
 * before it recovers on its own. N=4 means the block costs you 3 of your turns
 * (countdown 3→2→1) and frees on the 4th turn-start. Tuned in the prototype sweep:
 * lower neuters the hazard, higher barely beats the baseline; N=4 is the knee
 * (~33% fewer dead turns) while a block still has real teeth. */
export const SELF_HEAL_N = 4

/** Resolve a partial rules override against the classic defaults. */
export function resolveRules(partial?: Partial<GameRules>): GameRules {
  return { ...DEFAULT_RULES, ...partial }
}
