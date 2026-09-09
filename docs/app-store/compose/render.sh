#!/usr/bin/env bash
# Render the App Store marketing screenshots via headless Chrome.
# Output lands in docs/app-store/compose/out/ at the exact ASC pixel sizes:
#   iPhone 6.9" class 1320x2868  <- PRIMARY (Apple's base iPhone class)
#   iPhone 6.5" class 1284x2778  <- fallback set, what 1.0-1.3.0 shipped
#   iPad 13"          2064x2752
# Upload the 6.9" set; see ../screenshots/README.md for which ASC slot each
# class goes in (6.9" is the slot the API calls APP_IPHONE_67).
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="file://$PWD/compose.html"
mkdir -p out

render() { # $1 slide  $2 size  $3 WxH
  local out="out/$2-$1.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size="${3/x/,}" --screenshot="$out" \
    --virtual-time-budget=4000 \
    "$HTML?slide=$1&size=$2" 2>/dev/null
  echo "rendered $out"
}

for slide in marquee slingshot scry race table rules; do
  render "$slide" iphone69 1320x2868
  render "$slide" iphone65 1284x2778
done
for slide in table rules; do
  render "$slide" ipad 2064x2752
done
