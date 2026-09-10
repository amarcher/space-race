import { useRef, useState } from 'react'
import { CheckoutForm, useCheckoutForm } from '@stripe/react-stripe-js/checkout'
import type { StripeCheckoutFormChangeEvent, StripeCheckoutFormConfirmEvent, StripeCheckoutFormOptions } from '@stripe/stripe-js'
import { createShippingQuotes } from './shipping-quotes'

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

export function ShopCheckout({ onRetry }: { onRetry: () => void }) {
  const checkoutState = useCheckoutForm()
  const checkoutRef = useRef(checkoutState)
  checkoutRef.current = checkoutState
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
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

  const onChange = async (event: StripeCheckoutFormChangeEvent) => {
    const details = event.status.shippingAddress?.complete ? event.value.shippingAddress ?? null : null
    quotes.setAddress(details)
    if (details) await refreshShipping()
  }

  const onConfirm = async (event: StripeCheckoutFormConfirmEvent) => {
    if (checkoutState.type !== 'success') return
    setPaymentError(null)
    try {
      // Read the current form as well as change events, so an edit followed
      // immediately by Pay cannot reuse rates for the previous address.
      const form = await checkoutState.checkout.getForm()?.getValue()
      quotes.setAddress(form?.status.shippingAddress?.complete ? form.value.shippingAddress ?? null : null)
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

  return <>
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
