# Session 3 · Auxiliary art · 3 backgrounds

**Chat-based tool (Gemini app):** ⚠ FRESH CHAT.

**Shot-based tool (Google Flow):** no fresh chat needed. Attach `s1-01-black-hole_v1.png` (the cosmic anchor) as the reference for all three prompts — we want the Bonestell cosmic palette, just quieter and without a dramatic subject.

Either way: these are the painterly cosmic backgrounds that replace CSS-gradient placeholders on the tuck box + card back. No subjects, no hero portraits — just atmosphere.

**Reference strategy:** upload the Session 1 Black Hole anchor as a style reference at the start (its palette + mood is what you want), but don't carry forward the dramatic lensing — these are quieter cosmic fields.

**Aspect ratio: 3:4 portrait** (same as card faces). Matches the 2.5×3.5 card and tuck-box shape closely and keeps all generations on the same ratio across sessions. **Do not use 1:1 for these.**

---

## Prompt 01 · Tuck Box Background (front panel)

Save as: `s3-01-tuck-box-bg_v1.png`

**Aspect ratio:** portrait (2.5:3.5 ish) — the tuck box front is taller than wide.

```
Painterly cosmic nebula panel in portrait orientation for a card game tuck box. Deep Void #06061A and Nebula #1A0933 base, with plasma-magenta #C879FF nebula drift upper-left and ember red #FF5E5B warm bloom lower-right. Scattered painterly starfield with varied star sizes — white, gold, and magenta dust. Central vertical band slightly darker to receive overlaid typography (wordmark + rocket illustration will sit here). Vintage space-opera book-cover aesthetic, Chesley Bonestell painterly style. No text, no logos, no geometric shapes, no UI, no subjects. Cinematic wide composition, subtle film grain. 300dpi, print-ready.
```

**Pick the variant where:**
- Central vertical band is clearly calmer/darker than edges (typography will sit there)
- Star field feels painterly, not dotted
- Palette holds to Void / Nebula / Plasma / Ember without drifting pink or teal
- No accidental subject (no planets, no ships, no faces in the nebula)

---

## Prompt 02 · Card Back Tile

Save as: `s3-02-card-back-tile_v1.png`

**Aspect ratio:** also portrait (2.5:3.5), since the card back is poker-size.

```
Painterly cosmic tile for the back of a card game card, portrait orientation. Deep Void #06061A and Nebula #1A0933 base, plasma-magenta #C879FF nebula upper-left, ember red #FF5E5B wisp lower-right. Painterly scattered starfield with white, gold, and magenta dust. Central circular region slightly darker to receive an overlaid gold medallion (~58px radius on a 200×280px canvas). Rotationally symmetric — should look the same held upside down. Vintage space-opera aesthetic, Chesley Bonestell painterly style. No text, no logos, no geometric shapes, no UI, no subjects. Subtle film grain. 300dpi.
```

**Pick the variant where:**
- Central medallion area is slightly recessed/darker than corners
- No rotational tells (no asymmetric elements that would give away card orientation to a cheater)
- Painterly starfield, not dotted
- No accidental subject

---

## Prompt 03 · Tuck Box Back Panel

Save as: `s3-03-tuck-box-back-panel_v1.png`

**Aspect ratio:** portrait (2.5:3.5).

```
Painterly cosmic backdrop for the back panel of a card game tuck box, portrait orientation. Same palette as the front panel (Void #06061A, Nebula #1A0933, plasma magenta #C879FF, ember red #FF5E5B) but SUBTLER — a quieter nebula drift designed to sit BEHIND text. Most of the panel should be calm dark cosmic with a wash of color on one side. Black text will overlay this, so keep the overall luminance low and even. Scattered painterly stars in moderation. Think inside-cover of a vintage sci-fi hardcover — atmospheric, but subordinate to text. Chesley Bonestell painterly style. No text, no logos, no geometric shapes, no subjects. 300dpi.
```

**Pick the variant where:**
- It would be readable if you overlaid body text in cream or gold
- No area is bright enough to wash out typography
- Still feels like a continuation of the front panel's aesthetic
- Calm, atmospheric, subordinate

---

## End of Session 3

- [ ] 3 auxiliary PNGs saved to `artbin/`
- [ ] All three feel like siblings of the cosmic cards (same palette, same mood)
- [ ] Dark enough in their target regions to support overlay text/marks
- [ ] Return to Figma · Day 8 · place these on pages `04 Card Back`, `05 Tuck Box`, and `05a Milo Card` (Milo card can reuse the card-back tile with gold QR overlay)
