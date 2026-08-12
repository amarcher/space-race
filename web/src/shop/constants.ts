export const PRODUCT_NAME = 'Space Race: 1000 Light-Years — First Edition'
export const UNIT_PRICE_CENTS = 3499
export const CURRENCY = 'usd'
export const MAX_QTY_PER_ORDER = 3

export const TOTAL_INVENTORY = 118
// Held back for misprints/damage/gifts — see docs/store-wayfinder.md "Open decisions".
export const INVENTORY_RESERVE = 5
export const SELLABLE_INVENTORY = TOTAL_INVENTORY - INVENTORY_RESERVE

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
