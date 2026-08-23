#!/usr/bin/env bash
# Render every rulebook page to exports/booklet/rules-N.png at 825x1125 (300dpi
# Game Crafter Small Booklet spec) via headless Chrome.
#
# Page count MUST stay a multiple of 4 (saddle stitch). Second edition is 12:
#   1 cover · 2-7 core rules · 8 winning · 9-11 advanced play · 12 back cover
# After changing the count here, update the page count on the TGC product too.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="$ROOT/print/booklet-page.html"
OUT="$ROOT/exports/booklet"
PAGES="${1:-12}"

if (( PAGES % 4 != 0 )); then
  echo "error: page count $PAGES is not a multiple of 4 (saddle stitch)" >&2
  exit 1
fi

mkdir -p "$OUT"
for n in $(seq 1 "$PAGES"); do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=825,1125 \
    --virtual-time-budget=8000 \
    --screenshot="$OUT/rules-$n.png" \
    "file://$HTML?page=$n" 2>/dev/null
  echo "rendered: rules-$n.png"
done

echo "Done. $PAGES pages in exports/booklet/"
