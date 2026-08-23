# Release notes

Store-facing "What's New" copy, kept next to the version numbers it describes.
Paste into App Store Connect, Play Console, and the Amazon Appstore console at
submission time.

Versions are kept in **lockstep across iOS and Android** — both ships are built
from the same `web/dist`, so the feature set is identical and the version
strings should say so too. Two files to change, both in `web/`:

- `android/app/build.gradle` → `versionCode` / `versionName`
- `ios/App/App.xcodeproj/project.pbxproj` → `CURRENT_PROJECT_VERSION` /
  `MARKETING_VERSION` (**two occurrences each** — Debug and Release)

---

## 1.3.0 · build 16 — Advanced play

**Status:** version bumped, not yet submitted anywhere.

> ⚠️ **The App Store is still serving 1.2.0.** 1.2.1 was cut for the Amazon
> Appstore ship (`849ec85`) and went to web and Amazon only — it was never
> uploaded to App Store Connect. So the iOS jump is **1.2.0 → 1.3.0**, and the
> gallery fix below, though it landed back on 2026-08-06, reaches iOS users for
> the first time in this release. Play/Amazon jump 1.2.1 → 1.3.0 as normal.

### What's New (paste-ready, ~490 chars — under every store's limit)

```
TWO NEW WAYS TO PLAY, closer to the classic game that inspired Space Race.
Turn either on — or both — in Settings ▸ Advanced play.

PRECISION APPROACH — Land on exactly 1,000 light-years. A jump that would
overshoot can't be played at all, so save your short hops for the touchdown.

NAVIGATOR'S LEDGER — Only distance cards move your ship. Safeties and
Slingshots bank points instead, tallied at the end of the round with bonuses
for a clean trip, a shutout, and more.

Also: opening the rules no longer ends your game in progress.
```

### Shipped in this build

- **Precision approach** (`exactFinish`) — exact-1000 finish; overshooting
  distance cards are illegal plays. Safeties are exempt and clamp to the line.
- **Navigator's ledger** (`ledgerScoring`) — safeties/Slingshots leave the
  track and bank points against the full Mille Bornes scoring table.
- **Gallery fix** — the rules/card reference became an overlay instead of a
  replacement view, so a game in progress survives a trip to it. Already live
  on web and Amazon since 1.2.1; **new to App Store users in 1.3.0.**
- Settings sheet sizing/scroll-containment fix (it grew past a phone viewport).

### Submission checklist

- [ ] `cd web && npm run ios` then `npm run ios:archive` → upload to ASC
- [ ] `cd web && npm run android:release` → Play Console
- [ ] `cd web && npm run amazon:release` → Amazon Appstore console
      (see `docs/amazon-appstore/listing.md` — DRM stays **No**)
- [ ] Paste the What's New block above into all three
- [ ] No new screenshots needed — no changes to the play surface itself; the
      new UI is confined to Settings and the rules page

---

## Earlier

- **1.2.1 · build 15** (2026-08-06) — Amazon Appstore ship: analytics-free
  child-directed build, plus the gallery fix. **Web + Amazon only; never
  submitted to the App Store.**
- **1.2.0 · build 14** — Tractor Beam ≤50 cap tag. The version currently live
  on the App Store.
