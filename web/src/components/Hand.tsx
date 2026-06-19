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
  onSelect,
  onDragStart,
  wasDragged,
}: HandProps) {
  const n = player.hand.length
  return (
    <div className="hand" role="group" aria-label="Your hand">
      {player.hand.map((card, i) => {
        const playable = playableUids.has(card.uid)
        // gentle fan: rotate/offset around the centre
        const mid = (n - 1) / 2
        const rot = (i - mid) * 2.6
        const lift = Math.abs(i - mid) * 5
        return (
          <div
            key={card.uid}
            data-uid={card.uid}
            className={`hand__slot ${playable ? 'hand__slot--playable' : ''} ${
              selectedUid === card.uid ? 'hand__slot--selected' : ''
            } ${draggingUid === card.uid ? 'hand__slot--dragging' : ''} ${
              incomingUid === card.uid ? 'hand__slot--incoming' : ''
            }`}
            style={{ transform: `rotate(${rot}deg) translateY(${lift}px)` }}
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
              onClick={yourTurn ? () => onSelect(card.uid) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
