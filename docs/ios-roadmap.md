# Space Race — iOS Roadmap

Ship the web game (`web/`) as a native iOS app via **Capacitor**, fully offline
with all assets bundled (no server costs), distributed through TestFlight and
then the App Store. The web app at https://game.spaceexplorer.tech stays the
primary product and keeps auto-deploying; the iOS app is a wrapper around the
same Vite build output — **one codebase, two ships**.

Why Capacitor (decided 2026-07-06): the game is pure client-side React/DOM/CSS
(~5.8k lines), already a PWA, no backend for core play. A React Native or
SwiftUI rewrite would rebuild every animation (card tilt, drag/flight layers,
video takeovers) for no user-visible gain. WKWebView handles this workload
smoothly on modern iPhones/iPads.

---

## Phase 0 — Rebrand + gameplay default ✅ (done 2026-07-06)

- [x] Rebrand "1000 Light-Years" → **Space Race** everywhere user-facing:
      `index.html` SEO/OG/Twitter/JSON-LD, PWA manifest (`vite.config.ts` —
      install prompt now says "Space Race"), in-game `<h1>`s (Table, Gallery,
      TV stage), `apple-mobile-web-app-title`, print sheet, `package.json`,
      README, PLAN.md, code headers.
- [x] Strip kid-targeted verbiage from SEO/docs (titles, descriptions,
      keywords, JSON-LD `audience`). Positioning is now "a free space card
      game" — this also keeps the App Store listing out of the Kids category,
      which would ban our analytics (Guideline 1.3).
- [x] Two-up scry is the factory default for new players (`web/src/settings.ts`
      `FACTORY_RULES`). `DEFAULT_RULES` stays classic — it's the sim-harness
      regression baseline. Players with saved settings keep their choice; the
      exploratory modes (catch-up, momentum, self-heal, 3-card scry) live on as
      Settings toggles.

## Phase 1 — Capacitor scaffold ✅ (done 2026-07-06, PR #82; verified in Simulator)

- [x] `cd web && npm i @capacitor/core && npm i -D @capacitor/cli && npm i @capacitor/ios`
- [x] `npx cap init "Space Race" tech.spaceexplorer.spacerace --web-dir dist`
- [x] `npm run build && npx cap add ios` — runs in the iPhone 17 Pro Simulator
      (Capacitor 8.4.1, SwiftPM — no CocoaPods).
- [x] **Bundle all assets**: `dist/` ships inside the app. Fully offline, zero
      server dependency.
- [x] **Disable the service worker in the native app** — gated on
      `Capacitor.isNativePlatform()` in `src/main.tsx` (kept for web).
- [x] `capacitor.config.ts`: `backgroundColor: '#07071a'`. Inline media autoplay
      is the WKWebView default in Capacitor (no config key needed — documented in
      the config header).
- [x] AudioContext unlock-on-first-gesture (`sfx.ts`) confirmed in WKWebView.
- [x] Add `web/ios/` to the repo; DerivedData/Pods gitignored.
- [x] `"ios": "npm run build && npx cap sync ios"` in `package.json`.
- [x] **Self-host fonts** (offline completeness): Unbounded (500/700/900) + Inter
      (400/500/600/700) latin woff2 in `public/fonts/`, `@font-face` in
      `index.css`, Google Fonts `<link>`s removed, woff2 precached by the SW.

**Exit criteria:** full game (deal → play → win takeover, sound on) offline —
met in the Simulator (device/airplane-mode pass deferred to a signed build).

## Phase 2 — Make it feel native ✅ (done 2026-07-06)

- [x] **Safe areas** — audited every screen edge with `env(safe-area-inset-*)`;
      centralised `--safe-*` custom properties in `index.css`. (PR #81.)
- [x] **Haptics** (`@capacitor/haptics` 8.0.2) behind `src/native/haptics.ts`,
      no-op on web: light on card pick/drop, medium on hazard hit / big
      momentum, heavy + success ring on coup-fourré and the win. Wired at the
      same seams as `playSfx()`, gated to player-meaningful moments (your own
      plays + things happening to you — never buzzing on the AI's routine turns).
- [x] Launch screen: `LaunchScreen.storyboard` is now a flat `#07071a` view
      (default Capacitor Splash imageset dropped) — continuous with the starfield
      boot, verified in the Simulator (dark, no white flash).
- [x] App icon set: 1024×1024 opaque (no alpha) generated from the `favicon.svg`
      planet mark; the Capacitor placeholder is replaced.
- [x] Status bar: `@capacitor/status-bar` 8.0.2, `Style.Dark` (light text) over
      the dark app, no webview overlay; set once at boot behind the native check.
- [x] Killed webview artifacts: `overscroll-behavior: none` (no rubber-band),
      `touch-action: manipulation` (no double-tap zoom), `-webkit-user-select`/
      `-webkit-touch-callout: none` on the game surface (selection re-enabled on
      the one scrollable reading view). Cards/DragLayer already covered.
- [x] Keep-awake (`@capacitor-community/keep-awake` 8.0.1) — screen held on for
      the session; `src/native/keepAwake.ts`, no-op on web.
- [x] `@capacitor/share` 8.0.1 on the win screen — a share button (human win
      only) opens the native sheet on iOS, Web Share on web; `src/native/share.ts`.

**Exit criteria:** a stranger handling the phone can't tell it's a webview.
(Haptics can't fire in the Simulator — verified by code inspection + a clean
device build; will feel them on a cabled device in Phase 4.)

## Phase 3 — iOS-specific edges ✅ (done 2026-07-06, branch `ios-edges`)

- [x] **TV mode / arcade WebSocket** (`src/tv/arcadeClient.ts`, LAN `:8771`):
      added `NSLocalNetworkUsageDescription` to `Info.plist` ("Space Race
      connects to your TV on your home network…"). **No `NSBonjourServices` key
      needed** — that key only gates Bonjour/mDNS *service browsing*
      (`NSNetServiceBrowser`); the client dials a concrete host:port
      (`ws://<lan-ip>:8771`), which trips the Local Network prompt on first
      connect and needs only the usage-description string. Denial path audited
      and already graceful: `ArcadeClient` auto-reconnects with capped backoff
      (250 ms → 5 s max), `TvStage` shows a non-blocking `connecting/closed`
      badge, and the phone's `usePhoneBroadcast` `sendToAll` no-ops until the
      socket opens. **Crucially, all of this is gated behind `?mode=` (see
      `App.tsx`) — the shipped iOS app has no URL flag, so `tvMode()` is `null`,
      no socket is ever opened, and the Local Network prompt never even appears
      in normal single-player play.** No code changes required.
- [x] **Analytics**: tagged platform as a GA4 **user property** in `index.html`
      — `gtag('set', 'user_properties', { platform: … })` before `config`.
      Native detection runs in `<head>` (before the bundle, so
      `Capacitor.isNativePlatform()` is unavailable) via
      `location.protocol === 'capacitor:'` — Capacitor 8 iOS serves the app from
      `capacitor://localhost` (verified: sim console logged
      `⚡️ Loading app at capacitor://localhost…`; web sends `up.platform=web`,
      verified in DevTools network capture). No ATT added — GA4 first-party, no
      IDFA. `@vercel/analytics` + Speed Insights now gated behind
      `!Capacitor.isNativePlatform()` in `App.tsx` (they'd only 404 against the
      offline `capacitor://localhost` origin; they don't throw, but there's no
      point running them off Vercel).
- [x] Orientation: **iPhone portrait-locked, iPad all four.** `Info.plist`
      `UISupportedInterfaceOrientations` = `[Portrait]`;
      `UISupportedInterfaceOrientations~ipad` keeps Portrait, PortraitUpsideDown,
      LandscapeLeft, LandscapeRight. (TV-stage mode is a separate web build on an
      actual TV, unaffected.)
- [x] `localStorage` persistence (settings, mute): **kept `localStorage` as the
      sole source of truth — did NOT add `@capacitor/preferences`.** The reads
      (`settings.ts` `loadRules`, `sfx.ts` mute) are synchronous and fire at
      boot / new-game time; Preferences is Promise-based, so mirroring it in
      would force an async restore-before-first-render bootstrap and leak async
      into game code — not the "small clean win" bar. WKWebView `localStorage`
      is WebKit-backed and durable across launches for an installed, actively
      used app; eviction only happens under genuine storage pressure. Revisit
      only if real-world purging shows up.
- [x] External links: **none exist.** Grep of `src/` for `target="_blank"`,
      `window.open`, and `<a href`/`href=` to an external URL found nothing — the
      only outward action is the win-screen share button (native share sheet,
      Phase 2). Nothing to route through `@capacitor/browser`.

## Phase 4 — Ship

Ship-readiness landed on branch `ios-ship-readiness` (2026-07-06): everything is
done and verified **except** the steps that require the paid Apple account and an
interactive signing selection. Those are flagged **👤 HUMAN** below.

- [x] **Versioning**: `MARKETING_VERSION = 1.0.0`, `CURRENT_PROJECT_VERSION = 1`
      in the Xcode project (both Debug + Release configs). Verified in the built
      `App.app/Info.plist`.
- [x] **Export compliance**: `ITSAppUsesNonExemptEncryption = false` in
      `Info.plist` — app uses only standard HTTPS/ATS (grep confirmed no custom
      crypto in `src/`). App Store Connect will skip the per-release
      export-compliance question.
- [x] **Privacy manifest**: `web/ios/App/App/PrivacyInfo.xcprivacy` — tracking
      false; product-interaction analytics (GA4, not linked, no tracking);
      UserDefaults access (CA92.1, Capacitor plugin settings). Wired into the
      Xcode project's Resources build phase; confirmed bundled at the `.app` root
      in the archive. (Capacitor's own framework manifests declare empty API/data
      arrays, so the app-level one supplies both.)
- [x] **Unsigned archive proof**: `xcodebuild … archive CODE_SIGNING_ALLOWED=NO`
      → **ARCHIVE SUCCEEDED** for `generic/platform=iOS`. Device-arch compile +
      archive work; only signing remains.
- [x] **Release script**: `web/scripts/ios-release.sh` (npm `ios:archive`) —
      vite build → cap sync → xcodebuild archive. Unsigned by default; `--signed`
      (with `TEAM_ID=…`) does automatic signing + `-exportArchive` to an App
      Store `.ipa`. Runs end-to-end in unsigned mode.
- [x] **Screenshots**: `docs/app-store/screenshots/` — 6.9" iPhone (1320×2868)
      and 13" iPad (2064×2752), table + rules for each. (simctl can't tap; the
      rules shot used a throwaway view-default override. In-play/win shots need a
      real device during TestFlight — see the screenshots README.)
- [x] **Store listing draft**: `docs/app-store/listing.md` — name + fallback,
      subtitle, promo text, description, keywords, URLs, category (Games → Card /
      Family, **not** Kids), age rating (→ 4+), privacy nutrition label, review
      notes, and the human submission checklist.
- [ ] 👤 **HUMAN — Apple Developer Program** ($99/yr) + App Store Connect app
      record (bundle id `tech.spaceexplorer.spacerace`).
- [ ] 👤 **HUMAN — Xcode signing**: open the project, enable Automatic signing,
      select the Team (project is already `CODE_SIGN_STYLE = Automatic`).
- [ ] 👤 **HUMAN — upload + TestFlight**: `TEAM_ID=… ./web/scripts/ios-release.sh
      --signed` (or Xcode Organizer) → TestFlight internal → install on family
      devices (satisfies the "on Milo's iPad" goal with no review pressure).
- [ ] 👤 **HUMAN — submit**: attach screenshots, host a Privacy Policy page, fill
      the listing, submit for review.
- [ ] **Guideline 4.2 (minimum functionality)** insurance if review pushes
      back on "web wrapper": haptics + offline + share (Phases 2–3) usually
      suffice for a polished game; **Game Center** achievements/leaderboard
      (community Capacitor plugin) is the escalation move.

**Exit criteria:** approved App Store listing; downloading it on a fresh phone
and winning a game with zero network. *(Blocked only on the 👤 HUMAN steps.)*

---

## Parallel content track (does not block Phases 1–4)

The card set must stay **swappable** — art and names will get another pass.

- **Swap-ability**: card identity already flows from `game/cards.ts` +
  `game/cardArt.ts` + `public/cards/<slug>` assets. Keep it that way: any new
  art/name lands by replacing an asset + one definition entry, no engine
  changes. (After any swap, re-run `npx cap sync` so the bundle picks it up.)
- **Thruster** — weakest card art; queue for regeneration in the next art pass.
- **Warp-25 animated clip** — DONE (2026-07-06): clip + poster regenerated in
  Google Flow (Veo) from the v2 slow still; the whole 25 surface (still,
  poster, play clip) now reads as a calm drift.
- **Tractor Beam** — weakest *comprehension*: players don't get that it caps
  you at 50 LY per play. Fixes to explore (pick during the pass, cheap → rich):
  card-face copy ("MAX 50 LY"), a persistent "⛓ 50 LY cap" chip on the
  afflicted player's board, and/or a brief first-encounter tooltip.
- Candidate rename sweep alongside art: names should self-explain mechanics
  (the Tractor Beam lesson applies to the whole set).

## Risks / open questions

- **App Store name collision** on "Space Race" — check in App Store Connect
  early (Phase 4 fallback name above).
- **WKWebView video memory**: 30 card clips + win videos are fine streamed, but
  test older devices (A12-era iPad) for decode pressure in long sessions.
- **Guideline 4.2** — mitigations above; worst case is one resubmission with
  Game Center added.
- **Capacitor major-version churn** — pin versions; upgrade deliberately, not
  with every web deploy.
