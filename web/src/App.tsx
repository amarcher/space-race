import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import type { GameState } from './game'
import { initAudio } from './audio/sfx'
import { Gallery } from './components/Gallery'
import { Starfield } from './components/Starfield'
import { Table } from './components/Table'
import { tvMode } from './tv/mode'
import { TvStage } from './tv/TvStage'
import { usePhoneBroadcast } from './tv/usePhoneBroadcast'
import { initStatusBar } from './native/statusBar'
import { keepScreenAwake } from './native/keepAwake'

type View = 'game' | 'gallery'

// TV modes are FULLY GATED behind the ?mode= URL flag (no UI entrypoint). With no
// flag this is null and the app falls through to the normal game, byte-for-byte
// unchanged. ?mode=tv-stage = the TV spectator; ?mode=tv-play = the phone (the
// real game, additionally broadcasting its state to the TV).
const TV_MODE = tvMode()

export default function App() {
  if (TV_MODE === 'tv-stage') return <TvStage />
  if (TV_MODE === 'tv-play') return <PhoneApp />
  return <NormalApp />
}

/** The PHONE: the real, normal game, plus a broadcast of its GameState to the TV.
 * The broadcast is purely additive — the game itself is unchanged. */
function PhoneApp() {
  const broadcast = usePhoneBroadcast()
  return <NormalApp onStateChange={broadcast} />
}

function NormalApp({ onStateChange }: { onStateChange?: (game: GameState) => void }) {
  const [view, setView] = useState<View>('game')
  // wire the first-gesture audio unlock once (no-op until the user interacts)
  useEffect(() => initAudio(), [])
  // native-only boot: light status-bar over the dark starfield, and hold the
  // screen on for the session (both no-op on web). See src/native/.
  useEffect(() => {
    initStatusBar()
    keepScreenAwake()
  }, [])
  return (
    <>
      <Starfield />
      {/* passive observability — Vercel Web Analytics (traffic) + Speed Insights
          (Core Web Vitals). No-op off Vercel; no PII, no config. Skipped in the
          native app: it's served offline from capacitor://localhost (not Vercel),
          so the /_vercel/insights beacons would only 404. GA4 (index.html) carries
          the iOS platform tag instead. */}
      {!Capacitor.isNativePlatform() && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
      {view === 'game' ? (
        <Table onExit={() => setView('gallery')} onStateChange={onStateChange} />
      ) : (
        // the rules/gallery is the one scrollable view — it owns its own scroll
        // container (the document itself is locked, see index.css)
        <div className="view-scroll">
          <div style={{ textAlign: 'left', padding: '18px 0 0 clamp(16px, 4vw, 40px)' }}>
            <button className="btn btn--ghost" onClick={() => setView('game')} style={{ cursor: 'pointer' }}>
              ← Back to game
            </button>
          </div>
          <Gallery />
        </div>
      )}
    </>
  )
}
