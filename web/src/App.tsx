import { useEffect, useState } from 'react'
import { initAudio } from './audio/sfx'
import { Gallery } from './components/Gallery'
import { Starfield } from './components/Starfield'
import { Table } from './components/Table'

type View = 'game' | 'gallery'

export default function App() {
  const [view, setView] = useState<View>('game')
  // wire the first-gesture audio unlock once (no-op until the user interacts)
  useEffect(() => initAudio(), [])
  return (
    <>
      <Starfield />
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
