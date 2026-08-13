import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { stripe } from './_lib/stripe.js'
import { sql } from './_lib/db.js'
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

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Receipt lines between the item and the total, in the order they're shown. */
type ReceiptRow = { label: string; amount: number }

function addressLines(address: Stripe.Address, name: string | null): string[] {
  return [
    name,
    address.line1,
    address.line2,
    // "Lexington, MA 02420" — comma after the city only, space before the ZIP.
    [[address.city, address.state].filter(Boolean).join(', '), address.postal_code]
      .filter(Boolean)
      .join(' '),
    // Only worth stating when it isn't the one country we ship to today.
    address.country && address.country !== 'US' ? address.country : null,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

/** Plain-text fallback. Deliberately avoids column alignment — mail clients
 *  render text/plain in a proportional font often enough that padded columns
 *  come out ragged, so each amount just follows its label. */
function receiptText(rows: ReceiptRow[], totalCents: number, ship: string[], shipDateLine: string) {
  return [
    `Thanks for pre-ordering ${PRODUCT_NAME}!`,
    '',
    'YOUR ORDER',
    ...rows.map((row) => `  ${row.label}: ${money(row.amount)}`),
    `  Total: ${money(totalCents)}`,
    '',
    'SHIPPING TO',
    ...ship.map((line) => `  ${line}`),
    '',
    shipDateLine,
  ].join('\n')
}

function receiptHtml(rows: ReceiptRow[], totalCents: number, ship: string[], shipDateLine: string) {
  const cell = 'padding:6px 0;font:14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#333'
  const row = (label: string, amount: string, extra = '') =>
    `<tr><td style="${cell};${extra}">${escapeHtml(label)}</td>` +
    `<td style="${cell};${extra};text-align:right;white-space:nowrap">${escapeHtml(amount)}</td></tr>`
  return `<div style="max-width:520px;margin:0 auto">
<p style="${cell}">Thanks for pre-ordering <strong>${escapeHtml(PRODUCT_NAME)}</strong>!</p>
<table style="width:100%;border-collapse:collapse">
${rows.map((r) => row(r.label, money(r.amount))).join('\n')}
${row('Total', money(totalCents), 'border-top:1px solid #ddd;font-weight:700;color:#000')}
</table>
<p style="${cell}"><strong>Shipping to</strong><br>${ship.map(escapeHtml).join('<br>')}</p>
<p style="${cell}">${escapeHtml(shipDateLine)}</p>
</div>`
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
    // makes that look like an overcharge. Subtotal comes from Stripe rather
    // than being recomputed here so the lines always reconcile to what was
    // actually charged, including any tax Stripe worked out at checkout.
    const subtotalCents = fullSession.amount_subtotal ?? UNIT_PRICE_CENTS * quantity
    const taxCents = fullSession.total_details?.amount_tax ?? 0
    const rows: ReceiptRow[] = [
      // The greeting right above already names the product — don't repeat it here.
      { label: `Pre-order — ${quantity} × ${money(UNIT_PRICE_CENTS)}`, amount: subtotalCents },
      { label: shippingService ? `Shipping (${shippingService})` : 'Shipping', amount: shippingCents },
    ]
    // Omitted rather than shown as $0.00 — outside a registered state there's
    // no tax to report, and the remaining lines still sum to the total.
    if (taxCents > 0) rows.push({ label: 'Sales tax', amount: taxCents })

    const ship = addressLines(shippingAddress as Stripe.Address, customerName)

    await resend.emails.send({
      // TODO: verify a spaceexplorer.tech sending domain in Resend before launch —
      // see docs/store-wayfinder.md Phase 1.
      from: 'Space Race <orders@spaceexplorer.tech>',
      to: customerEmail,
      subject: 'Your Space Race pre-order is confirmed',
      text: receiptText(rows, amountTotal, ship, shipDateLine),
      html: receiptHtml(rows, amountTotal, ship, shipDateLine),
    })
  }
}
