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
| `iphone-6.9-06-ace-hero.png` | iPhone 17 Pro Max | 1320×2868 | Golden Ace Pilot hero frame (dodge-clip opening) — the MARQUEE slide art, echoes the app icon |
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

`../previews/app-preview-6.9.mp4` — 886×1920, 16s, H.264 + silent AAC.
886×1920 is the accepted portrait resolution for the 6.9" class **and** the
6.5" one — Apple publishes the same number for both, so this file is already
at 6.9" spec and wants a different SLOT, not a re-encode. (NB Apple's minimum
is 15s — don't trim tighter.)

Recorded 2026-07-21 via `simctl io recordVideo` on the staged build, opening
~1s before the action per the owner: mid-race board beat →
full slingshot cinematic + SLINGSHOT! caption → SEAMLESS handoff (post-#126
chain) → safety reveal → board.
Re-encode recipe: `ffmpeg -ss 0.8 -t 26 -i raw.mp4 -f lavfi -t 26 -i
anullsrc=channel_layout=stereo:sample_rate=44100 -vf
"scale=886:1920:flags=lanczos,fps=30" -c:v libx264 -profile:v high -pix_fmt
yuv420p -b:v 10M -c:a aac -b:a 64k -shortest -movflags +faststart out.mp4`.

## Upload notes

Upload the composed `../compose/out/*` files — never these raw captures.

### Which set goes in which slot

| Our file | ASC slot (UI label) | API `screenshotDisplayType` | Pixels |
|---|---|---|---|
| `out/iphone69-*.png` | iPhone 6.9" Display | `APP_IPHONE_67` | 1320×2868 |
| `out/iphone65-*.png` | iPhone 6.5" Display | `APP_IPHONE_65` | 1284×2778 |
| `out/ipad-*.png` | iPad 13" Display | `APP_IPAD_PRO_3GEN_129` | 2064×2752 |

**Send the 6.9" set.** 6.9" is Apple's current base iPhone class; 6.5" is the
fallback it *upscales* from, which is what 1.0–1.3.0 have been serving to every
iPhone 15/16/17 Pro Max. Keeping the 6.5" set alongside it is harmless and
costs nothing, so the compositor still renders both.

> **Correcting the 2026-07-21 note in this file**, which said ASC "REJECTS
> 1320×2868 for this app record". It doesn't, and there was never an
> app-record-specific rule. Two things were true at once and read as one:
> **(1)** the ASC API has no `APP_IPHONE_69` — ask it to create a set with that
> value and it enumerates what it does accept, and the 6.9" slot turns out to
> be the one named `APP_IPHONE_67` (Apple relabelled the 6.7" slot rather than
> adding an enum, and never updated the docs — see the open developer-forum
> thread 763908). **(2)** `APP_IPHONE_65` accepts *only* 1242×2688 or
> 1284×2778, so a 1320×2868 file aimed at the 6.5" slot is a genuine spec
> violation and is correctly refused. A 1320×2868 file in the 6.9" slot is
> exactly what Apple asks for.

### Order

SCREENSHOT ORDER matters twice: the App Store link unfurl thumbnails the FIRST
screenshot. Use this order — **marquee** (the app-title brand card — must be
first), slingshot, scry, race, table, rules.

Upload the preview video FIRST of everything (previews display before
screenshots), into the 6.9" preview slot — which the API spells **`IPHONE_67`**,
with no `APP_` prefix. The two enums genuinely differ: screenshot sets take
`APP_IPHONE_67`, preview sets take `IPHONE_67`. (The live listing's preview sits
in `IPHONE_65` today.)

### How to upload

The **media manager in the ASC web console is manual-only** — automating the
drag/file-picker is CSP-blocked. The **REST API is not**, and it does the whole
job: `../asc-media.py`.

```sh
./docs/app-store/asc-media.py show                  # versions + current media
./docs/app-store/asc-media.py upload <localization-id> \
    --display-type APP_IPHONE_67 \
    docs/app-store/compose/out/iphone69-{marquee,slingshot,scry,race,table,rules}.png
```

It reserves each asset, PUTs the bytes through the returned upload operations,
commits with the MD5, waits for `assetDeliveryState` to reach `COMPLETE`, and
sets the display order to the argument order. Auth is the `space-race-ci` ASC
API key (`~/.appstoreconnect/private_keys/`); nothing secret lives in the repo.

`show` is exercised and correct — it's what established the table above.
`upload`/`upload-preview` follow Apple's documented reserve→PUT→commit flow but
have **not yet run against a live version page**, because there hasn't been an
editable one since this was written. Expect the first run to be at the next
release; watch for a `FAILED` `assetDeliveryState`, which is where a wrong
pixel size surfaces.

**It needs an editable version.** Screenshots attach to an
`appStoreVersionLocalization`, and a `READY_FOR_SALE` version's is frozen — so
this runs against the *next* version page, at release time, right after the
build is uploaded. `show` prints the localization id to pass.
