#!/usr/bin/env bash
# Render the brand banners (Play feature graphic + Facebook cover) from the REAL
# design tokens, so they can never drift from the app the way the first pair did.
#
#   ./web/scripts/gen-brand-banners.sh
#
# WHY A SCRIPT AND NOT A ONE-OFF EXPORT. The original feature graphic was built
# by hand in ImageMagick and used neither the brand display face nor the brand
# palette — it looked like a generic app banner because it was one. Everything
# below is pulled from source: Unbounded (--font-display) straight out of
# web/public/fonts, #ffd93d (--gold) and #07071a (--bg) from web/src/index.css,
# and the artwork from artbin/. Change a token and re-run; the banners follow.
#
# The fonts are inlined as base64 data URIs rather than file:// URLs — headless
# Chrome silently refuses to load a file:// @font-face and falls back to
# Helvetica, which renders a plausible-looking banner in the WRONG typeface.
# That failure is invisible unless you A/B it against a known sans, so don't
# "simplify" this back to file:// paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT_PLAY="$ROOT/docs/play-store/assets/feature-graphic.png"
OUT_FB="$ROOT/docs/marketing/assets/facebook-cover.png"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
[[ -x "$CHROME" ]] || { echo "!! headless Chrome not found at $CHROME" >&2; exit 1; }

b64(){ base64 -i "$1"; }
U9=$(b64 "$ROOT/web/public/fonts/unbounded-900.woff2")
U7=$(b64 "$ROOT/web/public/fonts/unbounded-700.woff2")
NEB=$(b64 "$ROOT/artbin/s3-01-tuck-box-bg_v2.png")   # tuck-box nebula
# REAL card faces, straight out of exports/ — the same PNGs the print run uses.
# An earlier version faked these by dropping raw art inside the card-BACK frame,
# which produced cards that do not exist in the game. Always use exports/cards/.
A1=$(b64 "$ROOT/exports/cards/black-hole.png")      # hazard
A2=$(b64 "$ROOT/exports/cards/ace-pilot.png")       # safety / hero
A3=$(b64 "$ROOT/exports/cards/warp-200.png")        # distance

# $1 out  $2 w  $3 h  $4 stage-left  $5 stage-w  $6 title-px  $7 copy-top  $8 card-w  $9 card-h
render(){
cat > "$TMP/b.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Unbounded';src:url(data:font/woff2;base64,$U9) format('woff2');font-weight:900;font-display:block}
@font-face{font-family:'Unbounded';src:url(data:font/woff2;base64,$U7) format('woff2');font-weight:700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${2}px;height:${3}px;overflow:hidden;background:#07071a}
.wrap{position:relative;width:${2}px;height:${3}px;overflow:hidden}
.neb{position:absolute;inset:0;background:url(data:image/png;base64,$NEB) center 45% / 140% no-repeat}
.scrim{position:absolute;inset:0;background:radial-gradient(95% 130% at 50% 50%,rgba(7,7,26,.30) 0%,rgba(7,7,26,.62) 55%,rgba(7,7,26,.90) 100%)}
.vig{position:absolute;inset:0;background:radial-gradient(130% 108% at 50% 50%,rgba(7,7,26,0) 44%,rgba(7,7,26,.86) 100%)}
.stage{position:absolute;left:${4}px;top:0;width:${5}px;height:${3}px}
.copy{position:absolute;left:6px;top:${7};transform:translateY(-50%);z-index:5}
h1{font-family:'Unbounded';font-weight:900;font-size:${6}px;line-height:1.02;color:#fff;letter-spacing:-.005em;
   text-shadow:0 8px 52px rgba(7,7,26,1),0 2px 14px rgba(7,7,26,.95)}
.rule{width:88px;height:3px;background:#ffd93d;margin:26px 0 18px;box-shadow:0 0 24px rgba(255,217,61,.75)}
.sub{font-family:'Unbounded';font-weight:700;font-size:19px;color:#ffd93d;letter-spacing:.24em;text-shadow:0 2px 20px rgba(7,7,26,1)}
.fan{position:absolute;right:0;top:50%;transform:translateY(-50%);width:$(( $8 * 26 / 10 ))px;height:$(( $9 + 110 ))px;z-index:4}
.card{position:absolute;width:${8}px;height:${9}px;border-radius:14px;overflow:hidden;top:56px;
  background-size:cover;background-position:center;background-repeat:no-repeat;
  box-shadow:0 28px 58px rgba(0,0,0,.76),0 0 0 1px rgba(255,217,61,.34)}
.c1{left:0;transform:rotate(-13deg) translateY(8px);z-index:1}
.c2{left:$(( $8 * 72 / 100 ))px;transform:rotate(-1deg) translateY(-14px);z-index:2}
.c3{left:$(( $8 * 144 / 100 ))px;transform:rotate(11deg) translateY(8px);z-index:3}
.glow{position:absolute;right:120px;top:50%;transform:translateY(-50%);width:560px;height:560px;z-index:3;
  background:radial-gradient(circle,rgba(255,217,61,.20) 0%,rgba(255,217,61,0) 62%)}
</style></head><body><div class="wrap">
<div class="neb"></div><div class="scrim"></div>
<div class="stage"><div class="glow"></div>
 <div class="fan">
  <div class="card c1" style="background-image:url(data:image/png;base64,$A1)"></div>
  <div class="card c2" style="background-image:url(data:image/png;base64,$A2)"></div>
  <div class="card c3" style="background-image:url(data:image/png;base64,$A3)"></div>
 </div>
 <div class="copy"><h1>SPACE<br>RACE</h1><div class="rule"></div><div class="sub">1000 LIGHT-YEARS</div></div>
</div><div class="vig"></div></div></body></html>
HTML
"$CHROME" --headless --disable-gpu --force-device-scale-factor=1 --hide-scrollbars \
  --screenshot="$1" --window-size="$2,$3" --virtual-time-budget=9000 "file://$TMP/b.html" 2>/dev/null
echo "==> $1 ($(sips -g pixelWidth -g pixelHeight "$1" | awk '/pixel/{printf "%s ",$2}'))"
}

# Play feature graphic — exactly 1024x500, no safe-area concerns.
render "$OUT_PLAY" 1024 500 30 964 66 50% 226 308
# Facebook cover — 1640x624. Composition is held inside the central ~1130px so
# FB's mobile crop (it shows roughly the centre 640x360) keeps all of it, and the
# type sits ABOVE centre so the page's profile picture, which overlaps the
# cover's bottom-left on desktop, cannot clip the wordmark.
render "$OUT_FB" 1640 624 255 1130 78 44% 256 349
