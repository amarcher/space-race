#!/usr/bin/env bash
# Build Space Race for iOS: vite build -> cap sync -> xcodebuild archive.
#
#   ./scripts/ios-release.sh            # unsigned archive (proves the build; no Apple account needed)
#   ./scripts/ios-release.sh --signed   # signed archive + .ipa export for App Store Connect
#
# --signed requires an Apple Developer team. Set TEAM_ID to your 10-char Team ID
# (App Store Connect -> Membership) and have automatic signing set up in Xcode once:
#
#   TEAM_ID=ABCDE12345 ./scripts/ios-release.sh --signed
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
[[ "${1:-}" == "--signed" ]] && SIGNED=1

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
echo "    Upload via Xcode Organizer, Transporter, or:"
echo "    xcrun altool --upload-app -f \"$EXPORT_DIR\"/*.ipa -t ios --apiKey <KEY> --apiIssuer <ISSUER>"
