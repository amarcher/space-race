// Native-only boot splash: the Ace Pilot takeover.
//
// Continues the storyboard launch screen (LaunchScreen.storyboard shows the SAME
// Ace-Pilot still full-bleed) so there's no seam between the native launch image
// and the web layer. Sequence: hold the still → play the takeover clip once →
// fade out (~400ms) revealing the game table underneath.
//
// Gated entirely behind Capacitor.isNativePlatform() — the web app never mounts
// this (returns null), so the browser boot is byte-for-byte unchanged. Honours
// prefers-reduced-motion by skipping the clip and doing a quick fade.
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { cardHeroVideo } from '../game/cardArt'
import './BootSplash.css'

const STILL = '/cards/ace-pilot.webp'
const CLIP = cardHeroVideo('ace-pilot') // the full-screen takeover clip, if present
const FADE_MS = 400
const HOLD_MS = 600 // how long the still sits when there's no clip / reduced motion

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function BootSplash() {
  // only ever live on the native platform; web renders nothing
  if (!Capacitor.isNativePlatform()) return null
  return <BootSplashOverlay />
}

function BootSplashOverlay() {
  const [fading, setFading] = useState(false)
  const [done, setDone] = useState(false)
  // WKWebView paints the <video> surface BLACK from load-start until the first
  // frame decodes (the poster does not reliably cover that window on iOS), so
  // the clip must stay invisible — still showing underneath — until it reports
  // real playback. Same fix as CardTakeover's stage mode.
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // The NATIVE splash (launchAutoHide: false) is still covering everything
  // when we mount. Dismiss it only once OUR still has decoded and had a frame
  // to paint — the native still and this one are the same art, so the handoff
  // is seamless and the dark half-loaded webview is never exposed. The timeout
  // is a safety net: never trap the user on the native splash.
  useEffect(() => {
    let cancelled = false
    const dismiss = () => {
      if (cancelled) return
      cancelled = true
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {})
    }
    const img = new Image()
    img.src = STILL
    const ready = 'decode' in img ? img.decode().catch(() => {}) : Promise.resolve()
    void ready.then(() => requestAnimationFrame(() => requestAnimationFrame(dismiss)))
    const guard = window.setTimeout(dismiss, 3000)
    return () => window.clearTimeout(guard)
  }, [])

  useEffect(() => {
    const beginFade = () => setFading(true)
    const reduce = reducedMotion()
    const clip = !reduce && CLIP

    if (clip) {
      // play the takeover once; fall back to a timed fade if it never fires `ended`
      const v = videoRef.current
      v?.play().catch(() => beginFade())
      const guard = setTimeout(beginFade, 5000)
      return () => clearTimeout(guard)
    }
    // no clip (or reduced motion): hold the still, then fade
    const hold = setTimeout(beginFade, reduce ? 200 : HOLD_MS)
    return () => clearTimeout(hold)
  }, [])

  useEffect(() => {
    if (!fading) return
    const t = setTimeout(() => setDone(true), FADE_MS)
    return () => clearTimeout(t)
  }, [fading])

  if (done) return null
  const showClip = !reducedMotion() && CLIP

  return (
    <div className={`boot-splash${fading ? ' boot-splash--out' : ''}`} aria-hidden="true">
      <img className="boot-splash__still" src={STILL} alt="" />
      {showClip && (
        <video
          ref={videoRef}
          className="boot-splash__clip"
          src={CLIP}
          poster={STILL}
          style={{ opacity: playing ? 1 : 0, transition: 'opacity 180ms ease' }}
          muted
          playsInline
          autoPlay
          preload="auto"
          onPlaying={() => setPlaying(true)}
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime > 0) setPlaying(true)
          }}
          onEnded={() => setFading(true)}
          onError={() => setFading(true)}
        />
      )}
    </div>
  )
}
