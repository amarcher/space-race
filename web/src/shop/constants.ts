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

/** The Uline box each order size ships in — order #57968922, 2026-09-16, 25 each.
 *
 *  Dimensions are the OUTSIDE ones, because that is what a carrier measures,
 *  and because UPS bills the greater of actual weight and dim weight
 *  (L×W×H÷139, rounded up) — so the box's outer size moves the quote on its
 *  own, not just what it weighs.
 *
 *  `weightOz` is the EMPTY box, from Uline's catalog. `packedOz`, where
 *  present, is a scale reading of the finished parcel — game copies, box,
 *  void fill and tape — and supersedes the whole estimate. Sizes without it
 *  have not been packed yet and still quote the estimate; see
 *  PACKING_EXTRAS_OZ below and docs/store-ops.md.
 */
const SHIPPING_BOX_BY_QUANTITY = {
  // Packed and weighed 2026-09-17.
  1: { sku: 'S-16725', lengthIn: 4.375, widthIn: 4.375, heightIn: 3.625, weightOz: 1.6, packedOz: 10.25 },
  // Two 4x4x4 boxes were bought to compare sturdiness: S-4040 (1.76 oz) and
  // S-22101 (1.6 oz, lightweight 32 ECT). Until Andrew picks one after test
  // packing, quote the heavier — understating weight is what costs money.
  // The only size not yet packed, so it alone still quotes the estimate.
  2: { sku: 'S-4040', lengthIn: 4.375, widthIn: 4.375, heightIn: 4.625, weightOz: 1.76 },
  // Copies stand on their long edges side by side: 3 × 1.75" = 5.25" across a
  // 6" inside length. Packed and weighed 2026-09-17, which also proves they fit.
  3: { sku: 'S-4582', lengthIn: 6.375, widthIn: 4.375, heightIn: 3.625, weightOz: 2.08, packedOz: 27.15 },
} as const

/** Tape, label and void fill. Not measured, and deliberately not zero.
 *
 *  The old model allowed 1 oz for a whole bubble mailer, which the corrugated
 *  box alone now exceeds. An understated parcel doesn't fail loudly: the
 *  carrier accepts it, delivers it, and bills the difference back weeks later
 *  as an adjustment, after the customer has paid a quote we can't revise. So
 *  this errs heavy on purpose until a packed box goes on a scale.
 */
const PACKING_EXTRAS_OZ = 1

export function parcelForQuantity(quantity: number) {
  const copies = Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_QTY_PER_ORDER)
  const box = SHIPPING_BOX_BY_QUANTITY[copies as keyof typeof SHIPPING_BOX_BY_QUANTITY]
  // A scale reading of the real packed parcel always wins. Without one, fall
  // back to the estimate — copies + empty box + extras — which errs heavy on
  // purpose, because the failure mode of understating is a carrier adjustment
  // billed back after the customer has already paid.
  const weightOz =
    'packedOz' in box ? box.packedOz : SINGLE_UNIT_WEIGHT_OZ * copies + box.weightOz + PACKING_EXTRAS_OZ
  return {
    // Round here, not just in the caller: 3 × 8.1 + 2.08 + 1 is
    // 27.379999999999995 in float, and Shippo rejects more than four decimal
    // places with a 400 — which is exactly how 3-copy orders broke before
    // (#212). api/shipping-rates.ts still guards too; this stops the ugly
    // number existing at all, including in the webhook's label pre-fill.
    weightOz: Math.round(weightOz * 100) / 100,
    lengthIn: box.lengthIn,
    widthIn: box.widthIn,
    heightIn: box.heightIn,
  }
}
