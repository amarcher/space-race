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
import { useCardPreview } from './useCardPreview'
import './Gallery.css'

const GROUPS: { type: CardType; label: string }[] = [
  { type: 'distance', label: 'Distances' },
  { type: 'hazard', label: 'Hazards' },
  { type: 'remedy', label: 'Remedies' },
  { type: 'safety', label: 'Safeties' },
]

type TrackTone = 'hazard' | 'remedy' | 'safety'
/** a single name cell: enough to render the text AND pop the matching card */
interface TrackRef {
  kind: string
  title: string
}
const refOf = (kind?: string): TrackRef | null =>
  kind && CARD_DEFS[kind] ? { kind, title: CARD_DEFS[kind].title } : null

// Derive the hazard → remedy → safety tracks straight from the card data so the
// rules can never drift out of sync with the deck. We keep each cell's card KIND
// (not just its title) so the name can pop the actual animated card. One row per
// threat lane.
interface TrackRow {
  hazard: TrackRef | null
  remedy: TrackRef | null
  safety: TrackRef | null
}
const HAZARD_TRACKS: TrackRow[] = LANES.map((lane) => {
  const hazard = GALLERY_ORDER.map((k) => CARD_DEFS[k]).find((d) => d.type === 'hazard' && d.lane === lane)
  return hazard
    ? {
        hazard: refOf(hazard.kind),
        remedy: refOf(hazard.fixedBy),
        safety: refOf(hazard.protectedBy?.[0]),
      }
    : null
}).filter((t): t is TrackRow => t !== null)

/**
 * A hazard-track NAME that reveals its actual card — animated — on hover
 * (desktop) or press-and-hold (mobile), via the shared useCardPreview hook.
 */
function TrackName({ refData, tone }: { refData: TrackRef; tone: TrackTone }) {
  const { handlers, popover, open } = useCardPreview(refData.kind)
  return (
    <>
      <button
        type="button"
        className={`track-name track-name--${tone} ${open ? 'track-name--on' : ''}`}
        {...handlers}
        onClick={(e) => e.preventDefault()}
        aria-label={`${refData.title} card`}
      >
        {refData.title}
      </button>
      {popover}
    </>
  )
}

const TrackCell = ({ refData, tone, label }: { refData: TrackRef | null; tone: TrackTone; label: string }) => (
  <span className="tracks__cell" data-label={label}>
    {refData ? <TrackName refData={refData} tone={tone} /> : '—'}
  </span>
)

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
              <li className="tracks__row" key={t.hazard?.kind ?? t.remedy?.kind}>
                <TrackCell refData={t.hazard} tone="hazard" label="Hazard" />
                <TrackCell refData={t.remedy} tone="remedy" label="Fix it with" />
                <TrackCell refData={t.safety} tone="safety" label="Safe forever with" />
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
