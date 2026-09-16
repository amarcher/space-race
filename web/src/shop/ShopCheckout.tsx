import { useEffect, useRef, useState } from 'react'
import { CheckoutForm, useCheckoutForm } from '@stripe/react-stripe-js/checkout'
import type { StripeCheckoutFormConfirmEvent, StripeCheckoutFormOptions } from '@stripe/stripe-js'
import { createShippingQuotes, type ShippingDetails } from './shipping-quotes'

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
    }
  }

  // The change event's own payload has proven unreliable as the sole trigger:
  // production quoted an edited address exactly once, where a live edit should
  // have re-quoted on every complete keystroke, leaving the previous address's
  // rates on screen. getForm().getValue() is the same authoritative read that
  // onConfirm already trusts, so both paths now ask the form, not the event.
  const readShippingAddress = async (): Promise<ShippingDetails | null> => {
    const state = checkoutRef.current
    if (state.type !== 'success') return null
    const form = await state.checkout.getForm()?.getValue()
    return form?.status.shippingAddress?.complete ? form.value.shippingAddress ?? null : null
  }

  // Every keystroke in an already-valid address line ("350 Fifth Ave" →
  // "351 Fifth Ave") produces a complete-but-different address, and quoting
  // each one is a Shippo round trip per character. Wait for the address to
  // stop changing instead. setAddress above still runs immediately, so the
  // stale rate stops being displayed and Pay stays blocked during the wait.
  const scheduleRefresh = () => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(() => { void refreshShipping() }, QUOTE_DEBOUNCE_MS)
  }

  const onChange = async () => {
    const details = await readShippingAddress()
    quotes.setAddress(details)
    setHasAddress(details !== null)
    if (details) scheduleRefresh()
    else if (quoteTimer.current) clearTimeout(quoteTimer.current)
  }

  const onConfirm = async (event: StripeCheckoutFormConfirmEvent) => {
    if (checkoutState.type !== 'success') return
    setPaymentError(null)
    // Pay beats the debounce: quote now rather than racing a queued timer.
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
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
  const shippingReady = quotes.ready() && !updating

  return <>
    <section className="checkout-prices" aria-label="Order summary">
      {checkout.lineItems.map((item) => (
        <div className="checkout-prices__row" key={item.id}>
          <span>{item.name}<small>{item.quantity} {item.quantity === 1 ? 'copy' : 'copies'}</small></span>
          <strong>{item.total.amount}</strong>
        </div>
      ))}
      <div className="checkout-prices__row">
        <span>Shipping</span>
        <strong>{shippingReady ? checkout.total.shippingRate.amount : hasAddress ? 'Calculating…' : 'Calculated below'}</strong>
      </div>
      <div className="checkout-prices__row checkout-prices__total">
        <span>{shippingReady && checkout.tax.status === 'ready' ? 'Total' : 'Total so far'}</span>
        <strong>{checkout.total.total.amount}</strong>
      </div>
      {!hasAddress && (
        // Stripe treats the recipient name as part of the shipping address, so
        // no rate can be quoted until it is filled. Say so, rather than leaving
        // the customer to guess why the shipping line has no price.
        <p className="checkout-prices__hint">
          Enter your name and shipping address below to see shipping options.
        </p>
      )}
    </section>
    {updating && <p role="status">Calculating shipping…</p>}
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
