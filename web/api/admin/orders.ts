import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAdmin } from '../_lib/adminAuth.js'

// Fulfillment list for /shop/admin — see docs/store-wayfinder.md Phase 12.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!requireAdmin(req, res)) return

  const orders = await sql`
    select
      id, created_at, customer_email, customer_name, shipping_address,
      quantity, unit_price_cents, shipping_cents, shipping_service,
      amount_total_cents, currency, status, tracking_number, fulfilled_at,
      notes, ship_window
    from orders
    order by
      case status when 'paid' then 0 else 1 end,
      created_at asc
  `

  res.status(200).json({ orders })
}
