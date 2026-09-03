#!/usr/bin/env bash
# Build the promo video from the App Store preview footage.
#
#   ./web/scripts/gen-promo-video.sh [source.mp4]
#
# FULL-BLEED, NOT MATTED. The first cut of this matted the portrait footage onto
# a branded 1920x1080 backdrop. It was mostly backdrop: the app occupied about a
# quarter of the frame, which is the opposite of showing the game. This keeps the
# footage native and vertical so the app fills the screen.
#
# WHY IT PADS THE SIDES INSTEAD OF CROPPING TO 9:16. The source is 886x1920
# (~0.46), narrower than 9:16 (0.5625), so reaching 1080x1920 by cropping costs
# ~18% of the HEIGHT. That crop is not cosmetic: the player's hand sits flush to
# the bottom edge and the opponent's tableau to the top, so cropping eats actual
# game state. Padding ~70px per side costs nothing, and the app's own background
# is near #07071a, so the bars read as part of the screen rather than as bars.
#
# The only thing removed is the iOS status bar (clock/wifi/battery) off the top,
# which just looks unfinished in a promo.
#
# TWO FLAGS THAT LOOK OPTIONAL AND ARE NOT:
#   -r 30 — the source is 30fps; letting ffmpeg pick can resample and judder.
#   -c:a aac with an explicit map-through — the preview HAS audio, and filter
#   chains silently drop it if you are not deliberate.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${1:-$ROOT/docs/app-store/previews/app-preview-6.9.mp4}"
OUT="$ROOT/docs/marketing/assets/space-race-promo-1080x1920.mp4"
command -v ffmpeg >/dev/null || { echo "!! ffmpeg not found" >&2; exit 1; }
[[ -f "$SRC" ]] || { echo "!! source footage not found: $SRC" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"

ffmpeg -y -loglevel error -i "$SRC" \
  -vf "crop=iw:ih-110:0:110,scale=-2:1920,pad=1080:1920:(1080-iw)/2:0:color=0x07071a,format=yuv420p" \
  -r 30 -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "$OUT"

echo "==> $OUT"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration -of default=nw=1 "$OUT" | sed 's/^/    /'
echo "    audio: $(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$OUT" | head -1)"
