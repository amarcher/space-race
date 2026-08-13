import type { VercelRequest, VercelResponse } from '@vercel/node'

// Shared-secret gate for /shop/admin — sent as `Authorization: Bearer <secret>`
// by the admin page (see docs/store-wayfinder.md Phase 12). Not full auth, but
// enough for a single-operator admin tool with no accounts to manage.
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    res.status(500).json({ error: 'Admin access is not configured' })
    return false
  }

  const auth = req.headers.authorization
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }

  return true
}
