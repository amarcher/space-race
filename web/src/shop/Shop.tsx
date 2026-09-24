import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Brand, StoreFooter } from './StoreExperience'
import { ScrollStore } from './ScrollStore'
import {
  MAX_QTY_PER_ORDER,
  PRODUCT_NAME,
  quantityFromMetaCart,
} from './constants'

const CheckoutPanel = lazy(() => import('./CheckoutPanel'))
type InventoryStatus = {
  earlyRemaining: number
  sellableRemaining: number
  earlySoldOut: boolean
}
const CHECKOUT_CONFIGURED = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
const CHECKOUT_PHOTO_ALT =
  'The real Space Race First Edition: illustrated tuck box, rulebook, distance cards, hazards, repairs, and safeties laid out on a table'

export function Shop() {
  const sessionId = new URLSearchParams(window.location.search).get(
    'session_id'
  )
  return sessionId ? <Confirmation /> : <ProductPage />
}

function Confirmation() {
  return (
    <>
      <header className="store-header">
        <Brand />
      </header>
      <main className="shop--confirm">
        <img
          src="/shop/rescue-shuttle.jpg"
          alt="Rescue Shuttle card"
          width="180"
          height="245"
        />
        <h1>You're in!</h1>
        <p>
          Thanks for ordering <strong>{PRODUCT_NAME}</strong>. A confirmation
          email is on its way with your order details, and we'll send tracking
          info once your copy actually ships.
        </p>
        <a className="shop__buy" href="/">
          Play while you wait
        </a>
      </main>
      <StoreFooter />
    </>
  )
}

function ProductPage() {
  // Non-null when the visitor arrived from a Meta Shops cart, which is also
  // what makes the itemised cart summary appear.
  const [metaCart] = useState(() => quantityFromMetaCart(window.location.search))
  const [quantity, setQuantity] = useState(() => metaCart ?? 1)
  const [checkingOut, setCheckingOut] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const checkoutRequest = useRef(0)
  const [inventory, setInventory] = useState<InventoryStatus | null>(null)
  const purchaseButton = useRef<HTMLButtonElement>(null)
  const checkoutHeading = useRef<HTMLHeadingElement>(null)
  const productScroll = useRef(0)
  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory-status', { signal: AbortSignal.timeout(10000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: InventoryStatus | null) => {
        if (
          !cancelled &&
          body &&
          Number.isInteger(body.earlyRemaining) &&
          Number.isInteger(body.sellableRemaining)
        )
          setInventory(body)
      })
      .catch(() => {
        /* Unknown inventory never becomes a claim of availability. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxQuantity = inventory
    ? Math.max(0, Math.min(MAX_QTY_PER_ORDER, inventory.sellableRemaining))
    : MAX_QTY_PER_ORDER
  const soldOut = maxQuantity === 0
  const availability =
    inventory == null
      ? 'Availability confirmed at checkout'
      : soldOut
      ? 'Currently sold out'
      : 'In stock · Available now'
  useEffect(() => {
    if (maxQuantity > 0)
      setQuantity((current) => Math.min(current, maxQuantity))
  }, [maxQuantity])

  // Preserve the existing checkout history and bfcache protection. The purchase
  // flow must never remount a consumed Stripe session after browser Back.
  const startCheckout = useCallback(async () => {
    if (!CHECKOUT_CONFIGURED || soldOut) return
    const request = ++checkoutRequest.current
    if (!checkingOut) {
      productScroll.current = window.scrollY
      window.history.pushState({ shopCheckout: true }, '')
    }
    setCheckingOut(true)
    setClientSecret(null)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
        signal: AbortSignal.timeout(20000),
      })
      const body = await res.json().catch(() => ({}))
      if (
        !res.ok ||
        typeof body.clientSecret !== 'string' ||
        !body.clientSecret
      ) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Checkout could not start right now. Please try again.'
        )
      }
      if (request === checkoutRequest.current)
        setClientSecret(body.clientSecret)
    } catch (error) {
      if (request === checkoutRequest.current)
        setCheckoutError(
          error instanceof Error && error.name === 'Error'
            ? error.message
            : 'Checkout could not start right now. Please try again.'
        )
    }
  }, [checkingOut, quantity, soldOut])

  useEffect(() => {
    if (checkingOut) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      checkoutHeading.current?.focus({ preventScroll: true })
    }
  }, [checkingOut])

  useEffect(() => {
    const leaveCheckout = () => {
      ++checkoutRequest.current
      setCheckingOut(false)
      setClientSecret(null)
      setCheckoutError(null)
      requestAnimationFrame(() => {
        window.scrollTo({ top: productScroll.current, behavior: 'instant' })
        purchaseButton.current?.focus({ preventScroll: true })
      })
    }
    const onPopState = () => {
      if (checkingOut) leaveCheckout()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && checkingOut) leaveCheckout()
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [checkingOut])

  const checkout = checkingOut && (
    <>
      <header className="store-header">
        <Brand />
        <span className="store-secure">Secure checkout</span>
      </header>
      <main className="shop--checkout">
        <aside className="checkout-summary">
          <button
            className="shop__back"
            onClick={() => window.history.back()}
          >
            ← Back to the game
          </button>
          <h1 ref={checkoutHeading} tabIndex={-1}>
            Your order.
          </h1>
          <img
            className="checkout-summary__photo"
            src="/shop/hero.jpg"
            alt={CHECKOUT_PHOTO_ALT}
          />
          <h2>Space Race: 1,000 Light-Years</h2>
          <p>
            First Edition · {quantity} {quantity === 1 ? 'copy' : 'copies'}
          </p>
          <p className="checkout-summary__promise">
            Cancel anytime before it ships. 30-day returns after it arrives.
          </p>
        </aside>
        <section
          className="checkout-payment"
          aria-label="Shipping and payment"
        >
          <h2>Checkout</h2>
          {checkoutError ? (
            <div className="checkout-status" role="alert">
              <p className="shop__error">{checkoutError}</p>
              <button className="shop__buy" onClick={startCheckout}>
                Try again
              </button>
            </div>
          ) : clientSecret ? (
            <Suspense
              fallback={
                <p className="checkout-status" role="status">
                  Loading secure payment form…
                </p>
              }
            >
              <CheckoutPanel
                clientSecret={clientSecret}
                onRetry={startCheckout}
              />
            </Suspense>
          ) : (
            <p className="checkout-status" role="status">
              Opening secure checkout…
            </p>
          )}
        </section>
      </main>
    </>
  )

  // The store stays mounted behind the checkout: its scroll engine has no
  // teardown, and Back must return to the exact frame the buyer left.
  return (
    <>
      {checkout}
      <ScrollStore
        hidden={checkingOut}
        quantity={quantity}
        onQuantity={setQuantity}
        maxQuantity={maxQuantity}
        soldOut={soldOut}
        availability={availability}
        checkoutConfigured={CHECKOUT_CONFIGURED}
        metaCart={metaCart}
        onBuy={startCheckout}
        buyRef={purchaseButton}
      />
    </>
  )
}
