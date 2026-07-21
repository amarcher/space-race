# App Store screenshots

RAW captures from the iOS Simulator (`xcrun simctl io <udid> screenshot`) — the
inputs to the marketing compositor in `../compose/` (edit SLIDES in
compose.html, run render.sh; the composed `../compose/out/*.png` are what get
UPLOADED to App Store Connect). Refreshed 2026-07-21 from the v1.1 build 7
content (slingshot cinematic, portrait 💫 safeties, compact iPad layout).

| File | Device | Pixels | Shows |
|------|--------|--------|-------|
| `iphone-6.9-01-table.png` | iPhone 17 Pro Max | 1320×2868 | Freshly dealt table |
| `iphone-6.9-02-rules.png` | iPhone 17 Pro Max | 1320×2868 | How-to-Play / card reference |
| `iphone-6.9-03-slingshot.png` | iPhone 17 Pro Max | 1320×2868 | Slingshot cinematic mid-clip — cockpit asteroid field + SLINGSHOT! +200 ly caption |
| `iphone-6.9-04-scry.png` | iPhone 17 Pro Max | 1320×2868 | Two-card scry reveal |
| `iphone-6.9-05-board-race.png` | iPhone 17 Pro Max | 1320×2868 | Staged mid-race board — AI 575 (blocked, red) vs you 525, 💫 slingshot safety |
| `ipad-13-01-table.png` | iPad Pro 13" (M5) | 2064×2752 | Mid-race table, compact iPad layout |
| `ipad-13-02-rules.png` | iPad Pro 13" (M5) | 2064×2752 | How-to-Play on iPad |

## How the staged shots were made

The board-race + slingshot shots come from a THROWAWAY local build (reverted,
never committed): `buildInitialGame()` short-circuited to a hand-seeded
mid-race `GameState` (distance piles, hazard on the AI, coupSafeties for the
💫 badge), plus a `useEffect` that `setTakeover`s the ace-pilot slingshot
cinematic 12s after mount. Recreate the same way when new content shots are
needed.

## App preview video

`../previews/app-preview-6.9.mp4` — 886×1920, 16s, H.264 + silent AAC
(exact ASC spec for the 6.5"/6.7" class; NB Apple's minimum is 15s — don't
trim tighter). Recorded 2026-07-21 via `simctl io recordVideo` on the staged
build, opening ~1s before the action per the owner: mid-race board beat →
full slingshot cinematic + SLINGSHOT! caption → SEAMLESS handoff (post-#126
chain) → safety reveal → board.
Re-encode recipe: `ffmpeg -ss 0.8 -t 26 -i raw.mp4 -f lavfi -t 26 -i
anullsrc=channel_layout=stereo:sample_rate=44100 -vf
"scale=886:1920:flags=lanczos,fps=30" -c:v libx264 -profile:v high -pix_fmt
yuv420p -b:v 10M -c:a aac -b:a 64k -shortest -movflags +faststart out.mp4`.

## Upload notes

- ASC accepts the 6.5"/6.7" class (1284×2778) for this app and REJECTS
  1320×2868 — the compositor renders at the accepted size; upload
  `../compose/out/*`, not these raw captures.
- Upload the preview video FIRST (previews display before screenshots),
  then the composed screenshots, on the v1.1 version page. Media manager
  is manual-only (automation is CSP/file-picker blocked).
- SCREENSHOT ORDER matters twice: the App Store link unfurl thumbnails the
  FIRST screenshot. Drag in this order: **marquee** (the app-title brand
  card — must be first), slingshot, scry, race, table, rules.
