#!/usr/bin/env bash
# Build Space Race for Android: vite build -> cap sync -> gradlew bundleRelease.
#
#   ./scripts/android-release.sh                  # Play release AAB (unsigned if no upload key configured)
#   ./scripts/android-release.sh --apk            # also emit a release APK for sideload/device testing
#   ./scripts/android-release.sh --amazon         # Amazon Appstore build (AAB + APK)
#   ./scripts/android-release.sh --init-keystore  # one-time: generate the Play upload key + keystore.properties
#
# TWO ANDROID SHIPS, ONE ARTIFACT. `--amazon` sets SPACE_RACE_STORE=amazon for
# the `cap sync`, which flips android.appendUserAgent to 'SpaceRaceAmazon' rather
# than 'SpaceRaceAndroid'. Everything else — dist/, the media overlay, the Gradle
# build — is identical. The flag matters at SYNC time, so never hand an Amazon
# binary to Play or vice versa without re-running this script.
#
# NEITHER ANDROID SHIP CARRIES ANALYTICS. index.html loads no GA4 for either
# marker, because both are declared child-directed: Amazon under its COPPA
# policy, and Play because the listing's target audience includes under-13s,
# which puts it under Google Play's Families policy (2026-09-03). Do not
# "restore" analytics to the Play build without first changing that declaration
# — see docs/play-store/account.md.
#
# Signing is AUTOMATIC once android/keystore.properties exists (written by
# --init-keystore). Google Play App Signing holds the real app-signing key; you
# only ever ship the *upload* key this script manages. Both the keystore (.jks)
# and keystore.properties are gitignored — never commit them. Losing the upload
# key is recoverable via Play Console (request an upload-key reset); losing the
# app-signing key is not, but Google holds that one. See docs/android-roadmap.md.
#
# The unsigned path is the default so CI / a fresh machine can verify the app
# bundles for release. Only the final Play upload needs the signed AAB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # web/
ANDROID="$ROOT/android"
KEYSTORE="$ANDROID/upload-keystore.jks"
KEYSTORE_PROPS="$ANDROID/keystore.properties"

# Point Gradle at the JDK + SDK this machine actually has (Android Studio's
# bundled JBR; the SDK under ~/Library/Android/sdk). Respect anything preset.
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--init-keystore" ]]; then
  if [[ -f "$KEYSTORE" ]]; then
    echo "!! $KEYSTORE already exists — refusing to overwrite. Delete it first if you really mean to." >&2
    exit 1
  fi
  # Passwords: from env if provided (CI), else keytool prompts interactively.
  STOREPASS="${KEYSTORE_PASSWORD:-}"
  KEYPASS="${KEY_PASSWORD:-$STOREPASS}"
  echo "==> Generating Play upload key at $KEYSTORE (alias: upload, RSA 2048, ~27yr validity)"
  if [[ -n "$STOREPASS" ]]; then
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
      -keystore "$KEYSTORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$STOREPASS" -keypass "$KEYPASS" \
      -dname "CN=Space Race, O=Andrew Archer, C=US"
  else
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
      -keystore "$KEYSTORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Space Race, O=Andrew Archer, C=US"
    echo -n "Re-enter the keystore password (to record it in keystore.properties): "
    read -rs STOREPASS; echo
    KEYPASS="$STOREPASS"
  fi
  cat > "$KEYSTORE_PROPS" <<PROPS
storeFile=upload-keystore.jks
storePassword=$STOREPASS
keyAlias=upload
keyPassword=$KEYPASS
PROPS
  echo "==> Wrote $KEYSTORE_PROPS (gitignored). Back up upload-keystore.jks somewhere safe."
  echo "    Re-run without --init-keystore to build a signed AAB."
  exit 0
fi

WANT_APK=0
STORE=play
for arg in "$@"; do
  case "$arg" in
    --apk)    WANT_APK=1 ;;
    --amazon) STORE=amazon; WANT_APK=1 ;;   # Amazon takes the APK directly
    *)        echo "!! unknown flag: $arg" >&2; exit 1 ;;
  esac
done

echo "==> Building web bundle (vite)"
cd "$ROOT"
npm run build

echo "==> Syncing Capacitor Android project (store: $STORE)"
SPACE_RACE_STORE="$STORE" npx cap sync android

# Prove the store marker actually landed in the synced native config — this is the
# ONLY thing that keeps GA4 out of the Amazon build, and a silently-ignored config
# key has burned us here before (appendUserAgentString vs appendUserAgent).
SYNCED_CONFIG="$ANDROID/app/src/main/assets/capacitor.config.json"
EXPECT_UA=$([[ "$STORE" == "amazon" ]] && echo SpaceRaceAmazon || echo SpaceRaceAndroid)
grep -q "\"appendUserAgent\": *\"$EXPECT_UA\"" "$SYNCED_CONFIG" \
  || { echo "!! $SYNCED_CONFIG is missing appendUserAgent=$EXPECT_UA — refusing to build" >&2; exit 1; }
echo "==> Verified UA marker: $EXPECT_UA"

# MUST run after every `cap sync android` — the sync copies the portrait H.264
# originals out of dist/ and overwrites whatever was there. Without this the
# release AAB ships 164 MB of clips that decode in software (#140) and blows
# past Play's 200 MB base-module limit.
echo "==> Overlaying the Android media set (HEVC, landscape+rot90)"
bash "$ROOT/scripts/build-android-media.sh" --swap

if [[ ! -f "$KEYSTORE_PROPS" ]]; then
  echo "==> NOTE: android/keystore.properties not found — building UNSIGNED (verification only)."
  echo "    Run './scripts/android-release.sh --init-keystore' to set up Play upload signing."
fi

cd "$ANDROID"
echo "==> Gradle bundleRelease (AAB for Google Play)"
./gradlew bundleRelease
AAB="$ANDROID/app/build/outputs/bundle/release/app-release.aab"
echo "==> AAB at $AAB"

if [[ "$WANT_APK" -eq 1 ]]; then
  echo "==> Gradle assembleRelease (APK for sideload testing)"
  ./gradlew assembleRelease
  echo "==> APK(s) at $ANDROID/app/build/outputs/apk/release/"
fi

if [[ "$STORE" == "amazon" ]]; then
  echo
  echo "    AMAZON BUILD — no analytics. Upload the .apk at"
  echo "    $ANDROID/app/build/outputs/apk/release/ to the Amazon Developer Console."
  echo "    Binary limit is 2.5 GB (we are ~85 MB); Amazon re-signs APKs with its own key."
  echo "    Listing copy + submission answers: docs/amazon-appstore/listing.md"
else
  echo "    Upload the .aab to Play Console (Internal testing → Production), or via:"
  echo "    Play Console UI, or fastlane supply, or the Play Developer Publishing API."
fi
