import type { CheckoutFormValues } from '@stripe/stripe-js'

export type ShippingDetails = NonNullable<CheckoutFormValues['shippingAddress']>

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
