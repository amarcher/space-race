# Checkout failure and repair — September 10, 2026

## Confirmed cause

The production request at 13:33:09 EDT failed in `create-checkout-session`.
Stripe rejected `permissions.update_shipping_details` for Embedded Checkout.
The browser consequently received no client secret and displayed the generic
“Something went wrong” panel. Reproduced against the live shop at 13:35 EDT.

Production deployment: `dpl_DQNAU2wjDdVfuEzVeRYhPZVkny9m`.
Original Stripe request: `req_5rN2VldqwbfCO9`.
The browser and Stripe request logs both confirm TEST mode.
An older API version (`2025-03-31.basil`) returned the same rejection.

## Repair

- Use Stripe's supported Checkout Form (`ui_mode: form`) and remove the rejected permissions parameter.
- Upgrade only `@stripe/react-stripe-js` (3.10.0 → 6.9.0) and `@stripe/stripe-js` (5.10.0 → 9.16.0), with user approval. Other installed package versions remain unchanged.
- Have the form collect the address, then update carrier rates through `runServerUpdate`. The server updates shipping options only.
- Serialize quote requests and allow payment confirmation only after a successful quote for the current complete address. Failed or stale quotes cannot authorize payment in the shop UI.
- Display recoverable startup and shipping errors, with separate retry controls and bounded network waits.
- Disable express wallet buttons: Stripe documents that they bypass the dynamic shipping flow. Standard payment methods remain available in the form.

References: [Checkout Form quickstart](https://docs.stripe.com/checkout/form/quickstart),
[dynamic shipping with Checkout Form](https://docs.stripe.com/payments/checkout/custom-shipping-options?payment-ui=checkout-form).

## Verification

- Frontend TypeScript and production build: passed.
- API TypeScript check: passed.
- Six automated shipping tests: passed. Cover duplicate events, concurrent address changes, failed quotes and explicit retry, incomplete addresses, switching back to a previous address, and recovery from a stale request's failure.
- Real Chrome browser against the modified local shop: form loads using a real Stripe TEST session.
- Local verification substitutes inventory counts only; it uses the actual modified checkout/shipping handlers, Stripe TEST API, and the existing local Shippo quote token.
- Public example destination in New York: five carrier rates appeared; USPS Ground Advantage cost $6.17, and the total correctly became $34.96 for a $28.79 game.
- Simulated shipping API failure: visible error and Retry shipping control; retry recovered the carrier quotes while retaining the address.
- Simulated session API failure: visible startup error and Try again control; retry requested a fresh session and reopened checkout.
- Browser Back returned to the product page.
- No payment was submitted or completed. A decline-only card was entered for an additional browser check, but that check stopped at Stripe's agent/Link authentication flow. Payment completion, webhooks, confirmation email, and fulfillment are not newly verified by this repair.

## Release state at the initial handoff

Prepared on `codex/fix-shop-checkout` in an isolated worktree. Not pushed,
merged, or deployed. Production remains unchanged and in Stripe TEST mode.
Publishing the fix does not activate live payments. Hosted preview and live
shop verification remain release steps after approval.
