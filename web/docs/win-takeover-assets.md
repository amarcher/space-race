# Win Takeover — Asset Spec

**Status:** LIVE — all four videos and two poster JPEGs are in `web/public/win/` and wired. CSS starburst fallback is still active if a file 404s.

---

## Delivered assets (already in worktree)

| File | Resolution | Served to |
|------|-----------|-----------|
| `web/public/win/win-hero.mp4` | 720p (mobile) | viewports < 768 px |
| `web/public/win/win-hero.hero.mp4` | 1080p (desktop) | viewports ≥ 768 px |
| `web/public/win/lose-hero.mp4` | 720p (mobile) | viewports < 768 px |
| `web/public/win/lose-hero.hero.mp4` | 1080p (desktop) | viewports ≥ 768 px |
| `web/public/win/win-poster.jpg` | 1080p first frame | `<video poster>` + reduced-motion |
| `web/public/win/lose-poster.jpg` | 1080p first frame | `<video poster>` + reduced-motion |

**Responsive convention** (mirrors `CardTakeover`):
- `WIDE_MIN_PX = 768` evaluated once at mount via `window.innerWidth`
- Wide → `*-hero.hero.mp4`; narrow → `*-hero.mp4`
- Outcome: human wins → `win-*`; AI wins → `lose-*`

**Poster** extracted with `ffmpeg -vframes 1` from each 1080p clip.

> The component preloads all four clips idly on mount. If a file is missing or errors, the CSS starburst/ray fallback activates automatically — no visible 404.

---

## Responsive wiring (in WinTakeover.tsx)

```ts
const WIDE_MIN_PX = 768
// mobile (720p)
WIN_VIDEO_MOBILE  = '/win/win-hero.mp4'
LOSE_VIDEO_MOBILE = '/win/lose-hero.mp4'
// desktop (1080p)
WIN_VIDEO_WIDE    = '/win/win-hero.hero.mp4'
LOSE_VIDEO_WIDE   = '/win/lose-hero.hero.mp4'

function pickVideoSrc(humanWon: boolean): string {
  const wide = window.innerWidth >= WIDE_MIN_PX
  if (humanWon) return wide ? WIN_VIDEO_WIDE  : WIN_VIDEO_MOBILE
  return           wide ? LOSE_VIDEO_WIDE : LOSE_VIDEO_MOBILE
}
```

The `<video poster>` attribute points to `win-poster.jpg` or `lose-poster.jpg` (JPEG, ~96–98 KB each).

---

---

## Video spec (Google Ultra / Veo 3 in Flow)

### Both clips

- **Aspect ratio:** `9:16` (portrait, 1080×1920 or 720×1280). The video fills the screen with `object-fit: cover`, so portrait works on both phone and desktop — the sides crop gracefully on wide screens.
- **Duration:** `4–5 s`, one-shot (no loop). The UI holds the video for 3.8 s then transitions to the tally card.
- **End frame:** fade to near-black or to stars — the tally card slides up from the bottom over the fade.
- **Codec / container:** H.264 MP4 (broadest mobile autoplay support). VP9/WebM optional as a sibling file.
- **File size target:** ≤ 8 MB (these play on phones and tablets over LTE).
- **Audio:** none — all clips are `muted` + `playsInline`. Generate with no sound or strip audio in export.

### Shared style anchor (prepend to every prompt)

> Cinematic, photorealistic sci-fi render. Deep space backdrop. The palette matches the game's dark-blue-to-violet space aesthetic with gold and cyan accents. No text, logos, watermarks, captions, UI, or HUD elements. No audio.

---

### `win-hero.mp4` — human wins (triumphant arrival)

**Veo text-to-video prompt (copy-paste ready):**

> Cinematic, photorealistic sci-fi render. Deep space backdrop. A sleek white-and-silver child-pilot rocket ship bursts out of a hyperspace tunnel in a blinding flash of gold-white light, decelerating dramatically as star-streaks condense back into stars around it. The rocket glides forward into a star-dense finish zone — a shimmering translucent gate of cyan energy beams marks the destination. The ship crosses the gate threshold. Gold-and-cyan light pulses radiate outward like a ripple. The final second holds on the ship floating triumphantly beyond the gate, engines glowing, stars twinkling. Portrait 9:16 framing, rocket centered, gate in the upper half of frame. The last frame fades toward deep black. No text, logos, watermarks, captions, UI, or HUD elements. No audio. 4–5 seconds, one-shot, no loop.

**Negative / constraints block:**

> No ground, no atmosphere, no planets in focus, no camera shake or handheld motion, no zoom or dolly during the final hold, no human figures visible, no lens flares covering the ship, no motion blur on the ship silhouette (the form must read clearly), no 2D animation style, no cartoon look.

**Key-art poster prompt (ChatGPT / DALL-E 3 or Midjourney — for `win-poster.webp`):**

> Photorealistic sci-fi illustration. A sleek white-and-silver child-pilot rocket ship crosses a glowing cyan finish gate in deep space. Gold and cyan light bursts radiate from the gate crossing point. Star-dense background. Portrait 9:16, rocket centered in the middle third, gate arch framing the upper portion. Triumphant, celebratory mood. No text, no HUD, no logos. Dark deep-space palette with gold-cyan-white accent colors. Film-quality render, high detail.

- **Use as:** `poster` attribute on the `<video>` tag (the component already sets it — just drop the file in at `web/public/win/win-poster.webp`) and as the reduced-motion static fallback background.
- **Dimensions:** 1080×1920 px (same as the video).

---

### `lose-hero.mp4` — AI wins (dignified, not punishing)

**Veo text-to-video prompt (copy-paste ready):**

> Cinematic, photorealistic sci-fi render. Deep space backdrop. A sleek white-and-silver child-pilot rocket ship drifts slowly forward through a beautiful star field, engines dimmed, navigation lights blinking softly. The rival ship — a dark angular robot craft with purple-and-silver markings — glides past it in the foreground, crossing a shimmering cyan finish gate ahead. The rival ship's engines glow warmly as it crosses. The child pilot's ship watches from behind, surrounded by gently twinkling stars, its hull catching the finish-gate light. The mood is respectful and calm — not crushing. The final second holds on both ships in frame, the finish gate fading to starlight. Portrait 9:16 framing. The last frame fades toward deep black. No text, logos, watermarks, captions, UI, or HUD elements. No audio. 4–5 seconds, one-shot, no loop.

**Negative / constraints block:**

> No angry or sad expressions, no crashing or damaged ship, no explosions, no ground or atmosphere, no camera shake, no 2D animation style, no cartoon look.

**Key-art poster prompt (for `lose-poster.webp`):**

> Photorealistic sci-fi illustration. A sleek child-pilot rocket ship drifts in beautiful deep space watching a rival dark angular robot craft cross a glowing cyan finish gate ahead of it. Respectful, calm mood — not crushing or sad. Both ships visible. Portrait 9:16. Stars dense in the background. Purple-and-silver rival ship glowing through the gate. No text, no HUD, no logos.

- **Drop-in path:** `web/public/win/lose-poster.webp`

---

## Poster frames (already wired)

Posters extracted with:
```bash
ffmpeg -y -i web/public/win/win-hero.hero.mp4  -vframes 1 web/public/win/win-poster.jpg
ffmpeg -y -i web/public/win/lose-hero.hero.mp4 -vframes 1 web/public/win/lose-poster.jpg
```

The `<video>` element in `WinTakeover.tsx` already has `poster={posterSrc}` wired — no further changes needed. If you regenerate the videos, re-run the ffmpeg commands above to refresh the posters.

---

## Style consistency with existing card-art clips

The existing card clips (in `web/public/cards/video/`) follow the prompts in `docs/veo-card-art-prompts.md`. The win-hero clips should feel like the same universe — same cinematic photorealism, same deep-space dark palette, same ship design if possible. The key difference is **framing and duration**: card clips are subtle 3-4 s ambient loops; the win clips are one-shot hero moments with a clear narrative arc (approach → crossing → resolution).

---

## Status — all done

All assets are wired on `feature/win-takeover`:
- 4 videos: `win-hero.mp4`, `win-hero.hero.mp4`, `lose-hero.mp4`, `lose-hero.hero.mp4`
- 2 posters: `win-poster.jpg`, `lose-poster.jpg`
- Responsive src selection (768px breakpoint) wired in `WinTakeover.tsx`
- `poster=` attribute wired on `<video>`
- Preview at `http://localhost:5184/?win=human` and `?win=ai`

To replace videos with new generations: drop the new files at the same paths and re-extract posters with the ffmpeg commands above.
