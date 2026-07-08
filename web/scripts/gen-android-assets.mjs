// Generate the Android launcher-icon + splash resources from the ACE PILOT art —
// the same hero the iOS app uses for its app icon and boot takeover.
//
//   node scripts/gen-android-assets.mjs
//
// Sources (already in the repo — no external art needed):
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png  (1024² ace pilot)
//   public/cards/video/ace-pilot.poster.webp                            (9:16 clip frame-0)
//
// The icon is a PHOTOGRAPHIC hero, so it goes FULL-BLEED into the adaptive icon
// (no 16.7% safe-zone inset — that's for line-mark logos) and ships no monochrome
// layer (a photo can't theme). The OS splash shows the same ace pilot: the
// Android-12+ SplashScreen API uses @mipmap/ic_launcher_foreground as its animated
// icon (wired in styles.xml), and the pre-12 window background is the full-bleed
// still regenerated here. The in-app full-screen takeover CLIP is BootSplash.tsx.
import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, 'android/app/src/main/res')
const ICON = join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
const POSTER = join(ROOT, 'public/cards/video/ace-pilot.poster.webp')
const BG = '#07071a'

// legacy square + round icon sizes, and the adaptive foreground/background size, per density
const DENSITIES = {
  mdpi: { legacy: 48, fg: 108 },
  hdpi: { legacy: 72, fg: 162 },
  xhdpi: { legacy: 96, fg: 216 },
  xxhdpi: { legacy: 144, fg: 324 },
  xxxhdpi: { legacy: 192, fg: 432 },
}

const circleMask = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)

async function square(size) {
  return sharp(ICON).resize(size, size, { fit: 'cover' }).png().toBuffer()
}

async function gen() {
  for (const [d, { legacy, fg }] of Object.entries(DENSITIES)) {
    const dir = join(RES, `mipmap-${d}`)
    // legacy square icon (older launchers / notifications)
    await sharp(await square(legacy)).toFile(join(dir, 'ic_launcher.png'))
    // round icon (launchers that request the round variant)
    await sharp(await square(legacy))
      .composite([{ input: circleMask(legacy), blend: 'dest-in' }])
      .png().toFile(join(dir, 'ic_launcher_round.png'))
    // adaptive FOREGROUND — full-bleed ace pilot (opaque, so it covers the bg)
    await sharp(await square(fg)).toFile(join(dir, 'ic_launcher_foreground.png'))
    // adaptive BACKGROUND — solid brand dark (only shows at the masked corners)
    await sharp({ create: { width: fg, height: fg, channels: 4, background: BG } })
      .png().toFile(join(dir, 'ic_launcher_background.png'))
    console.log(`icons: mipmap-${d}`)
  }

  // Adaptive-icon XML: full-bleed (NO inset), no monochrome (photographic hero).
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
  const anydpi = join(RES, 'mipmap-anydpi-v26')
  const { writeFileSync } = await import('node:fs')
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    writeFileSync(join(anydpi, name), adaptiveXml)
    console.log(`adaptive xml: ${name}`)
  }

  // Splash: overwrite every generated splash.png variant at its existing size with
  // the ace-pilot poster, covering a brand-dark field (full-bleed, matches the
  // iOS launch still and the BootSplash frame-0).
  let n = 0
  for (const entry of readdirSync(RES)) {
    if (!entry.startsWith('drawable')) continue
    const dir = join(RES, entry)
    const splash = join(dir, 'splash.png')
    let meta
    try { meta = await sharp(splash).metadata() } catch { continue }
    const { width, height } = meta
    const cover = await sharp(POSTER).resize(width, height, { fit: 'cover', position: 'top' }).png().toBuffer()
    await sharp({ create: { width, height, channels: 4, background: BG } })
      .composite([{ input: cover }])
      .png().toFile(splash)
    n++
  }
  console.log(`splash: ${n} variants regenerated`)
  console.log('done')
}

gen()
