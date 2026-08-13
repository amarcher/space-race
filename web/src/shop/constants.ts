export const PRODUCT_NAME = 'Space Race: 1000 Light-Years — First Edition'
export const UNIT_PRICE_CENTS = 3499
export const CURRENCY = 'usd'
export const MAX_QTY_PER_ORDER = 3

export const TOTAL_INVENTORY = 118
// Held back for misprints/damage — see docs/store-wayfinder.md "Decisions locked".
export const INVENTORY_RESERVE = 5

// September batch: 18 units, 8 reserved as personal Christmas gifts (pulled on
// arrival, never in the sellable pool) — 10 sellable, first-come-first-served,
// before falling back to the January ship window. See docs/store-wayfinder.md.
export const EARLY_BATCH_TOTAL = 18
export const EARLY_BATCH_GIFT_RESERVE = 8
export const EARLY_BATCH_SELLABLE = EARLY_BATCH_TOTAL - EARLY_BATCH_GIFT_RESERVE

export const SELLABLE_INVENTORY = TOTAL_INVENTORY - INVENTORY_RESERVE - EARLY_BATCH_GIFT_RESERVE

export const EARLY_SHIP_DATE_LABEL = 'Sept 10'
export const MAIN_SHIP_DATE_LABEL = 'mid-January 2027'

export type ShipWindow = 'early' | 'january'

export const ALLOWED_SHIP_COUNTRIES = ['US']

// Measured on one of the 4 proof copies, 2026-08-12 — see docs/store-wayfinder.md.
export const SINGLE_UNIT_WEIGHT_OZ = 8.1
export const SINGLE_UNIT_DIMS_IN = { length: 3.55, width: 2.55, height: 1.75 }
// Bubble mailer + label, rough estimate until real packaging is chosen.
const PACKAGING_OVERHEAD_OZ = 1

export function parcelForQuantity(quantity: number) {
  return {
    // copies stack in the same footprint; height scales with quantity
    weightOz: SINGLE_UNIT_WEIGHT_OZ * quantity + PACKAGING_OVERHEAD_OZ,
    lengthIn: SINGLE_UNIT_DIMS_IN.length,
    widthIn: SINGLE_UNIT_DIMS_IN.width,
    heightIn: SINGLE_UNIT_DIMS_IN.height * quantity,
  }
}
