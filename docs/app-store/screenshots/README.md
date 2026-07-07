# App Store screenshots

Captured from the iOS Simulator (`xcrun simctl io … screenshot`) on the reverted
`main` build (game default view). Pixel dimensions verified with `sips`.

| File | Device | Pixels | Shows |
|------|--------|--------|-------|
| `iphone-6.9-01-table.png` | iPhone 17 Pro Max | 1320 × 2868 | Game table, freshly dealt hand — both player boards, 94-card draw pile, 5-card hand fanned at the bottom |
| `iphone-6.9-02-rules.png` | iPhone 17 Pro Max | 1320 × 2868 | In-app How-to-Play / card reference (toolbar book icon): Goal, turn flow, Ignition, Slingshot, hazard tracks |
| `ipad-13-01-table.png` | iPad Pro 13-inch (M5) | 2064 × 2752 | Game table on the wide iPad layout — both boards, draw pile, 6-card hand with distance + hazard/remedy art |
| `ipad-13-02-rules.png` | iPad Pro 13-inch (M5) | 2064 × 2752 | How-to-Play / card reference on iPad |

**Sizes match App Store Connect requirements:** 6.9" iPhone = 1320×2868, 13" iPad
= 2064×2752 (both portrait). App Store Connect derives the 6.5"/6.7" iPhone slots
from the 6.9" set.

## Limitation & how to get more

`simctl` cannot tap or scroll inside the WKWebView, and Appium was explicitly
off-limits. To reach a screen other than the launch table without tapping, the
`02-rules` shots were captured from a throwaway build that defaulted the app's
view state to `gallery` (source reverted to `game` before committing — see git).

Screens that need in-play interaction — a mid-race board with distance/hazards
played, a Coup-fourré, or the win takeover — can't be reached this way. Grab
those live during TestFlight on a real device (they're the game's showpieces and
worth adding before the final submission).

## Gameplay captures (2026-07-06, real play in iPhone 17 Pro Max sim)

- `iphone-6.9-03-rescue-takeover.png` — Rescue Shuttle safety takeover, full-bleed (1320×2868)
- `iphone-6.9-04-scry.png` — two-card scry reveal, two different cards (1320×2868)
- `iphone-6.9-05-board-race.png` — mid-game: AI 200 vs player 150, Rescue Shuttle on board (1320×2868)
- `../previews/app-preview-6.9.mp4` — 19s App Preview (886×1920, H.264 + silent AAC): scry reveal → Rescue Shuttle takeover → aftermath

Suggested store order: rescue-takeover, scry, board-race, table, rules (first 3 appear on install sheets).

## Upload-ready 6.7" set (1284×2778)

App Store Connect's media manager for this app demands the 6.5"/6.7" size
class (1242×2688 / 1284×2778) and rejects 1320×2868. The `iphone-6.7-*.png`
files are the same five shots center-cropped to 1284×2778 — **upload these**.
The 6.9" originals remain canonical.
