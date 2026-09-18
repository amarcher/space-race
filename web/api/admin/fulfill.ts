import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_lib/db.js'
import { requireAdmin } from '../_lib/adminAuth.js'
import { sendShippedEmail } from '../_lib/shippedEmail.js'

// Marks an order shipped + records tracking — see docs/store-wayfinder.md Phase 12.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!requireAdmin(req, res)) return

  const id = String(req.body?.id ?? '')
  const trackingNumber = String(req.body?.trackingNumber ?? '').trim()
  if (!id || !trackingNumber) {
    res.status(400).json({ error: 'id and trackingNumber are required' })
    return
  }

  const updated = await sql`
    update orders
    set status = 'fulfilled', tracking_number = ${trackingNumber}, fulfilled_at = now()
    where id = ${id} and status = 'paid'
    returning id
  `

  if (updated.length === 0) {
    res.status(409).json({ error: 'Order not found or not in a fulfillable state' })
    return
  }

  // The order is shipped whether or not the email goes out; report the email
  // separately so /shop/admin can say so and offer a retry.
  const email = await sendShippedEmail(id)
  res.status(200).json({ ok: true, emailed: email.sent, emailError: email.sent ? null : email.reason })
}
