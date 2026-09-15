import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { stripe } from './_lib/stripe.js'
import { ALLOWED_SHIP_COUNTRIES, CURRENCY, parcelForQuantity } from '../src/shop/constants.js'

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

// Checkout Form collects the address. Its change event calls this endpoint
// through runServerUpdate to refresh the carrier quotes shown in the form.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const checkoutSessionId = req.body?.checkout_session_id as string | undefined
  // The Checkout Form change event supplies the recipient and postal address.
  const shippingDetails = req.body?.shipping_details as
    | Stripe.Checkout.SessionUpdateParams.CollectedInformation.ShippingDetails
    | undefined
  const address = shippingDetails?.address as ShippoAddress | undefined

  if (!checkoutSessionId || !address?.postal_code || !address.country ||
      !ALLOWED_SHIP_COUNTRIES.includes(address.country as typeof ALLOWED_SHIP_COUNTRIES[number])) {
    res.status(200).json({ type: 'error', message: "We can't ship to that address — please check it and try again." })
    return
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ['line_items'] }, {
      timeout: 3000, maxNetworkRetries: 0,
    })
    if (session.status !== 'open' || session.ui_mode !== 'form') {
      res.status(409).json({ type: 'error', message: 'This checkout is no longer available. Go back and start again.' })
      return
    }
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
      // The new form owns shipping details; only quote options are server-owned.
      shipping_options: shippingOptions,
    }, { timeout: 3000, maxNetworkRetries: 0 })

    res.status(200).json({ type: 'object', value: { succeeded: true } })
  } catch (error) {
    console.error('Checkout shipping update failed', error)
    res.status(503).json({ type: 'error', message: 'Could not update shipping right now. Please try again.' })
  }
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

// Shippo rejects parcel numbers with more than four decimal places (HTTP 400).
// Float math makes 3 × 8.1 oz + 1 oz = 25.299999999999997, so round first.
function shippoDecimal(value: number): string {
  return String(Math.round(value * 100) / 100)
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
    // Finish before Stripe's 20-second runServerUpdate deadline.
    signal: AbortSignal.timeout(8000),
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
          length: shippoDecimal(parcel.lengthIn),
          width: shippoDecimal(parcel.widthIn),
          height: shippoDecimal(parcel.heightIn),
          distance_unit: 'in',
          weight: shippoDecimal(parcel.weightOz),
          mass_unit: 'oz',
        },
      ],
      async: false,
    }),
  })

  if (!response.ok) {
    // Shippo's body names the failing field; it echoes no address data we log.
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    throw new Error(`Shippo shipment request failed: ${response.status} ${detail}`)
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
