# Scope: Apple Pay / Google Pay on the shop

Written 2026-09-15. Question asked: can we offer more payment methods than card
and Cash App Pay?

## What the Dashboard actually says

Read 2026-09-17 from both live accounts. An earlier draft of this file claimed
Cash App Pay could be switched off and PayPal switched on in "minutes". The
second half was wrong, and the framing was misleading.

| | Space Race (`acct_1OPdcR…`) | Fable Designer (`acct_1Tsoob…`) |
|---|---|---|
| Enabled | 6 | 13 |
| Cards | enabled | enabled |
| Apple Pay | **enabled** | **enabled** |
| Google Pay | *requires action* | disabled |
| Link | enabled | enabled |
| Cash App Pay | enabled | enabled |
| Bancontact, EPS | enabled | enabled |
| Amazon Pay, Klarna, Affirm, MB WAY, Satispay, BLIK, Pix | not enabled | enabled |

Three things follow:

- **PayPal is in neither list**, out of ~40 methods. It is not a toggle. It
  presumably sits behind "Manual integration options", i.e. integration work.
- **Apple Pay is already enabled account-side on both.** The shop does not
  offer it because `ShopCheckout.tsx` sets `applePay: 'never'`. No Dashboard
  change would have surfaced it, and none is needed for the migration below.
- **Google Pay is enabled on neither**, and shows "requires action" on Space
  Race — something must be accepted before it can even be turned on.

### Why the two accounts cannot simply be made to match

Fable Designer is a superset, so "make them the same" reads as enabling its
seven extras on Space Race. That is the wrong direction for a store shipping
physical goods: those extras either supply their own shipping address (Amazon
Pay) or can surface as an express button that bypasses the address form
(Klarna, Affirm) — the same failure this document is about, a checkout that
completes without our Shippo quote ever running. The rest (MB WAY, Satispay,
BLIK, Pix) are Portugal, Italy, Poland and Brazil methods on a
US-shipping-only store.

Fable sells digital books and collects no shipping address, so it carries those
methods safely. **The accounts differ because the businesses differ.** Aligning
them only becomes meaningful once Space Race can quote shipping from a wallet
address — the migration below. Sequence it that way round.

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
