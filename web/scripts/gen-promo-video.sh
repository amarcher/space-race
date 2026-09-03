#!/usr/bin/env bash
# Build the landscape promo video from the App Store preview footage.
#
#   ./web/scripts/gen-promo-video.sh
#
# WHY THIS EXISTS. The store previews we already shot are PORTRAIT (886x1920) —
# right for App Store and Play listings, wrong for YouTube, which the Play
# listing's Video field wants as a URL. Rather than re-shoot, this mats the
# existing footage onto the same branded 1920x1080 backdrop the banners use, so
# one recording serves both orientations and the promo can never drift from the
# brand (see gen-brand-banners.sh for the token sourcing).
#
# TWO THINGS THAT LOOK OPTIONAL AND ARE NOT:
#   -framerate 30 on the LOOPED BACKDROP. Without it ffmpeg gives the image
#   input the default 25fps, which becomes the output rate and silently drops
#   every 6th frame of 30fps gameplay. The result plays and looks almost fine,
#   which is what makes it worth a comment.
#   -map 1:a. The overlay filter emits video only, so the preview's audio is
#   dropped unless it is mapped back explicitly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="${1:-$ROOT/docs/app-store/previews/app-preview-6.9.mp4}"
OUT="$ROOT/docs/marketing/assets/space-race-promo-1080p.mp4"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
command -v ffmpeg >/dev/null || { echo "!! ffmpeg not found" >&2; exit 1; }
[[ -f "$SRC" ]] || { echo "!! source footage not found: $SRC" >&2; exit 1; }

U9=$(base64 -i "$ROOT/web/public/fonts/unbounded-900.woff2")
U7=$(base64 -i "$ROOT/web/public/fonts/unbounded-700.woff2")
NEB=$(base64 -i "$ROOT/artbin/s3-01-tuck-box-bg_v2.png")
cat > "$TMP/bg.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Unbounded';src:url(data:font/woff2;base64,$U9) format('woff2');font-weight:900;font-display:block}
@font-face{font-family:'Unbounded';src:url(data:font/woff2;base64,$U7) format('woff2');font-weight:700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:#07071a}
.w{position:relative;width:1920px;height:1080px;overflow:hidden}
.neb{position:absolute;inset:0;background:url(data:image/png;base64,$NEB) center 45% / 150% no-repeat}
.scrim{position:absolute;inset:0;background:radial-gradient(95% 130% at 50% 50%,rgba(7,7,26,.34) 0%,rgba(7,7,26,.66) 55%,rgba(7,7,26,.92) 100%)}
.vig{position:absolute;inset:0;background:radial-gradient(130% 108% at 50% 50%,rgba(7,7,26,0) 44%,rgba(7,7,26,.90) 100%)}
.copy{position:absolute;left:170px;top:50%;transform:translateY(-50%);z-index:5}
h1{font-family:'Unbounded';font-weight:900;font-size:118px;line-height:1.0;color:#fff;letter-spacing:-.01em;
   text-shadow:0 10px 60px rgba(7,7,26,1),0 2px 16px rgba(7,7,26,.95)}
.rule{width:132px;height:5px;background:#ffd93d;margin:40px 0 30px;box-shadow:0 0 32px rgba(255,217,61,.8)}
.sub{font-family:'Unbounded';font-weight:700;font-size:30px;color:#ffd93d;letter-spacing:.24em;text-shadow:0 2px 24px rgba(7,7,26,1)}
.glow{position:absolute;right:180px;top:50%;transform:translateY(-50%);width:900px;height:900px;z-index:2;
  background:radial-gradient(circle,rgba(255,217,61,.17) 0%,rgba(255,217,61,0) 62%)}
</style></head><body><div class="w"><div class="neb"></div><div class="scrim"></div><div class="glow"></div>
<div class="copy"><h1>SPACE<br>RACE</h1><div class="rule"></div><div class="sub">1000 LIGHT-YEARS</div></div>
<div class="vig"></div></div></body></html>
HTML
"$CHROME" --headless --disable-gpu --force-device-scale-factor=1 --hide-scrollbars \
  --screenshot="$TMP/bg.png" --window-size=1920,1080 --virtual-time-budget=9000 "file://$TMP/bg.html" 2>/dev/null

mkdir -p "$(dirname "$OUT")"
ffmpeg -y -loglevel error \
  -framerate 30 -loop 1 -i "$TMP/bg.png" -i "$SRC" \
  -filter_complex "[1:v]scale=-2:940,pad=iw+6:ih+6:3:3:color=0xffd93d[ph];[0:v][ph]overlay=x=1262:y=(H-h)/2:shortest=1,format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 30 -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
echo "==> $OUT"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of default=nw=1 "$OUT" | sed 's/^/    /'
