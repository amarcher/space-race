# The Play account is the LLC's, and the brand on the listing is a choice — not the entity's name (2026-09-03)

**Status:** decided 2026-09-03. This unblocks a submission that had been
**shelved since 2026-07-07** on business paperwork that has since been done.
Read this before touching Play Console; `listing.md` is the form-filling
companion, and everything in it is still current.

## The decision

Publish Space Race from a **Google Play organization account registered to
FABLE DESIGNER LLC**, using **D-U-N-S 148571084** — the number D&B already
issued for that entity — with **"Fable Designer" as the public developer
name**, and put **Fable Reader on the same account**.

One account, $25 once, one verification, both apps.

## Why the org account is the whole game

A **personal** Play account created after 2023-11-13 must run a closed test
with **12 testers opted in for 14 continuous days** before it may even apply
for production access. Andrew has no Android testers and no Android device,
so that gate is not merely slow, it is closed.

**Organization accounts verified with a D-U-N-S number are exempt** and
publish straight to production. That exemption is the entire reason this
document exists, and the D-U-N-S that unlocks it already exists.

## Why "Fable Designer" on a Space Race listing is allowed here, and wasn't on Apple

`storybook-studio`'s `docs/decisions/ios-distribution-entity-2026-08-29.md`
refused to let FABLE DESIGNER LLC become the published seller of space-race on
Apple, and #492 stood up a separate Amazon Business account rather than reuse
the one carrying space-race. Both refusals turned on the same fact: **on Apple,
the seller name published on the product page IS the account's legal entity
name.** There is no lever to separate them.

**Play works differently, and this is the load-bearing distinction.** The
public **developer name is free-form and changeable at any time**; the
organization's legal name, address and D-U-N-S live in the linked Google
payments profile and are **not shown on Google Play**. So the store-facing
brand and the legal owner are independent fields here, which is exactly what
Apple would not allow.

That makes the Apple reasoning inapplicable rather than overridden. It does
**not** make the choice free: the developer name is set **per account, not per
app**, so both apps on this account share one name on their listings. Andrew
chose "Fable Designer" for both on 2026-09-03, with the brand consequence for
Space Race understood and accepted. **Do not "correct" this to match the Apple
and Amazon decisions** — it diverges from them deliberately, and this paragraph
is why.

The exit stays open if the brands should later split: **Play supports app
transfers between developer accounts**, so nothing here is permanent in the way
a bundle id is.

## The dead ends behind us, so nobody walks back into them

- **`archer` on andrew.m.archer@gmail.com** — the original developer account,
  **closed for inactivity (2021-10-20) and not reactivatable.** That Google
  account also **cannot re-register**; `/console/signup` bounces it to its
  closed policy-center page. Inactivity closure is not a policy termination, so
  registering fresh carries no ban risk.
- **`aarcher520@gmail.com`, developer name "Aces Up Labs"** — a **personal**
  account, $25 paid, account ID 8203630696864011467. **Abandoned**, because a
  personal account is precisely what the 12-tester rule blocks, and
  personal↔organization **cannot be converted**. That $25 is sunk. Do not
  revive it.
- **`acesuplabs@gmail.com`** — a half-started org signup, parked at the "what
  you'll need" screen with **no $25 paid and no account created**. It was
  created to carry an "Aces Up Labs" DBA that was **never filed**. With the
  developer name now "Fable Designer" and the entity now an LLC, this identity
  no longer matches what it was for. Prefer a Google account on
  **`archer@fabledesigner.com`** — Google's own signup notes that a login on
  the organization's domain reduces verification steps versus a personal Gmail,
  and it matches the entity being verified. Either works; the domain account is
  the cleaner one.

## The one requirement still genuinely open

**Device verification.** Google's help page scopes it to *"developers with new
**personal** accounts"* and states no exemption either way for organizations,
so an org account may never be asked. Buy a **used Android 10+ phone (~$50)
regardless**, for a reason that has nothing to do with Play Console:

**Space Race has never run on real Android hardware.** Every on-device pass to
date was the arm64 emulator. `docs/android-roadmap.md` names WebView video
decode on low-end devices as the single biggest Android-only risk — 96 MB of
MP4 across a far wider device range than iOS — and an emulator on an M5 Max is
the worst possible instrument for measuring it.

## Runbook

**Andrew's, in order:**

1. Create or choose the Google account for the org — `archer@fabledesigner.com`
   preferred — and **enable 2-step verification**. Google requires 2SV before
   developer signup will start.
2. Sign up at Play Console → account type **organization** → "A company or
   business". Pay **$25**.
3. Enter **D-U-N-S 148571084**. The legal name and address must match the
   Massachusetts filing **exactly**.
4. Upload the **MA certificate** as the official business document, and link
   **fabledesigner.com** as the organization website.
5. Wait. Organization verification runs **2–4 weeks**.
6. If prompted, verify a physical device via the Play Console mobile app.

**Then, and only then** (the "Create app" button stays greyed until
verification clears):

7. Create the app — package **`tech.spaceexplorer.spacerace`**, which **locks
   permanently on first upload**. Free, Games → Card, target audience 13+, and
   **not** Designed for Families (it would restrict GA4, the same trade the iOS
   Kids category refused).
8. Upload the signed AAB, fill every form from `listing.md`, and submit
   **straight to production** — the org exemption means no closed-test detour.

## Provenance

The D-U-N-S, the entity and the Apple precedent are recorded in
`storybook-studio`'s `docs/decisions/ios-distribution-entity-2026-08-29.md`.
The build state, keystore location and QA history are in
`docs/android-roadmap.md`. The upload key's password is **not** in this repo
and must never be — it lives in the off-machine backup at
`~/SpaceRace-PlayUpload-Key-BACKUP/` and in project memory.
