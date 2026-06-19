import { useState } from 'react'
import { Gallery } from './components/Gallery'
import { Table } from './components/Table'

type View = 'game' | 'gallery'

export default function App() {
  const [view, setView] = useState<View>('game')
  return view === 'game' ? (
    <Table onExit={() => setView('gallery')} />
  ) : (
    <div>
      <div style={{ textAlign: 'center', paddingTop: 18 }}>
        <button className="btn btn--ghost" onClick={() => setView('game')} style={{ cursor: 'pointer' }}>
          ← Back to game
        </button>
      </div>
      <Gallery />
    </div>
  )
}
