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
        // Matches the storefront: warm off-black, lamp gold, Inter. The form
        // renders in Stripe's frame, so the font is loaded by URL (the font
        // files are served with Access-Control-Allow-Origin: *).
        fonts: [400, 600].map((weight) => ({
          family: 'Inter',
          src: `url(${window.location.origin}/fonts/inter-${weight}.woff2)`,
          weight: String(weight),
        })),
        appearance: {
          theme: 'night',
          variables: {
            fontFamily: 'Inter, system-ui, sans-serif',
            colorPrimary: '#ffd23f',
            accessibleColorOnColorPrimary: '#1a1205',
            colorBackground: '#15100c',
            colorText: '#f7efe3',
            colorTextSecondary: '#bfae98',
            colorTextPlaceholder: '#8c7d6a',
            colorDanger: '#ff9c86',
            colorIcon: '#bfae98',
            borderRadius: '12px',
            inputColorBorder: 'rgba(255, 214, 120, 0.18)',
            inputFocusColorBorder: '#ffd23f',
            inputFocusBoxShadow: '0 0 0 3px rgba(255, 210, 63, 0.22)',
            focusBoxShadow: '0 0 0 3px rgba(255, 210, 63, 0.3)',
            buttonColorBackground: '#ffd23f',
            buttonColorText: '#1a1205',
            buttonFontWeight: '700',
          },
        },
      }}
    >
      <ShopCheckout onRetry={onRetry} />
    </CheckoutFormProvider>
  )
}
