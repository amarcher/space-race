import { loadStripe } from '@stripe/stripe-js'
import { CheckoutFormProvider } from '@stripe/react-stripe-js/checkout'
import { ShopCheckout } from './ShopCheckout'

// Loaded only when a buyer enters checkout, keeping Stripe off the storefront.
const stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function CheckoutPanel({
  clientSecret,
  onRetry,
}: {
  clientSecret: string
  onRetry: () => void
}) {
  return (
    <CheckoutFormProvider
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#26365c',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
          },
        },
      }}
    >
      <ShopCheckout onRetry={onRetry} />
    </CheckoutFormProvider>
  )
}
