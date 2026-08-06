# Amazon Appstore listing — Space Race

Draft copy and submission answers for the Amazon Developer Console app record.
Companion to `docs/play-store/listing.md` (Play) and `docs/app-store/listing.md`
(iOS) — same game, Amazon's fields and rules.

**What is different here, and why it matters:** this is the *kids* ship. On a
Fire tablet, children reach an app through an **Amazon Kids** child profile,
which a parent populates from apps they already own — Amazon's Fire Tablet FAQ
is explicit that developers need take **no special action** to participate. So
"listed on the Appstore" and "a kid can play it" are the same milestone, and the
honest target-audience answer is *includes children*. That answer triggers
Amazon's **Child-Directed App (COPPA) Policy**, which permits only
"child-suitable" SDKs — so **the Amazon build ships with no analytics at all**
(see "Analytics" below). Amazon **Kids+**, the paid subscription catalog, is a
separate, invitation-only program with no application process; being listed and
child-directed is the only lever we have.

Target hardware is **Fire tablets only** — Fire TV is deliberately **not**
selected (D-pad, landscape, 10-foot UI; the game is tap-and-drag portrait). That
also spares us Amazon's separate Fire TV asset set.

---

## Step 1 — Upload your app file

| Field | Value |
|-------|-------|
| **Binary** | `web/android/app/build/outputs/apk/release/app-release.apk` |
| **Build command** | `npm run amazon:release` (= `./scripts/android-release.sh --amazon`) |
| **Package name** | `tech.spaceexplorer.spacerace` (same as Play/iOS) |
| **Version** | `versionName 1.2.0` / `versionCode 14` |
| **Approx. size** | ~85 MB |

Notes:

- **Binary limit is 2.5 GB**, uploaded through the browser. The old
  "150 MB then SFTP" rule is gone — SFTP is no longer supported at all. Our
  ~85 MB is a non-issue, and Play's 200 MB base-module limit does not apply here.
- **APK, not AAB.** Amazon accepts app bundles, but the APK is the well-trodden
  path and Amazon re-signs APKs with its own key on ingest, so our upload key is
  not load-bearing the way Play's is.
- **No native libraries.** Verified: the built APK contains zero `.so` files
  (pure Capacitor WebView), so Amazon's 32-bit/64-bit device-filtering guidance
  and the arm64 requirement are both moot.
- **⚠️ The store marker is baked in at sync time.** `--amazon` sets
  `SPACE_RACE_STORE=amazon` for `npx cap sync android`, which writes
  `appendUserAgent: 'SpaceRaceAmazon'` into
  `android/app/src/main/assets/capacitor.config.json`. The release script
  hard-fails if that marker is missing. **Never upload a Play-synced binary to
  Amazon** — it would carry GA4 into a child-directed listing.

---

## Step 2 — Target your app

### Device targeting

- **Fire tablets: YES.** Validated on real hardware — see the on-device pass in
  `docs/android-roadmap.md` (Fire HD 10, 11th gen, Fire OS 8 / API 30): 1.6 s
  cold launch, hardware HEVC decode, correct landscape tablet reflow,
  edge-to-edge insets.
- **Fire TV: NO.** Uncheck it.
- **Amazon Automotive: NO.**
- The console auto-filters from the manifest. Ours declares only `INTERNET` +
  `VIBRATE` and **no `uses-feature` elements at all**, so nothing should be
  filtered out unexpectedly. (Fire tablets have no vibration motor — haptics
  silently no-op, which is fine; there is no user-facing haptics toggle that
  would look broken.)

### Availability

- **Free**, all available countries.

### Target audience — the decision that drives everything else

| Question | Answer |
|----------|--------|
| **Target age groups** | **Includes children (0–12)** — an all-ages card game |
| Triggers Child-Directed App (COPPA) Policy? | **Yes, intentionally** |
| Age gate / neutral age screen needed? | **No** — a gate exists to keep non-compliant SDKs away from children's data, and this build has no SDKs and collects no data |

We take the strictest audience declaration because it costs us nothing: with
analytics stripped, there is no data-collection surface to defend.

### Content rating questionnaire

Same honest answers as the Play IARC questionnaire. The space "hazards" (black
holes, asteroid strikes, busted thrusters) are obstacle cards, not depicted
violence against people or creatures.

| Category | Answer |
|----------|--------|
| Violence | None |
| Drugs / alcohol / tobacco | None |
| Nudity / sex | None |
| Profanity / crude humor | None |
| Intolerance / hate | None |
| Gambling (real or simulated) | None |
| Account creation | **No** |
| Advertisements | **No** |
| Location services | **No** |
| User-generated content / user interaction | **No** |

**Expected summary maturity rating: "All Ages."**

### User data privacy → Amazon Appstore Privacy Labels

This is where the Amazon build diverges from iOS and Play, and it diverges
**upward**:

| Question | Answer |
|----------|--------|
| **Does the app collect or transfer user data?** | **No** |
| Data types collected | **None** |
| Advertising ID | Not used |
| Third-party SDKs collecting data | **None** |
| **Privacy policy URL** | https://game.spaceexplorer.tech/privacy.html |

Justification, so this survives a reviewer poking at it: the app is fully
offline-bundled, has no accounts, no ads, no IAP, no advertising ID, and makes
**no network requests during play**. GA4 is suppressed for this build
(`web/index.html`), `@vercel/analytics` + Speed Insights are already gated off
native (`web/src/App.tsx`), and the only outbound link in the app — the "get the
iOS app" banner — is gated off native too
(`web/src/components/AppStoreBanner.tsx`). The `INTERNET` permission remains
because Capacitor serves the bundle from a local `https://localhost` origin.

Supply the privacy policy URL anyway even though "collects no data" makes it
optional — it costs nothing and reviewers like seeing it.

---

## Step 3 — Appstore details

### Display title

```
Space Race
```

Fallback if taken: `Space Race: 1000 Light-Years`

### Short description (2,000 bytes ≈ 1,200 chars — no paragraph breaks, they get stripped)

```
A fast, friendly space card duel. Draw, plan, and fire your engines to be the first ship to travel 1,000 light-years — while black holes freeze your drive, asteroid strikes cripple your hull, and an empty tank leaves you drifting. Patch the damage, top off the fuel, and blast past your rival before they reach the finish. Easy to learn in one hand, with just enough strategy to keep every game close. Plays completely offline — every card, animation, and sound ships inside the app. No ads, no in-app purchases, no accounts, and nothing is collected about you or your kids.
```

### Long description (4,000 chars, plain text)

```
Space Race is a cosmic card game — a fast, friendly duel across the galaxy.

Draw, plan, and fire your engines to be the first ship to travel 1,000
light-years. But the void fights back: black holes freeze your drive, asteroid
strikes cripple your hull, and an empty fuel tank leaves you drifting. Patch the
damage, top off the tank, and blast past your rival before they reach the finish.

It's the classic "hazards and remedies" race, reimagined among the stars — easy
to learn in one hand, with just enough strategy to keep every game close.

MADE TO HAND TO A KID
Space Race collects nothing, shows no ads, sells nothing, and never asks anyone
to sign in. There is no chat, no leaderboard, no link out of the app, and no
network connection required — so it works the same on a plane as it does at the
kitchen table. Add it to an Amazon Kids profile and it just works.

FEATURES
- Single-player against a sharp AI rival — no account, no sign-up.
- Fully offline. Every card, animation, and sound ships in the app.
- Beautiful, tactile cards, tuned and tested on Fire tablets.
- A "scry" peek at what's coming, so the smart play is always in reach.
- Slingshot! Slap down the perfect counter the instant a hazard hits and
  leap ahead.
- Quick games — a full race takes just a few minutes.
- No ads. No in-app purchases. No tracking. No data collected.

Whether you've got two minutes in a waiting room or a long flight ahead, Space
Race is the space card game that's always ready to play.
```

### Product feature bullets (3–5, one per line)

```
Race a rival to 1,000 light-years in a few fast minutes — easy to learn, hard to call.
Dodge black holes and asteroid strikes, then patch up and slingshot past your rival.
Plays 100% offline — every card, animation, and sound is bundled in the app.
No ads, no in-app purchases, no accounts, and no data collected. Safe to hand to a kid.
Built and tested on Fire tablets, in both portrait and landscape.
```

### Keywords (comma-separated, optional)

```
card game, space, offline, family, kids, solitaire, strategy, rocket, planets, no ads, single player
```

### Category

- **Games → Card** (secondary: Games → Family, if a second slot is offered)

### Support / contact

| Field | Value |
|-------|-------|
| **Support email** | andrew.m.archer@gmail.com |
| **Support / marketing website** | https://game.spaceexplorer.tech |
| **Privacy policy** | https://game.spaceexplorer.tech/privacy.html |

### Images and multimedia

| Asset | Spec | Source / action |
|-------|------|-----------------|
| **Small icon** | 114 × 114 PNG | ✅ `docs/amazon-appstore/small-icon-114.png` — downscaled from the 512 |
| **Large icon** | 512 × 512 PNG | ✅ `docs/play-store/assets/play-icon-512.png` verbatim |
| **Screenshots** | 3–10, PNG/JPG, each side within **800×480 – 2560×1600** | ✅ `docs/amazon-appstore/screenshots/01`–`06` — **shot on the Fire HD 10**, 1920×1116 each |
| **Promotional image** | 1024 × 500 PNG/JPG (optional but take it) | ✅ `docs/play-store/assets/feature-graphic.png` verbatim — already exactly 1024×500 |
| **Video** | 720 × 1080, optional | Skip for v1 |
| **Fire TV assets** | 1280×720 icon, 1920×1080 shots + background | **Not needed** — Fire TV is unchecked |

> **Do not reuse the iOS screenshots.** `docs/app-store/screenshots/iphone-6.9-*`
> are 1320×2868 and `iphone-6.7-*` are 1284×2778 — both exceed Amazon's 2560 px
> ceiling and would be rejected. Since the Fire HD 10 is already the on-device
> test rig, shooting there is both easier and more honest: the shots show the
> app on the hardware the customer is buying it for.
>
> Captured over adb from a real game played on the tablet (2026-08-06). Method
> that worked: run a background burst — `adb -s <serial> exec-out screencap -p`
> every 3 s for 5 minutes — while a human plays a full game, then contact-sheet
> the frames (`montage`) and cull. Driving the game synthetically with
> `adb shell input tap/swipe` does NOT work: card play is gated by the rules
> engine (you cannot play distance cards before Ignition), so the play button
> sits disabled and nothing advances.
>
> Each frame is cropped `1920x1116+0+36` to remove the Fire OS status bar and
> navigation bar — still inside Amazon's bounds, and much cleaner in the listing.
>
> **Upload order** (Amazon shows them in sequence; the first carries the listing):
>
> | # | File | Why |
> |---|------|-----|
> | 1 | `01-race-board.png` | The game itself, late race — 1125 vs 775, played stacks, two slingshot badges, full hand |
> | 2 | `02-slingshot.png` | "SLINGSHOT! +200 ly" — the signature feel-good moment |
> | 3 | `03-card-reference.png` | The full deck: distances, hazards, remedies with counts |
> | 4 | `04-black-hole-hazard.png` | Art quality on a hazard takeover |
> | 5 | `05-victory-pilot.png` | The win payoff — pilot celebrating in the cockpit |
> | 6 | `06-scry-peek.png` | The scry peek (optional sixth) |

---

## Step 4 — Review and submit

Amazon runs an automated + human review. Expect days, not weeks.

---

## Open item — age verification (US state laws)

Not a blocker for submission, but decide before shipping wide:

Texas's App Store Accountability Act is **in effect now** (a federal appeals
court stayed the December 2025 preliminary injunction); **Utah follows 2027-05-06**
and **Louisiana 2027-07-01**. Amazon's compliance path is the **`GetUserAgeData`
API**, which returns an age bucket (0–12 / 13–15 / 16–17 / 18+) plus a
`userStatus`; apps must cut off access when `userStatus` is `CONSENT_NOT_GRANTED`
(parent revoked consent, or a "significant change" is pending re-consent).
Amazon cannot restrict distribution by state, so applicability follows the
*user's* location, not ours.

**Before building anything, read the doc and determine whether it binds a free,
account-less, zero-data-collection game, or only apps that actually need an age
signal** — Amazon's scope language is ambiguous on exactly this case. If it does
bind us, the work is a small native call in `MainActivity` plus a blocked-state
screen; there is no Capacitor plugin for it, so budget a day.

Source: https://developer.amazon.com/docs/app-submission/user-age-verification.html

---

## Submission checklist (human steps)

1. [x] **Register a free Amazon developer account** (2026-08-06) —
   https://developer.amazon.com → *Sign in* → *Developer Console* → accept the
   Appstore Distribution Agreement. **No fee, no annual renewal** (vs Play's
   one-time $25 and Apple's $99/yr). Answers used:

   | Field | Value | Why |
   |-------|-------|-----|
   | Account identifies as | **Sole Proprietorship** | The MA LLC (Fable Designer) is filed but not formed, and Amazon's own hint reserves *Business* for a corporate entity. Space Race is free, earns nothing, and collects nothing, so there is no exposure waiting on the entity would reduce. |
   | Legal name / tax interview | **Andrew Archer** (SSN) | Matches the App Store seller name and the APK signing cert (`O=Andrew Archer`). |
   | **Customer-facing business name** | **Aces Up Labs** | Public byline on every Appstore listing. Amazon rejects personal names in this field — it wants a *brand* — so "Andrew Archer" would not validate. |

   > **This is effectively permanent.** Amazon's docs: the customer-facing
   > business name "cannot be edited after you click Agree and continue (except
   > by filing a support case)."
   >
   > **Deliberately NOT "Fable Designer."** That brand belongs to the revenue
   > business in `~/Programs/storybook-studio` — Stripe merchant of record,
   > Stripe Tax, Lulu fulfillment — which the MA LLC is being formed to hold.
   > It gets its **own** Amazon account, registered as *Business* under the
   > LLC's legal name and EIN once the entity exists. Sharing one
   > personal-tax-identity account across both would undo that separation, and
   > would also put a child-directed listing under the same public byline as
   > Fable Designer, whose positioning non-negotiable
   > (`~/Programs/storybook-studio/AGENTS.md:56`) is to stay adult-framed for
   > COPPA reasons.
   >
   > **Name-collision note (informational — the field is already locked):**
   > "Aces Up" is in use by *Aces Up Gaming* (casino table-game distributor)
   > and *Aces Up Casino Parties, LLC*. Both are gambling-adjacent and in
   > different trades, and "Labs" distinguishes ours, so a conflict is
   > unlikely — but if Amazon ever queries the name, that is where it would
   > come from. Note the content-rating questionnaire answers **Gambling:
   > None**, which remains true; the byline is a studio name, not a theme.
2. [ ] **Build the Amazon binary:** `cd web && npm run amazon:release`.
3. [x] **Capture 3+ Fire HD 10 screenshots** → 6 landscape shots, 1920×1116.
4. [x] **Generate the 114×114 small icon** from the 512.
5. [ ] **Create the app** in the Developer Console and upload the APK.
6. [ ] **Target:** Fire tablets only, all countries, free, **target audience
   includes children (0–12)**.
7. [ ] **Content rating** questionnaire → expect *All Ages*.
8. [ ] **Privacy labels:** collects no data. Privacy policy URL supplied.
9. [ ] **Appstore details:** title, descriptions, bullets, keywords, category,
   contact, icons, screenshots, 1024×500 promotional image.
10. [ ] **Submit for review.**
11. [ ] **After it goes live:** add it to a child profile in the Amazon Kids
    Parent Dashboard and confirm it launches inside the kid sandbox. This is the
    actual acceptance test for "kids can play it."

---

## Analytics — the one code difference between the two Android ships

Both Android ships are built from the same `web/dist`. The **only** difference
is the WebView UA marker set at sync time:

| Ship | `android.appendUserAgent` | GA4 |
|------|---------------------------|-----|
| Google Play | `SpaceRaceAndroid` | loads, tagged `platform = android` |
| Amazon Appstore | `SpaceRaceAmazon` | **never loads** |

The snippet in `web/index.html` computes the platform first and **injects** the
googletagmanager `<script>` only when the platform is not `amazon`. It has to be
injected rather than a static `<script async src>`, because a static tag would
fetch Google before any check could run — and "did not send an event" is not the
same as "did not contact a third party" when the policy is about which SDKs a
child-directed app is allowed to load at all.

Cost of this decision: no GA4 numbers from Fire tablets. Given Fire's share of
our traffic, that is a rounding error, and it buys an unambiguous COPPA posture
plus a "collects no data" privacy label — which is also the strongest possible
position if Amazon ever *does* come knocking about Kids+.
