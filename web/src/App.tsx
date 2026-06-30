import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { initAudio } from './audio/sfx'
import { Gallery } from './components/Gallery'
import { Starfield } from './components/Starfield'
import { Table } from './components/Table'
import { tvMode } from './tv/mode'
import { TvStage } from './tv/TvStage'
import { TvController } from './tv/TvController'

type View = 'game' | 'gallery'

// TV second-screen modes are FULLY GATED behind the ?mode= URL flag. With no
// flag this is null and the app falls through to the normal game below, byte-for-
// byte unchanged. ?mode=tv-stage = the TV table; ?mode=tv-controller = a phone.
const TV_MODE = tvMode()

export default function App() {
  if (TV_MODE === 'tv-stage') return <TvStage />
  if (TV_MODE === 'tv-controller') return <TvController />
  return <NormalApp />
}

function NormalApp() {
  const [view, setView] = useState<View>('game')
  // wire the first-gesture audio unlock once (no-op until the user interacts)
  useEffect(() => initAudio(), [])
  return (
    <>
      <Starfield />
      {/* passive observability — Vercel Web Analytics (traffic) + Speed Insights
          (Core Web Vitals). No-op off Vercel; no PII, no config. */}
      <Analytics />
      <SpeedInsights />
      {view === 'game' ? (
        <Table onExit={() => setView('gallery')} />
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
