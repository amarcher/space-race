import type { VercelRequest, VercelResponse } from '@vercel/node'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
import { metaMetadata } from './_lib/metaConversions.js'
import {
  ALLOWED_SHIP_COUNTRIES,
  CURRENCY,
  MAX_QTY_PER_ORDER,
  PRODUCT_NAME,
  MAIN_SHIP_DATE_LABEL,
  shipWindowForOrder,
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
    const shipWindow = shipWindowForOrder(quantity, sold, inStockSold)
    if (shipWindow === null) {
      res.status(409).json({ error: "Sorry — we don't have enough copies left." })
      return
    }
    // A preorder is only ever started by a buyer who was shown the January
    // date. A page that still believes copies are on hand (an older tab, or
    // the last one selling a moment ago) sends no acknowledgement and is told
    // to look again instead of being charged for something that ships later.
    if (shipWindow === 'january' && req.body?.preorder !== true) {
      res.status(409).json({
        error: `The copies on hand just sold out. You can still preorder: it ships in ${MAIN_SHIP_DATE_LABEL}. Try again to continue as a preorder.`,
        preorderOnly: true,
      })
      return
    }

    const origin = (req.headers.origin as string | undefined) ?? `https://${req.headers.host}`

    // No shipping_options at creation. It is optional alongside
    // shipping_address_collection, and updating it later is supported (Stripe
    // changelog, Basil 2025-03-31), which is what /api/shipping-rates does once
    // the customer enters an address. Seeding a $0 placeholder instead rendered
    // a preselected, focus-grabbing "Shipping method" row offering nothing —
    // leaving it out keeps the section collapsed until real rates exist.
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'form',
      mode: 'payment',
      // The Meta identifiers ride along so the webhook can report the purchase
      // against the ad that led to it.
      metadata: { ship_window: shipWindow, ...metaMetadata(req.body, req.headers['user-agent']) },
      // Zero tax anywhere without an active Stripe Tax registration — safe to
      // leave on ahead of actually registering. See docs/store-wayfinder.md
      // "Sales tax" for the MA-registration follow-up this depends on.
      automatic_tax: { enabled: true },
      shipping_address_collection: { allowed_countries: ALLOWED_SHIP_COUNTRIES },
      line_items: [
        {
          quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: UNIT_PRICE_CENTS,
            // General tangible goods — the card game itself is ordinary taxable
            // merchandise in every US state, no special-case tax code needed.
            product_data: {
              name: PRODUCT_NAME,
              tax_code: 'txcd_99999999',
              // Shown on the Stripe form and receipt, so the date is in front
              // of the buyer at the moment they pay.
              ...(shipWindow === 'january'
                ? { description: `Preorder. Ships in ${MAIN_SHIP_DATE_LABEL}.` }
                : {}),
            },
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
