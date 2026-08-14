import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
import { renderOrderConfirmation } from './_lib/orderEmail.js'
import {
  EARLY_SHIP_DATE_LABEL,
  MAIN_SHIP_DATE_LABEL,
  PRODUCT_NAME,
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
    // Itemized, because shipping is a live carrier rate that can rival the item
    // price (a real order came in at $28.79 + $31.59 Express) — a lone "Total"
    // makes that look like an overcharge. Subtotal and tax come from Stripe
    // rather than being recomputed here, so the lines always reconcile to what
    // was actually charged.
    const email = renderOrderConfirmation({
      productName: PRODUCT_NAME,
      quantity,
      unitPriceCents: UNIT_PRICE_CENTS,
      subtotalCents: fullSession.amount_subtotal ?? UNIT_PRICE_CENTS * quantity,
      shippingCents,
      shippingService,
      taxCents: fullSession.total_details?.amount_tax ?? 0,
      totalCents: amountTotal,
      customerName,
      address: shippingAddress,
      shipDateLine,
      // Short enough to read down the phone; unique enough to find the row.
      orderRef: String(inserted[0].id).slice(0, 8),
    })

    // The order is already safely in the database by this point, so a failed
    // send must not fail the webhook: throwing here would return 500 to Stripe,
    // which then retries — and on the retry the insert conflicts, inserted is
    // empty, and we skip the email entirely. The buyer would silently get no
    // confirmation while Stripe's dashboard showed a failed delivery. Log it
    // and let the webhook succeed; the order is what matters.
    //
    // The likeliest cause is the sending domain not being verified in Resend
    // yet — see docs/store-wayfinder.md Phase 1 and docs/store-ops.md.
    try {
      const sent = await resend.emails.send({
        from: 'Space Race <orders@spaceexplorer.tech>',
        to: customerEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      if (sent.error) {
        console.error('Confirmation email rejected by Resend', {
          orderId: inserted[0].id,
          error: sent.error,
        })
      }
    } catch (err) {
      console.error('Confirmation email failed to send', { orderId: inserted[0].id, err })
    }
  }
}
