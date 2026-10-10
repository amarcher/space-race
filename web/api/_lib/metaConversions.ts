import { CURRENCY, META_CATALOG_CONTENT_ID, META_PIXEL_ID } from '../../src/shop/constants.js'

// Purchases reach Meta from here, not from the browser: the order confirmation
// page keeps the Pixel off because its URL holds the Stripe session id.

// Meta's browser identifiers, set by the Pixel on /shop: _fbp names the browser
// and _fbc the ad click that brought it. Both read fb.<n>.<ms timestamp>.<value>.
const BROWSER_ID = /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{1,400}$/

export type MetaBrowser = { fbp?: string; fbc?: string; userAgent?: string }

// What the shop page sent with the checkout request, as Stripe metadata. Only
// well-formed identifiers are kept; a visitor who blocks the Pixel has none.
export function metaMetadata(body: unknown, userAgent: string | undefined): Record<string, string> {
  const meta = (body as { meta?: Record<string, unknown> } | null)?.meta
  const id = (value: unknown) => (typeof value === 'string' && BROWSER_ID.test(value) ? value : undefined)
  const fbp = id(meta?.fbp)
  const fbc = id(meta?.fbc)
  if (!fbp && !fbc) return {}
  return {
    ...(fbp ? { meta_fbp: fbp } : {}),
    ...(fbc ? { meta_fbc: fbc } : {}),
    ...(userAgent ? { meta_ua: userAgent.slice(0, 500) } : {}),
  }
}

export function metaBrowserFromMetadata(metadata: Record<string, string> | null | undefined): MetaBrowser {
  return { fbp: metadata?.meta_fbp, fbc: metadata?.meta_fbc, userAgent: metadata?.meta_ua }
}

// Reports one paid order. Sends nothing without an access token, or for a buyer
// whose browser never ran the Pixel: there is nobody for Meta to match, and a
// visitor who blocked it should stay unreported. No name, email or address goes.
export async function sendMetaPurchase(order: {
  eventId: string
  paidAt: Date
  quantity: number
  merchandiseCents: number
  browser: MetaBrowser
}): Promise<boolean> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN
  const { fbp, fbc, userAgent } = order.browser
  if (!accessToken || (!fbp && !fbc)) return false

  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE
  // Unversioned on purpose: Meta retires each numbered Graph API version after
  // about two years, and this must not stop silently when one does.
  const res = await fetch(`https://graph.facebook.com/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      access_token: accessToken,
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(order.paidAt.getTime() / 1000),
          event_id: order.eventId,
          action_source: 'website',
          event_source_url: 'https://game.spaceexplorer.tech/shop',
          user_data: {
            ...(fbp ? { fbp } : {}),
            ...(fbc ? { fbc } : {}),
            ...(userAgent ? { client_user_agent: userAgent } : {}),
          },
          custom_data: {
            currency: CURRENCY.toUpperCase(),
            value: order.merchandiseCents / 100,
            content_ids: [META_CATALOG_CONTENT_ID],
            content_type: 'product',
            num_items: order.quantity,
          },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Meta Conversions API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return true
}
