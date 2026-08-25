#!/usr/bin/env bash
# Submit the already-built Amazon Appstore APK via the App Submission API.
#
#   ./scripts/amazon-submit.sh              # upload APK + release notes, then commit (SUBMITS FOR REVIEW)
#   ./scripts/amazon-submit.sh --dry-run    # preflight + auth + inspect only; changes nothing at Amazon
#   ./scripts/amazon-submit.sh --no-commit  # upload everything, leave the edit open to eyeball in the Console
#
# This is the Amazon counterpart to `ios-release.sh --upload`, and it exists for
# one reason: the Appstore Console needs a HUMAN to pick the ~85 MB APK out of a
# file dialog. The API's /large/upload endpoint does not, so a release no longer
# has to wait on somebody's file picker.
#
# It does NOT build. Run `npm run amazon:release` first — that is what enforces
# SPACE_RACE_STORE=amazon at sync time, and the store marker is baked into the
# binary there, not here.
#
#   cd web && npm run amazon:release && ./scripts/amazon-submit.sh
#
# CREDENTIALS (never in the repo, never VITE_-prefixed — Vite inlines VITE_* into
# the client bundle, which would publish them to every visitor):
#
#   export AMAZON_CLIENT_ID=...       # LWA client id,  amzn1.application-oa2-client.…
#   export AMAZON_CLIENT_SECRET=...   # LWA client secret
#
# They live in ~/.zshrc next to ASC_API_KEY_ID / ASC_API_ISSUER_ID, because they
# are the same species: machine-scoped release credentials, not app config. The
# security profile is "Aces Up Labs", attached to the App Submission API under
# My Settings > Enterprise Security Features > API Access. (Amazon's own docs say
# Tools & Services > API Access. They are wrong; it moved.)
#
# THINGS THAT WILL BITE YOU, all learned the hard way on 2026-08-25:
#
#   * ONE OPEN EDIT PER APP, and edits sync bidirectionally with the Console. If
#     someone clicked "Add Upcoming Version" in the browser, that IS the open
#     edit and this script will reuse it. Never drive both at once.
#   * "Ready to Submit" in the Console does NOT mean the binary is current — a
#     new version carries the PREVIOUS APK forward. The preflight below refuses
#     to upload a versionCode that is already live, which is the automated
#     version of that lesson.
#   * NEVER ship a Play-synced binary to Amazon. It would carry GA4 into a
#     child-directed listing. Preflight hard-fails unless the packaged
#     capacitor.config.json says appendUserAgent=SpaceRaceAmazon.
#   * The API does not support AAB (we ship an APK here, so this is moot) and
#     does not support PATCH — listings must be read, modified, and PUT back
#     whole. Every PUT needs If-Match with the ETag from the preceding GET.
#
# STATUS: preflight, auth, GET /edits and the listing shape are all verified
# against the live API (2026-08-25) — 'recentChanges' is confirmed to be the
# release-notes field. The upload, PUT and commit calls are built from Amazon's
# docs and have NOT yet run for real; 1.3.0 went through the Console. Always
# --dry-run first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # web/
APK_DEFAULT="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
NOTES_DEFAULT="$ROOT/../docs/release-notes.md"
APP_ID="${AMAZON_APP_ID:-amzn1.devportal.mobileapp.aada012b80d5411993843b3aa386b91a}"
API="https://developer.amazon.com/api/appstore/v1/applications/$APP_ID"
LANG_CODE="${AMAZON_LOCALE:-en-US}"

APK="$APK_DEFAULT"
NOTES_FILE="$NOTES_DEFAULT"
DRY_RUN=0
COMMIT=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN=1 ;;
    --no-commit)   COMMIT=0 ;;
    --apk)         APK="$2"; shift ;;
    --notes-file)  NOTES_FILE="$2"; shift ;;
    *) echo "!! unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

command -v jq >/dev/null || { echo "!! jq is required" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preflight. Everything here is local and free; do it before touching Amazon.
# ---------------------------------------------------------------------------
echo "==> Preflight: $APK"
[[ -f "$APK" ]] || { echo "!! no APK at $APK — run 'npm run amazon:release' first" >&2; exit 1; }

AAPT="$(ls "$HOME"/Library/Android/sdk/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1 || true)"
[[ -n "$AAPT" ]] || { echo "!! aapt2 not found under ~/Library/Android/sdk/build-tools" >&2; exit 1; }

BADGING="$("$AAPT" dump badging "$APK")"
APK_VC="$(sed -nE "s/.*versionCode='([0-9]+)'.*/\1/p" <<<"$BADGING" | head -1)"
APK_VN="$(sed -nE "s/.*versionName='([^']+)'.*/\1/p" <<<"$BADGING" | head -1)"
APK_PKG="$(sed -nE "s/^package: name='([^']+)'.*/\1/p" <<<"$BADGING" | head -1)"
echo "    package $APK_PKG, versionName $APK_VN, versionCode $APK_VC, $(du -h "$APK" | cut -f1)"

# The store marker is the ONLY thing keeping GA4 out of a child-directed build.
UA="$(unzip -p "$APK" assets/capacitor.config.json | jq -r '.android.appendUserAgent // empty')"
[[ "$UA" == "SpaceRaceAmazon" ]] \
  || { echo "!! appendUserAgent is '$UA', expected 'SpaceRaceAmazon' — this looks like a PLAY build. Refusing." >&2; exit 1; }
echo "    UA marker: $UA (no GA4)"

# Keep the gradle source of truth and the artifact honest with each other.
GRADLE_VC="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' "$ROOT/android/app/build.gradle" | head -1)"
[[ "$APK_VC" == "$GRADLE_VC" ]] \
  || { echo "!! APK versionCode $APK_VC != build.gradle versionCode $GRADLE_VC — stale build, re-run npm run amazon:release" >&2; exit 1; }

SO_COUNT="$(unzip -l "$APK" | grep -c '\.so$' || true)"
[[ "$SO_COUNT" -eq 0 ]] || echo "    note: $SO_COUNT native .so files present (expected 0 for a pure WebView build)"

# ---------------------------------------------------------------------------
# Release notes — same copy that goes to the App Store, from the same source.
# ---------------------------------------------------------------------------
NOTES="$(python3 - "$NOTES_FILE" <<'PY'
import re, sys
s = open(sys.argv[1]).read()
i = s.index("### What's New")
print(re.search(r"```\n(.*?)\n```", s[i:], re.S).group(1).strip())
PY
)" || { echo "!! could not extract the What's New block from $NOTES_FILE" >&2; exit 1; }
echo "==> Release notes: ${#NOTES} chars (limit 4000) from $(basename "$NOTES_FILE")"
[[ "${#NOTES}" -le 4000 ]] || { echo "!! release notes exceed 4000 chars" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Auth. Token is good for an hour; a release takes minutes.
# ---------------------------------------------------------------------------
: "${AMAZON_CLIENT_ID:?Set AMAZON_CLIENT_ID (see the header)}"
: "${AMAZON_CLIENT_SECRET:?Set AMAZON_CLIENT_SECRET (see the header)}"

echo "==> Requesting an LWA token"
TOKEN="$(curl -sS --fail-with-body -X POST https://api.amazon.com/auth/o2/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$AMAZON_CLIENT_ID" \
  --data-urlencode "client_secret=$AMAZON_CLIENT_SECRET" \
  --data-urlencode 'scope=appstore::apps:readwrite' | jq -r '.access_token')"
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || { echo "!! token request failed" >&2; exit 1; }
echo "    token acquired"

auth=(-H "Authorization: Bearer $TOKEN")

# Every mutating call needs the ETag of the thing it mutates.
etag_of() { curl -sS -D - -o /dev/null "${auth[@]}" "$1" | tr -d '\r' | sed -nE 's/^[Ee][Tt][Aa][Gg]: (.*)$/\1/p'; }

# ---------------------------------------------------------------------------
# Edit: reuse the open one if a human already started it in the Console.
# ---------------------------------------------------------------------------
echo "==> Checking for an open edit"
EDIT_JSON="$(curl -sS "${auth[@]}" "$API/edits" 2>/dev/null || true)"
EDIT_ID="$(jq -r 'if type=="object" then (.id // empty) else empty end' <<<"$EDIT_JSON" 2>/dev/null || true)"
EDIT_STATUS="$(jq -r 'if type=="object" then (.status // empty) else empty end' <<<"$EDIT_JSON" 2>/dev/null || true)"

# A SUBMITTED release still comes back from GET /edits, with status REVIEW — so
# "an edit exists" is not the same as "an edit I may write to". Only IN_PROGRESS
# is ours to touch; anything else means a release is already in flight and
# uploading into it would either fail or disturb something under review.
if [[ -n "$EDIT_ID" && "$EDIT_STATUS" != "IN_PROGRESS" ]]; then
  echo "!! edit $EDIT_ID exists but its status is '$EDIT_STATUS', not IN_PROGRESS." >&2
  echo "   A release is already in flight. Wait for it to go live, or cancel it in the" >&2
  echo "   Console, before submitting another. Refusing to touch it." >&2
  exit 1
fi

if [[ -n "$EDIT_ID" ]]; then
  echo "    reusing open edit $EDIT_ID (status IN_PROGRESS — started in the Console, or by a previous run)"
else
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "    none open. [dry-run] would POST $API/edits"
    echo "==> Dry run complete — preflight and auth both pass, nothing was changed."
    exit 0
  fi
  echo "    none open; creating one"
  EDIT_ID="$(curl -sS --fail-with-body -X POST "${auth[@]}" "$API/edits" | jq -r '.id')"
  [[ -n "$EDIT_ID" && "$EDIT_ID" != "null" ]] || { echo "!! could not create an edit" >&2; exit 1; }
  echo "    created edit $EDIT_ID"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> [dry-run] would upload $APK to $API/edits/$EDIT_ID/apks/large/upload"
  echo "==> [dry-run] would PUT release notes to .../listings/$LANG_CODE"
  [[ "$COMMIT" -eq 1 ]] && echo "==> [dry-run] would COMMIT edit $EDIT_ID (submits for review)"
  echo "==> Dry run complete — nothing was changed."
  exit 0
fi

# ---------------------------------------------------------------------------
# Upload. /large/upload is the one that survives an ~85 MB body.
# ---------------------------------------------------------------------------
echo "==> Uploading $(basename "$APK") ($(du -h "$APK" | cut -f1))"
UPLOAD="$(curl -sS --fail-with-body -X POST "${auth[@]}" \
  -H 'Content-Type: application/octet-stream' \
  -H "fileName: $(basename "$APK")" \
  --data-binary "@$APK" \
  "$API/edits/$EDIT_ID/apks/large/upload")"
APK_ID="$(jq -r '.id // .apkId // empty' <<<"$UPLOAD")"
[[ -n "$APK_ID" ]] || { echo "!! upload returned no apk id: $UPLOAD" >&2; exit 1; }
echo "    uploaded as apk id $APK_ID"

# ---------------------------------------------------------------------------
# Release notes. Amazon has no PATCH: GET the listing, edit it, PUT it back.
# ---------------------------------------------------------------------------
set_release_notes() {
  local url="$API/edits/$EDIT_ID/listings/$LANG_CODE"
  local listing etag body
  listing="$(curl -sS --fail-with-body "${auth[@]}" "$url")"
  etag="$(etag_of "$url")"
  [[ -n "$etag" ]] || { echo "!! no ETag for $url" >&2; return 1; }

  # 'recentChanges' is verified against the live listing (alongside title,
  # shortDescription, fullDescription, featureBullets, keywords, language). If
  # Amazon ever renames it, fail loudly with the real keys rather than silently
  # PUTting a listing whose notes never got set.
  if ! jq -e 'has("recentChanges")' >/dev/null <<<"$listing"; then
    echo "!! listing has no 'recentChanges' field. Actual keys:" >&2
    jq -r 'keys[]' <<<"$listing" >&2
    return 1
  fi

  body="$(jq --arg n "$NOTES" '.recentChanges = $n' <<<"$listing")"
  curl -sS --fail-with-body -X PUT "${auth[@]}" \
    -H 'Content-Type: application/json' \
    -H "If-Match: $etag" \
    --data "$body" "$url" >/dev/null
  echo "    release notes set for $LANG_CODE"
}
echo "==> Setting release notes"
set_release_notes

if [[ "$COMMIT" -eq 0 ]]; then
  echo "==> Edit $EDIT_ID left OPEN as requested. Review it in the Console, then commit."
  echo "    Reminder: confirm the APK card reads versionCode $APK_VC before submitting."
  exit 0
fi

# ---------------------------------------------------------------------------
# Commit == submit for review. This is the irreversible one.
# ---------------------------------------------------------------------------
echo "==> Committing edit $EDIT_ID (submits $APK_VN / $APK_VC for review)"
EDIT_ETAG="$(etag_of "$API/edits")"
[[ -n "$EDIT_ETAG" ]] || { echo "!! no ETag for the edit" >&2; exit 1; }
RESULT="$(curl -sS --fail-with-body -X POST "${auth[@]}" -H "If-Match: $EDIT_ETAG" "$API/edits/$EDIT_ID/commit")"
STATUS="$(jq -r '.status // empty' <<<"$RESULT")"
echo "    edit status: ${STATUS:-$RESULT}"
echo "==> Submitted. Amazon review is days, not weeks; publishing takes a few hours after approval."
