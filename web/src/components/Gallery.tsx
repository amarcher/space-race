import { useState } from 'react'
import { CARD_DEFS, DECK_COUNTS, DECK_TOTAL, GALLERY_ORDER, type CardType } from '../game/cards'
import { Card } from './Card'
import './Gallery.css'

const GROUPS: { type: CardType; label: string }[] = [
  { type: 'distance', label: 'Distances' },
  { type: 'hazard', label: 'Hazards' },
  { type: 'remedy', label: 'Remedies' },
  { type: 'safety', label: 'Safeties' },
]

/** Browse every card face in the deck — the asset proof sheet. */
export function Gallery() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showBacks, setShowBacks] = useState(false)

  return (
    <div className="gallery">
      <header className="gallery__head">
        <div>
          <h1>1000 Light-Years</h1>
          <p className="gallery__sub">Milo's Space Race · deck proof sheet · {DECK_TOTAL} cards</p>
        </div>
        <label className="gallery__toggle">
          <input type="checkbox" checked={showBacks} onChange={(e) => setShowBacks(e.target.checked)} />
          Show card back
        </label>
      </header>

      {showBacks && (
        <section className="gallery__group">
          <h2>Card back</h2>
          <div className="gallery__row">
            <figure className="gallery__cell">
              <Card faceDown size="md" />
              <figcaption>×{DECK_TOTAL}</figcaption>
            </figure>
          </div>
        </section>
      )}

      {GROUPS.map((group) => {
        const kinds = GALLERY_ORDER.filter((k) => CARD_DEFS[k].type === group.type)
        return (
          <section className="gallery__group" key={group.type}>
            <h2>
              <span className={`dot dot--${group.type}`} /> {group.label}
            </h2>
            <div className="gallery__row">
              {kinds.map((kind) => (
                <figure className="gallery__cell" key={kind}>
                  <Card
                    kind={kind}
                    size="md"
                    selected={selected === kind}
                    onClick={() => setSelected(selected === kind ? null : kind)}
                  />
                  <figcaption>×{DECK_COUNTS[kind]}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
