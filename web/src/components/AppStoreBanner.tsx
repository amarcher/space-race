import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import './AppStoreBanner.css'

const APP_STORE_URL = 'https://apps.apple.com/us/app/space-race-1000-light-years/id6788064058'
const DISMISS_KEY = 'sr-appstore-banner-dismissed'

/** Should the custom banner show at all? Decided once at module scope — the
 * answer can't change mid-session.
 *
 * Safari itself is deliberately EXCLUDED: it renders the native Smart App
 * Banner from the `apple-itunes-app` meta tag in index.html, and we don't want
 * two banners. This component exists for the iOS browsers that ignore that
 * meta tag (Chrome/Firefox/Edge/DuckDuckGo on iOS — all WebKit skins). */
function shouldOffer(): boolean {
  if (Capacitor.isNativePlatform()) return false
  const ua = navigator.userAgent
  // iPhone/iPod, plus iPad — modern iPadOS masquerades as macOS but is the
  // only "Mac" with a multi-touch screen
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIos) return false
  // installed-to-home-screen PWA — they've already "installed" us; don't nag
  const standalone =
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  if (standalone) return false
  // real Safari gets the native Smart App Banner instead
  const isAltBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//.test(ua)
  if (!isAltBrowser) return false
  try {
    if (localStorage.getItem(DISMISS_KEY)) return false
  } catch {
    /* private mode etc. — just show it */
  }
  return true
}

const OFFER = shouldOffer()

/** Slim dismissible "get the app" bar, overlaid along the top safe area on
 * iOS browsers that don't support Safari's Smart App Banner. Dismissal is
 * remembered forever in localStorage. */
export function AppStoreBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (!OFFER || dismissed) return null
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* session-only dismissal is fine */
    }
  }
  return (
    <div className="appstore-banner" role="complementary" aria-label="Get the iOS app">
      <button className="appstore-banner__close" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
      <img className="appstore-banner__icon" src="/icon-192.png" alt="" />
      <div className="appstore-banner__text">
        <strong>Space Race</strong>
        <span>Free on the App Store — plays offline</span>
      </div>
      <a
        className="appstore-banner__cta"
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        GET
      </a>
    </div>
  )
}
