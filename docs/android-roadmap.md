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
- [x] **Adaptive launcher icon** — the planet mark (favicon motif), generated by
      `@capacitor/assets` from `web/assets/` source art
      (`scripts/gen-android-assets.mjs`): foreground + `#07071a` background +
      **monochrome** (Android 13+ themed icons) in `mipmap-anydpi-v26/`, all
      density PNGs + legacy fallbacks. Masked-icon preview verified (circle +
      squircle).
- [x] **Splash screen** — Android 12+ SplashScreen API wired in `styles.xml`:
      `windowSplashScreenBackground = @color/spaceBg` (#07071a),
      `windowSplashScreenAnimatedIcon` = the planet, `postSplashScreenTheme`
      hands off to the dark no-action-bar theme (no white flash). Dark `@drawable/splash`
      covers pre-12. Continuous with the starfield boot, matching iOS.
- [~] **Status bar + edge-to-edge** — the shared `@capacitor/status-bar` boot
      call (`Style.Dark` = light icons, overlay) already applies. **API 35
      (Android 15) enforces edge-to-edge** for `targetSdk 35+`; the iOS
      `env(safe-area-inset-*)` CSS is in place. **Still to verify on device**:
      that the Android window insets actually feed those CSS vars so nothing
      hides behind the status/nav bars (plumb from the inset listener if not).
- [x] **Killed webview artifacts** — the iOS CSS (`overscroll-behavior: none`,
      `touch-action: manipulation`, no selection/callout on the game surface) is
      platform-neutral and already applies. *Verify on device*: no Android-only
      long-press selection or pull-to-refresh.
- [x] **Haptics** — `@capacitor/haptics` uses the Android `Vibrator` (`VIBRATE`
      permission auto-added by the plugin). *Verify on a real device* (emulator
      can't vibrate).

**Build status:** web build + `cap sync android` + `assembleDebug` all green with
the new plugin and resources. **On-device runtime smoke-test is pending** — the
local emulator can't launch here (Hypervisor Framework / HVF fails to init in
this environment), so Back-button behavior, the splash, the masked launcher icon,
edge-to-edge insets, and haptics want a real-device pass (via Play internal
testing, or a cabled device). Same posture as the iOS "device pass deferred."

**Exit criteria:** a stranger handling the phone can't tell it's a webview, and
Back behaves like a native app. *(Code complete; on-device confirmation pending.)*

## Phase 3 — Android-specific edges

- [ ] **Analytics platform split — the key gotcha.** iOS tags the GA4 `platform`
      user property in `<head>` via `location.protocol === 'capacitor:'`. **This
      check fails on Android** — Capacitor Android serves from
      `https://localhost`, so the current code would mislabel Android sessions as
      `web`. Fix options (pick one, then verify in the emulator via a GA4
      DebugView / network capture, exactly as iOS was verified):
      1. **UA marker (recommended):** set `appendUserAgentString: "SpaceRaceAndroid"`
         in the `android` config block and sniff `navigator.userAgent` in `<head>`.
         Robust, pre-bundle, and disambiguates from `localhost` dev servers.
      2. Move the platform tag into the bundle and use `Capacitor.getPlatform()`
         (`'ios' | 'android' | 'web'`), sending the GA4 user property after
         `config` instead of in `<head>`.
      Keep the iOS `capacitor:` branch; add an Android branch beside it. Also gate
      `@vercel/analytics`/Speed Insights off Android (already gated behind
      `!Capacitor.isNativePlatform()`, which covers it).
- [ ] **Orientation** — mirror iOS: **phone portrait-locked, tablet unrestricted.**
      Android has no `~ipad` split, so lock portrait in the manifest and relax it
      at runtime when `smallestScreenWidthDp >= 600` (tablet), or use a
      `values`/`values-sw600dp` bool resource read in `MainActivity`.
- [ ] **TV mode / LAN WebSocket** — same as iOS, this is gated behind a `?mode=`
      URL flag the shipped app never sets, so no socket ever opens and **no extra
      permission is needed** for normal play. If TV mode is ever enabled on
      Android, note that Android 9+ blocks **cleartext** traffic by default:
      `ws://<lan-ip>:8771` would need a `network_security_config.xml` allowing
      cleartext to local addresses. Not required for the shipped build.
- [ ] **localStorage persistence** — keep `localStorage` as the sole store (same
      decision as iOS; WebView localStorage is durable for an installed app).
      Do **not** add `@capacitor/preferences` unless real-world eviction appears.

**Exit criteria:** analytics correctly split `android` vs `ios` vs `web`;
orientation matches iOS; no permission prompts in normal play.

## Phase 4 — Ship to Google Play

Everything below is drafted/automatable **except** the steps needing the paid
Play Console account and interactive Console web forms — flagged **👤 HUMAN**.

- [ ] **Versioning** — `versionCode` is a monotonically increasing **integer**
      (bump every upload, even for the same `versionName`); `versionName` is the
      display string (`1.0.0`). Set in `android/app/build.gradle`.
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

## Parallel content track

Identical to the iOS roadmap's — card art/names stay swappable (`game/cards.ts`
+ `game/cardArt.ts` + `public/cards/<slug>`); after any swap, re-run
`npx cap sync android` so the bundle picks it up. Thruster art redo and Tractor
Beam comprehension are the open items. No Android-specific content work.

## Risks / open questions

- **WebView video decode on low-end Android** — the biggest Android-only risk.
  30 card clips + win videos stream fine on modern hardware, but Android's device
  range is far wider than iOS. Test on a low-RAM / older device (Go-class, A-series
  Samsung) for decode pressure and jank in long sessions; downscale/shorten clips
  if needed (the content track already owns clip regeneration).
- **AAB size headroom** — ~100 MB of assets (96 MB video) sits under the 200 MB
  base-module limit but leaves limited room to grow. If the deck's video grows,
  move clips to **Play Asset Delivery** (install-time asset pack) rather than the
  base module. Video barely compresses, so watch the total.
- **Edge-to-edge enforcement (API 35)** — must consume insets or content hides
  behind system bars (Phase 2/3).
- **Back-button UX** — get this right or the app feels broken (Phase 2).
- **Cleartext WebSocket** for TV mode if ever enabled on Android (Phase 3).
- **Analytics platform detection** — the `capacitor:` scheme check is iOS-only;
  Android needs its own branch (Phase 3) or every Android session mislabels as web.
- **Capacitor major-version churn** — pinned at 8.4.1 across core/iOS/Android;
  upgrade deliberately, in lockstep with iOS.
