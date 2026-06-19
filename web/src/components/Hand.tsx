import type { PlayerState } from '../game/engine'
import { Card } from './Card'
import './Hand.css'

interface HandProps {
  player: PlayerState
  playableUids: Set<string>
  selectedUid: string | null
  draggingUid: string | null
  yourTurn: boolean
  onSelect: (uid: string) => void
  onDragStart: (uid: string) => void
  onDragEnd: () => void
}

export function Hand({
  player,
  playableUids,
  selectedUid,
  draggingUid,
  yourTurn,
  onSelect,
  onDragStart,
  onDragEnd,
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
            className={`hand__slot ${playable ? 'hand__slot--playable' : ''} ${
              selectedUid === card.uid ? 'hand__slot--selected' : ''
            } ${draggingUid === card.uid ? 'hand__slot--dragging' : ''}`}
            style={{ transform: `rotate(${rot}deg) translateY(${lift}px)` }}
            draggable={yourTurn}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', card.uid)
              onDragStart(card.uid)
            }}
            onDragEnd={onDragEnd}
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
