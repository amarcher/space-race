import { CURRENCY, META_CATALOG_CONTENT_ID, PRODUCT_NAME, UNIT_PRICE_CENTS } from './constants'

// GA4 ecommerce events for the storefront. gtag is injected by shop.html and is
// absent in the native Android ships and for anyone blocking it, so every call
// here is a no-op when it is missing. Values are merchandise only: shipping and
// tax are settled inside Stripe and never reach this page.

type Gtag = (...args: unknown[]) => void

const QTY_KEY = 'shop:checkout-qty'
const SENT_KEY = 'shop:purchase-sent'

function send(event: string, params: Record<string, unknown>) {
  const gtag = (window as { gtag?: Gtag }).gtag
  if (typeof gtag === 'function') gtag('event', event, params)
}

function cart(quantity: number) {
  return {
    currency: CURRENCY.toUpperCase(),
    value: (UNIT_PRICE_CENTS * quantity) / 100,
    items: [
      {
        item_id: META_CATALOG_CONTENT_ID,
        item_name: PRODUCT_NAME,
        price: UNIT_PRICE_CENTS / 100,
        quantity,
      },
    ],
  }
}

export function trackBeginCheckout(quantity: number) {
  try {
    sessionStorage.setItem(QTY_KEY, String(quantity))
  } catch {
    /* The purchase event falls back to one copy. */
  }
  send('begin_checkout', cart(quantity))
}

// Called on the confirmation page. The Stripe session id stays out of GA4: only
// its tail is used, as the transaction id GA4 de-duplicates on. A reload of the
// confirmation page must not report a second order.
export function trackPurchase(sessionId: string) {
  const transactionId = sessionId.slice(-12)
  let quantity = 1
  try {
    if (sessionStorage.getItem(SENT_KEY) === transactionId) return
    sessionStorage.setItem(SENT_KEY, transactionId)
    quantity = Math.max(1, Math.trunc(Number(sessionStorage.getItem(QTY_KEY))) || 1)
  } catch {
    /* Storage blocked: report once per page load with the default quantity. */
  }
  send('purchase', { transaction_id: transactionId, ...cart(quantity) })
}

// Which control a visitor used. content_type and content_id are built-in GA4
// dimensions, so these report without registering a custom one.
export function trackCta(id: string) {
  send('select_content', { content_type: 'shop_cta', content_id: id })
}

// GA4 only reports a scroll at 90% of the page, which here is the order panel,
// so a visitor who leaves at the hero looks the same as one who read most of
// the story. Report the earlier depths too, measured the way GA4 measures its
// own: by how far down the page the bottom of the viewport has been.
const DEPTHS = [10, 25, 50, 75]

export function trackScrollDepth(page: HTMLElement) {
  let next = 0
  let queued = false
  const measure = () => {
    queued = false
    // Hidden behind checkout, the document is the checkout view's height.
    if (page.hidden) return
    const seen = ((scrollY + innerHeight) / document.documentElement.scrollHeight) * 100
    while (next < DEPTHS.length && seen >= DEPTHS[next]) send('scroll', { percent_scrolled: DEPTHS[next++] })
    if (next === DEPTHS.length) removeEventListener('scroll', onScroll)
  }
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(measure)
  }
  addEventListener('scroll', onScroll, { passive: true })
}
