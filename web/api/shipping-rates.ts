import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { stripe } from './_lib/stripe.js'
import { CURRENCY, parcelForQuantity } from '../src/shop/constants.js'

const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN
const SHIPPO_API_BASE = 'https://api.goshippo.com'

const FROM_ADDRESS = {
  name: 'Space Race',
  street1: '137 Woburn Street',
  city: 'Lexington',
  state: 'MA',
  zip: '02420',
  country: 'US',
}

type ShippoAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

// Stripe's dynamic-shipping callback: the client posts here when the customer
// finishes the shipping address step, we fetch live Shippo rates and push
// them onto the Checkout Session server-side (permissions.update_shipping_details
// = 'server_only' means only this endpoint, with the secret key, can do that).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const checkoutSessionId = req.body?.checkout_session_id as string | undefined
  // Pass-through from Stripe's own client — cast to their type rather than a
  // narrower local one, so it round-trips cleanly into sessions.update() below.
  const shippingDetails = req.body?.shipping_details as
    | Stripe.Checkout.SessionUpdateParams.CollectedInformation.ShippingDetails
    | undefined
  const address = shippingDetails?.address as ShippoAddress | undefined

  if (!checkoutSessionId || !address?.postal_code || !address.country) {
    res.status(200).json({ type: 'error', message: "We can't ship to that address — please check it and try again." })
    return
  }

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ['line_items'] })
  const quantity = session.line_items?.data.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 1

  let shippingOptions
  try {
    shippingOptions = await liveShippingOptions(address, quantity)
  } catch (err) {
    console.error('Shippo rate lookup failed', err)
    res.status(200).json({ type: 'error', message: 'Could not calculate shipping for that address right now. Please try again.' })
    return
  }

  await stripe.checkout.sessions.update(checkoutSessionId, {
    collected_information: { shipping_details: shippingDetails },
    shipping_options: shippingOptions,
  })

  res.status(200).json({ type: 'object', value: { succeeded: true } })
}

// Stripe rejects a 6th element outright ("Array shipping_options exceeded
// maximum 5 allowed elements"), but Shippo routinely quotes 11+ rates for a US
// address, so some selection is forced on us.
const STRIPE_MAX_SHIPPING_OPTIONS = 5

/** Pick which quoted rates to show, cheapest first.
 *
 *  Taking the 5 cheapest looks fair but isn't: for most addresses they're all
 *  ground services within a couple of dollars of each other, so a buyer who
 *  wants it fast has no way to pay for that. Instead take the cheapest rate at
 *  each distinct delivery speed first — every speed the carriers actually
 *  offer stays on the table, at its best price — then spend any leftover slots
 *  on the next cheapest rates. Redundant near-duplicates (a pricier service
 *  arriving the same day as a cheaper one) are what get dropped.
 */
function selectRates(all: Array<Record<string, unknown>>) {
  const byPrice = [...all].sort((a, b) => Number(a.amount) - Number(b.amount))

  const picked: Array<Record<string, unknown>> = []
  const seenSpeeds = new Set<string>()
  for (const rate of byPrice) {
    if (picked.length >= STRIPE_MAX_SHIPPING_OPTIONS) break
    // Rates with no estimate share one bucket rather than each claiming a slot.
    const speed = String(rate.estimated_days ?? 'unknown')
    if (seenSpeeds.has(speed)) continue
    seenSpeeds.add(speed)
    picked.push(rate)
  }
  for (const rate of byPrice) {
    if (picked.length >= STRIPE_MAX_SHIPPING_OPTIONS) break
    if (!picked.includes(rate)) picked.push(rate)
  }

  return picked.sort((a, b) => Number(a.amount) - Number(b.amount))
}

async function liveShippingOptions(address: ShippoAddress, quantity: number) {
  // No placeholder/flat-rate fallback, ever — a fake accepted rate is a real
  // rate we'd be on the hook for honoring. If Shippo can't quote (missing
  // token, bad token, API error, no rates), throw and let the caller reject
  // the checkout attempt instead of silently charging a made-up number.
  if (!SHIPPO_API_TOKEN) {
    throw new Error('SHIPPO_API_TOKEN is not configured')
  }

  const parcel = parcelForQuantity(quantity)
  const response = await fetch(`${SHIPPO_API_BASE}/shipments/`, {
    method: 'POST',
    headers: {
      Authorization: `ShippoToken ${SHIPPO_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address_from: FROM_ADDRESS,
      address_to: {
        name: '',
        street1: address.line1,
        street2: address.line2 ?? '',
        city: address.city,
        state: address.state,
        zip: address.postal_code,
        country: address.country,
      },
      parcels: [
        {
          length: String(parcel.lengthIn),
          width: String(parcel.widthIn),
          height: String(parcel.heightIn),
          distance_unit: 'in',
          weight: String(parcel.weightOz),
          mass_unit: 'oz',
        },
      ],
      async: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Shippo shipment request failed: ${response.status}`)
  }

  const shipment = (await response.json()) as { rates?: Array<Record<string, unknown>> }
  const rates = selectRates((shipment.rates ?? []).filter((rate) => rate.amount))

  if (!rates.length) {
    throw new Error('No Shippo rates returned')
  }

  return rates.map((rate) => {
    const servicelevel = rate.servicelevel as { name?: string } | undefined
    const estimatedDays = rate.estimated_days as number | undefined
    return {
      shipping_rate_data: {
        type: 'fixed_amount' as const,
        display_name: `${rate.provider ?? 'Shipping'} ${servicelevel?.name ?? ''}`.trim(),
        fixed_amount: {
          amount: Math.round(Number(rate.amount) * 100),
          currency: CURRENCY,
        },
        // Separately-stated at real carrier cost — lets Stripe Tax apply each
        // state's actual shipping-taxability rules (e.g. exempt in MA per DOR
        // Directive 98-5) instead of defaulting to untaxed everywhere.
        tax_code: 'txcd_92010001',
        tax_behavior: 'exclusive' as const,
        ...(estimatedDays
          ? {
              delivery_estimate: {
                minimum: { unit: 'business_day' as const, value: estimatedDays },
                maximum: { unit: 'business_day' as const, value: estimatedDays },
              },
            }
          : {}),
      },
    }
  })
}
