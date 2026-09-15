export const PRODUCT_NAME = 'Space Race: 1000 Light-Years — First Edition'
// Priced at parity with ordering a single copy from The Game Crafter directly
// (their manufacturing/handling cost, tax excluded — see docs/store-wayfinder.md
// "Pricing" for the derivation) rather than for margin. Sells at a loss on the
// September batch specifically; see the same doc section.
export const UNIT_PRICE_CENTS = 2879
export const CURRENCY = 'usd'
export const MAX_QTY_PER_ORDER = 3

// Content ID of the First Edition in the Meta Commerce catalog "Space Race Store".
export const META_CATALOG_CONTENT_ID = 'space-race-first-edition'

// Meta Shops send buyers to /shop?products=<content id>:<qty>,... (plus a coupon
// and utm_*/cart_origin/fbclid params we ignore). Returns the requested quantity
// of our product clamped to 1..MAX_QTY_PER_ORDER, or null when the URL carries no
// usable Meta cart. Inventory clamping still happens on the page and server.
export function quantityFromMetaCart(search: string): number | null {
  const products = new URLSearchParams(search).get('products')
  if (!products) return null
  for (const entry of products.split(',')) {
    const [id, qty] = entry.split(':')
    if (id?.trim() !== META_CATALOG_CONTENT_ID) continue
    const quantity = Math.trunc(Number(qty))
    if (!Number.isFinite(quantity) || quantity < 1) return null
    return Math.min(quantity, MAX_QTY_PER_ORDER)
  }
  return null
}

export const TOTAL_INVENTORY = 118
// Held back for misprints/damage — see docs/store-wayfinder.md "Decisions locked".
export const INVENTORY_RESERVE = 5

// September batch: 18 units, 8 reserved as personal Christmas gifts (pulled on
// arrival, never in the sellable pool) — 10 sellable. Later stock is held out
// until its arrival is confirmed. See docs/store-wayfinder.md.
export const EARLY_BATCH_TOTAL = 18
export const EARLY_BATCH_GIFT_RESERVE = 8
export const EARLY_BATCH_SELLABLE = EARLY_BATCH_TOTAL - EARLY_BATCH_GIFT_RESERVE

export const SELLABLE_INVENTORY = TOTAL_INVENTORY - INVENTORY_RESERVE - EARLY_BATCH_GIFT_RESERVE

export const IN_STOCK_INVENTORY = EARLY_BATCH_SELLABLE

export function availableInventory(sold: number, inStockSold: number): number {
  return Math.max(0, Math.min(SELLABLE_INVENTORY - sold, IN_STOCK_INVENTORY - inStockSold))
}

export const EARLY_SHIP_DATE_LABEL = 'September 10th'
export const MAIN_SHIP_DATE_LABEL = 'mid-January 2027'

// New orders are available now. Keep the historical windows for existing
// Stripe sessions and order records; their original promises must not change.
export type ShipWindow = 'in_stock' | 'early' | 'january'
export const CURRENT_SHIP_WINDOW: ShipWindow = 'in_stock'

export function resolveShipWindow(value: string | undefined): ShipWindow {
  return value === 'in_stock' || value === 'early' ? value : 'january'
}

export function shippingConfirmationLine(window: ShipWindow): string {
  if (window === 'in_stock') return "We'll email tracking info when your order ships."
  return window === 'early'
    ? `We'll email tracking info once your copy ships — expected around ${EARLY_SHIP_DATE_LABEL}.`
    : `We'll email tracking info once your copy ships — expected ${MAIN_SHIP_DATE_LABEL}.`
}

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
