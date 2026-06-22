# Veo (Google Ultra) prompts — animated card art

Generation prompts for the looping card-art clips consumed by the animated-card-art
pipeline (`web/src/game/cardArt.ts` + `Card.tsx`). One **idle** loop per card is the
priority; **hover** is an optional livelier variant; **played** is a future one-shot
(not wired yet).

## How to use these

- **Use image-to-video.** Feed the card's existing static art as the input/reference
  image (`web/public/cards/<kind>.webp`) and let the prompt describe only the *motion*
  and the look to preserve. This guarantees the clip matches the printed card.
- **Plan:** Google AI **Ultra** → Veo in **Flow** (or the Gemini app). Veo 3 generates
  ~8s with audio; we only need subtle motion and **no sound**.
- **Aspect / framing:** portrait **9:16** (or keep the input framing). The game crops
  each clip to a 3:4 card with `object-fit: cover`, so **keep the focal point centered**
  and leave a little breathing room top/bottom.
- **Looping:** Veo won't make a perfect loop on its own. Ask for *subtle, continuous*
  motion that ends where it began, then trim to a clean ~3–4s and (if needed) add a short
  crossfade, or use the ffmpeg loop trick below. In-engine the clip is set to `loop`.
- **Output:** export the trimmed clip as WebM (VP9) or MP4 (H.264), small (these run on
  kids' tablets), and drop it at `web/public/cards/video/<kind>-<state>.webm`, then add a
  one-line entry to the manifest in `web/src/game/cardArt.ts`:
  ```ts
  'black-hole': { idle: '/cards/video/black-hole-idle.webm', hover: '/cards/video/black-hole-hover.webm' },
  ```

### Shared STYLE anchor (prepend to every prompt)
> Cinematic, photorealistic sci-fi render. Preserve the exact palette, lighting, finish,
> and composition of the provided image.

### Shared CONSTRAINTS / negative (append to every prompt)
> Locked-off camera — no pan, tilt, zoom, dolly, or shake. Framing, colors, and all major
> shapes stay identical to the source image; no new objects enter or leave; nothing
> translates across the frame. No text, numbers, captions, logos, watermarks, or UI. No
> audio, dialogue, or music. Motion is subtle, slow, and continuous so the first and last
> frames are nearly identical and the clip loops seamlessly.

### Optional ffmpeg loop polish
```bash
# crossfade the tail back into the head for a seamless ~4s loop
ffmpeg -i in.mp4 -filter_complex "[0]split[a][b];[b]reverse[r];[a][r]xfade=transition=fade:duration=0.5:offset=3.5" -an out.webm
```

### Hover & played variants
- **hover:** regenerate the same prompt with the motion ~1.5–2× faster/more energetic and
  the glow ~20% brighter — a livelier "awake" state — composition unchanged. Most worth it
  for the hazards, the black hole, and the warp cards.
- **played (future):** a ~1s dramatic surge (warp lurches into a jump; hazard erupts;
  remedy flares to completion). The pipeline reserves this state but doesn't drive it yet.

---

## Distances — shared cockpit-porthole-into-hyperspace motif

Per-card motion line (wrap with the STYLE anchor + CONSTRAINTS above):

- **warp-25** — *Animate the view through the cockpit porthole: the blue-white radial
  star-streaks breathe, gently brightening and pulsing outward from the center then easing
  back, with individual stars twinkling asynchronously. Calm, slow, low-energy. The cockpit
  dashboard, window frame, and glowing instruments stay perfectly still — only the starfield
  light moves.*
- **warp-50** — *Same cockpit porthole: blue-white star-streaks breathe outward with warm
  rose/magenta flares pulsing through them, slightly faster than a resting state; stars
  twinkle asynchronously. Dashboard and frame stay still.*
- **warp-75** — *Same porthole: rich magenta-purple-pink hyperspace streaks pulse outward
  from the core, color saturation gently oscillating (brighter, then softer), stars
  flickering. Medium energy. Cockpit frame and instruments locked.*
- **warp-100** — *Same porthole: brilliant gold-white-magenta-cyan streaks shimmer with the
  color layers drifting slightly out of phase, star brightness undulating as if still
  accelerating. Higher energy. Frame and dashboard static.*
- **warp-200** — *Same porthole at maximum intensity: full-spectrum (blue/magenta/gold/white)
  velocity streaks pulse and the chromatic intensity cycles like a charging hyperdrive
  (gold brightens → magenta peaks → cool tones intensify), brightest at the core, stars
  dancing subtly in place. Most energetic. Cockpit frame locked.*

## Hazards

- **asteroid-strike** — *Embers and sparks drift slowly outward from the golden-orange
  impact fire; the fire glow flickers (±10%); scattered asteroid debris tumbles gently in
  place. The cargo ship and the main asteroids hold their positions.*
- **empty-tank** — *The big red neon "E" fuel gauge pulses bright→dim like an emergency
  warning (~2s); the needle subtly trembles near empty as if sloshing the last drops; amber
  warning lights flicker faintly across the dusty cockpit walls. Everything else stays still.*
- **busted-thruster** — *The ruptured engine's red-orange flame flickers and licks with
  magenta edges; hot embers and shattered metal fragments drift slowly outward; black smoke
  tendrils curl gently. The engine body and the camera stay locked.*
- **tractor-beam** — *The cyan helical energy beam slowly rotates around the trapped ship
  (~45° over the clip); the beam's brightness pulses; small cyan particles swirl along the
  spiral. The captured ship holds dead center; the red nebula backdrop stays still.*
- **black-hole** — *The accretion disk rotates slowly (about one revolution every 6s) in
  magenta/blue/cyan/purple; the inner photon ring glows with a gentle pulse; purple-magenta
  dust drifts faintly; a subtle gravitational shimmer ripples at the disk edge. The small
  foreground rocket stays still.*

## Remedies

- **repair-drone** — *Welding sparks spray and drift from the contact point on the hull; the
  drone's golden optical eye pulses warmly; its manipulator arm has a fine working tremor.
  The drone body and the damaged ship hull stay in place.*
- **fuel-cell** — *The canister's interior orange glow flickers and pulses (~2s); small
  embers float slowly upward; the warm radiance around it blooms and softens. The canister
  stays upright and locked.*
- **new-thruster** — *The centered green-white thrust beam pulses and flickers with streaming
  particle trails drifting outward; the golden radiance around the engine breathes in and
  out. The engine body stays static.*
- **beam-cutter** — *The green cutting beam flickers and pulses; the torch's brass
  manipulator arms rotate slightly; the impact glow on the distant target flares rhythmically;
  sparks and energy motes drift slowly upward through the bay. The window frame stays locked.*
- **ignition** — *The green push-button's glow pulses outward in gentle waves (glow radius
  ±20%, ~2.5s); golden dust particles drift lazily through the volumetric light rays from the
  porthole; soft highlight shifts play across the worn brass panel. The button and panel
  stay put.*

## Safeties — heroic portraits / held objects with divine glow

Keep faces calm and still — **no head turn, no big expression**; at most one slow, subtle
blink. Only light, glow, and the held object animate.

- **ace-pilot** — *The heroic golden halo/backlight behind the helmeted pilot pulses gently;
  a soft warm glint travels slowly across the gold visor and suit; subtle rim-light breathing.
  The pilot holds the pose.*
- **antimatter-fuel-cell** — *The magenta plasma inside the glass cylinder swirls slowly like
  a lava lamp; its glow pulses (±15%); the golden god-rays around it shimmer and shift faintly;
  a soft pink aura orbits the container. The container stays upright and locked.*
- **diamond-thruster** — *The held teal-green crystal's facets scintillate with shifting
  sparkles; the white halo glow around the pilot and crystal breathes softly; a faint teal
  aura orbits the crystal. The pilot holds still.*
- **rescue-shuttle** — *Golden god-rays shimmer through the clouds; soft cloud wisps drift
  slowly behind the rising shuttle; the red cross emblem pulses gently; faint engine-trail
  particles. The shuttle holds its position in frame.*
