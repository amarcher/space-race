import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  Brand,
  FilmSection,
  GameMoment,
  StoreFooter,
  StoreHero,
  Trailer,
} from './StoreExperience'
import { MAX_QTY_PER_ORDER, PRODUCT_NAME, UNIT_PRICE_CENTS } from './constants'

const CheckoutPanel = lazy(() => import('./CheckoutPanel'))
type InventoryStatus = {
  earlyRemaining: number
  sellableRemaining: number
  earlySoldOut: boolean
}
const CHECKOUT_CONFIGURED = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
const PRICE_LABEL = (UNIT_PRICE_CENTS / 100).toFixed(2)
const GALLERY_IMAGES = [
  {
    src: '/shop/hero.jpg',
    label: 'The complete game',
    alt: 'The real Space Race First Edition: illustrated tuck box, rulebook, distance cards, hazards, repairs, and safeties laid out on a table',
  },
  {
    src: '/shop/box-closeup.jpg',
    label: 'The tuck box',
    alt: 'Close-up of the shrink-wrapped Space Race: 1000 Light-Years tuck box',
  },
]

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

function ShippingPolicy() {
  return (
    <section className="shop__policy" aria-labelledby="policy-heading">
      <h3 id="policy-heading">Shipping &amp; returns</h3>
      <ul>
        <li>
          <strong>30-day returns.</strong> Changed your mind after it arrives?
          Send it back within 30 days for a refund.
        </li>
        <li>
          <strong>Damaged or lost in transit?</strong> Free replacement or a
          full refund — your choice, nothing to send back.
        </li>
        <li>
          <strong>Cancel anytime before it ships</strong> for a full refund.
        </li>
        <li>
          Shipping and any sales tax are calculated at checkout. US addresses
          only.
        </li>
      </ul>
    </section>
  )
}

function ProductPage() {
  const [quantity, setQuantity] = useState(1)
  const [checkingOut, setCheckingOut] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const checkoutRequest = useRef(0)
  const [inventory, setInventory] = useState<InventoryStatus | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [watching, setWatching] = useState(false)
  const purchaseButton = useRef<HTMLButtonElement>(null)
  const checkoutHeading = useRef<HTMLHeadingElement>(null)
  const productScroll = useRef(0)
  const productSection = useRef<HTMLElement>(null)
  const [offerVisible, setOfferVisible] = useState(false)
  useEffect(() => {
    if (checkingOut || !productSection.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setOfferVisible(entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px' }
    )
    observer.observe(productSection.current)
    return () => observer.disconnect()
  }, [checkingOut])

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

  if (checkingOut)
    return (
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
              Your next
              <br />
              game night.
            </h1>
            <img
              className="checkout-summary__photo"
              src="/shop/hero.jpg"
              alt={GALLERY_IMAGES[0].alt}
            />
            <h2>Space Race: 1,000 Light-Years</h2>
            <p>
              First Edition · {quantity} {quantity === 1 ? 'copy' : 'copies'}
            </p>
            <div className="checkout-summary__subtotal">
              <span>Game subtotal</span>
              <strong>
                ${((quantity * UNIT_PRICE_CENTS) / 100).toFixed(2)}
              </strong>
            </div>
            <p>
              We'll email your order confirmation and send tracking when your
              game ships.
            </p>
            <p>
              Shipping and any sales tax are calculated in the payment form.
            </p>
            <p className="checkout-summary__promise">
              Cancel anytime before it ships. 30-day returns after it arrives.
            </p>
          </aside>
          <section
            className="checkout-payment"
            aria-label="Shipping and payment"
          >
            <h2>Make it yours.</h2>
            <p>Choose your shipping service and complete your order below.</p>
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

  return (
    <>
      <a className="store-skip" href="#get-the-game">
        Skip to product and ordering
      </a>
      <header className="store-header">
        <Brand />
        <nav aria-label="Store">
          <a href="#the-film">The film</a>
          <a href="#your-move">How it plays</a>
          <a className="store-header__buy" href="#get-the-game">
            Get the game
          </a>
        </nav>
      </header>
      <main className="store">
        <StoreHero onWatch={() => setWatching(true)} />
        <FilmSection onWatch={() => setWatching(true)} />
        <GameMoment />
        <section
          ref={productSection}
          className="store-product store-section"
          id="get-the-game"
          aria-labelledby="product-heading"
        >
          <div className="shop__gallery">
            <div className="shop__photo-frame">
              <img
                className="shop__hero"
                src={GALLERY_IMAGES[activeImage].src}
                alt={GALLERY_IMAGES[activeImage].alt}
                width="1200"
                height="1600"
                loading="lazy"
              />
            </div>
            <div className="shop__thumbs">
              {GALLERY_IMAGES.map((image, i) => (
                <button
                  key={image.src}
                  type="button"
                  className={`shop__thumb${
                    i === activeImage ? ' shop__thumb--active' : ''
                  }`}
                  onClick={() => setActiveImage(i)}
                  aria-pressed={i === activeImage}
                >
                  <img src={image.src} alt="" loading="lazy" />
                  <span>{image.label}</span>
                </button>
              ))}
            </div>
            <p className="shop__photo-caption">
              Real cards. Real photos of the First Edition.
            </p>
          </div>
          <div className="shop__info">
            <p className="shop__badge">The physical game · First Edition</p>
            <h2 id="product-heading">
              Deal a little
              <br />
              adventure.
            </h2>
            <p className="shop__desc">
              Bring the race off the screen and onto your table. Everything you
              need to launch, dodge, and Slingshot your way to 1,000
              light-years.
            </p>
            <ul className="shop__contents">
              <li>107 illustrated, UV-coated poker-size cards</li>
              <li>Illustrated tuck box, ready to take along</li>
              <li>Rulebook with the base game and advanced modes</li>
            </ul>
            <div className="shop__price-row">
              <p className="shop__price">${PRICE_LABEL}</p>
              <span>
                per game
                <br />+ shipping and any sales tax
              </span>
            </div>
            <p className="shop__ship-window">
              {soldOut ? 'This edition is currently sold out.' : availability}
            </p>
            <div className="shop__order-row">
              <label className="shop__qty">
                Quantity
                <select
                  disabled={soldOut}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                >
                  {Array.from(
                    { length: Math.max(1, maxQuantity) },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                ref={purchaseButton}
                className="shop__buy"
                disabled={soldOut || !CHECKOUT_CONFIGURED}
                onClick={startCheckout}
              >
                {soldOut
                  ? 'Sold out'
                  : `Buy now · $${((quantity * UNIT_PRICE_CENTS) / 100).toFixed(
                      2
                    )}`}
              </button>
            </div>
            {!CHECKOUT_CONFIGURED && (
              <p className="shop__error">
                The store isn't open yet — check back soon.
              </p>
            )}
            <p className="shop__order-note">US shipping. Secure checkout.</p>
            <ShippingPolicy />
          </div>
        </section>
        <section
          className="store-questions store-section"
          aria-labelledby="questions-heading"
        >
          <div>
            <h2 id="questions-heading">
              Before you
              <br />
              launch.
            </h2>
            <p>Want to get a feel for the cards first?</p>
            <a
              className="store-text-link"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              Play free in your browser ↗
            </a>
          </div>
          <div>
            <details>
              <summary>How do you play?</summary>
              <p>
                Play Ignition to launch, then distance cards to move toward
                1,000 light-years. Slow your rivals with hazards, repair your
                ship with remedies, and save a safety for a perfectly timed
                Slingshot. The rulebook is included.
              </p>
            </details>
            <details>
              <summary>Do we need a phone or an app?</summary>
              <p>
                No. The physical game is a complete tabletop card game for 2–4
                players. The free digital game is another way to play, and a way
                to try the race before your deck arrives.
              </p>
            </details>
            <details>
              <summary>What's in the box?</summary>
              <p>
                A 107-card poker-size deck with UV coating, an illustrated tuck
                box, and a rulebook. The deck includes the distance, hazard,
                remedy, and safety cards plus a card linking to the digital
                game.
              </p>
            </details>
            <details>
              <summary>When will my order ship?</summary>
              <p>
                {availability}. Choose a shipping service at checkout. We'll
                email tracking when your order ships. You can cancel for a full
                refund anytime before it ships.
              </p>
            </details>
          </div>
        </section>
      </main>
      <StoreFooter />
      <div className="store-mobile-order" hidden={offerVisible}>
        <span>
          First Edition<strong>${PRICE_LABEL}</strong>
        </span>
        <a className="shop__buy" href="#get-the-game">
          {soldOut ? 'View the game' : 'Get the game'}
        </a>
      </div>
      <Trailer open={watching} onClose={() => setWatching(false)} />
    </>
  )
}
