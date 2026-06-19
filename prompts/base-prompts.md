# Base prompts

Two templates — everything else derives from these.

## Cosmic · for hazards / remedies / distance

```
Painterly cinematic illustration of [SUBJECT]. Deep cosmic space setting, moody volumetric
lighting with [ACCENT COLOR] highlights. Retro-futurist space-opera aesthetic inspired by
Chesley Bonestell and Denis Villeneuve's Dune. Palette dominated by Void #06061A and Nebula
#1A0933, accented with [ACCENT]. Dramatic chiaroscuro, shallow depth of field, subtle film
grain. No text, no logos, no UI. 300dpi, print-ready.
```

## Angelic · SAFETIES ONLY

```
Photorealistic hero portrait of [SUBJECT]. Blown-out angelic golden light streaming from
behind, volumetric god-rays, halo effect, cinematic rim lighting. MTG mythic-rare / Marvel
Snap card-art quality. Subject is lit, heroic, reverent. Ghost white #FFF7D6 and Halo gold
#FFD93D dominate, with [ACCENT COLOR] details. Shallow depth of field, subtle film grain.
No text, no logos. 300dpi.
```

## Palette reference

| Token | Hex | Role |
|---|---|---|
| Void | #06061A | Deepest dark · cosmic base |
| Nebula | #1A0933 | Deep purple · secondary dark |
| Plasma | #C879FF | Magenta accent (Black Hole, Antimatter) |
| **Ember** | **#FF5E5B** | **Coral red · HAZARDS (dominant ~50% of frame)** |
| Signal | #4ECDC4 | Teal · tech highlights, tractor beams |
| **Panacea** | **#10B981** | **Emerald green · REMEDIES (dominant ~50% of frame)** |
| Halo | #FFD93D | Gold · angelic light + typography |
| Ghost | #FFF7D6 | Cream white · safety base |

## Type-color dominance rule · traffic-light semantics

A 5-year-old reads the card **before** the words. Each card-type has an unmistakable color:

- **Hazards** · **Ember red DOMINATES the frame** (~50% visual weight). Red = "stuck, problem, bad." Cosmic purple recedes to edges.
- **Remedies** · **Panacea green DOMINATES the frame** (~50% visual weight). Green = "healing, solving, safe."
- **Distance** · neutral cosmic (warp-cockpit palette — purples, whites, streaks)
- **Safeties** · angelic gold + cream + white · the only LIGHT cards in the deck

From across the table, without reading any text: a player should know if another player is in trouble (red card on their pile), resolving it (green card on their pile), moving forward (warp cockpit), or untouchable (angelic glow).

## Consistency rule · tool-dependent

Style drift between cosmic and angelic aesthetics is the #1 failure mode. How you prevent it depends on your tool:

### Chat-based tools (Gemini app, ChatGPT)
Style drift comes from accumulated chat context. Solution: three **separate chats**:
- Chat 1 · 15 cosmic cards (hazards / remedies / distance)
- Chat 2 · 4 angelic safeties · **fresh chat**
- Chat 3 · 3 auxiliary backgrounds · **another fresh chat**

### Shot-based tools (Google Flow, Imagen Studio)
Each prompt is isolated by default — no chat state to contaminate. Drift comes from inconsistent references. Solution: save anchors as **Ingredients / reference assets** and attach the right one per prompt:
- Cosmic prompts → attach `s1-01-black-hole_v1.png`
- Angelic prompts → attach `s2-01-rescue-shuttle_v1.png`
- Auxiliary prompts → attach `s1-01-black-hole_v1.png` (quieter cosmic)

In Flow, the "session" framing in the prompt files is just a grouping convention — you can run them in any order in a single session. Only rule: **always attach the correct anchor reference.**
