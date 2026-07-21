#!/usr/bin/env bash
# Render the App Store marketing screenshots via headless Chrome.
# Output lands in docs/app-store/compose/out/ at the exact ASC pixel sizes:
#   iPhone 6.5"/6.7" class 1284x2778, iPad 13" 2064x2752.
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

for slide in slingshot scry race table rules; do
  render "$slide" iphone 1284x2778
done
for slide in table rules; do
  render "$slide" ipad 2064x2752
done
