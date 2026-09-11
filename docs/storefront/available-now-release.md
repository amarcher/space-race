# Available-now storefront release — September 11, 2026

The user approved shipping the immersive store and confirmed that the card game
is available now. Purchase buttons, checkout summaries, FAQs, and new-order
emails now describe an order, with tracking sent when it ships.

## Fulfillment and stock

New Stripe sessions use `ship_window=in_stock`. Old early/January sessions and
orders retain their original fulfillment promises. The migration in
`web/migrations/20260911-in-stock-orders.sql` widens the database constraint and
must be applied before this application is deployed. It changes no order rows.

The on-hand sales cap remains the ten previously allocated September copies
(18 less eight gifts). The other 95 sellable copies are held out until receipt
is confirmed. Inventory and checkout both count old early and new in-stock
orders against this pool and preserve the overall reserve. Existing pending
sessions and concurrent payment inventory reservations are unchanged.

Stripe remains in its existing TEST mode. No payment, order email, shipping
label purchase, or fulfillment action was submitted during verification.

## Film editing receipt

Original v11 source: https://d2ol7oe51mr4n9.cloudfront.net/user_3DJZHPWadiWvqmgkNAUYZ9knRyh/9d1a4ea8-2aa6-4e1f-a67f-d50107e76cc0.mp4

Available-now derivative: https://d2ol7oe51mr4n9.cloudfront.net/user_3DJZHPWadiWvqmgkNAUYZ9knRyh/048ff9f8-750e-4c3f-bc47-a11d4f674927.mp4

SHA-256: `7a6384ba25320038a77033eeab5c2a6692e192da2f3a2d6e7cb8f3016429c519`

Used the Higgsfield media sandbox to replace the closing card's availability
text with “Available now.” Re-rendered the final 165 frames from the same
moving shuttle source and original overlay, changing only that text region.
The first 547 video frames and entire audio packet stream are byte-identical
to v11. Full-file decode passed. No generative model or new music was used.
`available-now-ending.jpg` is the visually reviewed frame at 27 seconds.
The original campaign assets remain unchanged. Existing Scott Buckley credit,
CC BY 4.0 links, and music edit disclosure remain in the film dialog.

## Local validation

Production build, API typecheck, and all ten shipping, cache, receipt, and
inventory tests pass. Browser and deployment verification are recorded in the PR.
