# App Store listing — Space Race

Draft copy and submission answers for the App Store Connect record. Fill these
into the corresponding fields; character limits noted inline.

---

## Name & identity

| Field | Value | Limit |
|-------|-------|-------|
| **App Name** | `Space Race` | 30 |
| **Fallback name** (if "Space Race" is taken) | `Space Race: 1000 Light-Years` | 30 (28 used) |
| **Subtitle** | `Cosmic card duel to 1,000 LY` | 30 (28 used) |
| **Bundle ID** | `tech.spaceexplorer.spacerace` | — |
| **Primary language** | English (U.S.) | — |

> **Name-collision plan:** "Space Race" is a common phrase — expect it may be
> taken on the store. The fallback `Space Race: 1000 Light-Years` keeps the
> original brand ("1000 Light-Years") alive and is almost certainly unique. If
> even the fallback collides, append a disambiguator (`Space Race — Card Game`).
> The in-app display name (`CFBundleDisplayName`) stays `Space Race` regardless;
> only the App Store listing name needs to be unique.

---

## Category

- **Primary:** Games → Card
- **Secondary:** Games → Family

(Deliberately **not** the Kids category — that would ban the GA4 analytics under
Guideline 1.3. Positioning is "a free space card game," per the Phase 0 rebrand.)

---

## Promotional text (170 chars, editable without review)

```
Blast off in a fast, friendly card duel. Dodge black holes and asteroids, fire your engines, and race a rival to 1,000 light-years. Free, offline, no ads.
```

## Description (4000 chars)

```
Space Race is a cosmic card game — a fast, friendly duel across the galaxy.

Draw, plan, and fire your engines to be the first ship to travel 1,000
light-years. But the void fights back: black holes freeze your drive, asteroid
strikes cripple your hull, and an empty fuel tank leaves you drifting. Patch the
damage, top off the tank, and blast past your rival before they reach the finish.

It's the classic "hazards and remedies" race, reimagined among the stars — easy
to learn in one hand, with just enough strategy to keep every game close.

FEATURES
• Single-player against a sharp AI rival — no account, no sign-up.
• Fully offline. Every card, animation, and sound ships in the app. Play on a
  plane, a subway, or anywhere with no signal.
• Beautiful, tactile cards with real haptics — feel every engine burn, hazard
  hit, and last-second reversal.
• A "scry" peek at what's coming, so the smart play is always in reach.
• Coup-fourré! Slap down the perfect counter the instant a hazard hits and
  leap ahead.
• Quick games — a full race takes just a few minutes.
• No ads. No in-app purchases. No tracking.

Whether you've got two minutes in a waiting room or a long flight ahead, Space
Race is the space card game that's always ready to play.
```

## Keywords (100 chars, comma-separated, NO spaces after commas)

```
card game,space,mille bornes,hazards,remedies,strategy,offline,solitaire,rival,race,light years,duel
```

(97 chars. Don't repeat the app name or subtitle words — Apple already indexes
those. "cosmic," "galaxy," "sci-fi" are candidates if any of the above test weak.)

---

## URLs

| Field | Value |
|-------|-------|
| **Support URL** (required) | `https://game.spaceexplorer.tech` |
| **Marketing URL** (optional) | `https://game.spaceexplorer.tech` |
| **Privacy Policy URL** | `https://game.spaceexplorer.tech/privacy.html` (static page in `web/public/`, ships with this PR) |

> The web game at `game.spaceexplorer.tech` doubles as support + marketing.
> The policy page is live at `/privacy.html` (no accounts, anonymous analytics
> only, no tracking) — App Store Connect will not accept a submission without it.

---

## Age rating questionnaire → **4+**

Answer the questionnaire honestly. The "hazards" (black holes, asteroid strikes,
busted thrusters) are obstacle cards, not depicted violence — nothing is shown
happening to a person or creature.

| Question | Answer |
|----------|--------|
| Cartoon or Fantasy Violence | **None** |
| Realistic Violence | None |
| Sexual Content / Nudity | None |
| Profanity / Crude Humor | None |
| Alcohol, Tobacco, Drugs | None |
| Simulated Gambling | None |
| Horror / Fear Themes | None |
| Medical / Treatment Info | None |
| Contests | None |
| Unrestricted Web Access | **No** (offline app, no in-app browser) |
| Gambling & Contests | No |

**Expected result: 4+.** If Apple's tooling nudges the space hazards toward
"Infrequent/Mild Cartoon or Fantasy Violence," that yields **9+** — still fine,
still out of the Kids category. Answer "None" first; only escalate if review
pushes back.

---

## Privacy nutrition label (must match PrivacyInfo.xcprivacy)

- **Data used to track you:** None.
- **Data linked to you:** None.
- **Data not linked to you:** **Usage Data → Product Interaction** (GA4 analytics).

Questionnaire path in App Store Connect:
1. "Do you collect data?" → **Yes**.
2. Data type: **Usage Data → Product Interaction**.
3. Purpose: **Analytics**.
4. Linked to identity? → **No**.
5. Used for tracking? → **No**.

This is the only data collected. GA4 is first-party, no IDFA, no ATT prompt.
Matches `web/ios/App/App/PrivacyInfo.xcprivacy` exactly.

---

## App Review notes

```
Space Race is an offline, single-player card game. No login, no network, no
in-app purchases. The full experience is available immediately on launch — deal
a hand and play.

Analytics: Google Analytics 4 (first-party, anonymous product-interaction
events only; no IDFA, no cross-app tracking) — declared in the privacy manifest.

The app has an optional "TV mode" for casting to a second screen over the local
network. This is NOT reachable in the shipped App Store build (it is gated behind
a URL flag that the bundled app never sets), requires a separate LAN daemon, and
is not needed to review or play the game. The Local Network usage string is
present only so the feature degrades gracefully if ever enabled.
```

---

## Screenshots

See `docs/app-store/screenshots/`. Required:

- **6.9" iPhone** (1320 × 2868) — iPhone 17 Pro Max, portrait. **Required.**
- **13" iPad** (2064 × 2752) — iPad Pro 13-inch, portrait. Required if the app
  ships for iPad (it does — `TARGETED_DEVICE_FAMILY = 1,2`).

App Store Connect derives the 6.5"/6.7" slots from the 6.9" set, so one iPhone
size covers modern devices. An optional **app preview video** can be cut from the
existing win hero clip (`public/og.mp4`) — nice-to-have, not required for submit.

---

## Submission checklist (human steps)

1. [ ] **Enroll in the Apple Developer Program** ($99/yr) — the one hard
   prerequisite; nothing below works without it.
2. [ ] **Xcode signing:** open `web/ios/App/App.xcodeproj`, select the App
   target → Signing & Capabilities → check *Automatically manage signing* →
   select your Team. (Project is already `CODE_SIGN_STYLE = Automatic`.)
3. [ ] **App Store Connect → create app record:** platform iOS, bundle ID
   `tech.spaceexplorer.spacerace`, name `Space Race` (or the fallback if taken).
4. [ ] **Fill this listing** — name, subtitle, description, keywords, URLs,
   category, age rating, privacy label. Host the Privacy Policy page and paste
   its URL.
5. [ ] **Upload the build:** `TEAM_ID=<your-team> ./web/scripts/ios-release.sh
   --signed` produces an App Store `.ipa`, or archive in Xcode and use the
   Organizer → Distribute App. First upload can also go straight through Xcode.
6. [ ] **TestFlight internal testing** — add yourself/family, install on a real
   device (satisfies the "on Milo's iPad" goal with no review pressure).
7. [ ] **Attach screenshots** (from `docs/app-store/screenshots/`) and submit for
   review.

Everything above the checklist is drafted and ready. The checklist items are the
genuinely-human steps: they need the paid account, an interactive Xcode signing
selection, and the App Store Connect web console.
```
