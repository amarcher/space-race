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
