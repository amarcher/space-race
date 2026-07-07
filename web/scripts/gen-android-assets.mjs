// Generate the Android icon/splash SOURCE art under web/assets/ from the Space
// Race planet mark (the favicon.svg motif), then `@capacitor/assets generate
// --android` turns these into the full adaptive-icon + splash resource set.
//
//   node scripts/gen-android-assets.mjs && npx @capacitor/assets generate --android
//
// We author three sources with full control (rather than letting the tool pad a
// single logo) so the adaptive icon reads correctly under the circular/rounded/
// squircle masks OEMs apply:
//   assets/icon-foreground.png  — planet on transparency, inside the adaptive safe zone
//   assets/icon-background.png  — solid #07071a brand dark
//   assets/splash.png / -dark   — solid #07071a with a small centered planet
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets')
mkdirSync(OUT, { recursive: true })

const BG = '#07071a'

// The planet mark from public/favicon.svg (orbit + planet + three star dots),
// WITHOUT the background rect, drawn on a 0 0 100 100 canvas. `scale`/`cx`/`cy`
// place it so callers can pad it into the adaptive safe zone.
function planetSvg({ size, scale = 1, cx = 50, cy = 50 }) {
  // favicon coords are on a 32-box, planet centered at (16,14); recenter to (0,0)
  // then place at (cx,cy) with `scale` (favicon planet spans ~x:5..27, y:10..27).
  const k = (100 / 32) * scale
  const ox = cx - 16 * k
  const oy = cy - 16 * k
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <g transform="translate(${ox} ${oy}) scale(${k})">
    <ellipse cx="16" cy="14" rx="11" ry="4" fill="none" stroke="#8b7bff" stroke-width="1.4" opacity="0.9"/>
    <circle cx="16" cy="14" r="3.4" fill="#05050f" stroke="#c9b8ff" stroke-width="1"/>
    <circle cx="16" cy="26" r="1.3" fill="#ffd76a"/>
    <circle cx="8" cy="22" r="0.8" fill="#6fb7ff"/>
    <circle cx="24" cy="21" r="0.8" fill="#ff8aa0"/>
  </g>
</svg>`)
}

async function write(name, buf) {
  await sharp(buf).png().toFile(join(OUT, name))
  console.log('wrote assets/' + name)
}

const S = 1024
// Foreground: planet at ~52% of the canvas, centered — well inside the adaptive
// safe zone (the outer ~1/6 on every side can be masked away by the launcher).
await write('icon-foreground.png',
  await sharp(planetSvg({ size: S, scale: 1.5, cx: 50, cy: 52 }))
    .png().toBuffer())

// Solid brand-dark background layer.
const solid = (size) => sharp({
  create: { width: size, height: size, channels: 4, background: BG },
}).png()
await write('icon-background.png', await solid(S).toBuffer())

// A full opaque icon too (legacy launchers / any single-image consumer).
await write('icon-only.png',
  await solid(S).composite([{ input: planetSvg({ size: S, scale: 1.5, cx: 50, cy: 52 }) }]).toBuffer())

// Splash: dark field, small centered planet (~28%), matching the iOS flat launch.
const SP = 2732
const splash = await sharp({
  create: { width: SP, height: SP, channels: 4, background: BG },
}).composite([{ input: planetSvg({ size: SP, scale: 0.85, cx: 50, cy: 50 }) }]).png().toBuffer()
await write('splash.png', splash)
await write('splash-dark.png', splash)

console.log('done — now run: npx @capacitor/assets generate --android')
