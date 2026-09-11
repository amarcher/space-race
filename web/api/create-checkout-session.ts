import type { VercelRequest, VercelResponse } from '@vercel/node'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
import {
  ALLOWED_SHIP_COUNTRIES,
  CURRENCY,
  CURRENT_SHIP_WINDOW,
  MAX_QTY_PER_ORDER,
  PRODUCT_NAME,
  availableInventory,
  UNIT_PRICE_CENTS,
} from '../src/shop/constants.js'

// Creates a Stripe Checkout Form session. Price and inventory are decided
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

  try {
    const [{ sold, inStockSold }] = await sql`
      select
        coalesce(sum(quantity), 0)::int as sold,
        coalesce(sum(quantity) filter (where ship_window in ('early', 'in_stock')), 0)::int as "inStockSold"
      from orders
      where status != 'cancelled'
    `
    if (quantity > availableInventory(sold, inStockSold)) {
      res.status(409).json({ error: "Sorry — we don't have enough copies left in stock." })
      return
    }

    const origin = (req.headers.origin as string | undefined) ?? `https://${req.headers.host}`

    // shipping_options here is a required $0 placeholder — /api/shipping-rates
    // replaces it server-side once the customer enters a real address (see
    // Checkout Form change event and docs/store-wayfinder.md).
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'form',
      mode: 'payment',
      metadata: { ship_window: CURRENT_SHIP_WINDOW },
      // Zero tax anywhere without an active Stripe Tax registration — safe to
      // leave on ahead of actually registering. See docs/store-wayfinder.md
      // "Sales tax" for the MA-registration follow-up this depends on.
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ALLOWED_SHIP_COUNTRIES },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'Calculating shipping…',
            fixed_amount: { amount: 0, currency: CURRENCY },
            tax_code: 'txcd_92010001',
            tax_behavior: 'exclusive',
          },
        },
      ],
      line_items: [
        {
          quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: UNIT_PRICE_CENTS,
            // General tangible goods — the card game itself is ordinary taxable
            // merchandise in every US state, no special-case tax code needed.
            product_data: { name: PRODUCT_NAME, tax_code: 'txcd_99999999' },
            tax_behavior: 'exclusive',
          },
        },
      ],
      return_url: `${origin}/shop.html?session_id={CHECKOUT_SESSION_ID}`,
    })

    res.status(200).json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('Checkout session creation failed', error)
    res.status(503).json({ error: 'Checkout could not start right now. Please try again.' })
  }
}
