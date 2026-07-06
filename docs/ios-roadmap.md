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

## Phase 1 — Capacitor scaffold (goal: game running on a real iPhone)

- [ ] `cd web && npm i @capacitor/core && npm i -D @capacitor/cli && npm i @capacitor/ios`
- [ ] `npx cap init "Space Race" <bundle-id> --web-dir dist` — pick the bundle
      id once, it's forever (suggest `tech.spaceexplorer.spacerace`).
- [ ] `npm run build && npx cap add ios && npx cap open ios` — first run in the
      Simulator, then a cabled device (free personal team signing is fine for
      this phase).
- [ ] **Bundle all assets**: `dist/` (~101MB incl. `cards/`, `sfx/`, `ui/`,
      `win/`) ships inside the app. Fully offline, zero server dependency.
      Well under App Store size limits; nothing needs to stay remote.
- [ ] **Disable the service worker in the native app** — Capacitor serves from
      disk, Workbox caching is pure overhead there. Gate registration on
      `Capacitor.isNativePlatform()` (keep it for web).
- [ ] `capacitor.config.ts`: `allowsInlineMediaPlayback: true`,
      `mediaPlaybackRequiresUserAction: false` (card-play clips and the win
      hero autoplay), `backgroundColor: '#07071a'`.
- [ ] Verify the AudioContext unlock-on-first-gesture path in `sfx.ts` fires in
      WKWebView (it should — same Safari engine).
- [ ] Add `web/ios/` to the repo; gitignore Xcode DerivedData/Pods noise.
- [ ] Script the sync so iOS never drifts: `"ios": "npm run build && npx cap sync ios"`
      in `package.json` (open Xcode + archive stays manual for now).

**Exit criteria:** full game (deal → play → win takeover, sound on) on a
physical iPhone, airplane mode.

## Phase 2 — Make it feel native

- [ ] **Safe areas** — the big one. `viewport-fit=cover` is already set; audit
      every screen edge (top bar, hand fan, settings sheet, win takeover) with
      `env(safe-area-inset-*)` padding so nothing collides with the notch /
      Dynamic Island / home indicator. Test iPhone SE → Pro Max → iPad.
- [ ] **Haptics** (`@capacitor/haptics`) behind a tiny `haptics.ts` shim that
      no-ops on web: light tick on card pick-up/drop, medium on hazard hit,
      heavy + success pattern on coup-fourré and the win moment. Cheap, and it
      does the most for the MTG-Arena feel on a phone.
- [ ] Launch screen: storyboard in `#07071a` with the logo — must feel
      continuous with the starfield boot.
- [ ] App icon set from the existing 512px art (regenerate at 1024 for the
      store).
- [ ] Status bar: `@capacitor/status-bar`, translucent over the game.
- [ ] Kill webview artifacts: no rubber-band overscroll, no double-tap zoom, no
      text selection/callout on long-press of cards (`touch-action`,
      `-webkit-user-select`, `overscroll-behavior` audit — DragLayer especially).
- [ ] Keep-awake plugin so the screen doesn't sleep mid-game.
- [ ] `@capacitor/share` on the win screen — share the win clip (App Review
      likes native integrations; players like bragging).

**Exit criteria:** a stranger handling the phone can't tell it's a webview.

## Phase 3 — iOS-specific edges

- [ ] **TV mode / arcade WebSocket** (`src/tv/arcadeClient.ts`, LAN `:8771`):
      add `NSLocalNetworkUsageDescription` (+ Bonjour services key if needed)
      to Info.plist — iOS prompts for Local Network permission on first
      connect. Phone-as-controller + TV-as-stage is a *stronger* story in the
      app; make sure the permission denial path degrades gracefully.
- [ ] **Analytics**: GA4 + Vercel Analytics run fine in the webview, but tag
      platform (`gtag('set', {platform: 'ios'})` or a custom dimension) so the
      app-tracker dashboard splits web vs iOS. Add App Tracking Transparency
      only if required — GA4 first-party config without IDFA shouldn't need it.
- [ ] Orientation: decide phone = portrait-locked vs free; iPad = both (iPad
      multitasking/size-classes get App Review attention).
- [ ] Audit `localStorage` persistence (settings, mute) — fine in WKWebView,
      but consider `@capacitor/preferences` for durability across OS cleanups.
- [ ] External links (if any) must open in Safari (`@capacitor/browser`), not
      the app webview.

## Phase 4 — Ship

- [ ] Apple Developer Program ($99/yr), App Store Connect app record.
- [ ] **TestFlight first**: internal testing on family devices; this alone
      satisfies the "on Milo's iPad" goal with no review pressure.
- [ ] Store listing: name **Space Race** may collide with existing apps — have
      a fallback ready ("Space Race: 1000 Light-Years" keeps the old name alive
      as a subtitle/keyword). Screenshots (6.7", 6.1", iPad), preview video cut
      from the win hero clip, privacy nutrition label (analytics = "Data Not
      Linked to You"), age rating questionnaire (aim 4+, list under
      Games → Card, **not** Kids category).
- [ ] **Guideline 4.2 (minimum functionality)** insurance if review pushes
      back on "web wrapper": haptics + offline + share (Phases 2–3) usually
      suffice for a polished game; **Game Center** achievements/leaderboard
      (community Capacitor plugin) is the escalation move.
- [ ] Release cadence: script `build → cap sync → xcodebuild archive → upload`
      (fastlane or a plain script) so every web release can ship to iOS the
      same day.

**Exit criteria:** approved App Store listing; downloading it on a fresh phone
and winning a game with zero network.

---

## Parallel content track (does not block Phases 1–4)

The card set must stay **swappable** — art and names will get another pass.

- **Swap-ability**: card identity already flows from `game/cards.ts` +
  `game/cardArt.ts` + `public/cards/<slug>` assets. Keep it that way: any new
  art/name lands by replacing an asset + one definition entry, no engine
  changes. (After any swap, re-run `npx cap sync` so the bundle picks it up.)
- **Thruster** — weakest card art; queue for regeneration in the next art pass.
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
