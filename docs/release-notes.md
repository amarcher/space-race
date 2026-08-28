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

**Status (re-verified 2026-08-28):**

- **App Store — live.** 1.3.0 / build 16 was approved and released on
  **2026-08-25**. ASC reports the version record `READY_FOR_SALE` /
  `READY_FOR_DISTRIBUTION`, and the public store is serving 1.3.0 with this
  release's What's New copy and all 8 screenshots + the app preview.
- **Amazon Appstore — live.** Submitted 2026-08-25, approved, and now serving
  **Version 1.3.0** (84.6 MB, Aces Up Labs, permissions listed as network
  sockets + vibration only — exactly what we shipped). The Submission API
  agrees indirectly: `GET /edits` returns `{}`, i.e. the `REVIEW` edit has
  closed.
- **Play — never shipped.** Not "behind on a version": there is no public Play
  listing at all, and every 👤 HUMAN step in `docs/android-roadmap.md`'s Phase 4
  (Play Console account, internal testing, listing, data safety, content rating,
  submit) is still open.

### Checking a store's live version without credentials

Both of these answer "what is the public store actually serving right now",
which is the question `GET /edits` and the ASC version record can't quite
answer on their own.

**App Store** — the iTunes lookup API, no auth:

    curl -s "https://itunes.apple.com/lookup?id=6788064058&country=us" \
      | python3 -c "import json,sys; r=json.load(sys.stdin)['results'][0]; \
                    print(r['version'], r['currentVersionReleaseDate'])"

**Amazon Appstore** — the public listing is
**[B0GXHBHD78](https://www.amazon.com/dp/B0GXHBHD78)**; *Technical details ▸
Version* is the live version. (Worth writing down, because it is genuinely hard
to find: searching the exact display title in **Apps & Games** returns *no
results*, and `amazon.com/gp/mas/dl/android?p=tech.spaceexplorer.spacerace`
404s. Searching the byline **Aces Up Labs** is what surfaces it. The Submission
API is no help here — it exposes only `/edits`, with no published-version
endpoint.)

> ℹ️ **The iOS jump was 1.2.0 → 1.3.0.** 1.2.1 was cut for the Amazon Appstore
> ship (`849ec85`) and went to web and Amazon only — it was never uploaded to
> App Store Connect. So the gallery fix below, though it landed back on
> 2026-08-06, reached iOS users for the first time in this release. Amazon
> jumped 1.2.1 → 1.3.0; Play jumped nowhere.

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
- **Mode-toggle fix** (#185) — flipping an Advanced-play toggle on an untouched
  deal re-deals so the new rules actually take effect. Without it the headline
  feature of this release silently does nothing on the most common path.

### Submission checklist

- [x] `cd web && npm run ios:archive` → uploaded to ASC **2026-08-25**. Build 16
      attached to the 1.3.0 record, What's New set, submitted for review —
      **approved and live on the App Store the same day.**
- [ ] `cd web && npm run android:release` → Play Console. Not started, and not
      startable: the Play Console app doesn't exist yet (roadmap Phase 4).
- [x] `cd web && npm run amazon:release` → APK built, verified, uploaded and
      **submitted 2026-08-25** (88.7 MB; `versionCode 16` / `1.3.0`,
      `appendUserAgent=SpaceRaceAmazon`, no `.so`, only INTERNET+VIBRATE) —
      **approved and live**, confirmed on the public listing 2026-08-28.
- [x] Paste the What's New block above — done for iOS and Amazon; still owed to Play
- [x] No new screenshots needed — the 8 existing shots (6 iPhone 6.5, 2 iPad
      12.9) carried over to the 1.3.0 record automatically and read COMPLETE,
      as did the app preview (confirmed on the live record 2026-08-28)

> **Amazon account gotcha (resolved 2026-08-25, will recur).** The Appstore
> console was signed in as **Fable Designer**, which has an empty App List and a
> standing *"Account Identity Verification Failed — you cannot upload apps"*
> banner. Space Race lives under the **Aces Up Labs** account. Check the avatar
> initials before touching anything: **AA** = Aces Up Labs (correct), **FD** =
> Fable Designer (wrong). Never create Space Race under Fable Designer to get
> unblocked — the child-directed listing must not share a byline with the
> adult-framed brand, and the business name cannot be edited afterward.

> **⚠️ "Ready to Submit" does not mean the binary is current.** Creating an
> upcoming version carries the *previous* APK forward, and the console reports
> "Ready to Submit" with all steps green while the card still reads the old
> `Version Code`. Submitting there would have shipped 1.2.1's binary under
> 1.3.0's release notes. **Always confirm the APK card's Version Code, and open
> *Manifest* to check Version Name, before submitting.**

> **The 88.7 MB APK cannot be uploaded by an agent through the browser** — the
> tooling caps file transfers at 10 MB and a single binary cannot be split, and
> Chrome is read-only to computer-use. A human must pick the file, *or* use the
> App Submission API (see below).

### Amazon App Submission API — `npm run amazon:submit`

`scripts/amazon-submit.sh` (= `npm run amazon:submit`) uploads the built APK and
release notes and commits the edit, so releases after 1.3.0 need no file picker.
It does **not** build — run `npm run amazon:release` first, since that is what
bakes in the Amazon store marker. Credentials live in `~/.zshrc` as
`AMAZON_CLIENT_ID` / `AMAZON_CLIENT_SECRET` (never in the repo, never
`VITE_`-prefixed — Vite inlines `VITE_*` into the client bundle).

    cd web && npm run amazon:release && ./scripts/amazon-submit.sh --dry-run
    ./scripts/amazon-submit.sh          # for real; --no-commit to stop short of submitting

**Verified against the live API 2026-08-25:** preflight, LWA auth, `GET /edits`,
and the listing shape. The upload / PUT / commit calls have not yet run for real
(1.3.0 went through the Console), so **always `--dry-run` first.**

The preflight encodes the lessons below: it refuses a Play-synced binary (UA
marker check), refuses an APK whose `versionCode` disagrees with `build.gradle`,
and refuses to write to an edit that is not `IN_PROGRESS` — a submitted release
still comes back from `GET /edits` with status `REVIEW`, so "an edit exists" is
not "an edit you may write to".

- Base: `https://developer.amazon.com/api/appstore/v1/applications/{appId}`,
  appId `amzn1.devportal.mobileapp.aada012b80d5411993843b3aa386b91a`
- Token: `POST https://api.amazon.com/auth/o2/token`,
  `grant_type=client_credentials`, `scope=appstore::apps:readwrite`, 1 h TTL
- Flow: create edit → `POST /edits/{id}/apks/large/upload` (use **`/large/`** for
  our ~85 MB binary) → `PUT /listings/en-US` → `POST /edits/{id}/commit`
- Every `PUT`/`DELETE` needs `If-Match: {ETag}` from a prior `GET`
- Only **one open edit per app**, and edits sync both ways with the Console — so
  do not mix API and Console work on the same release
- No AAB support (we ship an APK to Amazon, so this is moot). Content rating,
  pricing and availability still require the Console
- **Console navigation:** the docs say *Tools & Services ▸ API Access*; it is
  actually under **My Settings ▸ Enterprise Security Features ▸ API Access**

### iOS signing — read before the next release

The July path (Xcode's signed-in Apple ID → **Cloud Managed Apple Distribution**
cert) broke: the session expired silently, and `xcodebuild` failed the *export*
with `Cloud signing permission error / No signing certificate "iOS Distribution"
found`. The archive step succeeded, which makes this look like a build problem
when it is an auth problem.

- **An ASC API key cannot rescue this.** `scripts/ios-release.sh` now passes
  `-authenticationKeyPath/-ID/-IssuerID` when `ASC_API_KEY_ID` is set, which does
  get the *archive* past a dead session — but cloud-managed certs are reachable
  only through an Apple ID, so the export still needs Xcode to be signed in.
- **Fix:** Xcode ▸ Settings ▸ Accounts, sign in to the account owning team
  `J39B2498YF`. No local distribution private key exists on this machine (the
  only one in the keychain is an expired 2018 cert), so cloud signing is the
  path unless someone mints a real Apple Distribution cert + profile.
- A stale `archer@google.com` entry in Xcode logs
  `missing Xcode-Token` on every build. Harmless noise; delete it to stop the
  confusion.

---

## Earlier

- **1.2.1 · build 15** (2026-08-06) — Amazon Appstore ship: analytics-free
  child-directed build, plus the gallery fix. **Web + Amazon only; never
  submitted to the App Store.**
- **1.2.0 · build 14** (2026-07-27) — Tractor Beam ≤50 cap tag. Was the live
  App Store version until 1.3.0 replaced it on 2026-08-25.
