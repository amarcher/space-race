import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import './StoreBanner.css'

/** The three native stores the game ships to, keyed by the platform a browser
 * scan can land on. `live` is the kill switch: a store that hasn't published
 * yet must never be linked, because a 404 from a QR code printed on a physical
 * card is unrecoverable — the card can't be reprinted.
 *
 * Play is `false` until the listing actually resolves. Verify before flipping:
 *   curl -s -o /dev/null -w '%{http_code}\n' \
 *     'https://play.google.com/store/apps/details?id=tech.spaceexplorer.spacerace'
 */
const STORES = {
  ios: {
    live: true,
    url: 'https://apps.apple.com/us/app/space-race-1000-light-years/id6788064058',
    label: 'Free on the App Store — plays offline',
    aria: 'Get the iOS app',
  },
  android: {
    live: false,
    url: 'https://play.google.com/store/apps/details?id=tech.spaceexplorer.spacerace',
    label: 'Free on Google Play — plays offline',
    aria: 'Get the Android app',
  },
  // NOT the amazon.com/gp/mas/dl/android?p=<pkg> deep link — that 404s for this
  // app (see docs/release-notes.md). The /dp/ listing is the only URL that works.
  amazon: {
    live: true,
    url: 'https://www.amazon.com/dp/B0GXHBHD78',
    label: 'Free on the Amazon Appstore — plays offline',
    aria: 'Get the Fire tablet app',
  },
} as const

type Platform = keyof typeof STORES

const DISMISS_KEY = 'sr-appstore-banner-dismissed'

/** Which native store, if any, matches the browser we're being scanned in?
 *
 * Order matters: a Fire tablet is an Android device and reports `Android` in
 * its UA, so it has to be tested first or every Fire user gets sent to Play. */
function detectPlatform(ua: string): Platform | null {
  // Fire OS: Silk is Amazon's browser, and `KF*` model codes (KFMAWI, KFTRWI…)
  // identify a Fire tablet even in the Chrome-skinned browser or desktop mode.
  if (/\bSilk\//.test(ua) || /\bKF[A-Z]{2,}\b/.test(ua)) return 'amazon'
  if (/Android/.test(ua)) return 'android'
  // iPhone/iPod, plus iPad — modern iPadOS masquerades as macOS but is the
  // only "Mac" with a multi-touch screen
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'
  return null
}

/** Should the custom banner show, and for which store? Decided once at module
 * scope — the answer can't change mid-session.
 *
 * On iOS, Safari itself is deliberately EXCLUDED: it renders the native Smart
 * App Banner from the `apple-itunes-app` meta tag in index.html, and we don't
 * want two banners. This component covers everything that ignores that meta
 * tag: other iOS browser skins (Chrome/Firefox/Edge/Opera/DuckDuckGo/Google
 * app), AND in-app browsers (Instagram, Facebook, Threads, TikTok, LinkedIn,
 * Pinterest, Snapchat, WeChat, LINE) — those render links in a bare WKWebView
 * owned by the host app, which Apple's Smart Banner never activates in.
 *
 * Android and Fire have no platform equivalent of the Smart App Banner, so
 * there this is the only offer they get and it shows in every browser. */
function resolveOffer(): Platform | null {
  if (Capacitor.isNativePlatform()) return null

  const ua = navigator.userAgent
  const platform = detectPlatform(ua)
  if (!platform || !STORES[platform].live) return null

  // installed-to-home-screen PWA — they've already "installed" us; don't nag
  const standalone =
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  if (standalone) return null

  // real Safari gets the native Smart App Banner instead — iOS only, because
  // it's the only platform that has one
  if (platform === 'ios') {
    const isAltBrowser =
      /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Threads|LinkedInApp|Pinterest|Snapchat|MicroMessenger|Line\/|musical_ly|TikTok/.test(
        ua,
      )
    if (!isAltBrowser) return null
  }

  try {
    if (localStorage.getItem(DISMISS_KEY)) return null
  } catch {
    /* private mode etc. — just show it */
  }
  return platform
}

const OFFER = resolveOffer()

/** Slim dismissible "get the app" bar, overlaid along the top safe area,
 * pointing at whichever native store matches the device. Dismissal is
 * remembered forever in localStorage. */
export function StoreBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (!OFFER || dismissed) return null
  const store = STORES[OFFER]
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* session-only dismissal is fine */
    }
  }
  return (
    <div className="store-banner" role="complementary" aria-label={store.aria}>
      <button className="store-banner__close" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
      <img className="store-banner__icon" src="/icon-192.png" alt="" />
      <div className="store-banner__text">
        <strong>Space Race</strong>
        <span>{store.label}</span>
      </div>
      <a
        className="store-banner__cta"
        href={store.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        GET
      </a>
    </div>
  )
}
