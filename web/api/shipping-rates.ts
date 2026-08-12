import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { stripe } from './_lib/stripe.js'
import { CURRENCY, parcelForQuantity } from '../src/shop/constants.js'

const SHIPPO_API_TOKEN = process.env.SHIPPO_API_TOKEN
const SHIPPO_API_BASE = 'https://api.goshippo.com'

// TODO before launch: replace with the real ship-from address (see
// docs/store-wayfinder.md Phase 1/9).
const FROM_ADDRESS = {
  name: 'Space Race',
  street1: 'TODO',
  city: 'TODO',
  state: 'TODO',
  zip: 'TODO',
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

async function liveShippingOptions(address: ShippoAddress, quantity: number) {
  if (!SHIPPO_API_TOKEN) {
    // Shippo isn't configured yet — a flat placeholder keeps the checkout flow
    // testable end-to-end. Swap this out once docs/store-wayfinder.md Phase 1 lands.
    return [
      {
        shipping_rate_data: {
          type: 'fixed_amount' as const,
          display_name: 'Standard shipping (placeholder rate)',
          fixed_amount: { amount: 599, currency: CURRENCY },
          delivery_estimate: {
            minimum: { unit: 'business_day' as const, value: 5 },
            maximum: { unit: 'business_day' as const, value: 10 },
          },
        },
      },
    ]
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
  const rates = (shipment.rates ?? [])
    .filter((rate) => rate.amount)
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .slice(0, 3)

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
