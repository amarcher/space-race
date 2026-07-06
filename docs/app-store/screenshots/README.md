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
