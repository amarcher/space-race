# Store wayfinder — selling the physical game

**Purpose of this doc:** the map for standing up "buy the physical game" on
the website. Read this first in any future session that touches the store.
Update the phase table and open decisions as work lands — this is the single
source of truth for where the project stands, not a one-time plan.

Companion docs: **`docs/store-ops.md`** — the day-to-day fulfillment runbook
(which packaging each service needs and who supplies it, buying/printing
labels in Shippo, the reserves not to sell, and the gotchas around stale rates
and estimated packaging weight). Written 2026-08-13; read it before packing
anything. `docs/store-legal.md` (policies/copy) still doesn't exist — the
policy decisions live in this doc for now.

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
- ~~**Price: $34.99.**~~ **Repriced to $28.79 on 2026-08-13** — see
  "Pricing" below. The original $34.99 pick (floor $30, ceiling $40, "sweet
  spot for a card game people will actually pay for") is superseded.
- **Box: 8.1 oz, 3.55" × 2.55" × 1.75"** (measured 2026-08-12 on one of the 4
  proof copies) — both weight and dimensions now confirmed, unblocking
  accurate Shippo rating. Comfortably under the 1 lb band most carriers price
  around — a single-copy order (copy + a light mailer) should land around
  9–9.5 oz, a 2-copy order around 17–18 oz (just over 1 lb, likely the next
  pricing tier), 3 copies around 25–26 oz. Volume is 15.85 in³ — at USPS's
  standard 166 dim-weight divisor that's under 2 oz of dimensional weight, so
  actual weight (8.1 oz) governs pricing on every carrier; DIM weight isn't a
  factor at this size.
- **Illustrative margin at $28.79** (pre-shipping, shipping is pass-through
  at live carrier cost so it shouldn't eat margin either way; blended cost
  weighted by the 10 early / 95 main sellable split, not the raw 18/100
  batch sizes, since the 8 gift + 5 general reserve units are never sold):
  | | Early batch | Main batch | Blended (105 sellable) |
  |---|---|---|---|
  | Price | $28.79 | $28.79 | $28.79 |
  | Cost | $30.00 | $18.50 | $19.60 |
  | Gross margin | **−$1.21 (−4%)** | $10.29 (36%) | $9.19/unit avg |
  | − Stripe fee (~2.9%+$0.30) | −$1.13 | −$1.13 | −$1.13 |
  | − packaging (mailer/tape/label, est.) | −$1.00 | −$1.00 | −$1.00 |
  | **Net illustrative margin** | **~−$3.34 (−12%)** | **~$8.16 (28%)** | **~$7.06/unit (25%)** |

  **The September batch sells at a loss** — a deliberate outcome of the
  pricing decision below, not an error. The January batch still carries
  healthy margin.

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

## Pricing (2026-08-13)

Repriced from $34.99 to **$28.79**. Andrew's reasoning: the game is also
buyable today as a one-off print-on-demand order directly from **The Game
Crafter** (the same manufacturer this print run comes from), and this store
shouldn't charge more than that unless it's offering something TGC isn't.
Speed was the candidate justification — TGC's own regular-production
estimate for a fresh single-copy order (checked 2026-08-13, shipped to the
137 Woburn St address) was **~32 days out (ship date 2026-09-14)** — but the
September batch here lands on essentially the same timeline (2026-09-10) and
the January batch is *slower*, months out. With no real speed edge on either
batch, charging a premium over TGC's own price "felt a little dishonest" —
Andrew's words — for a project whose near-term goal is disseminating the
game, not making money on it. **Decided: one price for everyone, not split
by ship window** — a single-tier price was simpler and matched the intent
better than engineering a two-price system to reward a speed advantage that,
on reflection, barely exists.

**The derivation** (TGC checkout screenshot, single item to the Lexington MA
address, 2026-08-13):

| | Amount |
|---|---|
| TGC item price | $28.22 |
| TGC "Taxes & Fees" (undocumented composition — see below) | $2.35 |
| TGC shipping (separately stated, excluded from this comparison) | $7.01 |
| TGC grand total | $37.58 |

`/research` (against help.thegamecrafter.com) confirmed TGC does collect
sales tax on US orders, but **could not find any public documentation
itemizing what "Taxes & Fees" actually contains** — no tax engine is named,
and TGC's published $0.89/copy "handling fee" appears to already be baked
into the item price rather than charged separately, per their bulk-pricing
docs. So the split below is Andrew's own estimate, not a sourced fact:
assume MA tax applies to the item price only (6.25% × $28.22 = **$1.76**,
consistent with the same shipping-is-separately-stated-and-exempt logic this
store already applies to itself under DOR Directive 98-5), leaving **$0.59**
as TGC's own non-tax fee. Added to the item price: $28.22 + $0.59 =
**$28.81** — what a unit "costs" apples-to-apples with TGC, before either
store's own tax/shipping is calculated at checkout. Andrew picked **$28.79**,
a few cents under that computed ceiling, to stay safely at-or-below TGC's
cost even given the estimation uncertainty in the tax/fee split (the
item+shipping tax-base alternative would put the fee at only $0.15, i.e. a
$28.37 ceiling — $28.79 sits between the two estimates, closer to the
higher one).

Implementation: `UNIT_PRICE_CENTS = 2879` in `web/src/shop/constants.ts`,
same single source of truth used by the checkout session, the confirmation
email, and all on-page copy — no other code changes needed.

## Sales tax (2026-08-13)

Decided: enable Stripe Tax, scoped to Massachusetts only.

- **Massachusetts nexus is certain** — Andrew operates from Lexington, MA, so
  physical-presence nexus applies regardless of volume. **Every other state
  is out of scope for now**: even selling the full 105-unit sellable pool at
  $34.99 is ~$3,675 in revenue, nowhere near any state's economic-nexus
  threshold (typically $100k / 200 transactions). Revisit only if volume or
  reach (e.g. Amazon/retail distribution) changes materially.
- **MA facts** (researched 2026-08-13, `/research` — Mass.gov and DOR primary
  sources): flat **6.25%** statewide, no local add-on. The card game is
  ordinary taxable tangible personal property — no applicable exemption.
  Shipping is **exempt** per **DOR Directive 98-5** as long as it's
  separately stated as its own line item and reflects actual delivery cost —
  which this checkout already does via live Shippo rates, so no design
  change needed there.
- **Implementation**: `automatic_tax: { enabled: true }` on the Checkout
  Session (`web/api/create-checkout-session.ts`), `tax_code: 'txcd_99999999'`
  (General – Tangible Goods) + `tax_behavior: 'exclusive'` on the product line
  item, and `tax_code: 'txcd_92010001'` (standard shipping) + `exclusive` on
  every shipping rate (both the placeholder in `create-checkout-session.ts`
  and the live Shippo-derived ones in `web/api/shipping-rates.ts`) so Stripe
  applies each state's real shipping-taxability rules rather than defaulting
  untaxed. Safe to ship live now — **Stripe Tax calculates $0 tax in any
  jurisdiction without an active registration**, so this doesn't start
  charging anyone until the next step happens.
- **Registration is the remaining blocker**, and it's sequenced behind the
  Fable Designer LLC's EIN (SS-4 faxed 2026-08-11, response expected
  ~2026-08-17/18 — see `/Users/archer/tax-strategy/wiki/entities/fable-designer-llc.md`).
  Neither Fable Designer LLC nor `storybook-studio` has an existing MA sales
  tax permit. Registering now under the current sole-proprietor Stripe
  account (SSN-based) would mean re-registering under the LLC's own EIN once
  it lands — MassTaxConnect treats that as a new registration, not an
  amendment. **So: wait for the EIN, register the LLC on MassTaxConnect
  (Andrew's own action — a state tax registration isn't something to
  automate), then add the resulting active MA registration to Stripe**
  (Dashboard → Settings → Tax → Registrations, or the Tax Registrations API).
  Blocks Phase 10 fully closing, but nothing else in the launch depends on it.

## Returns/refund policy (2026-08-13)

Resolved via `/grilling`, grounded in `/research` against FTC and Massachusetts
primary sources (16 CFR 435, 940 CMR 3.13/3.15). Andrew's recollection of a
Massachusetts default-refund-window statute was outdated — M.G.L. c. 93 §14
was repealed in 2003; the live rule (940 CMR 3.13(4)) has **no mandated
minimum return window**, only a requirement to clearly and conspicuously
disclose whatever policy is chosen, before the sale completes. Policy:

- **Defective, damaged-on-arrival, or lost in transit**: buyer's choice of a
  free replacement (from the general 5-unit reserve) or a full refund — no
  return shipping required. A $35 item isn't worth the handling cost of
  inspecting a returned defective copy before honoring the claim.
- **Buyer's remorse** (not defective): returnable within 30 days of delivery
  for a refund; buyer pays return shipping; original shipping charge is
  non-refundable. A no-returns policy would be legal (MA has no floor) but
  risks more in trust than the occasional return costs, for a first-time
  hobby brand's debut product.
- **Pre-order cancellation before shipment**: full refund, anytime, no
  questions asked — nothing's been consumed yet, and the existing
  `status != 'cancelled'` inventory accounting already handles this
  correctly with no code changes needed.
- **Ship-date slips are not just customer service — they're a legal
  obligation.** FTC's Mail/Internet/Telephone Order Rule (16 CFR 435)
  requires proactively notifying affected buyers by the originally promised
  date: a revised date (buyer can still cancel for a full refund anytime
  before shipment; silence counts as consent only if the new date is ≤30
  days later), or — if the delay exceeds 30 days past the original date or
  is indefinite — the order **auto-cancels and refunds** unless the buyer
  affirmatively reconfirms within 30 days. Massachusetts (940 CMR 3.15(3)(b))
  adds a sharper edge on top: missing a stated date is a 93A violation
  unless the cause was genuinely beyond Andrew's control and unknown at
  order time — treat the Sept/Jan dates as real commitments. Handled
  manually (email + a Stripe refund) given the order volume — no automation
  built. Worth carrying into the Phase 12/13 fulfillment runbook.
- **Disclosure placement**: a compact policy summary lives directly on the
  `/shop` product page (`web/src/shop/Shop.tsx`, below the buy button — see
  `.shop__policy`), not just in checkout fine print or a footer link, to
  satisfy 940 CMR 3.13(4)'s "clear and conspicuous... prior to consummation
  of a transaction" standard.

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
  new dedicated Resend account — `spaceexplorer.tech` **verified 2026-08-13**,
  sending confirmed live with a real send of the production template).
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
| 1 | Open accounts: Stripe, Shippo, Resend domain for `spaceexplorer.tech` | ✅ done (2026-08-12) — Stripe/Shippo/Resend keys and tokens all live in Vercel prod/preview/dev. Resend domain `spaceexplorer.tech` **verified 2026-08-13** and a real send of the production template returned 200 (see below). Shippo/Stripe **live** activation still needed before real launch — see Phase 13 |
| 2 | Weigh/measure an actual box → lock shipping weight/dims for Shippo | ✅ done (8.1 oz, 3.55"×2.55"×1.75", 2026-08-12) |
| 3 | Neon schema migration (`orders` table above) | ✅ done (2026-08-12) — project `space-race-store` (`little-mud-75974419`), `DATABASE_URL` added to Vercel prod/preview/dev |
| 4 | `web/shop.html` + product page UI (price, quantity, pre-order copy, ship-date messaging) | ✅ done (2026-08-12, real photos + gallery added 2026-08-13) — `web/public/shop/hero.jpg` (flat-lay: tuck box at an angle, rulebook, spread of illustrated cards) and `web/public/shop/box-closeup.jpg` (macro shot of the shrink-wrapped box) are real photos of the physical proof copies, cropped/color-corrected. Shown via a small click-to-swap thumbnail gallery (`GALLERY_IMAGES` in `web/src/shop/Shop.tsx`) — add more entries there as more product photos come in |
| 5 | `/api/create-checkout-session` + Embedded Checkout mounted on the shop page | ✅ code done (2026-08-12) — untested live, no Stripe key yet; verified against current Stripe docs (`ui_mode: 'embedded_page'`, Stripe SDK bumped 17→22.5.0 to match) |
| 6 | `/api/shipping-rates` (Shippo live rates via `onShippingDetailsChange`) | ✅ done and verified with real carrier rates (2026-08-12) — **no flat-rate fallback of any kind**, by design (see below). `FROM_ADDRESS` is the real 137 Woburn St, Lexington MA origin. Confirmed against Shippo's test API with a real address (1600 Pennsylvania Ave NW, DC): **USPS Ground Advantage $6.25, Priority Mail $9.22, Priority Mail Express $39.05** |
| 7 | `/api/stripe-webhook` → Neon insert + Resend confirmation email | ✅ code done (2026-08-12) — raw-body signature verification wired per Vercel's gotcha; `RESEND_API_KEY` live in Vercel, `orders@spaceexplorer.tech` domain added to Resend with DNS records in place, verification pending propagation (see below) |
| 8 | Inventory cap guard (118 minus reserves) + early/January ship-window split | ✅ done (2026-08-12, extended 2026-08-13) — `SELLABLE_INVENTORY = 118 - 5 - 8 = 105` and `EARLY_BATCH_SELLABLE = 10` in `web/src/shop/constants.ts`, checked server-side in `create-checkout-session.ts`; `ship_window` decided at session creation, persisted via webhook, surfaced live via `GET /api/inventory-status` and shown on the shop page |
| 9 | Policy copy: shipping policy, returns/refunds, pre-order disclaimer, sales-tax handling | ✅ done (2026-08-13) — shipping-policy and sales-tax-inclusive-pricing lines added to `.shop__policy` in `web/src/shop/Shop.tsx`, alongside the returns/refunds/cancellation copy already live. Tax line is worded to stay accurate regardless of MA registration status (see Phase 10) rather than asserting a specific rate |
| 10 | Sales tax decision + Stripe Tax enabled | 🟨 code done (2026-08-13) — `automatic_tax` + tax codes wired in `create-checkout-session.ts`/`shipping-rates.ts` (see "Sales tax" above); calculates $0 everywhere until the MA MassTaxConnect registration lands, blocked on the LLC's EIN (~2026-08-17/18) |
| 11 | End-to-end QA in Stripe test mode (real Shippo sandbox rates, webhook round-trip, email) | 🟨 backend verified with real Shippo rates (2026-08-12). A **real end-to-end checkout was completed 2026-08-13** by Andrew in the browser — that's what surfaced the dead-webhook-endpoint bug (see "three real bugs" below); the order is now recorded correctly in Neon. Resend sending confirmed the same day with a real send of the production template. **Left:** a fresh checkout that exercises webhook → insert → email in one pass (the existing order predates both the endpoint fix and the email work, and `on conflict do nothing` means replaying it won't re-send) |
| 12 | Admin/fulfillment view (`/shop/admin` or documented SQL runbook) | ✅ done (2026-08-13) — `/shop/admin` (`web/shop-admin.html` + `web/src/shop-admin/`), gated by a shared secret (`ADMIN_SECRET` env var, entered client-side, sent as `Authorization: Bearer` on every API call — see `web/api/_lib/adminAuth.ts`). `GET /api/admin/orders` lists all orders (unfulfilled first); `POST /api/admin/fulfill` sets `status = 'fulfilled'`, records tracking number, stamps `fulfilled_at`. `ADMIN_SECRET` added to Vercel prod/preview/dev (2026-08-13); value handed to Andrew once, not stored in this doc or the repo. Shows a **Ship via** column (service + amount paid) — the parcel must go out by the service the buyer paid for, so this is load-bearing for fulfillment, not decoration |
| 13 | Go live — request a Shippo live key (self-serve only covers test), flip Stripe to live mode, announce | ⬜ |
| 14 | Hub page (`/get`) linking web/iOS/Play/Amazon/shop | ✅ done (2026-08-13) — static `web/public/get.html`, rewritten at `/get` (`web/vercel.json`). Real links for Web and App Store (`id6788064058`); Google Play and Amazon Appstore show "Coming soon" — neither has a confirmed live listing yet (Play Console signup and the Amazon Kids child-profile step are both still open per `docs/android-roadmap.md` / `docs/amazon-appstore/listing.md`), so linking them would 404. Buy-the-game links to `/shop` |
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
send. **Verified 2026-08-13**, and a real send of the production confirmation
template through the send-only key returned 200 and **landed in the inbox, not
spam** — so the strict-DMARC worry below is resolved in practice, not just on
paper, carried by DKIM alignment (`aspf=s` means SPF
never aligns, since Resend bounces via `send.spaceexplorer.tech`; DKIM signs
`d=spaceexplorer.tech`, which matches the From domain exactly, and DMARC needs
only one to align). **Worth knowing:** the domain already carries a **strict DMARC
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

## 2026-08-13 — three real bugs found by using the thing

All three were invisible to `npm run build` and to the backend verification
above. Worth knowing before assuming "code compiles + API verified" means the
store works.

**1. Stripe was delivering webhooks to a dead preview URL.** A completed test
checkout never reached the database. The only registered
`checkout.session.completed` endpoint pointed at
`web-git-docs-store-wayfinder-…vercel.app` — the PR preview from the original
store branch, long since merged and deleted. Nothing pointed at production.
The event sat at `pending_webhooks: 1`, retrying into the void. **The earlier
"webhook verified" note above is what hid this:** that test built a signature
with `generateTestHeaderString()` and the configured secret, which proves the
*code* works but says nothing about whether Stripe's registered endpoint
matches. Fixed by registering
`https://game.spaceexplorer.tech/api/stripe-webhook`, rotating
`STRIPE_WEBHOOK_SECRET` in Vercel to that endpoint's signing secret,
redeploying (env vars are snapshotted at build time), and replaying the
pending event. **If orders ever stop appearing, check the endpoint list
first.**

Also noticed while in there: **two unrelated webhook endpoints on this same
Stripe account pointed at a Supabase project** and listened for
`payment_intent.succeeded` — so they received Space Race payment events,
carrying customer email and payment details into an unrelated project.
Identified as **`brewcredits`** (Supabase org `aces-up-labs`, project ref
`uxyphzjiyzyrimpudasb`), an abandoned side project of Andrew's — the Supabase
project reads *Unhealthy* with no backups and no repo connected, so those
deliveries had most likely been failing for months anyway. **Both endpoints
deleted 2026-08-13** with Andrew's go-ahead; the Supabase project, its
function, and the local Brew Credits checkout are untouched. This Stripe
account now has exactly one webhook endpoint, ours.

Worth remembering that this account was described as "genuinely dormant"
when it was repurposed — and it still had live webhook config from March.
**Dormant meant no revenue, not unconfigured.** If anything else surfaces
from that era, check for it rather than assuming a clean account.

**2. The service worker silently served the game instead of the page —
twice.** `navigateFallback: '/index.html'` catches any navigation that doesn't
match a precached entry, and Workbox's URL matching is narrower than it looks:

- `/shop/admin` → never matched `shop-admin.html`. Workbox only bridges clean
  URLs by adding/removing `.html` on the *same* path, so `/shop` → `shop.html`
  works but a nested path → hyphenated file never does. Fixed with
  `navigateFallbackDenylist`.
- `/shop.html?session_id=…` (Stripe's post-payment return URL) → precache
  matching doesn't strip unknown query params; the default only removes
  `utm_*`/`fbclid`. So buyers landed in the **game** right after paying, with
  no confirmation. Fixed by adding `session_id` to
  `ignoreURLParametersMatching`.

Both only reproduce **once a service worker is installed and controlling** —
a first visit or a private window works fine, which is exactly why a wrong
`/store` URL and these two bugs all looked like the same vague "sometimes I
get the game" complaint. Verify service-worker behaviour on a *repeat* visit.

**3. Browser Back out of checkout showed "Access Denied."** Entering checkout
was a React state flip with no history entry, so Safari's bfcache restored the
page with `checkingOut` still true and re-mounted the Stripe iframe against a
consumed session. Fixed by pushing a history entry (popstate exits) and
bailing out of checkout on a persisted `pageshow`.

**Also changed that day:** checkout now shows every distinct delivery speed
rather than the 3 cheapest (Stripe caps `shipping_options` at 5 — verified
against the API; Shippo quotes 11+ for a typical address, and the cheapest 3
were all ground, leaving no way to buy overnight at any price); the
confirmation email is itemized and uses a branded dark template
(`web/api/_lib/orderEmail.ts`); and the shop hero is the full flat-lay
(EXIF orientation 6 — honour the EXIF and add *no* rotation, or the distance
cards read sideways).

## Open decisions (need a call before or during the phase that hits them)

- ~~**Per-order quantity cap**~~ — resolved by implementation: capped at 3
  (`MAX_QTY_PER_ORDER` in `web/src/shop/constants.ts`). Easy to change before
  launch if that feels wrong.
- ~~**Inventory reserve**~~ — resolved by implementation: 5 units held back
  generally, another 8 held back as gifts (see below), 105 sellable
  (`INVENTORY_RESERVE` / `SELLABLE_INVENTORY`, same file). Same — easy to tune.
- ~~**Early-batch fulfillment**~~ — resolved 2026-08-13, see "Early-batch
  fulfillment & gift reserve" above: two-pass, 10 sellable from the September
  batch (8 held back as gifts), whole orders never split across windows.
- **International shipping** — defaulted to **US-only** for now
  (`ALLOWED_SHIP_COUNTRIES` in `web/src/shop/constants.ts`, a one-line
  change to expand). Shippo/Stripe both support international, but customs
  paperwork and duties-at-checkout are extra complexity (buyer typically pays
  duties on delivery, not at checkout, unless DDP rates are enabled) — left
  out of the v1 build rather than decided against permanently.
- ~~**Sales tax**~~ — resolved 2026-08-13, see "Sales tax" below: Stripe Tax
  enabled in code, scoped to Massachusetts; actual collection is blocked on
  registering with MassTaxConnect once the LLC's EIN lands.
- ~~**Returns/refund policy**~~ — resolved 2026-08-13, see "Returns/refund
  policy" below: cancel-anytime pre-shipment, no-return-needed
  replacement/refund for defects/loss, 30-day buyer's-remorse window, FTC-
  compliant delay notices. Copy live on the shop page.
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
  verified 2026-08-13
- Live shop URL: `https://game.spaceexplorer.tech/shop` — merged and deployed
  2026-08-12 (PR #147)
