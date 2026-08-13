import type { VercelRequest, VercelResponse } from '@vercel/node'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
import {
  ALLOWED_SHIP_COUNTRIES,
  CURRENCY,
  EARLY_BATCH_SELLABLE,
  MAX_QTY_PER_ORDER,
  PRODUCT_NAME,
  SELLABLE_INVENTORY,
  UNIT_PRICE_CENTS,
} from '../src/shop/constants.js'

// Creates a Stripe Embedded Checkout session. Price and inventory are decided
// server-side only — never trust a client-supplied amount.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const quantity = Math.trunc(Number(req.body?.quantity))
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ORDER) {
    res.status(400).json({ error: `Quantity must be between 1 and ${MAX_QTY_PER_ORDER}` })
    return
  }

  const [{ sold, earlySold }] = await sql`
    select
      coalesce(sum(quantity), 0)::int as sold,
      coalesce(sum(quantity) filter (where ship_window = 'early'), 0)::int as "earlySold"
    from orders
    where status != 'cancelled'
  `
  if (sold + quantity > SELLABLE_INVENTORY) {
    res.status(409).json({ error: "Sorry — we don't have enough copies left in this pre-order pool." })
    return
  }

  // Whole order ships in the same window — never split a single order across
  // the September and January batches. See docs/store-wayfinder.md.
  const shipWindow = earlySold + quantity <= EARLY_BATCH_SELLABLE ? 'early' : 'january'

  const origin = (req.headers.origin as string | undefined) ?? `https://${req.headers.host}`

  // shipping_options here is a required $0 placeholder — /api/shipping-rates
  // replaces it server-side once the customer enters a real address (see
  // permissions.update_shipping_details below and docs/store-wayfinder.md).
  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded_page',
    mode: 'payment',
    metadata: { ship_window: shipWindow },
    permissions: { update_shipping_details: 'server_only' },
    shipping_address_collection: { allowed_countries: ALLOWED_SHIP_COUNTRIES },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: 'Calculating shipping…',
          fixed_amount: { amount: 0, currency: CURRENCY },
        },
      },
    ],
    line_items: [
      {
        quantity,
        price_data: {
          currency: CURRENCY,
          unit_amount: UNIT_PRICE_CENTS,
          product_data: { name: PRODUCT_NAME },
        },
      },
    ],
    return_url: `${origin}/shop.html?session_id={CHECKOUT_SESSION_ID}`,
  })

  res.status(200).json({ clientSecret: session.client_secret })
}
