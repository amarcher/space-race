import { useCallback, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { MAX_QTY_PER_ORDER, PRODUCT_NAME, UNIT_PRICE_CENTS } from './constants'

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null

const PRICE_LABEL = (UNIT_PRICE_CENTS / 100).toFixed(2)

export function Shop() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  return sessionId ? <Confirmation /> : <ProductPage />
}

function Confirmation() {
  return (
    <main className="shop shop--confirm">
      <h1>You're in! 🚀</h1>
      <p>
        Thanks for pre-ordering <strong>{PRODUCT_NAME}</strong>. A receipt is on its
        way to your email now, and we'll send tracking info once your copy ships —
        expected mid-January 2027 (some early orders may ship sooner).
      </p>
      <a className="shop__link" href="/">
        Back to the game
      </a>
    </main>
  )
}

function ProductPage() {
  const [quantity, setQuantity] = useState(1)
  const [checkingOut, setCheckingOut] = useState(false)

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Could not start checkout')
    }
    const { clientSecret } = (await res.json()) as { clientSecret: string }
    return clientSecret
  }, [quantity])

  const onShippingDetailsChange = useCallback(async (event: { checkoutSessionId: string; shippingDetails: unknown }) => {
    const res = await fetch('/api/shipping-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkout_session_id: event.checkoutSessionId,
        shipping_details: event.shippingDetails,
      }),
    })
    const body = await res.json().catch(() => ({ type: 'error', message: 'Something went wrong.' }))
    if (body.type === 'error') {
      return { type: 'reject' as const, errorMessage: body.message as string }
    }
    return { type: 'accept' as const }
  }, [])

  if (checkingOut) {
    if (!stripePromise) {
      return <p className="shop__error">Checkout isn't configured yet.</p>
    }
    return (
      <div className="shop shop--checkout">
        <button className="shop__back" onClick={() => setCheckingOut(false)}>
          &larr; Back
        </button>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret, onShippingDetailsChange }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  return (
    <main className="shop">
      <img className="shop__hero" src="/shop/hero.png" alt="Space Race: 1000 Light-Years tuck box and cards" />
      <div className="shop__info">
        <p className="shop__badge">Pre-order — First Edition</p>
        <h1>{PRODUCT_NAME}</h1>
        <p className="shop__desc">
          The physical card game — a 107-card poker deck, illustrated tuck box, and
          rulebook. Ships starting mid-January 2027 (some early orders may ship
          sooner).
        </p>
        <p className="shop__price">${PRICE_LABEL}</p>

        <label className="shop__qty">
          Quantity
          <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
            {Array.from({ length: MAX_QTY_PER_ORDER }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {stripePromise ? (
          <button className="shop__buy" onClick={() => setCheckingOut(true)}>
            Pre-order — ${((quantity * UNIT_PRICE_CENTS) / 100).toFixed(2)} + shipping
          </button>
        ) : (
          <p className="shop__error">The store isn't open yet — check back soon.</p>
        )}
      </div>
    </main>
  )
}
