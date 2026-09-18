export const SHIPPO_API_BASE = 'https://api.goshippo.com'

export const FROM_ADDRESS = {
  name: 'Space Race',
  street1: '137 Woburn Street',
  city: 'Lexington',
  state: 'MA',
  zip: '02420',
  country: 'US',
}

type Address = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export type PaidOrder = {
  orderRef: string
  placedAt: Date
  productName: string
  quantity: number
  weightOz: number
  customerName: string | null
  customerEmail: string
  customerPhone: string | null
  address: Address
  shippingService: string | null
  shippingCents: number
  subtotalCents: number
  taxCents: number
  totalCents: number
}

type NamedSession = {
  customer_details?: { name?: string | null } | null
  collected_information?: { shipping_details?: { name?: string | null } | null } | null
}

/** Who the parcel is addressed to, or null if the session carries no name.
 *
 *  The shipping name comes first: it's the recipient (not always the payer —
 *  gifts), and the Checkout Form requires it before payment. The billing name
 *  is only a fallback, because `ui_mode: 'form'` leaves customer_details.name
 *  empty for card payments — reading it first is how every real order until
 *  #216 reached Shippo nameless, and a nameless order can't buy a label.
 *  Blank strings count as missing so `??` can't stop on an empty value.
 */
export function recipientName(session: NamedSession): string | null {
  for (const name of [
    session.collected_information?.shipping_details?.name,
    session.customer_details?.name,
  ]) {
    const trimmed = name?.trim()
    if (trimmed) return trimmed
  }
  return null
}

const dollars = (cents: number) => (cents / 100).toFixed(2)
// Shippo rejects numbers with more than four decimal places.
const ounces = (oz: number) => String(Math.round(oz * 100) / 100)

/** The Shippo order for a paid checkout, so its label can be bought from
 *  Shippo's Orders page with the address, weight and paid-for service filled in. */
export function shippoOrderRequest(order: PaidOrder) {
  return {
    order_number: order.orderRef,
    order_status: 'PAID',
    placed_at: order.placedAt.toISOString(),
    from_address: FROM_ADDRESS,
    to_address: {
      name: order.customerName ?? '',
      street1: order.address.line1 ?? '',
      street2: order.address.line2 ?? '',
      city: order.address.city ?? '',
      state: order.address.state ?? '',
      zip: order.address.postal_code ?? '',
      country: order.address.country ?? 'US',
      email: order.customerEmail,
      ...(order.customerPhone ? { phone: order.customerPhone } : {}),
    },
    line_items: [
      {
        title: order.productName,
        quantity: order.quantity,
        // PER UNIT, despite the name. Shippo multiplies this by `quantity` to
        // display the line — its Shipping Elements schema calls the same field
        // `unit_amount`. Sending the whole subtotal here billed a 3-copy order
        // as 3 × $86.37 = $259.11 on the packing slip. The order-level
        // subtotal_price/total_price below are the real extended totals.
        total_price: dollars(order.subtotalCents / Math.max(order.quantity, 1)),
        currency: 'USD',
      },
    ],
    // The buyer paid for this exact service; the label must match it.
    shipping_method: order.shippingService ?? '',
    shipping_cost: dollars(order.shippingCents),
    shipping_cost_currency: 'USD',
    subtotal_price: dollars(order.subtotalCents),
    total_tax: dollars(order.taxCents),
    total_price: dollars(order.totalCents),
    currency: 'USD',
    // Includes packaging, matching the parcel weight checkout quoted on.
    weight: ounces(order.weightOz),
    weight_unit: 'oz',
  }
}

export async function createShippoOrder(order: PaidOrder) {
  const token = process.env.SHIPPO_API_TOKEN
  if (!token) throw new Error('SHIPPO_API_TOKEN is not configured')

  const response = await fetch(`${SHIPPO_API_BASE}/orders/`, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `ShippoToken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippoOrderRequest(order)),
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    throw new Error(`Shippo order request failed: ${response.status} ${detail}`)
  }
}
