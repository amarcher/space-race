import type { CheckoutFormValues } from '@stripe/stripe-js'

export type ShippingDetails = NonNullable<CheckoutFormValues['shippingAddress']>

/** The address fields a carrier rate actually depends on, or null.
 *
 *  Deliberately not Stripe's `status.shippingAddress.complete`: that section
 *  includes the recipient name, so gating on it hid rates behind a field that
 *  cannot change them — /api/shipping-rates sends Shippo an empty name. A
 *  buyer who has typed a full address but not yet their name gets a quote.
 *  Stripe still requires the name before it will let them pay.
 */
export function quotableAddress(
  details: { name?: string | null; address?: ShippingDetails['address'] | null } | null | undefined,
): ShippingDetails | null {
  const a = details?.address
  if (!a) return null
  const filled = (value: string | null | undefined) => (value ?? '').trim().length > 0
  if (!filled(a.line1) || !filled(a.city) || !filled(a.state)) return null
  if (a.country !== 'US') return null
  // Quoting a half-typed ZIP would burn a round trip per keystroke and can
  // resolve to the wrong state; wait for one that could be real.
  if (!/^\d{5}(-\d{4})?$/.test((a.postal_code ?? '').trim())) return null
  return { name: details?.name ?? '', address: a }
}

function addressKey(details: ShippingDetails | null): string | null {
  if (!details) return null
  const a = details.address
  return JSON.stringify([a.line1, a.line2 ?? '', a.city, a.state, a.postal_code, a.country])
}

// Serialize server updates: a slow quote for address A must never overwrite
// address B's rates. Payment is allowed only after the current address succeeds.
export function createShippingQuotes(update: (details: ShippingDetails) => Promise<void>) {
  let current: ShippingDetails | null = null
  let quotedKey: string | null = null
  let attemptedKey: string | null = null
  let pending: Promise<void> | null = null

  const ready = () => current !== null && quotedKey === addressKey(current) && pending === null

  return {
    ready,
    setAddress(details: ShippingDetails | null) {
      if (addressKey(details) !== addressKey(current)) attemptedKey = null
      current = details
    },
    async refresh(retry = false): Promise<void> {
      if (pending) return pending
      if (!current || ready() || (!retry && attemptedKey === addressKey(current))) return
      pending = (async () => {
        while (current && quotedKey !== addressKey(current)) {
          const details = current
          const key = addressKey(details)
          attemptedKey = key
          // Updating the server invalidates every earlier quote, even when the
          // address returns to a previous value while a request is in flight.
          quotedKey = null
          try {
            await update(details)
            quotedKey = key
          } catch (error) {
            if (addressKey(current) === key) throw error
            // A stale failure must not prevent the new address from quoting.
          }
        }
      })()
      try {
        await pending
      } finally {
        pending = null
      }
    },
  }
}
