import { useEffect, useRef, useState } from 'react'
import { CheckoutForm, useCheckoutForm } from '@stripe/react-stripe-js/checkout'
import type { StripeCheckoutFormChangeEvent, StripeCheckoutFormConfirmEvent, StripeCheckoutFormOptions } from '@stripe/stripe-js'
import { createShippingQuotes, quotableAddress, type ShippingDetails } from './shipping-quotes'

// Wallets collect addresses outside the form and bypass its shipping updates.
// Stripe's dynamic-shipping guide requires the regular form for this flow.
const FORM_OPTIONS: StripeCheckoutFormOptions = {
  layout: 'expanded',
  expressCheckout: {
    paymentMethods: {
      applePay: 'never', googlePay: 'never', link: 'never',
      amazonPay: 'never', paypal: 'never', klarna: 'never',
    },
  },
}

// Long enough to swallow typing, short enough that a customer who finishes the
// address and reaches for Pay sees the rate rather than a blocked button.
const QUOTE_DEBOUNCE_MS = 600

export function ShopCheckout({ onRetry }: { onRetry: () => void }) {
  const checkoutState = useCheckoutForm()
  const checkoutRef = useRef(checkoutState)
  checkoutRef.current = checkoutState
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [hasAddress, setHasAddress] = useState(false)
  const [quotePending, setQuotePending] = useState(false)
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }, [])
  const [quotes] = useState(() => createShippingQuotes(async (shippingDetails) => {
    const state = checkoutRef.current
    if (state.type !== 'success') throw new Error('Checkout is still loading. Please try again.')
    const result = await state.checkout.runServerUpdate(async () => {
      const response = await fetch('/api/shipping-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_session_id: state.checkout.id, shipping_details: shippingDetails }),
        signal: AbortSignal.timeout(19000),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.type !== 'object' || body.value?.succeeded !== true) {
        throw new Error(body?.message ?? 'Could not calculate shipping right now. Please try again.')
      }
      return body
    })
    if (result.type === 'error') throw new Error(result.error.message)
  }))

  const refreshShipping = async (retry = false) => {
    setUpdating(true)
    try {
      await quotes.refresh(retry)
      if (quotes.ready()) setShippingError(null)
    } catch (error) {
      setShippingError(error instanceof Error ? error.message : 'Could not calculate shipping. Please try again.')
    } finally {
      setUpdating(false)
      setQuotePending(false)
    }
  }

  // Confirm-time only. getValue() validates the whole form as a side effect —
  // calling it from the change handler renders every shipping and card field
  // in an error state on a pristine form, before the buyer has typed anything.
  const readShippingAddress = async (): Promise<ShippingDetails | null> => {
    const state = checkoutRef.current
    if (state.type !== 'success') return null
    const form = await state.checkout.getForm()?.getValue()
    return quotableAddress(form?.value.shippingAddress)
  }

  // Every keystroke in an already-valid address line ("350 Fifth Ave" →
  // "351 Fifth Ave") produces a complete-but-different address, and quoting
  // each one is a Shippo round trip per character. Wait for the address to
  // stop changing instead. setAddress above still runs immediately, so the
  // stale rate stops being displayed and Pay stays blocked during the wait.
  const scheduleRefresh = () => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    // Show the pending state from the keystroke, not from the request: the
    // debounce window is otherwise dead air in which the old rate still reads
    // as though it applies to the address now on screen.
    if (!quotes.ready()) setQuotePending(true)
    quoteTimer.current = setTimeout(() => { void refreshShipping() }, QUOTE_DEBOUNCE_MS)
  }

  const cancelScheduledRefresh = () => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = null
    setQuotePending(false)
  }

  // Read the event's own payload, never getValue() — see above. The event is
  // the only non-validating source of the address while the buyer is typing.
  const onChange = (event: StripeCheckoutFormChangeEvent) => {
    const details = quotableAddress(event.value.shippingAddress)
    quotes.setAddress(details)
    setHasAddress(details !== null)
    if (details) scheduleRefresh()
    else cancelScheduledRefresh()
  }

  const onConfirm = async (event: StripeCheckoutFormConfirmEvent) => {
    if (checkoutState.type !== 'success') return
    setPaymentError(null)
    // Pay beats the debounce: quote now rather than racing a queued timer.
    cancelScheduledRefresh()
    try {
      // Read the current form as well as change events, so an edit followed
      // immediately by Pay cannot reuse rates for the previous address.
      quotes.setAddress(await readShippingAddress())
      if (!quotes.ready()) {
        setPaymentError('Please finish your shipping address and wait for shipping to update before paying.')
        await refreshShipping(true)
        return
      }
      const result = await checkoutState.checkout.confirm({ formConfirmEvent: event })
      if (result.type === 'error') setPaymentError(result.error.message)
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment could not be completed. Please try again.')
    }
  }

  if (checkoutState.type === 'error') {
    return <div role="alert">
      <p className="shop__error">Checkout could not load right now. Please try again.</p>
      <button className="shop__buy" onClick={onRetry}>Try again</button>
    </div>
  }
  if (checkoutState.type === 'loading') return <p role="status">Loading secure payment form…</p>

  const { checkout } = checkoutState
  const quoting = updating || quotePending
  const shippingReady = quotes.ready() && !quoting

  return <>
    <section className="checkout-prices" aria-label="Order summary">
      {checkout.lineItems.map((item) => (
        <div className="checkout-prices__row" key={item.id}>
          <span className="checkout-prices__item">
            <span className="checkout-prices__boxes" aria-hidden="true">
              {Array.from({ length: Math.min(item.quantity, 3) }, (_, i) => (
                <img key={i} src="/shop/scroll/box-front.webp" alt="" width="757" height="1057" />
              ))}
            </span>
            <span>{item.name}<small>{item.quantity} {item.quantity === 1 ? 'copy' : 'copies'}</small></span>
          </span>
          <strong>{item.total.amount}</strong>
        </div>
      ))}
      <div className="checkout-prices__row">
        <span>Shipping</span>
        {/* No $0 placeholder option exists any more, so until rates arrive and
            one is selected there may be no shippingRate at all. */}
        <strong>{shippingReady && checkout.total.shippingRate
          ? checkout.total.shippingRate.amount
          : quoting || hasAddress ? 'Calculating…' : 'Calculated below'}</strong>
      </div>
      <div className="checkout-prices__row checkout-prices__total">
        <span>{shippingReady && checkout.tax.status === 'ready' ? 'Total' : 'Total so far'}</span>
        <strong>{checkout.total.total.amount}</strong>
      </div>
      {!hasAddress && (
        <p className="checkout-prices__hint">
          Enter your shipping address below to see shipping options.
        </p>
      )}
    </section>
    {quoting && <p className="checkout-quoting" role="status">Calculating shipping…</p>}
    {shippingError && <div role="alert">
      <p className="shop__error">{shippingError}</p>
      <button className="shop__back" disabled={updating} onClick={() => refreshShipping(true)}>Retry shipping</button>
    </div>}
    {paymentError && <p className="shop__error" role="alert">{paymentError}</p>}
    <div className="shop__checkout-form">
      <CheckoutForm options={FORM_OPTIONS} onChange={onChange} onConfirm={onConfirm} />
    </div>
  </>
}
