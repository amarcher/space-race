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
        total_price: dollars(order.subtotalCents),
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
