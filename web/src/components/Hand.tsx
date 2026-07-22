import type { PlayerState } from '../game/engine'
import { Card } from './Card'
import './Hand.css'

interface HandProps {
  player: PlayerState
  playableUids: Set<string>
  selectedUid: string | null
  draggingUid: string | null
  /** a just-drawn card that's hidden until its incoming flight lands on it */
  incomingUid: string | null
  yourTurn: boolean
  /** card-name overlays (hidden once the label auto-hide preference kicks in) */
  showLabels: boolean
  onSelect: (uid: string) => void
  /** start a crane drag for this card (pointer-driven) */
  onDragStart: (e: React.PointerEvent, uid: string, kind: string) => void
  /** true if the press just ended in a drag — used to swallow the trailing click */
  wasDragged: () => boolean
}

export function Hand({
  player,
  playableUids,
  selectedUid,
  draggingUid,
  incomingUid,
  yourTurn,
  showLabels,
  onSelect,
  onDragStart,
  wasDragged,
}: HandProps) {
  const n = player.hand.length
  return (
    <div className="hand" role="group" aria-label="Your hand">
      {player.hand.map((card, i) => {
        const playable = playableUids.has(card.uid)
        // Held-fan arc: rotation grows linearly toward the ends while the
        // vertical offset follows a parabola so the middle sits highest and the
        // ends curve down — a real fanned hand. Both are exposed as CSS vars so
        // hover/relayout can recompose them (lift + straighten) in the stylesheet.
        const mid = (n - 1) / 2
        const off = i - mid
        const rot = off * 4.2
        const lift = off * off * 4.5
        return (
          <div
            key={card.uid}
            data-uid={card.uid}
            className={`hand__slot ${playable ? 'hand__slot--playable' : ''} ${
              selectedUid === card.uid ? 'hand__slot--selected' : ''
            } ${draggingUid === card.uid ? 'hand__slot--dragging' : ''} ${
              incomingUid === card.uid ? 'hand__slot--incoming' : ''
            } ${!yourTurn ? 'hand__slot--inert' : ''}`}
            style={{ '--rot': `${rot}deg`, '--ty': `${lift}px` } as React.CSSProperties}
            onPointerDown={yourTurn ? (e) => onDragStart(e, card.uid, card.kind) : undefined}
            // a press that became a drag fires a trailing click on release — swallow it
            // so the card isn't also toggled-selected after being dropped.
            onClickCapture={(e) => {
              if (wasDragged()) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            <Card
              kind={card.kind}
              size="md"
              selected={selectedUid === card.uid}
              muted={!yourTurn}
              showName={showLabels}
              // off-turn the hand is fully inert: no hover clip/tilt, nothing to
              // inspect or mis-tap before you've drawn — presses fall through the
              // slot (pointer-events: none) so the draw nudge still catches them
              noHover={!yourTurn}
              onClick={yourTurn ? () => onSelect(card.uid) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
