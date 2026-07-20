#!/usr/bin/env bash
# Build Space Race for iOS: vite build -> cap sync -> xcodebuild archive.
#
#   ./scripts/ios-release.sh            # unsigned archive (proves the build; no Apple account needed)
#   ./scripts/ios-release.sh --signed   # signed archive + .ipa export for App Store Connect
#   ./scripts/ios-release.sh --upload   # --signed, then upload the .ipa to App Store Connect
#
# --signed requires an Apple Developer team. Set TEAM_ID to your 10-char Team ID
# (App Store Connect -> Membership) and have automatic signing set up in Xcode once:
#
#   TEAM_ID=ABCDE12345 ./scripts/ios-release.sh --signed
#
# --upload additionally needs an App Store Connect API key (Users and Access ->
# Integrations -> App Store Connect API). altool finds the AuthKey_<ID>.p8 in
# ~/.appstoreconnect/private_keys automatically. Unlike the Xcode-account path,
# API keys never hit session expiry — this is the durable headless upload.
#
#   TEAM_ID=... ASC_API_KEY_ID=... ASC_API_ISSUER_ID=... ./scripts/ios-release.sh --upload
#
# The unsigned path is the default so CI / a fresh machine can verify the app
# compiles for device arch. Only the final signed upload needs the paid account.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"        # web/
PROJECT="$ROOT/ios/App/App.xcodeproj"
SCHEME="App"
BUILD_DIR="$ROOT/ios/build"
ARCHIVE="$BUILD_DIR/SpaceRace.xcarchive"

SIGNED=0
UPLOAD=0
[[ "${1:-}" == "--signed" ]] && SIGNED=1
[[ "${1:-}" == "--upload" ]] && { SIGNED=1; UPLOAD=1; }

echo "==> Building web bundle (vite)"
cd "$ROOT"
npm run build

echo "==> Syncing Capacitor iOS project"
npx cap sync ios

mkdir -p "$BUILD_DIR"

if [[ "$SIGNED" -eq 0 ]]; then
  echo "==> Archiving (unsigned — build verification only)"
  xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    archive \
    CODE_SIGNING_ALLOWED=NO
  echo "==> Unsigned archive at $ARCHIVE"
  echo "    (Run with --signed once you have an Apple Developer team to export an .ipa.)"
  exit 0
fi

# --- signed path ---
: "${TEAM_ID:?Set TEAM_ID to your Apple Developer Team ID for a signed build}"

echo "==> Archiving (signed, team $TEAM_ID)"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  archive \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID"

EXPORT_DIR="$BUILD_DIR/export"
EXPORT_OPTIONS="$BUILD_DIR/ExportOptions.plist"
cat > "$EXPORT_OPTIONS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store</string>
	<key>teamID</key>
	<string>$TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
	<key>destination</key>
	<string>export</string>
</dict>
</plist>
PLIST

echo "==> Exporting .ipa for App Store Connect"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

echo "==> .ipa at $EXPORT_DIR"

if [[ "$UPLOAD" -eq 1 ]]; then
  : "${ASC_API_KEY_ID:?Set ASC_API_KEY_ID (App Store Connect API key ID; .p8 in ~/.appstoreconnect/private_keys)}"
  : "${ASC_API_ISSUER_ID:?Set ASC_API_ISSUER_ID (App Store Connect API issuer ID)}"
  echo "==> Uploading to App Store Connect (API key $ASC_API_KEY_ID)"
  xcrun altool --upload-app -f "$EXPORT_DIR"/*.ipa -t ios \
    --apiKey "$ASC_API_KEY_ID" --apiIssuer "$ASC_API_ISSUER_ID"
  echo "==> Uploaded. TestFlight distributes automatically once Apple finishes processing."
else
  echo "    Upload via Xcode Organizer, Transporter, or re-run with --upload"
  echo "    (needs ASC_API_KEY_ID + ASC_API_ISSUER_ID; .p8 in ~/.appstoreconnect/private_keys)"
fi
