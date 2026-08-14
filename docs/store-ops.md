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
4. Buy and print the label in the Shippo dashboard.
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
proof copy, 2026-08-12). For a single copy that suits a **6×9 bubble mailer**
or a small **6×4×2 box**. Multi-copy orders stack in the same footprint —
`parcelForQuantity()` in `web/src/shop/constants.ts` models height scaling
with quantity, so a 3-copy order is ~5.25" tall.

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
- **No live API token needed for this.** Labels are bought by hand in the
  dashboard. The live token (which Shippo only issues on request — self-serve
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

### The packaging numbers are estimates

Two constants are currently guesses, both in `web/src/shop/constants.ts`:

- `PACKAGING_OVERHEAD_OZ = 1` — feeds the weight sent to Shippo for **live
  rate quotes at checkout**. If the real mailer is heavier, every quote is
  low, and the carrier bills the difference back as an adjustment.
- The **$1.00/unit packaging cost** in the margin table in
  `docs/store-wayfinder.md`.

**Weigh a real mailer with a real copy in it as soon as the mailers arrive,**
and correct both. Underdeclared weight means postage-due and carrier
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
