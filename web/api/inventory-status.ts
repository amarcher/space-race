import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { availableInventory } from '../src/shop/constants.js'

// Live counts for the shop page's available stock — read-only, no auth
// needed (the numbers are already implied by whether checkout succeeds).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const [{ sold, inStockSold }] = await sql`
    select
      coalesce(sum(quantity), 0)::int as sold,
      coalesce(sum(quantity) filter (where ship_window in ('early', 'in_stock')), 0)::int as "inStockSold"
    from orders
    where status != 'cancelled'
  `

  const sellableRemaining = availableInventory(sold, inStockSold)

  res.status(200).json({
    // Retain these fields for already-open older clients.
    earlyRemaining: sellableRemaining,
    sellableRemaining,
    earlySoldOut: sellableRemaining === 0,
  })
}
