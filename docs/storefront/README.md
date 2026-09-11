# Immersive storefront review

Branch: `codex/immersive-storefront`.

Local review URL: http://localhost:5192/shop.html

## What changed

- Authentic printed-card hero using existing Unbounded and Inter typography.
- On-demand portrait player for the latest v11 Rainbows campaign film.
- An interactive Black Hole / Rescue Shuttle Slingshot: 400 → 600 light-years,
  with optional escape footage from the digital game and a link to play.
- Physical-product photography, contents, quantity, price, pre-order timing,
  returns, and FAQ. A mobile purchase bar hides while the offer is visible.
- A branded checkout summary around the existing repaired Stripe Checkout Form.
  Stripe loads on checkout entry; film and escape videos load on request.
- Sold-out handling, remaining-stock quantity cap, quantity-aware ship estimate,
  and honest unknown-inventory copy. Price and availability remain server-owned.
- Browser Back and returning from payment retain the existing spent-session
  protection. Returning from checkout restores quantity, scroll, and focus.

## Validation on September 10, 2026

- Production build and API TypeScript check passed.
- All seven existing shipping/cache regression tests passed.
- Browser layouts inspected at 1280, 768, 390, and 320 pixels. No horizontal
  overflow or broken loaded images. Real product gallery and FAQ verified.
- Campaign video played to completion: 29.667969 seconds, readyState 4,
  no media error. Escape video reached ended at 8 seconds without an error.
- Escape closes both video dialogs, removes the video, and restores focus.
- Real Stripe TEST checkout loaded in the new layout. Two copies = $57.58.
  Public New York example destination returned five services; USPS Ground
  Advantage at $5.83 gave $63.41 total. No payment was submitted.
- Browser Back restored the selected quantity and focused the pre-order button.
- Local-only fixture checks verified: three copies with only two early copies
  remaining show January; a zero remainder disables checkout; a one-copy
  remainder restricts quantity; failed inventory shows no invented ship date.
- Simulated startup failure displayed a recoverable error. Removing that fault
  and clicking Try again loaded a real Stripe TEST form for the same quantity.
- Fixtures were removed after verification. The review server defaults to the
  real public inventory and existing API endpoints, with a Stripe TEST check.

Payment completion, webhooks, emails, and fulfillment were not tested in this
UI change. No production deployment, live-mode change, new dependencies, or
new image/video generation was performed.

## Media provenance

The campaign source is `marketing/campaigns/2026-09-child-slingshot/latest-review.json`
in the primary workspace, which currently selects `space-race-release-v11-rainbows.mp4`.
The original remains unchanged and is streamed from its existing hosted URL.
The player includes the campaign’s Scott Buckley / CC BY 4.0 music credit,
source and license links, and the excerpt-edit disclosure.
The copied poster is `release-cover-v11.jpg` from that same campaign.
The three storefront JPEGs are resized format conversions of the real printed
exports (`exports/cards/{black-hole,rescue-shuttle,warp-100}.png`), not new art.
The game escape clip is the existing `rescue-shuttle.vs-black-hole.slingshot.mp4`.

The campaign receipt still calls for final music-mix review and records launch
holds. Using the video here for local review does not clear those release gates.
The configured September 10 ship estimate is retained from the existing store;
confirm fulfillment timing before a production release.

## Reopen the local preview

Use existing dependencies. No installation is needed in this worktree.

```sh
SPACE_RACE_ENV_DIR=/Users/archer/Programs/space-race/web node docs/storefront/preview.mjs
```

The optional environment-directory setting reads only VITE-prefixed values and
requires the existing publishable key to be a TEST key. The server binds only
to loopback. It never confirms payments. `preview-state.local` is a temporary
local QA fixture file and must not be committed or left in place for review.

```sh
npm --prefix web run build
cd web
node --test tests/shop-shipping.test.ts tests/shop-service-worker.test.mjs
./node_modules/.bin/tsc -p api/tsconfig.json --noEmit
```
