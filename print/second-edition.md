# Second Edition — prepared, not yet executed

Everything needed to stand up the Second Edition on The Game Crafter, staged
here so the actual TGC work is paste-and-upload.

> **Nothing has been changed on The Game Crafter.** The live First Edition
> listing is untouched. Do not run any of this until the two advanced modes have
> been playtested — if a playtest reshuffles the wording on rulebook pages 9–11,
> re-render first (`./render-booklet.sh 12`) so this is a single upload pass.

## What changes, and why a copy

The rulebook grows **8 → 12 pages** to carry the two Mille Bornes modes, which
also ship in the apps under *Settings ▸ Advanced play*. Cards, tuck box, and
rulebook pages 1–7 are all unchanged.

We take TGC's **Copy** path rather than editing the live game, because:

- TGC has one mutable game record — no versions, no revision history, no
  rollback. Editing components mutates the live, purchasable listing in place.
- `edition` is a free-text field, not a mechanism. Edit in place and the shop
  page keeps saying "Edition: First" until someone retypes it — meaning one
  listing would have shipped two different books.
- **Automatic Pricing is ON** (desired markup $5). Booklets are $0.20/page, so
  four more pages moves Cost Each ~$28.11 → ~$28.91 and the shop MSRP drifts off
  $34.99 by itself. On a fresh record that's just the launch price.
- The already-printed First Edition run is unaffected either way — TGC snapshots
  a game's contents at order time and never updates that snapshot.

The costs of the copy path, accepted knowingly: new shop URL, zero inherited
ratings/sales, and it **restarts the buy-before-publish gate** — order a copy of
the new game, then wait **10 days** before it can be published.

## Ready-to-paste field copy

Character limits measured live in the TGC editor on 2026-08-23.

| Field | Limit | Value |
|---|---|---|
| Name | — | `Space Race: 1000 Light-Years` |
| Edition | 30 | `Second` |
| Web Site | — | `https://game.spaceexplorer.tech` |
| Players / Play Time / Age | — | 2–4 · `<30` · `14+` *(carried over)* |

**Short Description** (100)

```
A Mille Bornes-style dash to 1,000 light-years. Dodge disaster, slingshot it back.
```

**Cool Factor 1** (60)

```
Slingshot a hazard back using the safety you were holding
```

**Cool Factor 2** (60)

```
Two advanced modes for an exact landing or ledger scoring
```

**Cool Factor 3** (60)

```
107 UV-coated cards, original art on every single one
```

**Description** (long body — currently EMPTY on the First Edition listing, which
is why it shows "Shop Page: Missing required fields")

```
Fire your ignition, out-run the void, and be the first to cross 1,000
light-years.

Space Race is a fast, mean, beautiful little card game in the Mille Bornes
tradition. Bank distance while your rival does the same — then drop an Asteroid
Strike, an Empty Tank, or a Black Hole on them and watch the lead evaporate.
They will do it right back to you.

The twist is the Slingshot. Get hit by a hazard while holding the very safety
that stops it, and you can slam it down on the spot: the attack is voided, you
take an extra turn, and you are permanently immune for the rest of the race.
It is the best feeling in the game and it never gets old.

ADVANCED PLAY — new in the Second Edition

Two optional modes, playable alone or together, that pull the game closer to the
classic that inspired it:

PRECISION APPROACH — Land on exactly 1,000. A jump that would overshoot cannot
be played at all, so hold your short hops back for the touchdown or sit at 950
with a fistful of hyperwarps.

NAVIGATOR'S LEDGER — Only distance cards move your ship. Safeties and Slingshots
bank points instead, tallied at the end against a full scoring table with
bonuses for a clean trip, a shutout, and more.

107 cards with original art on every face, UV coated, in a tuck box with an
illustrated rulebook. 2-4 players, 15-30 minutes, ages 14+.

Play it free in your browser or on iPhone first: game.spaceexplorer.tech
```

## Runbook (do not start until after playtest)

1. Re-render if any rulebook wording changed: `./render-booklet.sh 12`.
2. TGC → **Games → Edit → Manage → Copy**. Creates
   `Space Race: 1000 Light-Years (Copy)` as a new record with a new id.
3. Rename to `Space Race: 1000 Light-Years`; set **Edition** to `Second`.
4. Small Booklet component:
   - Re-upload `exports/booklet/rules-8.png` to the existing **page-8** — its
     content changed (it was the back cover; it now carries *Winning / Deck
     Spent / Ready For More*, and the QR + App Store badge moved to page 12).
   - **+ Add Page** ×4, upload `rules-9.png` … `rules-12.png` in order.
   - *Renumber Pages* if the ordering drifts. Count must stay a multiple of 4.
5. **Proof All** on the booklet. Every newly added page starts unproofed
   (`BookletPage.has_proofed_image` defaults to 0). TGC images booklet pages 4
   to a sheet for the saddle stitch, so a page-order mistake shows up *only*
   here — check the imposition, not just the individual pages.
6. Fill Shop Page / Marketing / Action Shots from the copy above. The First
   Edition listing never had these filled, so there is nothing to inherit.
7. Check the new Cost Each and MSRP before publishing.
8. Order a copy → wait out the 10-day publish gate → publish.
9. Decide what happens to the First Edition listing — leave it up as the
   8-page book, or unpublish it. **Open question, not decided.**

## Not verified

- Whether unproofed pages hard-block a *customer* purchase or only warn the
  designer. TGC's wording ("you will be shown system messages") is ambiguous and
  they never say checkout is prevented.
- Whether re-uploading an image to the already-proofed page-8 clears its proof
  flag. New pages clearly default to unproofed; re-upload behaviour is not
  documented. Assume it needs re-proofing and check.
- The exact new Cost Each. $0.20/page × 4 is TGC's published booklet rate, but
  the editor only recomputes the real number after the pages are actually added.

## Sources

- Game record has no version/revision/history; `edition` is a `varchar` —
  https://www.thegamecrafter.com/developer/Game.html
- Copy creates a new game; "a copy is a new game" —
  https://news.thegamecrafter.com/post/7605217242/the-buy-before-publish-requirement-faq
- Order-time snapshot, unaffected by later edits —
  https://help.thegamecrafter.com/article/110-will-my-order-include-changes-i-made-after-placing-the-order
- 10-day publish waiting period —
  https://help.thegamecrafter.com/article/60-publishing-waiting-period
- Automatic pricing follows component changes —
  https://help.thegamecrafter.com/article/45-automatic-pricing
- Booklet pricing and proofing —
  https://help.thegamecrafter.com/article/80-booklets
