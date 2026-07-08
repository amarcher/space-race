# Google Play listing — Space Race

Draft copy and submission answers for the Play Console app record. Fill these
into the corresponding fields; character limits noted inline. Companion to
`docs/app-store/listing.md` (iOS) — same game, Play's fields and rules.

---

## Store presence → Main store listing

| Field | Value | Limit |
|-------|-------|-------|
| **App name** | `Space Race` | 30 |
| **Fallback** (if taken on Play) | `Space Race: 1000 Light-Years` | 30 (28 used) |
| **Package name** | `tech.spaceexplorer.spacerace` | — (immutable once uploaded) |
| **Default language** | English (United States) | — |

> Play package names are unique and permanent, so the app record locks to
> `tech.spaceexplorer.spacerace` on first upload. The store *name* is separate
> and can collide — the fallback keeps the "1000 Light-Years" brand if needed.

### Short description (80 chars, shown first in listings)

```
A fast space card duel — race a rival to 1,000 light-years. Free & offline.
```

### Full description (4000 chars)

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
• Slingshot! Slap down the perfect counter the instant a hazard hits and
  leap ahead.
• Quick games — a full race takes just a few minutes.
• No ads. No in-app purchases. No tracking.

Whether you've got two minutes in a waiting room or a long flight ahead, Space
Race is the space card game that's always ready to play.
```

---

## Categorization (Store settings → App category)

- **App type:** Games
- **Category:** Card
- **Tags:** card game, strategy, offline (choose the closest Play tags)

(As on iOS, deliberately **not** enrolled in *Designed for Families* — that
program restricts analytics SDKs, same tradeoff as Apple's Kids category. Target
audience is set to 13+ below.)

---

## Graphic assets (Store listing → Graphics)

| Asset | Spec | Source |
|-------|------|--------|
| **App icon** | 512 × 512 PNG, 32-bit, ≤1 MB | **`assets/play-icon-512.png`** — the Ace Pilot hero, same as the iOS/adaptive launcher icon |
| **Feature graphic** | **1024 × 500** PNG/JPG (REQUIRED by Play) | **`assets/feature-graphic.png`** (or `.jpg`) — Ace Pilot banner with the "SPACE RACE" wordmark + tagline on the brand-dark starfield. Generated this session. |
| **Phone screenshots** | 2–8, PNG/JPG, 16:9 or 9:16, each side 320–3840 px | reuse `docs/app-store/screenshots/iphone-6.9-*` (1320×2868) and `iphone-6.7-*` (1284×2778) table/rescue/scry/board captures (portrait; within Play's 320–3840 bounds, 9:16-ish) |
| **7" tablet screenshots** | up to 8 (recommended for tablet quality) | iPad captures re-shot on an Android tablet emulator, or Android tablet during internal testing |
| **10" tablet screenshots** | up to 8 | same |
| **Promo video** (optional) | YouTube URL | the existing win-hero / app-preview clip, uploaded to YouTube |

> Play does **not** derive tablet shots from phone shots (unlike App Store
> Connect's size derivation). To earn the "Optimized for tablets" badge you must
> supply 7"+10" sets. Minimum to publish is 2 phone screenshots + the feature
> graphic + the 512 icon.

---

## Content rating (App content → Content rating, IARC questionnaire)

Answer honestly — the space "hazards" (black holes, asteroid strikes, busted
thrusters) are obstacle cards, not depicted violence against people or creatures.

| Question | Answer |
|----------|--------|
| Violence (realistic / fantasy) | None |
| Sexuality / nudity | None |
| Profanity / crude humor | None |
| Controlled substances | None |
| Gambling (real or simulated) | None |
| Scary / disturbing content | None |
| User interaction / shares location / user-generated content | No |

**Expected result: Everyone (ESRB) / PEGI 3 / equivalent.** If IARC nudges the
hazards toward mild fantasy peril, "Everyone 10+ / PEGI 7" is still fine — same
posture as the iOS 4+/9+ questionnaire.

---

## Data safety (App content → Data safety)

Play's privacy declaration — must match `PrivacyInfo.xcprivacy` and the iOS
nutrition label.

- **Does your app collect or share user data?** → **Yes** (collects, does not share).
- **Data type collected:** **App activity → App interactions** (GA4 analytics events).
- **Purpose:** **Analytics**.
- **Is it shared with third parties?** → **No**.
- **Is it used to track users / linked to identity?** → **No** (first-party GA4,
  anonymous, no advertising ID).
- **Is collection optional?** → No (but no personal data is collected).
- **Data encrypted in transit?** → Yes (HTTPS).
- **Can users request deletion?** → No account exists; nothing tied to a person.

This is the only data collected. No ads, no advertising ID, no cross-app tracking.

---

## Target audience & content

- **Target age group:** **13+** (keeps out of *Designed for Families*; preserves
  analytics — mirrors the iOS decision to avoid the Kids category).
- **Appeals to children?** No specific child appeal claimed.
- **Ads:** **No ads** (declare "No, my app does not contain ads").

---

## App access

- **All functionality available without special access** → Yes. No login, no
  gated regions, no credentials. Reviewers can play immediately on launch. (No
  test-account instructions needed.)

---

## Store settings → Contact details

| Field | Value |
|-------|-------|
| **Email** (required, public) | andrew.m.archer@gmail.com |
| **Website** | https://game.spaceexplorer.tech |
| **Privacy policy** (required) | https://game.spaceexplorer.tech/privacy.html |

---

## Pricing & distribution

- **Free** (cannot be changed to paid later).
- **Countries:** all available.
- **Contains ads:** No. **In-app purchases:** No.
- **Content guidelines / US export laws:** acknowledge (standard HTTPS only,
  `ITSAppUsesNonExemptEncryption`-equivalent — no custom crypto).

---

## Release notes (first release)

```
First release of Space Race — a fast, offline space card game. Race a rival to
1,000 light-years, dodge black holes and asteroids, and slingshot past them at
the last second. No ads, no accounts.
```

---

## Submission checklist (human steps)

1. [ ] **Register a Google Play Console account** ($25 one-time) — the one hard
   prerequisite.
2. [ ] **Set up the upload key:** `./web/scripts/android-release.sh
   --init-keystore` (writes `upload-keystore.jks` + gitignored
   `keystore.properties`). **Back up the keystore off-machine.** Enroll in Play
   App Signing (default).
3. [ ] **Create the app** in Play Console: package `tech.spaceexplorer.spacerace`,
   name "Space Race" (or fallback), Free, Game.
4. [ ] **Build the AAB:** `./web/scripts/android-release.sh` →
   `app/build/outputs/bundle/release/app-release.aab`.
5. [ ] **Internal testing:** upload the AAB, add testers (family), install via the
   Play opt-in link on a real device (the "on Milo's tablet" goal, no review wait).
6. [ ] **Complete the Console forms** — this listing (name, descriptions,
   graphics incl. the 1024×500 feature graphic, screenshots), **Data safety**,
   **Content rating (IARC)**, **Target audience**, **Ads = none**, Contact +
   Privacy policy, Pricing (free, all countries).
7. [ ] **Promote Internal → Production** (or a closed/open test first) and submit
   for review.

Everything above the checklist is drafted. The checklist items need the paid
Console account and the Play Console web forms.

---

## Automation notes (for whoever drives the Console browser session)

Play Console form automation caveats — analogous to the App Store Connect
lessons in `asc-forms-need-real-keystrokes`, to be confirmed against Play's UI:

- The **feature graphic** and **screenshots** upload through a browser file
  picker (browser-owned) — likely human-only, as ASC media upload was.
- Treat programmatic form fills as suspect until reload-verified; type real
  keystrokes into text fields and re-read after save.
- The **AAB upload** is a large file through the Console (or the Play Developer
  Publishing API / `fastlane supply` for a scripted path — the CLI route avoids
  the browser entirely and is worth setting up if uploads become routine).
```
