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
  const videoRef = useRef<HTMLVideoElement | null>(null)

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
          muted
          playsInline
          autoPlay
          preload="auto"
          onEnded={() => setFading(true)}
          onError={() => setFading(true)}
        />
      )}
    </div>
  )
}
