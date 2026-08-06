#!/usr/bin/env bash
# Re-encode the clips in public/ for the ANDROID bundle: HEVC throughout, every
# clip coded LANDSCAPE with a display-rotation matrix.
#
#   ./scripts/build-android-media.sh           # encode (incremental) into web/android-media/
#   ./scripts/build-android-media.sh --swap    # encode, then overlay onto android/app/src/main/assets/public
#
# Two problems, one pass:
#
# 1. SIZE. The hero clips are 14-15 Mbps H.264 (~133 MB) and put the debug APK
#    at 214 MB — over Play's 200 MB base-module limit. HEVC at CRF 26 is ~2.5x
#    smaller at matching quality (the same trade build-hevc.sh makes for iOS)
#    and is verified playing in Amazon WebView 148 on Fire OS 8.
#
# 2. SOFTWARE DECODE (#140). Every clip we ship is PORTRAIT — heroes 1080x1920,
#    standard clips 720x1280 — and MediaTek's hardware decoders on the Fire HD 10
#    (MT8169) declare `size-range = 64x64-1920x1088`. Coded height above 1088 is
#    outside their advertised capability, so Chromium never even offers them the
#    format and falls back to the Codec2 SOFTWARE decoder. Measured on device:
#
#      1080x1920 H.264 portrait -> c2.android.avc.decoder     (software)
#      1080x1920 HEVC  portrait -> c2.android.hevc.decoder    (software)
#      1920x1080 HEVC  + rot90  -> OMX.MTK.VIDEO.DECODER.HEVC (HARDWARE)
#      1920x1080 H.264 + rot90  -> OMX.MTK.VIDEO.DECODER.AVC  (HARDWARE)
#
#    So we transpose the frame to landscape and carry a 90-degree display-rotation
#    matrix in the container. The decoder sees a 1920x1080 stream it can take in
#    hardware; Chromium applies the matrix and the <video> still reports — and
#    paints — 1080x1920 upright. Nothing in the app's CSS or markup changes.
#
#    This is not a Fire-specific hack: landscape 1920x1080 is the most universally
#    supported decode geometry on Android, so it is at worst neutral elsewhere.
#
#    ONE CEILING COMES WITH IT: the MTK decoders advertise
#    `max-concurrent-instances = 8`, where the software path had no practical
#    limit. Forcing 12 clips to play at once on device, 8 played and 4 stalled
#    (logcat: "keep callback message for reclaim") — no software fallback, they
#    just don't start. The app never gets near that (clips are hover-driven, plus
#    a couple of ambient hero cards and the takeover), but if a future board plays
#    many clips at once, that is the limit to design against.
#
# Rotation recipe: `-vf transpose=1` (clockwise) paired with `-display_rotation 90`
# on a copy pass. VERIFIED UPRIGHT on device — the sign matters, `-90` renders the
# frame 180 degrees off. ffmpeg 8 ignores the old `-metadata:s:v rotate=`, which
# writes nothing; the display matrix has to come from `-display_rotation`.
#
# EVERY clip goes to HEVC, not just the heroes. The geometry change forces a
# re-encode of the standard clips regardless — rotation cannot be done on a
# stream copy — and a same-codec H.264 round-trip at a safe CRF came out ~11 MB
# BIGGER than the source it replaced. Since we are paying for a re-encode either
# way, HEVC is the better end of the trade: smaller, and hardware-decoded on the
# same MTK path. HEVC decode is a baseline Android capability (AOSP has required
# it since 5.0), so a device that somehow lacks it falls back to the card's
# static poster rather than breaking.
#
# The WEB build keeps the portrait H.264 originals — desktop browsers have no
# 1088 ceiling, and H.264 is the safer universal baseline there — and iOS keeps
# its own portrait HEVC set from build-hevc.sh, since Apple silicon decodes
# portrait in hardware natively.
#
# Output is derived and gitignored; encodes are incremental (skipped when the
# output is newer than its source), so a clean re-run only pays for new clips.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"        # web/
OUT="$ROOT/android-media"
HERO_CRF=26     # HEVC, matches the iOS hero encode
STD_CRF=24      # HEVC, a little tighter than the heroes — these play at card size
JOBS=6

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }

# clip dirs shipped in the app
SRC_DIRS=("cards/video" "win")

encode_one() {
  local src="$1" out="$2"
  mkdir -p "$(dirname "$out")"
  local tmp="$out.tmp.mp4" rot="$out.rot.mp4"

  local crf="$STD_CRF"
  [[ "$src" == *.hero.mp4 ]] && crf="$HERO_CRF"

  # hvc1 tag: keeps the file playable on Apple players too, and AWV is happy either way.
  ffmpeg -y -v error -i "$src" \
    -vf transpose=1 \
    -c:v libx265 -crf "$crf" -preset medium -tag:v hvc1 \
    -x265-params log-level=error \
    -movflags +faststart -c:a copy "$tmp"

  # Stamp the display matrix on a stream copy — ffmpeg only writes it from an
  # input-side -display_rotation, so it needs its own pass.
  ffmpeg -y -v error -display_rotation 90 -i "$tmp" -c copy -movflags +faststart "$rot"
  rm -f "$tmp"
  mv "$rot" "$out"
  echo "  $(basename "$out"): $(du -h "$src" | cut -f1) -> $(du -h "$out" | cut -f1)"
}
export -f encode_one
export HERO_CRF STD_CRF

echo "==> Encoding Android media into $OUT (hero HEVC CRF $HERO_CRF, standard HEVC CRF $STD_CRF, landscape+rot90, incremental)"
pending=()
for dir in "${SRC_DIRS[@]}"; do
  for src in "$ROOT/public/$dir"/*.mp4; do
    [[ -e "$src" ]] || continue
    out="$OUT/$dir/$(basename "$src")"
    [[ -f "$out" && "$out" -nt "$src" ]] && continue
    pending+=("$src|$out")
  done
done

if [[ ${#pending[@]} -eq 0 ]]; then
  echo "    all ${SRC_DIRS[*]} clips up to date"
else
  echo "    ${#pending[@]} clip(s) to encode"
  printf '%s\0' "${pending[@]}" | \
    xargs -0 -P "$JOBS" -n1 bash -c 'IFS="|" read -r s o <<< "$1"; encode_one "$s" "$o"' _
fi

src_total=$(du -ch "$ROOT"/public/cards/video/*.mp4 "$ROOT"/public/win/*.mp4 | tail -1 | cut -f1)
echo "==> Android media set: $(du -sh "$OUT" | cut -f1)  (H.264 portrait source: $src_total)"

if [[ "${1:-}" == "--swap" ]]; then
  ANDROID_PUBLIC="$ROOT/android/app/src/main/assets/public"
  [[ -d "$ANDROID_PUBLIC" ]] || { echo "run 'npx cap sync android' first ($ANDROID_PUBLIC missing)" >&2; exit 1; }
  echo "==> Swapping Android media into the Android bundle"
  for dir in "${SRC_DIRS[@]}"; do
    for f in "$OUT/$dir"/*.mp4; do
      dest="$ANDROID_PUBLIC/$dir/$(basename "$f")"
      [[ -f "$dest" ]] || { echo "unexpected: $dest not in Android bundle" >&2; exit 1; }
      cp "$f" "$dest"
    done
  done
  echo "==> Android web bundle now $(du -sh "$ANDROID_PUBLIC" | cut -f1)"
fi
