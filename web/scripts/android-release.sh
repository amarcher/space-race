#!/usr/bin/env bash
# Build Space Race for Android (Google Play): vite build -> cap sync -> gradlew bundleRelease.
#
#   ./scripts/android-release.sh                  # release AAB (unsigned if no upload key configured)
#   ./scripts/android-release.sh --apk            # also emit a release APK for sideload/device testing
#   ./scripts/android-release.sh --init-keystore  # one-time: generate the Play upload key + keystore.properties
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
[[ "${1:-}" == "--apk" ]] && WANT_APK=1

echo "==> Building web bundle (vite)"
cd "$ROOT"
npm run build

echo "==> Syncing Capacitor Android project"
npx cap sync android

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

echo "    Upload the .aab to Play Console (Internal testing → Production), or via:"
echo "    Play Console UI, or fastlane supply, or the Play Developer Publishing API."
