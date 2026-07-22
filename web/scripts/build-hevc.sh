#!/usr/bin/env bash
# Re-encode the H.264 gameplay clips in public/ to HEVC for the iOS bundle.
#
#   ./scripts/build-hevc.sh           # encode (incremental) into web/ios-hevc/
#   ./scripts/build-hevc.sh --swap    # encode, then overlay onto ios/App/App/public
#
# Why: the wide-screen *.hero.mp4 clips are 14-15 Mbps H.264 (~133 MB of the
# bundle). HEVC at CRF 26 is ~2.5x smaller at matching quality, and every
# device that can run the app (iOS 13+, A9 and later) has hardware HEVC
# decode. Only the hero clips are swapped — the 720p standard clips are
# already tight (~31 MB total) and stay as shipped. The web build keeps
# H.264 everywhere — browser HEVC support (desktop Chrome, Android WebView)
# is hardware-dependent — so the swap happens only in the iOS copy step,
# after `cap sync ios`, replacing same-named files.
#
# Output is derived and gitignored; encodes are incremental (skipped when the
# output is newer than its source), so a clean re-run only pays for new clips.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"        # web/
OUT="$ROOT/ios-hevc"
CRF=26
JOBS=6

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }

# clip dirs shipped in the app that carry the big H.264 payloads
SRC_DIRS=("cards/video" "win")

encode_one() {
  local src="$1" out="$2"
  mkdir -p "$(dirname "$out")"
  local tmp="$out.tmp.mp4"
  # hvc1 tag: Apple players reject the default hev1 sample entry.
  ffmpeg -y -v error -i "$src" \
    -c:v libx265 -crf "$CRF" -preset medium -tag:v hvc1 \
    -x265-params log-level=error \
    -movflags +faststart \
    -c:a copy \
    "$tmp"
  mv "$tmp" "$out"
  echo "  $(basename "$out"): $(du -h "$src" | cut -f1) -> $(du -h "$out" | cut -f1)"
}
export -f encode_one
export CRF

echo "==> Encoding HEVC variants into $OUT (CRF $CRF, incremental)"
pending=()
for dir in "${SRC_DIRS[@]}"; do
  for src in "$ROOT/public/$dir"/*.hero.mp4; do
    out="$OUT/$dir/$(basename "$src")"
    [[ -f "$out" && "$out" -nt "$src" ]] && continue
    pending+=("$src|$out")
  done
done

if [[ ${#pending[@]} -eq 0 ]]; then
  echo "    all ${SRC_DIRS[*]} clips up to date"
else
  printf '%s\0' "${pending[@]}" | \
    xargs -0 -P "$JOBS" -n1 bash -c 'IFS="|" read -r s o <<< "$1"; encode_one "$s" "$o"' _
fi

echo "==> HEVC hero set: $(du -sh "$OUT" | cut -f1)  (H.264 hero source: $(du -ch "$ROOT"/public/cards/video/*.hero.mp4 "$ROOT"/public/win/*.hero.mp4 | tail -1 | cut -f1))"

if [[ "${1:-}" == "--swap" ]]; then
  IOS_PUBLIC="$ROOT/ios/App/App/public"
  [[ -d "$IOS_PUBLIC" ]] || { echo "run 'npx cap sync ios' first ($IOS_PUBLIC missing)" >&2; exit 1; }
  echo "==> Swapping HEVC hero clips into iOS bundle"
  for dir in "${SRC_DIRS[@]}"; do
    for f in "$OUT/$dir"/*.hero.mp4; do
      dest="$IOS_PUBLIC/$dir/$(basename "$f")"
      [[ -f "$dest" ]] || { echo "unexpected: $dest not in iOS bundle" >&2; exit 1; }
      cp "$f" "$dest"
    done
  done
  echo "==> iOS web bundle now $(du -sh "$IOS_PUBLIC" | cut -f1)"
fi
