# Print pipeline — Space Race: 1000 Light-Years (First Edition)

Everything the physical game renders from. All output goes to `exports/`,
which is the exact file set uploaded to The Game Crafter.

## The product

- **TGC game**: "Space Race: 1000 Light-Years" (account `aarcher520`)
  https://www.thegamecrafter.com/make/games/AE2D3926-864B-11F1-B4CD-6383B6BFA688
- **Components**: Poker Deck (107 cards, UV coated) · Poker Tuck Box (108) ·
  Small Booklet (8 pages, saddle-stitched, rides inside the box)
- **First proof order**: 4 copies, ordered 2026-07-23, production ships ~Aug 12.

## Renderers (HTML → headless Chrome screenshot at exact TGC pixel specs)

| File | Output | Spec |
|---|---|---|
| `card-front.html?kind=<kind>&variant=noscrim` | `exports/cards/<kind>.png` | 825×1125 (poker w/ bleed) |
| `render-cards.sh` | all 19 faces | defaults to `noscrim` |
| `tuck-box.html` | `exports/tuck-box.png` | 3075×2250 (PokerTuckBox108 dieline) |
| `booklet-page.html?page=1..8` | `exports/booklet/rules-N.png` | 825×1125/page, count must be ×4 |
| `marketing-card-front.html` / `-back.html` | `exports/marketing-card-*.png` | 825×1125 |

Render one-off:
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=825,1125 --virtual-time-budget=10000 \
  --screenshot=out.png "file://$PWD/print/<file>.html?<params>"
```

Card back: `exports/card-back.png` is the ChatGPT-commissioned celestial frame
(`print/celestial-frame.png`) matted on sampled cream (see the python snippet in
git history / regenerate by fitting 660×990 art centered on 825×1125 cream).

## Key assets

- `celestial-frame.png` — deck back + marketing back frame (ChatGPT image gen)
- `marketing-front-art.png` — cards-zooming-up art (ChatGPT; also rulebook back page)
- `qr-play-online.png` — QR → https://game.spaceexplorer.tech (verify with
  cv2.QRCodeDetector after any re-render!)
- `app-store-badge.svg` — official Apple badge, use as-is
- `../artbin/s3-01-tuck-box-bg_v1.jpg` — box hero art (racing ships)
- `tgc-templates/` — TGC dieline templates + proofing overlay for the box

## Design decisions locked in this edition

- Card faces: full-bleed art, no gradient scrim, captions with heavy text
  shadow; distance cards numeral-only (no captions); no corner glyphs.
- Rules: light-years only, no points. Scry draw (top two, pick one), Slingshot
  (+200 ly, extra card), Tractor Beam = 50 ly/turn speed limit, safeties +100 ly.
- Title everywhere: "SPACE RACE" gold / "1000 LIGHT-YEARS" light grey (#e8e6df).
- Box: pictograms 2–4 players · ages 4+ · 15–30 min; "First Edition" on front;
  © 2026 Andrew Archer; no barcode (add GS1 UPC only if retail ever happens).
- A textless "collector" deck variant exists in the renderer
  (`variant=notext`) — duplicate the TGC game to make a second edition.

## When the proof copies arrive (QA)

- Colors vs screen (golds can darken in print), cut alignment on card captions
  near edges, booklet stitching + page order, box folds/fit with 107 cards,
  QR scans from print (booklet back page + marketing card), UV coating feel.

## Follow-ups

- iOS app still ships the old purple card back: `web/scripts/build-assets.sh`
  maps `card-back` → `s3-02-card-back-tile_v2.png`; switch to `_v1.jpg`
  (celestial frame) for app/print parity at next release.
- Party-favor plan extras (from `index.html` master timeline): supplies,
  tissue/twine wrap, playtest before the party.
