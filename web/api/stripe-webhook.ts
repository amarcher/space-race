import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
import {
  EARLY_SHIP_DATE_LABEL,
  MAIN_SHIP_DATE_LABEL,
  UNIT_PRICE_CENTS,
  type ShipWindow,
} from '../src/shop/constants.js'

// Vercel parses the body as JSON by default, which breaks Stripe's signature
// check — it needs the exact raw bytes. Turn that off and buffer manually below.
export const config = {
  api: { bodyParser: false },
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const signature = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || typeof signature !== 'string' || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret' })
    return
  }

  const rawBody = await readRawBody(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err)
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  if (event.type === 'checkout.session.completed') {
    await recordOrder(event.data.object as Stripe.Checkout.Session)
  }

  res.status(200).json({ received: true })
}

async function recordOrder(session: Stripe.Checkout.Session) {
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items', 'shipping_cost.shipping_rate'],
  })

  const quantity = fullSession.line_items?.data.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 1
  const shippingCents = fullSession.shipping_cost?.amount_total ?? 0
  const shippingRate = fullSession.shipping_cost?.shipping_rate
  const shippingService = typeof shippingRate === 'object' && shippingRate !== null ? shippingRate.display_name : null

  const customerEmail = fullSession.customer_details?.email ?? ''
  const customerName = fullSession.customer_details?.name ?? null
  const shippingAddress = fullSession.collected_information?.shipping_details?.address ?? {}
  const amountTotal = fullSession.amount_total ?? 0
  // Decided at checkout-session creation (see create-checkout-session.ts) so the
  // window can't drift between then and now as other orders come in — 'january'
  // is the safe fallback for a session created before this metadata existed.
  const shipWindow: ShipWindow = fullSession.metadata?.ship_window === 'early' ? 'early' : 'january'

  const inserted = await sql`
    insert into orders (
      stripe_checkout_session_id, stripe_payment_intent_id, customer_email, customer_name,
      shipping_address, quantity, unit_price_cents, shipping_cents, shipping_service,
      amount_total_cents, currency, ship_window
    ) values (
      ${fullSession.id}, ${String(fullSession.payment_intent ?? '')}, ${customerEmail}, ${customerName},
      ${JSON.stringify(shippingAddress)}, ${quantity}, ${UNIT_PRICE_CENTS}, ${shippingCents}, ${shippingService},
      ${amountTotal}, ${fullSession.currency ?? 'usd'}, ${shipWindow}
    )
    on conflict (stripe_checkout_session_id) do nothing
    returning id
  `

  // Webhooks can retry/redeliver — only email on the first successful insert.
  if (inserted.length > 0 && resend && customerEmail) {
    const shipDateLine =
      shipWindow === 'early'
        ? `We'll email tracking info once your copy ships — expected around ${EARLY_SHIP_DATE_LABEL}.`
        : `We'll email tracking info once your copy ships — expected ${MAIN_SHIP_DATE_LABEL}.`
    await resend.emails.send({
      // TODO: verify a spaceexplorer.tech sending domain in Resend before launch —
      // see docs/store-wayfinder.md Phase 1.
      from: 'Space Race <orders@spaceexplorer.tech>',
      to: customerEmail,
      subject: 'Your Space Race pre-order is confirmed',
      text: [
        'Thanks for pre-ordering Space Race: 1000 Light-Years!',
        '',
        `Quantity: ${quantity}`,
        `Total: $${(amountTotal / 100).toFixed(2)}`,
        '',
        shipDateLine,
      ].join('\n'),
    })
  }
}
