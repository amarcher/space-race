import { SLINGSHOT_MILEAGE } from '../game/cards'
import type { SlingshotEvent } from '../game/engine'
import { Card } from './Card'
import './SlingshotOverlay.css'

/**
 * The hero moment. Staged so you actually watch it happen:
 * 1. the enemy hazard flies in at you,
 * 2. your safety swoops up from hand and intercepts (flash),
 * 3. "SLINGSHOT!" bursts,
 * 4. the hazard is flung to the discard pile,
 * 5. you draw a fresh card.
 */
export function SlingshotOverlay({ event, avatar }: { event: SlingshotEvent; avatar: string }) {
  return (
    <div className="sling" key={event.id} aria-label="Slingshot!">
      <div className="sling__scene">
        <div className="sling__hazard">
          <Card kind={event.hazardKind} size="lg" showName={false} ambient />
        </div>
        <div className="sling__flash" aria-hidden />
        <div className="sling__safety">
          <Card kind={event.safetyKind} size="lg" showName={false} ambient />
        </div>
        <div className="sling__draw" aria-hidden>
          <Card faceDown size="lg" />
        </div>
      </div>
      <div className="sling__banner">
        <span className="sling__avatar">{avatar}</span>
        <span className="sling__word">SLINGSHOT!</span>
        <span className="sling__pts">⚡ +{SLINGSHOT_MILEAGE} ly</span>
      </div>
    </div>
  )
}
