#!/usr/bin/env bash
# Optimize the print-resolution card art in ../artbin into web-sized WebP
# images under public/cards/. Re-run whenever source art changes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ART="$ROOT/artbin"
OUT="$ROOT/web/public/cards"
mkdir -p "$OUT"

WIDTH=720      # display ~360px CSS, 2x for retina
QUALITY=82

# source-relative-to-artbin  ->  output-id
map=(
  "s1-07-25ly-warp_v1.jpg|warp-25"
  "s1-06-50ly-warp_v1.jpg|warp-50"
  "s1-05-75ly-warp_v1.jpg|warp-75"
  "s1-04-100ly-warp_v1.jpg|warp-100"
  "s1-03-200ly-warp_v1.jpg|warp-200"
  "s1-08-asteroid-strike_v1.jpg|asteroid-strike"
  "s1-09-empty-tank_v1.jpg|empty-tank"
  "s1-10-busted-thruster_v1.jpg|busted-thruster"
  "s1-02-tractor-beam_v1.jpg|tractor-beam"
  "s1-01-black-hole_v2.jpg|black-hole"
  "s1-11-repair-drone_v1.jpg|repair-drone"
  "s1-12-fuel-cell_v1.jpg|fuel-cell"
  "s1-13-new-thruster_v1.jpg|new-thruster"
  "candidates/s1-14-beam-cutter_e.jpg|beam-cutter"
  "s1-15-ignition_v1.jpg|ignition"
  "s2-02-ace-pilot_v1.jpg|ace-pilot"
  "s2-04-antimatter-fuel-cell_v1.jpg|antimatter-fuel-cell"
  "s2-03-diamond-thruster_v1.jpg|diamond-thruster"
  "s2-01-rescue-shuttle_v1.jpg|rescue-shuttle"
  "s3-02-card-back-tile_v2.png|card-back"
)

for entry in "${map[@]}"; do
  src="${entry%%|*}"
  id="${entry##*|}"
  if [[ ! -f "$ART/$src" ]]; then
    echo "MISSING: $ART/$src" >&2
    exit 1
  fi
  magick "$ART/$src" -resize "${WIDTH}x" -quality "$QUALITY" "$OUT/$id.webp"
  printf '  %-22s -> %s.webp\n' "$src" "$id"
done

echo "Done. $(ls "$OUT" | wc -l | tr -d ' ') images in $OUT"
