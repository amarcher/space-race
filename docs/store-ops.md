# Store ops — packing and shipping the physical game

**Purpose of this doc:** the day-to-day runbook for actually getting a paid
order into the mail. `docs/store-wayfinder.md` is the map (decisions, phases,
architecture); this is the part you do standing at a table with a stack of
boxes. Researched 2026-08-13 against USPS and Shippo primary sources — see
"Sources" at the bottom.

Nothing here has been done for real yet: as of writing, exactly one order
exists (a test one) and nothing has shipped. Expect to correct this doc the
first time you actually pack a parcel.

## The short version

1. Open `/shop/admin` (secret in Andrew's password manager) and look at the
   unfulfilled orders — they sort first.
2. For each: note the **Ship via** service and the address.
3. Pack it in the right packaging **for that service** (see below).
4. Buy and print the label from the order on Shippo's Orders page
   (`apps.goshippo.com/orders`) — every paid order is sent there automatically.
5. Mark it shipped in `/shop/admin` with the tracking number.

## Which packaging, and where it comes from

This is decided by the service the buyer picked and paid for, which is why
`/shop/admin` shows it. **A buyer who paid for Priority Mail Express has to
go out by Priority Mail Express** — you don't get to substitute the cheap one
and pocket the difference.

| Service they picked | Packaging | Cost |
|---|---|---|
| **USPS Ground Advantage** | **Your own.** USPS supplies nothing for this service. | ~$0.15–0.30/mailer in bulk |
| **USPS Priority Mail** | Free from USPS — order from the Postal Store, delivered free | $0 |
| **USPS Priority Mail Express** | Free from USPS, Express-branded | $0 |
| **UPS services** | Your own | as above |

**Ground Advantage is the one to stock for.** It's the cheapest option in the
list on essentially every address, so it's what most buyers will pick — and
it's exactly the one USPS gives you nothing for.

The game box measures **3.55" × 2.55" × 1.75"** at **8.1 oz** (measured on a
proof copy, 2026-08-12).

**Boxes are bought** — Uline order #57968922, 2026-09-16, 25 each of four
sizes, $60.49 landed for 100 ($0.6049/box, of which $20.38 is inbound
shipping, so unit cost falls on a bigger reorder). `parcelForQuantity()` in
`web/src/shop/constants.ts` maps order size to box:

| Copies | Box | Outside (in) | Empty box | Packed parcel |
|---|---|---|---|---|
| 1 | S-16725 (4×4×3) | 4⅜ × 4⅜ × 3⅝ | 1.6 oz | **10.25 oz** (weighed 2026-09-17) |
| 2 | S-4040 (4×4×4) | 4⅜ × 4⅜ × 4⅝ | 1.76 oz | 18.96 oz (still estimated) |
| 3 | S-4582 (6×4×3) | 6⅜ × 4⅜ × 3⅝ | 2.08 oz | **27.15 oz** (weighed 2026-09-17) |

"Packed parcel" is the whole thing on a scale — games, box, void fill and
tape — and is what goes on the label. Where it's measured it overrides the
old copies+box+extras estimate outright (`packedOz` in `constants.ts`).

A 3-copy order is **wider, not taller** — copies stand on their long edges
side by side, 3 × 1.75" = 5.25" across a 6" inside length. **S-22101** (4×4×4
lightweight, 32 ECT, 1.6 oz) was also bought to compare sturdiness against
S-4040; whichever wins becomes the 2-copy box, and they differ by 0.16 oz and
$0.09. Send carriers the **outside** dimensions — UPS bills the greater of
actual and dim weight (L×W×H÷139), so the outer size moves the quote by
itself.

> The 1- and 3-copy sizes have been test-packed and weighed — the 3-copy fit
> (copies on edge, side by side) is confirmed real, not just arithmetic. **The
> 2-copy box has not been packed yet**, so its weight is still the estimate
> and the S-4040 vs S-22101 choice is still open.

> **Trap: don't put a non-Flat-Rate shipment in a Flat Rate box.** USPS Flat
> Rate packaging must ship as Flat Rate. Our rates are weight-based, so use
> *plain* Priority Mail boxes, not the Flat Rate ones sitting next to them in
> the Postal Store.

## Labels

Buy them in the **Shippo dashboard** — the same account already integrated
into checkout.

- **The free Starter plan allows 30 labels/month.** September's early batch is
  only 10 sellable units, so it's comfortably free. **January is the risk**:
  ~95 orders shipping in one month would blow through 30 and need the Pro plan
  (~$19/mo) for that month. Plan for one month of Pro rather than being
  surprised.
- **Paid orders appear on Shippo's Orders page on their own** (since
  2026-09-16): the Stripe webhook creates each one with the address, the
  service the buyer paid for, and the estimated packed weight. Open it, correct
  the weight/dimensions to the real packed parcel, buy. Orders placed before
  then were added by hand. A failed send is only logged (`Shippo order creation
  failed` in Vercel logs), so if one is missing, create it in the dashboard.
- **A Shippo order carries no dimensions, and cannot be edited after
  creation.** Shippo's objects are disposable — only Carrier Accounts accept a
  `PUT` — so the weight the webhook sent is frozen at whatever the model said
  that day, and box size was never on the order at all. Both are therefore
  entered at label-buy time, which is why the **parcel templates** below exist.
- **Three parcel templates are saved in the account** (created 2026-09-17), one
  per order size: `1 copy - Uline S-16725`, `2 copies - Uline S-4040`,
  `3 copies - Uline S-4582`. Pick the matching one when buying and the outside
  dimensions fill themselves in. A template supplies dimensions only — Shippo
  still wants the weight separately, so **check the weight against the table
  above**, especially on orders created before the boxes were weighed.
- **Labels are still bought by hand** in the dashboard. The live token (which Shippo only issues on request — self-serve
  covers test keys only) is needed if we ever automate label purchase from
  `/shop/admin`. Today the store only *quotes* rates; **nothing in the code
  buys a label.**
- **Printing:** plain 8.5×11 paper (label prints in a quadrant — cut it out
  and tape it down) or a 4×6 thermal printer (Rollo/DYMO/Zebra, no ink,
  peel-and-stick). Paper and packing tape is genuinely fine for September's
  ten. A thermal printer (~$100–150) earns its keep if January ships in a
  batch.

## Things that will bite

### The rate goes stale between payment and shipment

The buyer pays a rate quoted **the day they order**; you buy the label months
later. Shippo rate objects expire in days, so at ship time you re-quote and
buy fresh — and the price may have moved.

**USPS rate changes have typically landed in January, which is exactly when
the main batch ships.** Those ~95 buyers have already paid, so any increase
comes out of margin. At the January batch's ~$8.16/unit net that's absorbable,
but it's real money across 95 units, and it's worth re-checking actual rates
before promising anything to anyone.

### A bigger order can ship cheaper than a small one — that's real

Quoted live 2026-09-17, both from Lexington MA by UPS Ground Saver:

| Parcel | → New York NY 10128 | → Los Gatos CA 95030 |
|---|---|---|
| 1 copy (10.25 oz) | $6.16 | $6.94 |
| 3 copies (27.15 oz) | **$5.71** | $8.78 |

Two things are going on, and neither is a bug:

1. **Zone dominates weight.** Lexington → NYC is a neighbouring zone;
   Lexington → the Bay Area crosses the country. A heavy nearby parcel beats
   a light far one, so *never compare two orders' shipping without checking
   where they're going.*
2. **UPS Ground Saver prices under 1 lb on a separate, ounce-based table**,
   and in near zones that table can come out *above* the 1 lb+ rate. Hence
   the genuinely odd $6.16 for one copy vs $5.71 for three to the same NYC
   address. A 1-copy order is 10.25 oz (under the break); 3 copies is 1.70 lb
   (over it).

So a single-copy order to a nearby address is the *worst* value per unit we
ship, and there is nothing to fix in the quote — those are live carrier rates.

### The packaging numbers are still partly estimates

Box weights are now real catalog figures rather than a guess, but what goes
*around* the game still isn't measured:

- `PACKING_EXTRAS_OZ = 1` in `web/src/shop/constants.ts` — tape, label and
  void fill, on top of the box's own weight. Unmeasured. It now only applies
  to the **2-copy** order, the one size without a scale reading; the other two
  use `packedOz` directly. It deliberately errs heavy: an understated parcel
  doesn't fail loudly, it gets delivered and billed back weeks later as a
  carrier adjustment, after the customer has paid a quote we can no longer
  revise. The two real weights came in *under* the estimate (10.25 vs 10.7,
  27.15 vs 27.38), so erring heavy is working as intended.
- The **$1.00/unit packaging cost** in the margin table in
  `docs/store-wayfinder.md` — the box alone is $0.6049 landed, so this is
  roughly right, but it's still carrying tape and filler as a guess.

**Weigh a packed 2-copy box** and correct both — it's the last size still
running on an estimate. Underdeclared weight means postage-due and carrier
adjustment fees.

### A slipped ship date is a legal obligation, not just bad manners

From the returns/refund research in `docs/store-wayfinder.md`: FTC's
Mail/Internet/Telephone Order Rule (16 CFR 435) requires proactively notifying
affected buyers **by the originally promised date** with a revised date, and
Massachusetts (940 CMR 3.15(3)(b)) treats a missed stated date as a 93A
violation unless genuinely beyond your control. If a batch slips, email
before the promised date — don't wait for people to ask. Handled manually;
no automation built.

## Reserves — don't sell these

Of the 118 units, **13 are never in the sellable pool**:

- **8 units** — Andrew's personal Christmas gifts, pulled off the September
  batch the moment it arrives.
- **5 units** — general defect/replacement reserve, for the "damaged or lost
  in transit → free replacement" policy.

Pull the 8 gift copies **on arrival**, physically, before the shelf becomes a
picking shelf. The inventory math (`SELLABLE_INVENTORY = 105`) already assumes
they're gone; the failure mode is a human shipping one by mistake.

## Links

- Admin/fulfillment view: `https://game.spaceexplorer.tech/shop/admin`
  (shared secret, in Andrew's password manager — not in this repo)
- Shippo dashboard: https://portal.goshippo.com/
- USPS Postal Store (free Priority/Express supplies):
  https://store.usps.com/store/results/free-shipping-supplies/shipping-supplies/_/N-alnx4jZ7d0v8v
- Orders database: Neon project `space-race-store` (`little-mud-75974419`)

## Sources

Checked 2026-08-13:

- [USPS — free shipping supplies](https://store.usps.com/store/results/free-shipping-supplies/shipping-supplies/_/N-alnx4jZ7d0v8v)
  and [Ordering Free Shipping Supplies](https://faq.usps.com/s/article/Ordering-Free-Shipping-Supplies)
  — free packaging is Priority Mail and Priority Mail Express only.
- [USPS Ground Advantage](https://www.usps.com/ship/ground-advantage.htm)
- [Shippo — subscription plan overview](https://support.goshippo.com/hc/en-us/articles/360003855652-Shippo-Subscription-Plan-Overview)
  — Starter (free) = 30 labels/month; Pro from ~$19/mo.
- [Shippo — printing labels](https://support.goshippo.com/hc/en-us/sections/200392905-Printing-Labels)
  — 8.5×11 plain paper and 4×6 thermal both supported.
