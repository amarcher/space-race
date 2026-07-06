// Card definitions for Space Race.
// A Mille Bornes-style deck: Distances, Hazards, Remedies, Safeties.
// Mirrors manifest.csv at the repo root.

export type CardType = 'distance' | 'hazard' | 'remedy' | 'safety'
export type Lane = 'collision' | 'fuel' | 'engine' | 'restraint' | 'stop'

/** The five threat lanes, in tableau display order. */
export const LANES: Lane[] = ['collision', 'fuel', 'engine', 'restraint', 'stop']

/** Distance values present in the deck, ascending (for grouping piles). */
export const DISTANCE_VALUES = [25, 50, 75, 100, 200] as const

export interface CardDef {
  kind: string // stable identity, e.g. 'warp-100', 'black-hole'
  type: CardType
  title: string
  subtitle: string
  art: string // resolves to /cards/<art>.webp
  value?: number // light-years, for distance cards
  lane?: Lane
  /** hazard -> the remedy kind that clears it */
  fixedBy?: string
  /** remedy -> the hazard kind it clears */
  fixes?: string
  /** safety -> hazard kinds it makes you permanently immune to */
  immuneTo?: string[]
  /** hazard -> safety kinds that block it (and enable a Counter-Thrust) */
  protectedBy?: string[]
  /** ignition is both the "go" card to start moving and the Black Hole remedy */
  isGo?: boolean
}

export const CARD_DEFS: Record<string, CardDef> = {
  // ---- Distances ----
  'warp-25': { kind: 'warp-25', type: 'distance', title: '25 Light-Years', subtitle: 'warm-up jump', art: 'warp-25', value: 25 },
  'warp-50': { kind: 'warp-50', type: 'distance', title: '50 Light-Years', subtitle: 'light jump', art: 'warp-50', value: 50 },
  'warp-75': { kind: 'warp-75', type: 'distance', title: '75 Light-Years', subtitle: 'half warp', art: 'warp-75', value: 75 },
  'warp-100': { kind: 'warp-100', type: 'distance', title: '100 Light-Years', subtitle: 'full warp', art: 'warp-100', value: 100 },
  'warp-200': { kind: 'warp-200', type: 'distance', title: '200 Light-Years', subtitle: 'hyperwarp', art: 'warp-200', value: 200 },

  // ---- Hazards ----
  'asteroid-strike': { kind: 'asteroid-strike', type: 'hazard', title: 'Asteroid Strike', subtitle: 'fixed by Repair Drone', art: 'asteroid-strike', lane: 'collision', fixedBy: 'repair-drone', protectedBy: ['ace-pilot'] },
  'empty-tank': { kind: 'empty-tank', type: 'hazard', title: 'Empty Tank', subtitle: 'fixed by Fuel Cell', art: 'empty-tank', lane: 'fuel', fixedBy: 'fuel-cell', protectedBy: ['antimatter-fuel-cell'] },
  'busted-thruster': { kind: 'busted-thruster', type: 'hazard', title: 'Busted Thruster', subtitle: 'fixed by New Thruster', art: 'busted-thruster', lane: 'engine', fixedBy: 'new-thruster', protectedBy: ['diamond-thruster'] },
  'tractor-beam': { kind: 'tractor-beam', type: 'hazard', title: 'Tractor Beam', subtitle: 'fixed by Beam Cutter', art: 'tractor-beam', lane: 'restraint', fixedBy: 'beam-cutter', protectedBy: ['rescue-shuttle'] },
  'black-hole': { kind: 'black-hole', type: 'hazard', title: 'Black Hole', subtitle: 'fixed by Ignition', art: 'black-hole', lane: 'stop', fixedBy: 'ignition', protectedBy: ['rescue-shuttle'] },

  // ---- Remedies ----
  'repair-drone': { kind: 'repair-drone', type: 'remedy', title: 'Repair Drone', subtitle: 'fixes Asteroid Strike', art: 'repair-drone', lane: 'collision', fixes: 'asteroid-strike' },
  'fuel-cell': { kind: 'fuel-cell', type: 'remedy', title: 'Fuel Cell', subtitle: 'fixes Empty Tank', art: 'fuel-cell', lane: 'fuel', fixes: 'empty-tank' },
  'new-thruster': { kind: 'new-thruster', type: 'remedy', title: 'New Thruster', subtitle: 'fixes Busted Thruster', art: 'new-thruster', lane: 'engine', fixes: 'busted-thruster' },
  'beam-cutter': { kind: 'beam-cutter', type: 'remedy', title: 'Beam Cutter', subtitle: 'fixes Tractor Beam', art: 'beam-cutter', lane: 'restraint', fixes: 'tractor-beam' },
  'ignition': { kind: 'ignition', type: 'remedy', title: 'Ignition', subtitle: 'required to start · fixes Black Hole', art: 'ignition', lane: 'stop', fixes: 'black-hole', isGo: true },

  // ---- Safeties ----
  'ace-pilot': { kind: 'ace-pilot', type: 'safety', title: 'Ace Pilot', subtitle: 'immune to Asteroid Strike', art: 'ace-pilot', lane: 'collision', immuneTo: ['asteroid-strike'] },
  'antimatter-fuel-cell': { kind: 'antimatter-fuel-cell', type: 'safety', title: 'Antimatter Fuel Cell', subtitle: 'immune to Empty Tank', art: 'antimatter-fuel-cell', lane: 'fuel', immuneTo: ['empty-tank'] },
  'diamond-thruster': { kind: 'diamond-thruster', type: 'safety', title: 'Diamond Thruster', subtitle: 'immune to Busted Thruster', art: 'diamond-thruster', lane: 'engine', immuneTo: ['busted-thruster'] },
  'rescue-shuttle': { kind: 'rescue-shuttle', type: 'safety', title: 'Rescue Shuttle', subtitle: 'immune to Tractor Beam + Black Hole', art: 'rescue-shuttle', lane: 'stop', immuneTo: ['tractor-beam', 'black-hole'] },
}

/** How many of each card are in the physical deck (106 total). */
export const DECK_COUNTS: Record<string, number> = {
  'warp-25': 10,
  'warp-50': 10,
  'warp-75': 10,
  'warp-100': 12,
  'warp-200': 4,
  'asteroid-strike': 3,
  'empty-tank': 3,
  'busted-thruster': 3,
  'tractor-beam': 4,
  'black-hole': 5,
  'repair-drone': 6,
  'fuel-cell': 6,
  'new-thruster': 6,
  'beam-cutter': 6,
  'ignition': 14,
  'ace-pilot': 1,
  'antimatter-fuel-cell': 1,
  'diamond-thruster': 1,
  'rescue-shuttle': 1,
}

/** Display order for the gallery: distances, then each lane hazard/remedy/safety. */
export const GALLERY_ORDER: string[] = [
  'warp-25', 'warp-50', 'warp-75', 'warp-100', 'warp-200',
  'asteroid-strike', 'repair-drone', 'ace-pilot',
  'empty-tank', 'fuel-cell', 'antimatter-fuel-cell',
  'busted-thruster', 'new-thruster', 'diamond-thruster',
  'tractor-beam', 'beam-cutter',
  'black-hole', 'ignition', 'rescue-shuttle',
]

export const WIN_DISTANCE = 1000
export const HAND_SIZE = 6
export const MAX_200_PER_PLAYER = 2
/** Revealing a safety also moves you forward this many light-years. */
export const SAFETY_MILEAGE = 100
/** A Slingshot (instant safety vs the matching hazard) is worth double. */
export const SLINGSHOT_MILEAGE = 200

export const artUrl = (def: CardDef): string => `/cards/${def.art}.webp`
export const CARD_BACK_URL = '/cards/card-back.webp'

/** A dealt physical card: a definition plus a unique instance id. */
export interface CardInstance {
  uid: string
  kind: string
  /** SELF-HEALING HAZARDS mode: how many of the victim's own turns this hazard has
   * sat on a blocking lane. Ticks at each victim turn-start; at SELF_HEAL_N the
   * block recovers itself and the card is swept to discard. Only ever set on the
   * active blocking hazard of a lane (and only when the mode is on). Serializable. */
  hazardAge?: number
}

export const defOf = (card: CardInstance): CardDef => CARD_DEFS[card.kind]

/** Build the full 106-card deck as instances (unshuffled). */
export function buildDeck(): CardInstance[] {
  const deck: CardInstance[] = []
  let n = 0
  for (const [kind, count] of Object.entries(DECK_COUNTS)) {
    for (let i = 0; i < count; i++) {
      deck.push({ uid: `${kind}#${i}-${n++}`, kind })
    }
  }
  return deck
}

/** Total card count sanity check helper. */
export const DECK_TOTAL = Object.values(DECK_COUNTS).reduce((a, b) => a + b, 0)
