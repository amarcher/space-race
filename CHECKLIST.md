# 11-day build · checklist

Check off as you go. Duplicate the Figma file at end of each day as `dayN-eod` — cheap insurance.

---

## Phase A · Scaffolding (3 days · ~6 hrs)

### Day 0 · File setup (30 min)
- [ ] Figma file created with correct name
- [ ] All 11 pages named
- [ ] Mobile link saved

### Day 1 · Design tokens (2–3 hrs) · Page `01 Tokens`
- [ ] 7 color styles: `cosmos/void`, `cosmos/nebula`, `cosmos/plasma`, `ember/core`, `signal/tech`, `light/halo`, `light/ghost`
- [ ] 7 text styles: `display/xxl`, `display/l`, `display/m`, `display/s`, `body/m`, `caption/mono`, `subtitle/italic`
- [ ] 6 effect styles: `effect/angelic-halo`, `effect/star-glow`, `effect/cosmic-vignette`, `effect/tech-sheen`, `effect/card-shadow`, `effect/safe-mask`
- [ ] Swatches visible on the page
- [ ] Duplicate file as `day1-eod`

### Day 2 · Master card component (2–3 hrs) · Page `02 Components`
- [ ] `Card/Master` frame at 825×1125px
- [ ] Bleed / trim / safe guides on `.guides` layer (non-printing)
- [ ] Stripe, header row, corners, art-well, title, subtitle, mirrored footer
- [ ] All layers linked to token styles (no raw hex)
- [ ] 4 variants: `Type = Distance | Hazard | Remedy | Safety`
- [ ] 6 properties: Title, Subtitle, Value, SubCode, Art (instance-swap), Show Halo (boolean)
- [ ] All variants tested by switching
- [ ] Duplicate file as `day2-eod`

---

## Phase B · Cards (3 days · ~5–8 hrs)

### Day 3 · 19 card frames + text (2 hrs) · Page `03 Card Fronts`
- [ ] 19 frames created, one per unique card (see `manifest.csv`)
- [ ] `Card/Master` instance dropped into each
- [ ] Variant set per card type
- [ ] Title, Subtitle, Value, SubCode filled from manifest
- [ ] Art slots empty
- [ ] Arranged in 5×4 grid for review
- [ ] Duplicate file as `day3-eod`

### Day 4 · Nano Banana Session 1 · Cosmic (2–3 hrs)
- [ ] Black Hole anchor done (done tomorrow morning if you ran Move 2)
- [ ] Anchor uploaded back into chat as reference
- [ ] Prompts 02–15 run in order (see `prompts/session-1-cosmic.md`)
- [ ] Winners saved to `artbin/` named `s1-NN-subject_vN.png`
- [ ] Palette re-anchored every 3–4 prompts
- [ ] Duplicate file as `day4-eod`

### Day 5 · Placement pass 1 (1–2 hrs) · Page `08 Art Bin` + `03 Card Fronts`
- [ ] All 15 cosmic PNGs dropped into Art Bin
- [ ] Each renamed to match card name
- [ ] Instance-swap on `[art]` for each cosmic card
- [ ] All 15 cards visually reviewed side-by-side
- [ ] Flagged cards regenerated
- [ ] Duplicate file as `day5-eod`

---

## Phase C · Auxiliaries (3 days · ~4–6 hrs)

### Day 6 · Nano Banana Sessions 2 + 3 (1–2 hrs)
- [ ] **Fresh chat** · Rescue Shuttle anchor + 3 safeties (see `prompts/session-2-angelic.md`)
- [ ] **Fresh chat** · 3 auxiliary backgrounds (see `prompts/session-3-auxiliary.md`)
- [ ] 7 winners saved to `artbin/`
- [ ] Duplicate file as `day6-eod`

### Day 7 · Placement pass 2 + deck review (1 hr)
- [ ] Safety arts swapped into the 4 safety instances
- [ ] Angelic-vs-cosmic contrast confirmed (safeties visibly pop)
- [ ] Full 19-card deck reviewed for drift
- [ ] Image Palette plugin run on all cards
- [ ] Duplicate file as `day7-eod`

### Day 8 · Card back + tuck box + Milo card (2–3 hrs)
- [ ] Page `04 Card Back` · cosmic tile base + gold medallion + rocket + `· EST 2026 ·` line
- [ ] Page `05 Tuck Box` · dieline with 6 panels, cosmic BG on front, description on back, no QR
- [ ] Page `05a Milo Card` · 2.5″×3.5″ card with QR placeholder, "Milo reads the rules" text
- [ ] Duplicate file as `day8-eod`

---

## Phase D · Export + order (3 days · ~3–4 hrs)

### Day 9 · Rules insert + polish (1–2 hrs) · Page `06 Rules Insert`
- [ ] Folded card layout (8″×6″ open → folds to 4″×6″)
- [ ] Neutral third-person rules text (no "Hi I'm Milo")
- [ ] Typography polish pass across whole file
- [ ] Clean Document plugin run
- [ ] Font Finder plugin run
- [ ] Duplicate file as `day9-eod`

### Day 10 · Export PDFs (1 hr) · Page `07 Print Exports`
- [ ] Export-destination frames set up
- [ ] Each frame's export config: PDF, bleed marks on, CMYK, 300dpi, 1×
- [ ] Batch Exporter plugin installed
- [ ] All PDFs exported to `exports/`
- [ ] Each PDF manually opened and verified
- [ ] Duplicate file as `day10-eod` · then as `v1.0 · LOCKED`

### Day 11 · Upload + proof order (30 min)
- [ ] Game Crafter: Poker Deck product created
- [ ] 19 card-front PDFs uploaded
- [ ] 1 card-back PDF uploaded
- [ ] 1 tuck-box PDF uploaded
- [ ] 1 rules-insert PDF uploaded
- [ ] 1 Milo-card PDF uploaded
- [ ] Settings: Linen Finish, rounded corners, tuck box, qty 1, standard US shipping
- [ ] E-proof reviewed
- [ ] Approved within 24h
- [ ] Calendar reminder set for proof arrival (~1 week out)

---

## After the build

See `index.html` → the Master Timeline section for everything that happens after the proof arrives (QA, playtest, video filming, final order, supplies, assembly, party day).
