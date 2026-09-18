import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_lib/adminAuth.js'
import { sendShippedEmail } from '../_lib/shippedEmail.js'

// Sends the tracking email for an order already marked shipped — a retry after
// a failed send, or orders shipped before this email existed.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!requireAdmin(req, res)) return

  const id = String(req.body?.id ?? '')
  if (!id) {
    res.status(400).json({ error: 'id is required' })
    return
  }

  const result = await sendShippedEmail(id)
  if (!result.sent) {
    res.status(409).json({ error: result.reason })
    return
  }
  res.status(200).json({ ok: true })
}
