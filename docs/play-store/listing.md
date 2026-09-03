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

**The Play build collects NOTHING.** Superseded 2026-09-03: this section used to
declare GA4 analytics, because the Play build carried gtag.js. It no longer does
— the target audience now includes under-13s, which puts the app under Google
Play's Families policy, and plain gtag.js is not approved for child-directed
treatment. `index.html` loads no GA4 on either Android ship. So:

- **Does your app collect or share user data?** → **No**.
- No data types, no purposes, no third-party sharing, no advertising ID.
- **Data encrypted in transit?** → n/a (nothing is transmitted).
- **Can users request deletion?** → No account exists and nothing is collected.

Diverges deliberately from `PrivacyInfo.xcprivacy` and the iOS nutrition label,
which still describe the iOS build's GA4 — that build is 13+ and keeps analytics.
Do not "align" them; they describe different binaries.

---

## Target audience & content

- **Target age group:** **includes under-13** (Andrew's call, 2026-09-03) — the
  widest family reach. This is a deliberate reversal of the earlier 13+ plan and
  of the iOS posture, and it has a price: it puts the app under Google Play's
  **Families policy**, which is why the Play build now ships with **no analytics
  at all** (see Data safety above). Expect a neutral age screen requirement and
  SDK-compliance obligations.
- **Content rating:** **ESRB Everyone / PEGI 3 / IARC 3+** — submitted and
  returned 2026-09-03, lowest tier from every authority.
- **Appeals to children?** Yes, by declaration.
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

> **Account, entity and brand are decided — see `account.md`.** Space Race
> publishes from a Google Play **organization** account registered to FABLE
> DESIGNER LLC (D-U-N-S 148571084), public developer name **"Fable Designer"**.
> The org exemption means **no closed test and no 12 testers** — this goes
> straight to production.

1. [ ] **Register the organization account** ($25) and clear verification —
   the full sequence, the dead-end accounts to avoid, and the entity reasoning
   are in **`account.md`**. This is the only remaining prerequisite, and it is
   2–4 weeks of Google's time, not ours.
2. [x] ~~Set up the upload key~~ **Done 2026-07-08.** `upload-keystore.jks` +
   `keystore.properties` exist and are backed up off-machine to
   `~/SpaceRace-PlayUpload-Key-BACKUP/`. **Do not run `--init-keystore` again**
   — the script refuses to overwrite an existing key, but the instinct to
   re-run it is the wrong one: this key is the only thing that can ever ship an
   update to the published app. Enroll in Play App Signing (default) at upload.
3. [ ] **Create the app** in Play Console: package `tech.spaceexplorer.spacerace`
   (locks permanently on first upload), name "Space Race" (or fallback), Free,
   Game. The button stays greyed until org verification clears.
4. [ ] **Build a fresh AAB:** `./web/scripts/android-release.sh` →
   `app/build/outputs/bundle/release/app-release.aab`. **Rebuild rather than
   reusing whatever is on disk** — the artifact is a build output, not a
   tracked file, and it silently goes stale behind `main`. Never hand Play a
   binary built with `--amazon`: that flag strips GA4 entirely.
5. [ ] **Complete the Console forms** — this listing (name, descriptions,
   graphics incl. the 1024×500 feature graphic, screenshots), **Data safety**,
   **Content rating (IARC)**, **Target audience**, **Ads = none**, Contact +
   Privacy policy, Pricing (free, all countries).
6. [ ] **Submit to production** and await review.

Everything above the checklist is drafted. The checklist items need the
verified Console account and the Play Console web forms.

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
