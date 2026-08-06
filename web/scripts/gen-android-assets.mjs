// Generate the Android launcher icons from the ACE PILOT art — the same hero the
// iOS app uses for its app icon and boot takeover.
//
//   node scripts/gen-android-assets.mjs
//
// Sources (already in the repo — no external art needed):
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png  (1024² ace pilot)
//   public/cards/ace-pilot.webp   — the SAME still BootSplash.tsx paints, so the
//                                   native and web stills are the identical crop
//
// The icon is a PHOTOGRAPHIC hero, so it goes FULL-BLEED into the adaptive icon
// (no 16.7% safe-zone inset — that's for line-mark logos) and ships no monochrome
// layer (a photo can't theme).
//
// ONE SPLASH BITMAP, COVER-CROPPED (#141). This used to render the pilot into 26
// density-bucketed splash.png variants used as the launch WINDOW BACKGROUND, and
// the boot showed him at three different crops back to back — round-masked
// SplashScreen icon, stretched window background, then BootSplash.tsx's still +
// takeover clip — so he visibly jumped scale twice on the way in.
//
// A window-background bitmap can never be made to agree with the web layer: it is
// scaled to FILL with no aspect preservation, from a density bucket that says
// nothing about screen size (this hdpi Fire HD 10 stretched a 480x800 bitmap over
// 1200x1920 — blurry AND differently cropped). So the still is no longer a window
// background at all. It is now a SINGLE nodpi bitmap shown by the Capacitor
// SplashScreen plugin's ImageView with `androidScaleType: 'CENTER_CROP'`
// (capacitor.config.ts) — which is precisely `object-fit: cover`, the same rule
// BootSplash.css applies to the same source file. Native still and web still are
// therefore the identical crop at any screen size, and the plugin holds it
// (launchAutoHide: false) until BootSplash.tsx has painted and calls hide().
//
// nodpi, deliberately: the bitmap must NOT be density-scaled before CENTER_CROP
// gets it. One asset, every screen. Generated at 2x the source so the ImageView
// isn't bilinear-upscaling a small bitmap at draw time.
//
// The OS stage BEFORE the activity exists (windowSplashScreenAnimatedIcon, and the
// theme's window background) stays flat brand-dark — see res/drawable/splash_icon.xml.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, 'android/app/src/main/res')
const ICON = join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
// the same still BootSplash.tsx paints (its STILL constant)
const SPLASH_STILL = join(ROOT, 'public/cards/ace-pilot.webp')
const SPLASH_SCALE = 2 // 720x964 source -> 1440x1928; covers a 1200x1920 tablet
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

  // Splash still: ONE nodpi bitmap, cover-cropped at runtime by the plugin's
  // ImageView. No density variants, no window-background stretching — see the
  // header note. Opaque over the brand dark so there is nothing to blend.
  const nodpi = join(RES, 'drawable-nodpi')
  mkdirSync(nodpi, { recursive: true })
  const meta = await sharp(SPLASH_STILL).metadata()
  const width = meta.width * SPLASH_SCALE
  const height = meta.height * SPLASH_SCALE
  const art = await sharp(SPLASH_STILL)
    .resize(width, height, { kernel: 'lanczos3' })
    .png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background: BG } })
    .composite([{ input: art }])
    .webp({ quality: 82 })
    .toFile(join(nodpi, 'splash.webp'))
  console.log(`splash: drawable-nodpi/splash.webp ${width}x${height}`)
  console.log('done')
}

gen()
