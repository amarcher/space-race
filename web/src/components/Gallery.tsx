import { useState } from 'react'
import {
  CARD_DEFS,
  DECK_COUNTS,
  DECK_TOTAL,
  GALLERY_ORDER,
  LANES,
  SAFETY_MILEAGE,
  SLINGSHOT_MILEAGE,
  WIN_DISTANCE,
  type CardType,
} from '../game/cards'
import { Card } from './Card'
import './Gallery.css'

const GROUPS: { type: CardType; label: string }[] = [
  { type: 'distance', label: 'Distances' },
  { type: 'hazard', label: 'Hazards' },
  { type: 'remedy', label: 'Remedies' },
  { type: 'safety', label: 'Safeties' },
]

const titleOf = (kind?: string) => (kind ? CARD_DEFS[kind]?.title : undefined)

// Derive the hazard → remedy → safety tracks straight from the card data so the
// rules can never drift out of sync with the deck. One row per threat lane.
const HAZARD_TRACKS = LANES.map((lane) => {
  const hazard = GALLERY_ORDER.map((k) => CARD_DEFS[k]).find((d) => d.type === 'hazard' && d.lane === lane)
  return hazard
    ? {
        hazard: hazard.title,
        remedy: titleOf(hazard.fixedBy) ?? '—',
        safety: titleOf(hazard.protectedBy?.[0]) ?? '—',
      }
    : null
}).filter((t): t is { hazard: string; remedy: string; safety: string } => t !== null)

/** "How to Play" rules/NUX screen + a full reference of every card in the deck. */
export function Gallery() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showBacks, setShowBacks] = useState(false)

  return (
    <div className="gallery">
      <header className="gallery__head">
        <div>
          <h1>1000 Light-Years</h1>
        </div>
        <label className="gallery__toggle">
          <input type="checkbox" checked={showBacks} onChange={(e) => setShowBacks(e.target.checked)} />
          Show card back
        </label>
      </header>

      {/* ---- How to Play (words are fine here — this is not the play surface) ---- */}
      <section className="rules" aria-label="How to play">
        <h2 className="rules__heading">How to Play</h2>

        <div className="rules__grid">
          <article className="rules__card rules__card--goal">
            <h3>Goal</h3>
            <p>
              Be the first ship to race <strong>{WIN_DISTANCE} light-years</strong>. Add up your distance cards — cross
              the line and you win the round!
            </p>
          </article>

          <article className="rules__card">
            <h3>On your turn</h3>
            <p>
              <strong>Draw</strong> one card — off the deck or the top of the discard pile. Then <strong>play</strong> a
              card onto your track, or <strong>discard</strong> one you don't need.
            </p>
          </article>

          <article className="rules__card">
            <h3>Start your engines</h3>
            <p>
              You can't move until you play <strong>Ignition</strong> — it fires up your ship. Ignition also clears a{' '}
              <strong>Black Hole</strong> that's holding you still.
            </p>
          </article>

          <article className="rules__card rules__card--slingshot">
            <h3>Slingshot!</h3>
            <p>
              If you're <em>already holding</em> the matching{' '}
              <span className="rules__chip rules__chip--safety">Safety</span> the instant a hazard hits you, slam it
              down to dodge — a <strong>Slingshot</strong>. You shrug off the hazard <strong>and</strong> take an extra
              turn.
            </p>
          </article>
        </div>

        {/* Hazard tracks: what stops you, what fixes it, what makes you immune */}
        <article className="rules__card rules__tracks">
          <h3>
            Hazard tracks <span className="rules__hint">— what stops you, and how to get going again</span>
          </h3>
          <ul className="tracks">
            <li className="tracks__row tracks__row--head" aria-hidden>
              <span className="tracks__cell">
                <span className="dot dot--hazard" /> Hazard
              </span>
              <span className="tracks__cell">
                <span className="dot dot--remedy" /> Fix it with
              </span>
              <span className="tracks__cell">
                <span className="dot dot--safety" /> Safe forever with
              </span>
            </li>
            {HAZARD_TRACKS.map((t) => (
              <li className="tracks__row" key={t.hazard}>
                <span className="tracks__cell" data-label="Hazard">
                  {t.hazard}
                </span>
                <span className="tracks__cell" data-label="Fix it with">
                  {t.remedy}
                </span>
                <span className="tracks__cell" data-label="Safe forever with">
                  {t.safety}
                </span>
              </li>
            ))}
          </ul>
        </article>

        {/* Scoring */}
        <article className="rules__card rules__scoring">
          <h3>Scoring</h3>
          <ul className="rules__scores">
            <li>
              <span className="rules__chip rules__chip--safety">Safety</span> revealed
              <strong>+{SAFETY_MILEAGE} ly</strong>
            </li>
            <li>
              <span className="rules__chip rules__chip--slingshot">Slingshot</span> pulled off
              <strong>+{SLINGSHOT_MILEAGE} ly</strong>
            </li>
          </ul>
        </article>
      </section>

      {/* ---- Card reference (every card, with its animation + ×quantity) ---- */}
      <h2 className="rules__heading rules__heading--ref">Card reference</h2>

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
