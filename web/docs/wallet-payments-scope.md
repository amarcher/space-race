# Scope: Apple Pay / Google Pay on the shop

Written 2026-09-15. Question asked: can we offer more payment methods than card
and Cash App Pay?

## Two different problems

Splitting these up front, because one is a settings change and one is a
migration.

| Want | Where it lives | Effort |
|---|---|---|
| Turn **Cash App Pay** off | Stripe Dashboard → Payment methods | minutes |
| Turn **PayPal** on | Stripe Dashboard → Payment methods | minutes |
| **Apple Pay / Google Pay / Link** | Code — see below | days |

Cash App Pay is not in our code at all. It appears because it is enabled in the
Dashboard, and it can be turned off there. PayPal should be the same: it is a
redirect method that appears in the payment-method list, and Stripe passes it
the shipping address our form already collected, so our Shippo quote still
governs. *Verify on a preview before trusting that last point.*

Apple Pay and Google Pay are different in kind, and the rest of this document
is about them.

## Why they are switched off today

`web/src/shop/ShopCheckout.tsx` disables every wallet:

```ts
expressCheckout: {
  paymentMethods: {
    applePay: 'never', googlePay: 'never', link: 'never',
    amazonPay: 'never', paypal: 'never', klarna: 'never',
  },
},
```

The reason is that a wallet collects the shipping address inside its own sheet,
not in our form, so none of our address handling runs. The binding constraint
is in the SDK's own type definitions:

- `@stripe/stripe-js/dist/stripe-js/elements/payment-form.d.ts` — the
  **Checkout Form** (`ui_mode: 'form'`, what we use) emits `ready`, `change`,
  `confirm`, `cancel`, `focus`, `blur`, `escape`, `loaderror`, `loaderstart`.
  There is **no shipping-address event**.
- `.../elements/express-checkout.d.ts` — the standalone **Express Checkout
  Element** emits `shippingaddresschange` and `shippingratechange`, each with
  `resolve()` / `reject()`.

So in our current integration there is no hook at which to quote a wallet
buyer's address. Enabling the wallets as-is would let someone pay with whatever
`shipping_options` happened to be on the session — which, since #214 removed the
placeholder, is *none*. That is a silent $0-shipping order, and the store's
standing rule is no invented shipping prices ever (`api/shipping-rates.ts`).

## What it would take

Migrate the shop from `ui_mode: 'form'` to `ui_mode: 'elements'`, and compose
the page from a standalone Express Checkout Element plus an Address Element and
a Payment Element. That is the only configuration where the wallet shipping
callbacks exist.

This is a reversal of #202, which moved us *to* the Checkout Form. Worth reading
that PR before starting — whatever motivated it still applies.

Work items:

1. Swap the Checkout Form for ECE + Address Element + Payment Element, and
   re-do the layout and styling around them.
2. Wire `shippingaddresschange` → `/api/shipping-rates` → `resolve({shippingRates})`,
   and `reject()` when we cannot ship there. Stripe gives this handler a short
   deadline, so the existing Shippo timeout budget needs re-checking.
3. Wire `shippingratechange` so picking a different rate updates the total.
4. Keep the non-wallet path working — it is the majority of orders and it
   currently works. This is the main regression risk.
5. Re-test tax: `automatic_tax` needs the address to reach the session the same
   way it does now, or MA sales tax silently stops being collected.

### The partial-address constraint

The wallet hands us less than the form does. From `express-checkout.d.ts`:

```ts
export type ExpressCheckoutPartialAddress = {
  city: string; state: string; postal_code: string; country: string;
};
```

No `line1` — the wallets withhold the street until the buyer authorises the
payment, for privacy. Consequences:

- `quotableAddress()` in `src/shop/shipping-quotes.ts` requires `line1` and
  would reject every wallet address. It needs a second, looser mode.
- `/api/shipping-rates` sends `street1: address.line1` to Shippo. **Verified
  2026-09-15 against the live Shippo API: quoting from city/state/ZIP alone
  returns rates identical to the cent.** Three destinations (New York NY 10001,
  San Francisco CA 94103, Boston MA 02108), 11 rates each, street line present
  vs. omitted, every amount matching — e.g. SF USPS Ground Advantage $6.95 and
  UPS Ground $10.00 either way. As expected: carrier retail rates are zone-based,
  origin-ZIP to destination-ZIP, and the street line does not enter the pricing.
  **This was the question that could have killed the project. It doesn't.**
- Shippo returns a warning on the nameless request — `Attribute
  "address_to.name" must not be empty.` — but quotes anyway. Harmless for
  rating; a real name *is* needed to buy the label, which happens after the
  buyer authorises and the full details arrive.
- The full address arrives only in the confirm event, so the rate shown in the
  wallet sheet is quoted before we know the street. Given the result above that
  is not an estimate at all — the street would not have changed the price — so
  there is nothing to reconcile at confirm time.

## Recommendation

Do the Dashboard changes now — Cash App Pay off, PayPal on — and treat the
wallets as a separate project, not a follow-up commit.

The go/no-go question — can Shippo quote without a street line — is **answered
yes**, so the migration is viable whenever it is worth the time. It is a real
project, not a follow-up commit: the main cost is re-testing the card path,
which is the majority of orders and currently works.

Sequencing note: land #214 first. Re-testing a checkout migration on top of
unverified shipping fixes would make it impossible to tell which layer broke.
