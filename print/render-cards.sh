#!/usr/bin/env bash
# Render every card front to exports/cards/<kind>.png at 825x1125 (300dpi
# Game Crafter poker spec, bleed included) via headless Chrome.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="$ROOT/print/card-front.html"
OUT="$ROOT/exports/cards"
mkdir -p "$OUT"

KINDS=(
  warp-25 warp-50 warp-75 warp-100 warp-200
  asteroid-strike empty-tank busted-thruster tractor-beam black-hole
  repair-drone fuel-cell new-thruster beam-cutter ignition
  ace-pilot antimatter-fuel-cell diamond-thruster rescue-shuttle
)

for k in "${KINDS[@]}"; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=825,1125 \
    --virtual-time-budget=8000 \
    --screenshot="$OUT/$k.png" \
    "file://$HTML?kind=$k&variant=noscrim" 2>/dev/null
  echo "rendered: $k.png"
done

echo "Done. $(ls "$OUT" | wc -l | tr -d ' ') files in exports/cards/"
