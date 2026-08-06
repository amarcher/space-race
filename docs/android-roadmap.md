# Space Race — Android Roadmap

Ship the web game (`web/`) as a native **Android** app via **Capacitor**, fully
offline with all assets bundled (no server costs), distributed through Google
Play (internal testing → production). This is the exact **one codebase, two
ships** model already proven for iOS (`docs/ios-roadmap.md`) — now three ships.
The web app at https://game.spaceexplorer.tech stays the primary product; the
Android app is a wrapper around the same Vite build output as iOS.

Why Capacitor (same reasoning as iOS): the game is pure client-side
React/DOM/CSS, already a PWA, no backend for core play. The iOS port already did
all the shared "make it feel native" work (safe areas, haptics, status bar,
keep-awake, share, launch background) behind cross-platform `@capacitor/*`
plugins and `src/native/` shims — **those plugins work on Android unchanged.**
This roadmap is mostly (a) scaffolding the Android platform and (b) the
Android-only edges: hardware **Back** button, adaptive icons, edge-to-edge
insets, the analytics platform split, and Play Console submission.

**Cost delta vs iOS:** Google Play is a **one-time $25** developer registration
(vs Apple's $99/yr). No annual renewal, no per-build signing ceremony once the
upload key exists.

---

## Environment (this machine, verified 2026-07-07)

- **Android Studio** installed (`/Applications/Android Studio.app`) with a
  bundled **JDK 21** (JBR) at
  `/Applications/Android Studio.app/Contents/jbr/Contents/Home` — used as
  `JAVA_HOME`. No separate JDK on `PATH`, and that's fine.
- **Android SDK** at `~/Library/Android/sdk`: platforms `android-34` &
  `android-36.1`, build-tools `35.0.0`/`36.1.0`, `platform-tools`, one emulator
  system image (`android-36.1`). `adb` is on `PATH` (Homebrew). Licenses already
  accepted.
- **Missing but not blocking:** `ANDROID_HOME`/`ANDROID_SDK_ROOT` env vars are
  unset (the release script exports sane defaults), and `cmdline-tools`
  (`sdkmanager`) is absent — only needed to install extra SDK packages from the
  CLI; Android Studio's SDK Manager covers it, and the Gradle wrapper is
  self-contained.

---

## Phase 0 — Rebrand + shared web build ✅ (done with iOS, 2026-07-06)

Nothing Android-specific. The "Space Race" rebrand, the offline-complete Vite
build, self-hosted fonts, and the service-worker-gated-off-native logic
(`Capacitor.isNativePlatform()` — already covers Android) all shipped with the
iOS work. The Android app consumes the same `dist/`.

## Phase 1 — Capacitor Android scaffold ✅ (done 2026-07-07, this session)

- [x] `npm i @capacitor/android@^8.4.1` (matches the pinned core/CLI 8.4.1).
- [x] `npx cap add android` — native project generated under `web/android/`,
      Gradle synced clean, all 4 existing Capacitor plugins (keep-awake,
      haptics, share, status-bar) detected for Android.
- [x] `capacitor.config.ts` gains an `android` block: `backgroundColor #07071a`
      (matches the starfield boot — no white flash), `allowMixedContent: false`.
      `androidScheme` left at the default `https` (app served from
      `https://localhost`) so WebView storage / secure-context semantics hold.
- [x] Identity matches iOS: `applicationId = tech.spaceexplorer.spacerace`,
      `versionName "1.0.0"`, `versionCode 1`, `app_name = "Space Race"`.
      `compileSdk`/`targetSdk = 36`, `minSdk = 24` (Android 7.0 — covers ~99% of
      active devices).
- [x] **Assets bundled offline**: `cap add`/`cap sync` copies `dist/` into
      `android/app/src/main/assets/public` (gitignored + regenerated, same as
      iOS). Fully offline, zero server dependency.
- [x] Service worker stays gated OFF on native (existing
      `!Capacitor.isNativePlatform()` guard in `src/main.tsx` — no Android change).
- [x] **Toolchain proven end-to-end:** `./gradlew assembleDebug` →
      **BUILD SUCCESSFUL**, `app-debug.apk` = **104 MB** (101 MB bundled web
      assets, of which 96 MB is card/win MP4 video). Comfortably under Play's
      **200 MB base-module** download limit.
      **⚠️ No longer true — as of 2026-08-06 the debug APK is 214 MB.** `dist/`
      is 190 MB, of which **184 MB is 49 MP4 files** (`dist/cards` alone is
      172 MB; the five `*.slingshot.hero.mp4` clips are 62 MB between them).
      **This build now EXCEEDS Play's 200 MB base-module limit** and cannot ship
      to Google Play as-is. Amazon has no size limit, so the Amazon Appstore is
      currently the only store this build can ship to unmodified. See the size
      risk at the bottom of this doc for the two ways out.
- [x] Conditional **release signing** wired in `app/build.gradle` (reads a
      gitignored `keystore.properties`; unsigned when absent). Keystore files
      (`*.jks`, `*.keystore`, `keystore.properties`) added to `android/.gitignore`.
- [x] `web/scripts/android-release.sh` + npm scripts `android` (build+sync) and
      `android:release` (build the AAB).

**Exit criteria:** the full game runs offline in an Android emulator/device.
*(Debug APK builds; live emulator smoke-test is the first task of Phase 2.)*

## Phase 2 — Make it feel native (Android) ✅ (mostly done 2026-07-07)

Most of "native feel" is already done cross-platform by the iOS work. The
Android-only gaps:

- [x] **Hardware / gesture BACK button** — `@capacitor/app` + a back-interceptor
      registry (`src/native/backButton.ts`, the RN `BackHandler` pattern as a
      `useBackHandler(handler, active)` hook). Back closes an open menu overlay
      (settings / scoreboard / log — wired in `Table.tsx`) or the rules/gallery
      view (App.tsx) instead of exiting; at the game root it's **double-tap-to-exit**
      with a "press back again to exit" toast (`src/native/BackExitHint.tsx`,
      no extra plugin). No-op on web/iOS. *Deferred:* the Android 14+
      **predictive-back** gesture (`enableOnBackInvokedCallback`) — it changes
      back dispatch and needs verifying that Capacitor forwards it to the JS
      `backButton` event before opting in; the reliable legacy path ships first.
- [x] **Adaptive launcher icon** — the **Ace Pilot** hero (same art as the iOS
      app icon), generated by `scripts/gen-android-assets.mjs` from the iOS
      AppIcon + the ace-pilot clip poster. Photographic, so it's **full-bleed
      (no 16.7% inset)** with a solid `#07071a` background layer and **no
      monochrome** (a photo can't theme) — the deliberate opposite of a line-mark
      logo's treatment. Legacy + round + adaptive at all densities. Masked
      preview verified (circle + squircle).
- [x] **Splash screen** — the Ace Pilot everywhere, matching iOS. Android 12+
      SplashScreen API (`styles.xml`): `windowSplashScreenBackground = @color/spaceBg`
      (#07071a), `windowSplashScreenAnimatedIcon = @mipmap/ic_launcher_foreground`
      (the ace pilot, masked round), `postSplashScreenTheme` hands off to the dark
      theme (no white flash). The pre-12 `@drawable/splash` is the full-bleed
      ace-pilot still. Then `src/native/BootSplash.tsx` (already cross-platform,
      native-gated) plays the **full-screen ace-pilot takeover clip**
      (`/cards/video/ace-pilot.hero.mp4`) → fades to the table.
- [x] **Status bar + edge-to-edge** — the shared `@capacitor/status-bar` boot
      call (`Style.Dark` = light icons) sets the icon appearance. We target **API
      36 (Android 16), where edge-to-edge is fully ENFORCED with no opt-out**
      (`windowOptOutEdgeToEdgeEnforcement` was Android-15-only), so insets must be
      plumbed. Android WebView's `env(safe-area-inset-*)` only reports display
      **cutouts**, not the system bars — so `MainActivity` reads native
      `WindowInsets` (systemBars | displayCutout) and injects `--safe-area-inset-*`
      CSS variables (in CSS px), which `index.css` consumes ahead of `env()` in
      the `--safe-*` block. Re-fires on rotation/gesture-nav changes; forced on
      `onResume` so the values land after the SPA mounts. (This is what the
      unreleased `@capacitor/system-bars` plugin does internally — done inline to
      avoid a dependency on an unpublished package.) iOS/web unchanged: with
      `--safe-area-inset-*` unset there, `--safe-*` falls back to `env()`.
      **✅ Confirmed on device 2026-08-06 — but the original code was incomplete.**
      Targeting API 36 is NOT enough: enforcement removes the opt-*out*, it does
      not opt you *in*, and Fire OS 8 tablets run **API 30**, where the window
      lays out INSIDE the system bars and the inset listener therefore reports
      `bottom: 0`. Two additions were needed:
      (1) `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)` in
      `MainActivity.onCreate` — opts in on every API level;
      (2) transparent `statusBarColor`/`navigationBarColor` **plus**
      `enforceStatusBarContrast`/`enforceNavigationBarContrast = false` in
      `AppTheme.NoActionBar` — without these the bars still paint their own
      background and API 29+ re-adds a contrast scrim.
      Measured A/B on a Fire HD 10 (800×1280 CSS px, dpr 1.5):

      | | `innerHeight` | injected bottom inset | nav bar |
      |---|---|---|---|
      | before both changes | 1208 | — | opaque |
      | theme only (no opt-in) | 1232 | `0px` | **white** (regression) |
      | opt-in + theme | **1280** | **`48px`** | transparent, full bleed |

      The two changes are co-dependent — shipping the theme change alone is worse
      than shipping neither.
- [x] **Killed webview artifacts** — the iOS CSS (`overscroll-behavior: none`,
      `touch-action: manipulation`, no selection/callout on the game surface) is
      platform-neutral and already applies. *Verify on device*: no Android-only
      long-press selection or pull-to-refresh.
- [x] **Haptics** — `@capacitor/haptics` uses the Android `Vibrator` (`VIBRATE`
      permission auto-added by the plugin). **⛔️ Untestable on Fire tablets —
      they have no vibration motor.** `pm list features` on a Fire HD 10 reports
      no `android.hardware.vibrator`, and the vibrator service returns
      `mSupportedEffects=null`, so every haptic call silently no-ops. Nothing to
      fix (there is no user-facing haptics toggle that would look broken), but
      haptics still need a real Android **phone** before the Play release.

**Build status:** ✅ **On-device pass done 2026-08-06 on a Fire HD 10 (11th gen,
`KFTUWI`/tungsten, Fire OS 8.0 / Android 11 / API 30, MediaTek MT8169, 3 GB RAM,
1200×1920 @ 240 dpi → sw800dp).** First time the Android build ever ran on real
hardware — the local emulator still can't launch here (HVF init failure).

| Criterion | Result |
|---|---|
| Cold launch | **1.6 s** (first-ever run was 17.8 s — Amazon WebView provider warming) |
| Warm resume | 72 ms |
| Back button | ✅ closes overlays; double-tap-to-exit at root |
| SFX audio | ✅ via WebAudio (the iOS native-audio path is correctly iOS-only) |
| Splash / launcher icon | ✅ shows — but see **#141**, the ace pilot appears at three zoom levels |
| Landscape (tablet branch) | ✅ 1920×1200 reflows correctly — never previously exercised |
| Edge-to-edge insets | ✅ after the two fixes above |
| Memory pressure / codec errors | none |
| Haptics | ⛔️ no hardware (see above) |

**WebView is Amazon WebView (AWV) `148.0.7778.258`** — a modern Chromium fork,
not the stale WebView older Fire tablets shipped. DevTools attaches over adb:
`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`, which is how
the inset and GA4 numbers here were measured.

**Open issue found during the pass:** video decodes entirely in **software**
(77 × `c2.android.avc.decoder`) despite `OMX.MTK.VIDEO.DECODER.AVC` **and**
`.HEVC` being present — see **#140**.

**Exit criteria:** a stranger handling the phone can't tell it's a webview, and
Back behaves like a native app. *(✅ met on a Fire HD 10; haptics still want a
phone.)*

## Phase 3 — Android-specific edges ✅ (done 2026-07-07)

- [x] **Analytics platform split — the key gotcha.** iOS tags the GA4 `platform`
      user property in `<head>` via `location.protocol === 'capacitor:'`, which
      would mislabel Android as `web` (Android serves from `https://localhost`).
      **Fixed with a UA marker:** `appendUserAgentString: 'SpaceRaceAndroid'` in
      the `android` config block (set at WebView creation, so it's present when the
      `<head>` snippet runs), and `index.html` now branches
      `capacitor:` → ios / `/SpaceRaceAndroid/` UA → android / else web. Verified
      the marker lands in the synced native `capacitor.config.json`. `@vercel/analytics`
      + Speed Insights stay gated off native via `!Capacitor.isNativePlatform()`.
      **✅ Confirmed on device 2026-08-06** via DevTools-over-adb. The live
      WebView UA ends `... Safari/537.36 SpaceRaceAndroid`, the `<head>` snippet
      computes `platform = 'android'`, and GA4 is genuinely *sending* — not just
      loaded — with real hits to
      `https://www.google-analytics.com/g/collect?v=2&tid=G-GS8HYJ69C3`.
      No extra setup step is needed; analytics work as soon as the device is
      online (offline play is invisible to GA4 by design).
      *(Config key note: the working key is `appendUserAgent`, not
      `appendUserAgentString` — Capacitor silently ignores the latter.)*
- [x] **Orientation** — mirrors iOS: **phone portrait-locked, tablet unrestricted.**
      `MainActivity.onCreate` branches at runtime on `smallestScreenWidthDp >= 600`
      (tablet → `SCREEN_ORIENTATION_UNSPECIFIED`, phone → `..._PORTRAIT`) — Android
      has no manifest `~ipad` split.
- [x] **TV mode / LAN WebSocket** — no change needed. Same as iOS: gated behind a
      `?mode=` URL flag the shipped app never sets, so no socket opens and no extra
      permission is required for normal play. *(If TV mode is ever enabled on
      Android, `ws://<lan-ip>:8771` cleartext would need a `network_security_config.xml`
      allowing cleartext to local addresses — Android 9+ blocks it by default.)*
- [x] **localStorage persistence** — kept as the sole store (same decision as iOS;
      WebView localStorage is durable for an installed app). Did **not** add
      `@capacitor/preferences`.

**Exit criteria:** analytics correctly split `android` vs `ios` vs `web`;
orientation matches iOS; no permission prompts in normal play. *(Code complete;
the `platform=android` split wants the same on-device GA4 confirmation as the rest
of the on-device pass.)*

## Phase 4 — Ship to Google Play

Everything below is drafted/automatable **except** the steps needing the paid
Play Console account and interactive Console web forms — flagged **👤 HUMAN**.

- [x] **Versioning** — `versionCode` is a monotonically increasing **integer**
      (bump every upload, even for the same `versionName`); `versionName` is the
      display string. Set in `android/app/build.gradle`. **Brought to parity with
      iOS 2026-08-06: `versionCode 14`, `versionName "1.2.0"`** (was `1` /
      `"1.0.0"`, badly stale). Both ships build from the same `web/dist`, so keep
      these in lockstep with `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in
      `ios/App/App.xcodeproj`.
      **Feature parity verified, not assumed:** builds 13 (v1.2 polish) and 14
      touched only `web/src/` — scoreboard centre-grow, trophy scrub, Low Power
      Mode poster fallback (a generic autoplay-rejection handler, not an iOS
      API), compositor hardening, restart confirm, Tractor Beam ≤50 tag — so the
      shared `dist/` carries all of it to Android automatically. The one
      deliberate divergence is `src/audio/sfx.ts` gating native audio to iOS,
      which exists to defeat iOS's ring/silent switch; Android has no such switch
      and correctly uses WebAudio.
- [ ] **Target API level** — Play requires **new apps target API 35+** (as of
      Aug 2025). We target 36 → compliant.
- [ ] **Upload key + Play App Signing** — one-time:
      `./web/scripts/android-release.sh --init-keystore` generates
      `upload-keystore.jks` + a gitignored `keystore.properties`. Enroll in
      **Play App Signing** (default for new apps): Google holds the real
      app-signing key; you only ever ship the *upload* key. **Back up the
      keystore** off-machine.
- [ ] **Build the AAB** — `./web/scripts/android-release.sh` →
      `app/build/outputs/bundle/release/app-release.aab` (signed once the key
      exists). `--apk` also emits a sideloadable release APK for device testing.
- [ ] 👤 **HUMAN — Play Console account** ($25 one-time) + create the app
      (package `tech.spaceexplorer.spacerace`, "Space Race", free, game).
- [ ] 👤 **HUMAN — Internal testing track** — upload the AAB, add testers
      (family), install from the Play link. The low-friction equivalent of
      TestFlight; no review wait.
- [ ] 👤 **HUMAN — Store listing** — fill from `docs/play-store/listing.md`:
      title, short + full description, app icon (512×512), **feature graphic
      (1024×500, required)**, phone + tablet screenshots, category, contact,
      privacy-policy URL (already live).
- [ ] 👤 **HUMAN — Data safety form** — Play's privacy declaration. Matches the
      iOS nutrition label: collects **App interactions** (GA4 analytics), not
      shared, not used for tracking, no account. Draft answers in the listing doc.
- [ ] 👤 **HUMAN — Content rating** — complete the IARC questionnaire (expect
      **Everyone / PEGI 3**), same honest answers as the iOS 4+ questionnaire.
- [ ] 👤 **HUMAN — Target audience, Ads, Countries/Pricing** — target **13+**
      (staying out of the *Designed for Families* program, which — like Apple's
      Kids category — would restrict the GA4 analytics), declare **no ads**, free
      in all countries.
- [ ] 👤 **HUMAN — Submit for review** — promote Internal → Production (or a
      closed/open test first). First Play reviews can take a few days.
- [ ] **Guideline insurance (min functionality)** — same as iOS: offline +
      haptics + share + a polished game usually clears Play's spam/min-function
      bar; Play is generally more permissive than App Review about webview
      wrappers.

**Exit criteria:** a published Play listing; installing on a fresh Android phone
and winning a game with zero network. *(Blocked only on 👤 HUMAN steps.)*

---

## Phase 5 — Amazon Appstore (Fire tablets) — the cheaper second ship

The same artifact serves both stores; Amazon takes an **APK or AAB** and Fire OS
is Android. Points that differ from Play:

- **Fire tablets and Fire TV only.** Amazon discontinued the Appstore on general
  Android phones in Aug 2025. E-ink Kindles have never had an app store.
- **Developer registration is free** (vs Play's one-time $25, Apple's $99/yr).
- **No application size limit** — the only threshold is 150 MB, above which the
  upload goes by FTP rather than the browser form. This is why the 214 MB build
  can ship to Amazon but not to Play today.
- **Manifest is already Fire-clean:** only `INTERNET` + `VIBRATE` (+ Capacitor's
  internal receiver permission), and **no `uses-feature` declarations at all**,
  so nothing triggers Amazon's device filtering. No Google Play Services or
  Firebase anywhere in the build.
- **Vega OS is the medium-term question — tracked as a spike in #143.** Amazon is
  replacing Android-based Fire OS with **Vega**, a Linux platform that is *not*
  Android and takes `.vpkg` binaries, not APKs; both can be listed under one
  Appstore product with independent version numbers.
  **Do not assume this is cheap for us.** Vega apps are written in JS/TS using
  **React Native** (New Architecture — Hermes, JSI/TurboModules, Fabric), and
  *React Native is not React*: Space Race is a React **DOM** app (CSS animation,
  `<canvas>` starfield, `<video>` takeovers, drag-and-drop), so the RN path is a
  near-total UI rewrite, not a port. Whether Vega also supports shipping a plain
  web bundle is the open question #143 exists to answer.
  Two further caveats: Vega currently ships on **Fire TV and Echo Show, not Fire
  tablets** — our target hardware still runs Android and takes the APK — and Fire
  TV is a **D-pad, landscape, 10-foot** device, so even a working bundle would
  need a focus/selection model to replace tap-and-drag.
  Practical upshot: don't over-invest in Android-specific Fire polish, but the
  APK remains the right and sufficient artifact for Fire tablets today.
- Remaining work is the usual 👤 HUMAN store-listing set (free account, listing
  copy, 1024×500 feature graphic, icons, screenshots, IARC rating, privacy
  policy) — most of it re-croppable from `docs/play-store/`.

---

## Parallel content track

Identical to the iOS roadmap's — card art/names stay swappable (`game/cards.ts`
+ `game/cardArt.ts` + `public/cards/<slug>`); after any swap, re-run
`npx cap sync android` so the bundle picks it up. Thruster art redo and Tractor
Beam comprehension are the open items. No Android-specific content work.

## Risks / open questions

- **WebView video decode on low-end Android** — the biggest Android-only risk.
  30 card clips + win videos stream fine on modern hardware, but Android's device
  range is far wider than iOS. **Partly retired 2026-08-06:** playback looks good
  on a Fire HD 10 (MT8169, 3 GB RAM) with no dropped-frame warnings, memory
  pressure, or codec errors. **But it decodes entirely in software** — 77 ×
  `c2.android.avc.decoder` while `OMX.MTK.VIDEO.DECODER.AVC` sits unused —
  costing CPU, battery, and thermal headroom. Tracked in **#140**.
- **AAB size headroom — ⚠️ HEADROOM IS GONE.** The debug APK is **214 MB** as of
  2026-08-06, **over Play's 200 MB base-module limit**. Two ways out, and the
  first is far cheaper:
  1. **HEVC the hero clips, as iOS already does.** `scripts/build-hevc.sh`
     re-encodes only `*.hero.mp4` at CRF 26: **133 MB → 48 MB** on iOS. It
     deliberately skips Android because "browser HEVC support ... is
     hardware-dependent" — a blind hedge that is now testable and looks
     favourable: the Fire HD 10 **has** `OMX.MTK.VIDEO.DECODER.HEVC`, and AWV
     148 is well past Chrome 107 where HEVC `<video>` landed. Would put the APK
     near ~129 MB *and* might route decode to hardware, resolving #140 too.
     **Verify HEVC playback on a real device before relying on it** — and note
     Android's device range is wider than iOS's, so some phones may lack it.
  2. **Play Asset Delivery** (install-time asset pack) for the clips, if HEVC
     isn't enough or isn't universally safe.
  Note the hero clips are only *requested* above 761 CSS px (`CardTakeover.tsx`),
  so a portrait-locked **phone** never loads them — but tablets (incl. every Fire
  tablet) always do. Removing them is **not** a graceful fallback: `HERO_KINDS`
  in `src/game/cardArt.ts` is a hardcoded set, so deleting files yields 404s
  unless the code is gated too.
- **Edge-to-edge enforcement (API 35)** — must consume insets or content hides
  behind system bars (Phase 2/3). **Resolved 2026-08-06, with a caveat worth
  remembering: targeting API 36 does not opt you in, it only removes the
  opt-out.** Devices below API 35 — which includes every Fire tablet — need the
  explicit `setDecorFitsSystemWindows(false)` + transparent-bar theme. See
  Phase 2.
- **Back-button UX** — get this right or the app feels broken (Phase 2).
- **Cleartext WebSocket** for TV mode if ever enabled on Android (Phase 3).
- **Analytics platform detection** — the `capacitor:` scheme check is iOS-only;
  Android needs its own branch (Phase 3) or every Android session mislabels as web.
- **Capacitor major-version churn** — pinned at 8.4.1 across core/iOS/Android;
  upgrade deliberately, in lockstep with iOS.
