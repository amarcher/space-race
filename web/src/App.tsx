import { useState } from 'react'
import { Gallery } from './components/Gallery'
import { Starfield } from './components/Starfield'
import { Table } from './components/Table'

type View = 'game' | 'gallery'

export default function App() {
  const [view, setView] = useState<View>('game')
  return (
    <>
      <Starfield />
      {view === 'game' ? (
        <Table onExit={() => setView('gallery')} />
      ) : (
        <div>
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
