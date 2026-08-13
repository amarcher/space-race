import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { EARLY_BATCH_SELLABLE, SELLABLE_INVENTORY } from '../src/shop/constants.js'

// Live counts for the shop page's ship-window messaging — read-only, no auth
// needed (the numbers are already implied by whether checkout succeeds).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const [{ sold, earlySold }] = await sql`
    select
      coalesce(sum(quantity), 0)::int as sold,
      coalesce(sum(quantity) filter (where ship_window = 'early'), 0)::int as "earlySold"
    from orders
    where status != 'cancelled'
  `

  const earlyRemaining = Math.max(0, EARLY_BATCH_SELLABLE - earlySold)
  const sellableRemaining = Math.max(0, SELLABLE_INVENTORY - sold)

  res.status(200).json({
    earlyRemaining,
    sellableRemaining,
    earlySoldOut: earlyRemaining === 0,
  })
}
