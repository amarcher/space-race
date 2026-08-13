# Store wayfinder — selling the physical game

**Purpose of this doc:** the map for standing up "buy the physical game" on
the website. Read this first in any future session that touches the store.
Update the phase table and open decisions as work lands — this is the single
source of truth for where the project stands, not a one-time plan.

Companion docs once they exist: `docs/store-legal.md` (policies/copy),
`docs/store-ops.md` (day-to-day fulfillment runbook once orders start
flowing). Not created yet — see Phase 9/11.

## The facts on the ground

- **First print run exists and looks great** (photo confirmed 2026-08-12) —
  tuck box, 107-card poker deck, booklet, all landed as designed. This is the
  4-copy proof order from `print/README.md` (ordered 2026-07-23), delivered
  **2026-08-11 via UPS Ground** (tracking `1Z0999A30319856240`) — so 4
  physical copies are already in hand right now, not something to wait for.
  See `print/README.md` for the print pipeline; this doc is downstream of it.
- **Inventory, two batches, 118 units total:**
  | Batch | Qty | Arrives | Cost/unit | Total cost |
  |---|---|---|---|---|
  | Early | 18 | 2026-09-10 | ~$30.00 | $540 |
  | Main | 100 | 2027-01-10 | ~$18.50 | $1,850 |
  | **Combined** | **118** | — | **$20.25 blended** | **$2,390** |

  Of the 118, **8 units are reserved as Andrew's personal Christmas gifts**
  (carved from the September batch, pulled on arrival, never in the sellable
  pool) and **5 units are the general defect/replacement reserve** — both
  additive, since they serve different purposes. **Sellable total: 105**
  (`SELLABLE_INVENTORY` in `web/src/shop/constants.ts`). See "Early-batch
  fulfillment & gift reserve" below.
- **Price: $34.99.** Floor considered was $30, ceiling $40; user picked
  $34.99 as the sweet spot for a card game people will actually pay for.
- **Box: 8.1 oz, 3.55" × 2.55" × 1.75"** (measured 2026-08-12 on one of the 4
  proof copies) — both weight and dimensions now confirmed, unblocking
  accurate Shippo rating. Comfortably under the 1 lb band most carriers price
  around — a single-copy order (copy + a light mailer) should land around
  9–9.5 oz, a 2-copy order around 17–18 oz (just over 1 lb, likely the next
  pricing tier), 3 copies around 25–26 oz. Volume is 15.85 in³ — at USPS's
  standard 166 dim-weight divisor that's under 2 oz of dimensional weight, so
  actual weight (8.1 oz) governs pricing on every carrier; DIM weight isn't a
  factor at this size.
- **Illustrative margin** (pre-shipping, shipping is pass-through at live
  carrier cost so it shouldn't eat margin either way):
  | | Early batch | Main batch | Blended (118 sold) |
  |---|---|---|---|
  | Price | $34.99 | $34.99 | $34.99 |
  | Cost | $30.00 | $18.50 | $20.25 |
  | Gross margin | $4.99 (14%) | $16.49 (47%) | $14.74/unit avg |
  | − Stripe fee (~2.9%+$0.30) | −$1.32 | −$1.32 | −$1.32 |
  | − packaging (mailer/tape/label, est.) | −$1.00 | −$1.00 | −$1.00 |
  | **Net illustrative margin** | **~$2.67 (8%)** | **~$14.17 (40%)** | **~$12.42/unit (35%)** |

  Packaging cost estimate is firmer now that weight is known (8.1 oz single
  unit, a bubble mailer stays cheap at that weight) but still a placeholder
  until dimensions and an actual Shippo rate are in hand — see Open
  decisions. The early batch is basically break-even; treat it as a real
  fulfillment dry-run, not the profit driver. The January batch is where the
  margin is.

## Early-batch fulfillment & gift reserve (2026-08-13)

Resolved via `/grilling`. Two-pass fulfillment: ship the earliest paid orders
as soon as the September batch (18 units) lands 2026-09-10, rather than
holding every order for one clean January pass. The doc already framed the
September batch as "a real fulfillment dry-run, not the profit driver" — that
only pays off if it's actually used to ship real orders while volume is low
enough to be forgiving of mistakes. Early buyers also get rewarded visibly for
pre-ordering sight-unseen.

Andrew also wants **8 of the 18 September units held back as personal
Christmas gifts** — pulled off the shelf the moment the batch arrives,
independent of the paid-order shipping queue (they were never in the sellable
pool, so nothing about fulfilling paid orders blocks that). This reserve is
**additive** to the existing 5-unit general defect/replacement reserve, not a
replacement for it — different purposes, so both come off the top:

- September batch: 18 total − 8 gift reserve = **10 sellable** (`EARLY_BATCH_SELLABLE`)
- Combined pool: 118 − 5 general reserve − 8 gift reserve = **105 sellable** (`SELLABLE_INVENTORY`)

Implementation, since two-pass fulfillment plus the carve-out means a single
flat inventory number can no longer express when an order ships:

- `orders.ship_window` (`'early' | 'january'`) — decided once, at
  `create-checkout-session` time (stashed in the Stripe session's `metadata`
  so it can't drift between session creation and the webhook firing later),
  based on the running total of non-cancelled `early`-window quantity against
  the 10-unit cap.
- **No order splitting** — if an order's quantity would push the early-window
  running total past 10, the *whole* order ships in January, matching how
  Andrew's own print provider handles the same situation.
- `GET /api/inventory-status` — live `{ earlyRemaining, sellableRemaining,
  earlySoldOut }`, powering the shop page's live copy: "X of 10 early-ship
  spots left — ships around Sept 10," flipping to "Ships mid-January 2027"
  once early slots are gone. A genuine scarcity signal, not manufactured —
  there really are only 10 early slots — and it's the same query the
  inventory guard already runs.
- Confirmation email's ship-date line is tailored to the assigned
  `ship_window` rather than a single hardcoded date.

## Decisions locked (2026-08-12)

| Decision | Choice | Why |
|---|---|---|
| Payment | **Stripe** | Standard, PCI handled for us, works well with Vercel functions. |
| Checkout UI | **Embedded Checkout** (not hosted redirect) | Hosted Checkout *cannot* do dynamic/live shipping rates — confirmed against Stripe's own docs. Embedded Checkout's `onShippingDetailsChange` callback is the only path to real carrier rates inside Stripe Checkout. |
| Shipping rates | **Shippo**, live rates at checkout | Simpler onboarding than EasyPost for a solo hobbyist shipping one light product; EasyPost only wins on free-tier label volume, which doesn't matter here. Has its own "Shipping on Stripe" integration docs. |
| Launch timing | **Pre-order now, ship starting mid-January 2027** | Sell against the combined 118-unit pool immediately. First orders placed can plausibly ship earlier — the 18-unit Sept batch arrives first, so the earliest paid orders could go out ~mid/late September while the rest wait for January. Worth deciding whether to actually do first-come-first-shipped, or hold everything until January for one clean fulfillment pass (see Open decisions). |
| Order/fulfillment tracking | **Neon Postgres** `orders` table, webhook-populated, simple internal admin view | This session already has Neon + Resend MCP access, so orders land in Postgres via the Stripe webhook and a confirmation email goes out via Resend. |
| Business entity | **Fable Designer LLC** (Andrew's MA single-member LLC) | Decided 2026-08-12. Physical-goods fulfillment (inventory, shipping) is **not** a purpose mismatch — Fable Designer already plans to sell printed books, not just deliver digitally, per Andrew. **Still worth flagging:** `/Users/archer/tax-strategy/wiki/entities/fable-designer-llc.md` calls the QSBS-vs-pass-through classification fork the "highest-stakes open decision" in that project — Fable Designer may later convert to a C-corp to start the §1202 exclusion clock around `storybook-studio`'s software/IP, and bundling in an unrelated retail product line (a card game, distinct from the books business) is worth a mention to the tax attorney handling that fork, independent of the physical/digital question. The single-member operating agreement is also still undrafted — worth a broad purpose clause when that gets written. |
| Stripe account | **Separate account from `storybook-studio`'s**, same LLC | Decided 2026-08-12, revised from an earlier "reuse the same account" plan. `storybook-studio` already has a **live, revenue-bearing** Stripe account under Fable Designer (activated 2026-07 — see `/Users/archer/Programs/storybook-studio/BILLING-READINESS.md`). Converting an *existing* account's business type from individual → LLC triggers Stripe re-verification and, per Stripe's own guidance, **requires a valid EIN to even attempt** — and if verification fails or times out, charges/payouts on that account can be temporarily affected. Not a risk worth taking against someone else's live traffic. A second, dedicated Stripe account for Space Race is standard practice for a business with multiple product lines and carries zero risk to `storybook-studio`. **Resolved 2026-08-12:** Andrew had a pre-existing, genuinely dormant Stripe account ("New business," `acct_1OPdcRCdqO8xw407` — confirmed $0.00 gross volume, $0.00 balance, no payouts ever, business verification never completed) — repurposed that instead of registering a brand-new one. Andrew renamed it to "Space Race: 1000 Light Years" and completed business verification himself (identity, address, banking — an agent can't touch that). Started as **individual/sole proprietor**; upgrade to Fable Designer LLC once the EIN lands, which is low-risk on this account specifically since it'll still have no live traffic by then. |
| Resend account | **New, separate account** (`andrew.m.archer+spacerace@gmail.com`), not `fabledesigner.com`'s | Decided 2026-08-12. The existing Resend account (used for `storybook-studio`, domain `fabledesigner.com`) is on the **free plan, capped at 1 domain** — adding `spaceexplorer.tech` there would have required upgrading to Pro ($20/mo) just to unlock a second domain slot. A dedicated free account for Space Race avoids that cost and mirrors the Stripe separate-account reasoning (zero risk to Fable Designer's existing email setup). API key scoped to **Sending access** only (not full access) — least privilege, since this account only ever needs to send transactional emails. |

## Architecture

The game ships as a Vite/React SPA (web) **and** as native iOS/Android apps
via Capacitor (`web/capacitor.config.ts`). The store must be **web-only** —
no in-app purchase questions, no bloating the native bundle. Concretely:

- **New page, not a new view-state in `App.tsx`.** Add `web/shop.html` as a
  second Vite entry point (multi-page build, `rollupOptions.input`) with its
  own React root under `web/src/shop/`. Keeps checkout/Stripe JS entirely out
  of the game bundle that ships inside the iOS/Android apps.
  - Serve at a clean URL via a `vercel.json` rewrite: `/shop` → `/shop.html`.
  - Confirm `capacitor.config.ts`'s `webDir` / asset copy doesn't pull
    `shop.html` into native builds (harmless if it does, but confirm).
- **Backend: Vercel `/api` functions**, no framework migration needed —
  Vercel auto-detects a root `/api` directory alongside the static Vite
  build. Three routes:
  - `POST /api/create-checkout-session` — creates a Stripe Embedded Checkout
    session for `{ quantity }` (cap 1–3 per order, TBD), returns
    `client_secret`. Server-side price is the source of truth ($34.99), never
    trust a client-supplied amount.
  - `POST /api/shipping-rates` — Stripe's `onShippingDetailsChange` callback
    target. Receives the in-progress address, calls Shippo for live rates on
    the known box weight/dims, returns 2–3 `shipping_options` (e.g. cheapest +
    faster) back to the Checkout session.
  - `POST /api/stripe-webhook` — listens for `checkout.session.completed`.
    **Must** read the raw request body (`config.api.bodyParser = false`,
    manually buffer the stream) before calling
    `stripe.webhooks.constructEvent()` — Vercel's default JSON body parsing
    breaks signature verification. Writes the order into Neon, sends the
    confirmation email via Resend.
- **Database: Neon Postgres.** Minimal schema:
  ```sql
  create table orders (
    id                        uuid primary key default gen_random_uuid(),
    created_at                timestamptz not null default now(),
    stripe_checkout_session_id text not null unique,
    stripe_payment_intent_id  text,
    customer_email            text not null,
    customer_name             text,
    shipping_address          jsonb not null,
    quantity                  int not null,
    unit_price_cents          int not null,       -- snapshot, e.g. 3499
    shipping_cents            int not null,       -- actual Shippo rate charged
    shipping_service          text,               -- e.g. "USPS Ground Advantage"
    amount_total_cents        int not null,
    currency                  text not null default 'usd',
    status                    text not null default 'paid', -- paid | fulfilled | cancelled | refunded
    tracking_number           text,
    fulfilled_at              timestamptz,
    notes                     text,
    ship_window               text not null -- 'early' | 'january', see below
  );
  ```
  Inventory guard: before creating a checkout session, sum `quantity` across
  non-cancelled orders and reject/cap if it would exceed the sellable pool
  (105 = 118 minus a 5-unit general reserve minus an 8-unit gift reserve, all
  tunable constants in `web/src/shop/constants.ts` — see "Early-batch
  fulfillment & gift reserve" above). The same query also sums `early`-window
  quantity against the 10-unit September cap to decide the new order's
  `ship_window`. No separate inventory table needed at this scale.
- **Admin/fulfillment view:** start as direct SQL against Neon (via the Neon
  MCP tools already available in Claude Code sessions, or the Neon console)
  to list unfulfilled orders and mark them shipped + add tracking. A real
  `/shop/admin` page (basic-auth or shared-secret gated) is a nice-to-have,
  not a blocker for launch — see Phase 8.
- **Env vars needed** (names only): `STRIPE_SECRET_KEY`,
  `VITE_STRIPE_PUBLISHABLE_KEY` (client-exposed, `VITE_` prefix required for
  Vite to bundle it into the shop page), `STRIPE_WEBHOOK_SECRET`,
  `SHIPPO_API_TOKEN`, `RESEND_API_KEY`. **All done** — added to Vercel
  production/preview/development 2026-08-12 (test-mode values for
  Stripe/Shippo; `DATABASE_URL` points at the Neon project
  `space-race-store`; `RESEND_API_KEY` is a Sending-access-only key from the
  new dedicated Resend account — domain verification is still
  propagation-pending, so sending won't actually work until that clears).
  **Gotcha:** Vercel snapshots env vars at deploy time — a newly-added var
  doesn't apply to an already-built deployment until it's redeployed
  (`vercel redeploy <url>`, or just push a new commit).

## Cross-promotion: apps → physical game

Decision (2026-08-12): promote the physical game from inside the **iOS and
Android (Play)** apps via an **external link-out** to the shop page — not an
in-app purchase. **Exclude the Amazon Appstore build.**

- **Why link-out, not IAP:** Apple's and Google's in-app-purchase
  requirements only govern digital content/services consumed *inside* the
  app. A physical good shipped to the buyer's address (same category as the
  Amazon Shopping app, Etsy, Wayfair, Airbnb) has never required IAP or any
  special entitlement — you can link to an external checkout page with zero
  revenue share. This is long-standing, stable policy on both platforms, but
  **verify the current guideline text (App Store Review Guideline 3.1.3 /
  Play Billing policy) before submitting**, the same way this repo already
  double-checks every store's actual submission flow (see
  `docs/amazon-appstore/listing.md`'s "learned by driving the console" notes)
  rather than trusting memory.
  - Simplest implementation: a button that opens the shop URL in the system
    browser (there's already an external-link pattern to follow —
    `web/src/native/share.ts` — for consistency with how the app already
    hands off to native OS surfaces). Do **not** embed checkout in an in-app
    WebView; keep it unambiguous for review and simpler to build.
  - Existing store copy ("No in-app purchases") stays literally true — an
    external browser link isn't an IAP.
- **Why exclude Amazon:** that build was shipped 2026-08-06 specifically as
  an **analytics-free, child-directed (COPPA) certification** — "no ads, no
  in-app purchases, no accounts, and nothing is collected about you or your
  kids" (`docs/amazon-appstore/listing.md`). A kid reaches this build through
  an Amazon Kids child profile with no parental gate at the app level. Adding
  a path to a checkout/payment page — even external — cuts against that
  certification and the promise made to Amazon and to parents. Leave the
  Amazon build exactly as it is.
- **iOS/Android are not similarly locked:** both deliberately stayed *out*
  of Apple's Kids category and Google's Designed for Families program
  specifically to keep GA4 analytics (age rating "4+", not restricted) — see
  `docs/app-store/listing.md` and `docs/play-store/listing.md`. A physical-
  goods link-out doesn't conflict with either listing's current
  certification, but re-check both listings' copy/answers when this ships in
  case anything needs updating alongside it.

### The hub/landing page

Also decided: rather than link straight from the apps to `/shop`, build one
small **hub page** (e.g. `game.spaceexplorer.tech/get` or `/play-anywhere`)
that fans out to everywhere the game exists:

- Play free (web)
- App Store (iOS)
- Google Play (Android) — once live, hopefully by January 2027 alongside the
  physical launch (see `docs/android-roadmap.md` for ship status)
- Amazon Appstore
- **Buy the physical game** → `/shop`

This is the single link that the in-app promo buttons point to, and — per
the user's second-edition idea — a natural future home for a **QR code
printed on a v2 tuck box** (the textless "collector" deck variant already
noted as a future edition in `print/README.md`). One durable link that
outlives any single storefront's URL, rather than hard-coding a specific app
store URL into a printed physical product.

## Fulfillment alternatives & barcode/SKU (researched 2026-08-12)

The user asked whether Amazon fulfillment is worth using instead of/alongside
self-fulfillment, and whether a real product barcode/SKU is worth getting.
Verdict for now: **stay self-fulfilled, don't buy a barcode yet** — both
revisited below only if this takes off.

### Amazon FBA/FBM vs. self-fulfillment

- **Fee load is steep at this price point.** For a small/light item like this
  tuck box, 2026 FBA costs roughly: per-unit fulfillment fee **~$3.70–$4.10**
  (small-standard tier + the 3.5% fuel/logistics surcharge added April 2026)
  + **15% Toys & Games referral fee** (~$5.25 on $34.99, $0.30 min) ≈
  **$9.00–$9.35 total, ~26–27% of the sale** — before COGS or inbound
  freight to the fulfillment center. Against the January batch's $18.50 cost,
  that's roughly **$7/unit (~20%) net**, versus **~$14/unit (~40%)**
  self-fulfilled (Stripe fee + packaging only, per the margin table above).
  Self-fulfillment keeps roughly double the margin per unit at this scale.
- **No official Amazon minimum shipment size** and **storage cost is a
  non-issue** at this item's tiny volume (fractions of a cent/unit/month) —
  so the fee load, not any structural minimum, is what makes FBA a poor fit
  right now.
- **Barcode requirement bites here too:** Amazon now cross-checks listing
  GTINs against the GS1 registry and flags non-GS1 reseller codes. A GTIN
  exemption (Seller Central request + product photos) is a workaround for a
  self-published item like this, but adds listing friction.
  Commingled inventory ended March 2026, so every unit would also need an
  individual FNSKU sticker before shipping in — extra prep labor per copy.
- **Seller Fulfilled Prime** needs an existing delivery-speed track record —
  not attainable pre-launch, so it's not a near-term option. **Merchant-
  fulfilled on Amazon (FBM)**, i.e. list on Amazon but ship it yourself, is
  the actual middle ground if Amazon's marketplace traffic ever seems worth
  tapping without eating the FBA fee stack.
- **Recommendation:** launch self-fulfilled as already decided above. Revisit
  Amazon (FBA or FBM) only after the store's live and selling, and only if
  volume or Amazon-native demand looks likely to justify the fee load or the
  listing overhead — not for testing 118 units.

### Barcode / SKU (GS1 UPC)

- A real UPC is a GS1-issued GTIN tied to *your* registered GS1 Company
  Prefix, not just any 12-digit number — retail and Amazon both verify this
  against the GS1 registry now, and cheap third-party/reseller barcodes get
  flagged or suppressed.
- Cost is modest if it's ever needed: GS1 US's smallest tier (up to 10
  barcodes) is roughly **$250 upfront + $50/year**. `print/README.md`
  already anticipated this ("no barcode... add GS1 UPC only if retail ever
  happens") — that instinct holds up.
- **Recommendation:** don't buy one yet. A barcode with nothing retail or
  Amazon-listed under it doesn't do anything — cheap insurance, but only
  worth spending on once there's an actual retail shelf or Amazon listing to
  attach it to. Revisit alongside the Amazon decision above.

### Future / tangential (not in scope for this build)

The user flagged this as a tangent worth revisiting once the store exists:
broader marketing for the physical game (it "sells itself" but still needs a
push) — cross-promotion cadence, launch announcement, maybe eventually retail
distribution (see the GS1/barcode section above). Revisit with the
`marketing-plan` skill / `growth-marketer` agent once the store is live and
there's something to market.

## Phase table

| Phase | What | State |
|---|---|---|
| 0 | Plan + this doc | ✅ done (2026-08-12) |
| 1 | Open accounts: Stripe, Shippo, Resend domain for `spaceexplorer.tech` | ✅ done (2026-08-12) — Stripe/Shippo/Resend keys and tokens all live in Vercel prod/preview/dev. Resend domain verification is DNS-propagation-pending (see below). Shippo/Stripe **live** activation still needed before real launch — see Phase 13 |
| 2 | Weigh/measure an actual box → lock shipping weight/dims for Shippo | ✅ done (8.1 oz, 3.55"×2.55"×1.75", 2026-08-12) |
| 3 | Neon schema migration (`orders` table above) | ✅ done (2026-08-12) — project `space-race-store` (`little-mud-75974419`), `DATABASE_URL` added to Vercel prod/preview/dev |
| 4 | `web/shop.html` + product page UI (price, quantity, pre-order copy, ship-date messaging) | ✅ code done (2026-08-12) — placeholder hero image (`marketing-card-front.png`), needs real product photography before launch |
| 5 | `/api/create-checkout-session` + Embedded Checkout mounted on the shop page | ✅ code done (2026-08-12) — untested live, no Stripe key yet; verified against current Stripe docs (`ui_mode: 'embedded_page'`, Stripe SDK bumped 17→22.5.0 to match) |
| 6 | `/api/shipping-rates` (Shippo live rates via `onShippingDetailsChange`) | ✅ done and verified with real carrier rates (2026-08-12) — **no flat-rate fallback of any kind**, by design (see below). `FROM_ADDRESS` is the real 137 Woburn St, Lexington MA origin. Confirmed against Shippo's test API with a real address (1600 Pennsylvania Ave NW, DC): **USPS Ground Advantage $6.25, Priority Mail $9.22, Priority Mail Express $39.05** |
| 7 | `/api/stripe-webhook` → Neon insert + Resend confirmation email | ✅ code done (2026-08-12) — raw-body signature verification wired per Vercel's gotcha; `RESEND_API_KEY` live in Vercel, `orders@spaceexplorer.tech` domain added to Resend with DNS records in place, verification pending propagation (see below) |
| 8 | Inventory cap guard (118 minus reserves) + early/January ship-window split | ✅ done (2026-08-12, extended 2026-08-13) — `SELLABLE_INVENTORY = 118 - 5 - 8 = 105` and `EARLY_BATCH_SELLABLE = 10` in `web/src/shop/constants.ts`, checked server-side in `create-checkout-session.ts`; `ship_window` decided at session creation, persisted via webhook, surfaced live via `GET /api/inventory-status` and shown on the shop page |
| 9 | Policy copy: shipping policy, returns/refunds, pre-order disclaimer, sales-tax handling | ⬜ |
| 10 | Sales tax decision + (if yes) Stripe Tax enabled | ⬜ |
| 11 | End-to-end QA in Stripe test mode (real Shippo sandbox rates, webhook round-trip, email) | 🟨 backend verified with real Shippo rates (2026-08-12); UI click-through with a test card and a real send-and-receive email test (blocked on Resend DNS propagation) are what's left |
| 12 | Admin/fulfillment view (`/shop/admin` or documented SQL runbook) | ⬜ |
| 13 | Go live — request a Shippo live key (self-serve only covers test), flip Stripe to live mode, announce | ⬜ |
| 14 | Hub page (`/get`) linking web/iOS/Play/Amazon/shop | ⬜ |
| 15 | In-app link-out button, iOS + Android builds only (verify current IAP-exemption guideline text first) | ⬜ |

Code for phases 4–8 is written and type-checks clean (`npm run build` passes,
`web/api/*.ts` checked separately via `web/api/tsconfig.json`), and `/shop`
degrades gracefully with no Stripe key configured (shows "the store isn't
open yet" instead of crashing).

**2026-08-12 backend verification** (against the deployed PR preview, real
Stripe test mode, not curl-against-localhost): `create-checkout-session`
creates a real session; `shipping-rates` correctly quoted real live carrier
rates and updated the session via `sessions.update()`; `stripe-webhook` —
with a **genuinely valid signature**, built via
`Stripe.webhooks.generateTestHeaderString()` rather than bypassing
verification — inserted a correct row into Neon (right quantity, price,
shipping amount). Confirms the raw-body signature handling actually works,
not just that the code compiles. (A leftover synthetic-event test order was
deleted afterward with explicit confirmation, since deleting needs a
destructive SQL statement.)

**No flat-rate fallback, ever — confirmed by design, not just by accident.**
The first pass had the shipping-rates endpoint fall back to a flat $5.99
placeholder whenever `SHIPPO_API_TOKEN` was unset, so the flow was testable
before that account existed. Andrew flagged the real risk once Shippo was
live: a missing/revoked/misconfigured token would then silently *accept* a
made-up rate a customer could pay with, while every other Shippo failure
(401, network error, no rates) already correctly rejected. Fixed so every
failure mode throws and gets caught by the same reject path — verified live:
a real address still returns real rates, a garbage address now rejects
instead of fake-accepting. The principle for any future change here: a
rejected checkout is always better than a rate we didn't actually mean to
honor.

Three things learned along the way:
- **Vercel snapshots env vars at deploy time.** Adding a new env var to an
  already-built deployment doesn't take effect until it's redeployed
  (`vercel redeploy <url>`, or just push a new commit) — happened twice this
  session (`STRIPE_WEBHOOK_SECRET`, then `SHIPPO_API_TOKEN`).
- **Driving Stripe's actual payment iframe via browser-automation clicks
  didn't work** — coordinates landed, but keystrokes never reached the
  iframe's inputs, and the accessibility tree can't see into it at all
  (cross-origin). Reads as intentional hardening on Stripe's part, not a bug
  to route around. The backend verification above (real session + real
  signature + real Shippo rates, all driven via direct API calls) covers
  what actually matters — full UI click-through with a real test card is
  still open, but lower priority than it seemed before this session.
- **Shippo's onboarding "plan" picker** (Starter vs. Pro vs. API) is very
  likely just first-run dashboard personalization, not a different account
  tier — both free tiers list identical 30-labels/month limits and the same
  "best rates with top carriers" line. Picked **API** since the integration
  here is 100% programmatic; manual label-buying access during fulfillment
  isn't gated by that choice either way.

**2026-08-12 Resend domain setup:** `spaceexplorer.tech`'s DNS is on
**Cloudflare** (detected by Resend via nameserver lookup, confirmed logging
in). Added 3 records — `resend._domainkey` TXT (DKIM), `send` MX, `send` TXT
(SPF) — skipping the optional inbound-receiving MX since we only need to
send. Verification submitted, propagation-pending (Resend says it can take a
few hours). **Worth knowing:** the domain already carries a **strict DMARC
policy** (`p=reject; adkim=s`) and a hard-fail root SPF (`v=spf1 -all`) from
whatever set up `game.spaceexplorer.tech` originally — neither should
conflict with the new records (different DNS names: `send`/`resend._domainkey`
vs. root), and DKIM alignment should satisfy DMARC on its own since Resend
signs with `d=spaceexplorer.tech` matching the `From:` domain exactly. Should
still be **spot-checked once verified** — a strict DMARC policy is a classic
cause of "shows verified but emails don't actually arrive," and that failure
mode wouldn't be obvious from the Resend dashboard alone.

Phases 14–15 depend on 13 (shop must be live before anything can link to it)
but not on each other or on the Android Play launch — the hub page can ship
with a Play row that just says "coming soon" until Android roadmap Phase
whatever lands.

## Open decisions (need a call before or during the phase that hits them)

- ~~**Per-order quantity cap**~~ — resolved by implementation: capped at 3
  (`MAX_QTY_PER_ORDER` in `web/src/shop/constants.ts`). Easy to change before
  launch if that feels wrong.
- ~~**Inventory reserve**~~ — resolved by implementation: 5 units held back,
  113 sellable (`INVENTORY_RESERVE` / `SELLABLE_INVENTORY`, same file). Same —
  easy to tune.
- ~~**Early-batch fulfillment**~~ — resolved 2026-08-13, see "Early-batch
  fulfillment & gift reserve" above: two-pass, 10 sellable from the September
  batch (8 held back as gifts), whole orders never split across windows.
- **International shipping** — defaulted to **US-only** for now
  (`ALLOWED_SHIP_COUNTRIES` in `web/src/shop/constants.ts`, a one-line
  change to expand). Shippo/Stripe both support international, but customs
  paperwork and duties-at-checkout are extra complexity (buyer typically pays
  duties on delivery, not at checkout, unless DDP rates are enabled) — left
  out of the v1 build rather than decided against permanently.
- **Sales tax** — likely need to collect in your home state at minimum;
  Stripe Tax can automate this for a small per-transaction fee. Not decided.
- **Returns/refund policy** — needs actual copy before launch.
- **Amazon FBA/FBM + GS1 barcode** — researched and deliberately deferred
  (see the dedicated section above): fee load makes FBA a poor fit for 118
  units, and a UPC isn't worth buying until there's an actual retail/Amazon
  listing to attach it to. Not blocking this build; revisit only if the
  store takes off.

## Links

Fill in as each is created:
- Stripe dashboard: https://dashboard.stripe.com/acct_1OPdcRCdqO8xw407/dashboard
  — "Space Race: 1000 Light Years" (Fable Designer, individual for now — see
  "Decisions locked" above). Separate from `storybook-studio`'s live one.
- Shippo dashboard: https://portal.goshippo.com/activity/overview — test key
  live in Vercel; live key requires requesting one from Shippo's team
  (self-serve only covers test keys) before go-live
- Neon project: `space-race-store` (`little-mud-75974419`), console at
  https://console.neon.tech
- Resend dashboard: https://resend.com/domains — new dedicated account
  (`andrew.m.archer+spacerace@gmail.com`), separate from `fabledesigner.com`'s.
  `spaceexplorer.tech` domain added, DNS records in place, verification
  propagation-pending as of 2026-08-12
- Live shop URL: `https://game.spaceexplorer.tech/shop` — merged and deployed
  2026-08-12 (PR #147)
