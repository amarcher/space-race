import { useCallback, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import {
  EARLY_SHIP_DATE_LABEL,
  MAIN_SHIP_DATE_LABEL,
  MAX_QTY_PER_ORDER,
  PRODUCT_NAME,
  UNIT_PRICE_CENTS,
} from './constants'

type InventoryStatus = { earlyRemaining: number; sellableRemaining: number; earlySoldOut: boolean }

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null

const PRICE_LABEL = (UNIT_PRICE_CENTS / 100).toFixed(2)

const GALLERY_IMAGES = [
  {
    src: '/shop/hero.jpg',
    alt: 'The Space Race: 1000 Light-Years tuck box, rulebook, and a spread of illustrated cards',
  },
  {
    src: '/shop/box-closeup.jpg',
    alt: 'Close-up of the shrink-wrapped Space Race: 1000 Light-Years tuck box',
  },
]

export function Shop() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  return sessionId ? <Confirmation /> : <ProductPage />
}

function Confirmation() {
  return (
    <main className="shop shop--confirm">
      <h1>You're in! 🚀</h1>
      <p>
        Thanks for pre-ordering <strong>{PRODUCT_NAME}</strong>. A confirmation email
        is on its way now with your exact ship window, and we'll send tracking info
        once your copy actually ships.
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
  const [inventory, setInventory] = useState<InventoryStatus | null>(null)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: InventoryStatus | null) => {
        if (!cancelled && body) setInventory(body)
      })
      .catch(() => {
        // Live badge is a nice-to-have — leave it unset on failure rather than
        // blocking the product page.
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      <div className="shop__gallery">
        <img className="shop__hero" src={GALLERY_IMAGES[activeImage].src} alt={GALLERY_IMAGES[activeImage].alt} />
        {GALLERY_IMAGES.length > 1 && (
          <div className="shop__thumbs">
            {GALLERY_IMAGES.map((image, i) => (
              <button
                key={image.src}
                type="button"
                className={`shop__thumb${i === activeImage ? ' shop__thumb--active' : ''}`}
                onClick={() => setActiveImage(i)}
                aria-label={image.alt}
                aria-pressed={i === activeImage}
              >
                <img src={image.src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="shop__info">
        <p className="shop__badge">Pre-order — First Edition</p>
        <h1>{PRODUCT_NAME}</h1>
        <p className="shop__desc">
          The physical card game — a 107-card poker deck, illustrated tuck box, and
          rulebook.
        </p>
        {/* Deliberately says nothing about the January batch until the early
            10 sell through — no reason to muddy the offer with a slower
            window nobody's been assigned to yet. */}
        <p className="shop__ship-window">
          {inventory == null
            ? `Ships ${EARLY_SHIP_DATE_LABEL}`
            : inventory.earlySoldOut
              ? `Ships ${MAIN_SHIP_DATE_LABEL}`
              : `Ships ${EARLY_SHIP_DATE_LABEL} · ${inventory.earlyRemaining} left`}
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

        {/* Trimmed to the terms a buyer actually weighs before paying. The
            fuller policy (delay notices, tax/shipping mechanics) still governs
            and lives in docs/store-wayfinder.md — this is the disclosure that
            has to be clear and conspicuous pre-sale, not an exhaustive recital. */}
        <section className="shop__policy">
          <h2>Shipping &amp; returns</h2>
          <ul>
            <li>
              <strong>30-day returns.</strong> Changed your mind after it arrives? Send it
              back within 30 days for a refund.
            </li>
            <li>
              <strong>Damaged or lost in transit?</strong> Free replacement or a full
              refund — your choice, nothing to send back.
            </li>
            <li>
              <strong>Cancel anytime before it ships</strong> for a full refund.
            </li>
            <li>Shipping and any sales tax are calculated at checkout. US addresses only.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
