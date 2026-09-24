// RACE TRACK — the player's run to 1,000 light-years, drawn as the race itself.
//
// Replaces the plain progress pill with the shop's track: a rail with one
// segment per distance card played (so 75 + 75 + 75 reads as three hops, not a
// longer bar), the ship parked at the leading edge, faint quarter ticks, and a
// chequered flag at 1,000 that warms to gold once the finish is in sight. Still
// word-free: a number, a ship, a flag. The board's ambient state (docked /
// cruising / limited / blocked) restyles it through the same modifier classes.
import { CARD_DEFS, WIN_DISTANCE, type CardInstance } from '../game/cards'
import type { TrailHop } from '../game/engine'
import './RaceTrack.css'

interface RaceTrackProps {
  distance: number
  /** every light-year gained, in order (distance cards + safety bonuses) */
  trail: TrailHop[] | undefined
  /** the distance cards in play: the fallback when a state carries no trail */
  pile: CardInstance[]
  state: 'dormant' | 'cruising' | 'limited' | 'blocked'
  isOpponent: boolean
}

const TICKS = [0.25, 0.5, 0.75]
const IN_SIGHT = 0.8

export function RaceTrack({ distance, trail, pile, state, isOpponent }: RaceTrackProps) {
  const p = Math.min(1, distance / WIN_DISTANCE)
  const hops = trail ?? fallbackTrail(distance, pile)
  // an overshoot (allowed unless PRECISION APPROACH is on) stops at the flag
  let at = 0
  const segs = hops.map((h, i) => {
    const seg = { key: i, v: h.v, bonus: !!h.bonus, at }
    at += h.v
    return seg
  })

  return (
    <div
      className={`race race--${state} ${isOpponent ? 'race--opp' : ''} ${p >= IN_SIGHT ? 'race--near' : ''} ${
        p >= 1 ? 'race--done' : ''
      }`}
      style={{ '--p': p } as React.CSSProperties}
      role="img"
      aria-label={`${distance} of ${WIN_DISTANCE} light-years`}
    >
      <span className="race__total">{distance.toLocaleString("en-US")}</span>
      <div className="race__lane">
        <div className="race__rail">
          {TICKS.map((t) => (
            <span className="race__tick" key={t} style={{ '--at': t } as React.CSSProperties} />
          ))}
          {segs.map((s) => (
            <span
              className={`race__seg ${s.bonus ? 'race__seg--bonus' : ''}`}
              key={s.key}
              style={{ '--at': s.at / WIN_DISTANCE, '--w': Math.max(0, Math.min(s.v, WIN_DISTANCE - s.at)) / WIN_DISTANCE } as React.CSSProperties}
            >
              <b>{s.bonus ? `+${s.v}` : s.v}</b>
            </span>
          ))}
        </div>
        <span className="race__flag" aria-hidden />
        <span className="race__ship" aria-hidden>
          <img src="/ui/ship-marker.png" alt="" draggable={false} />
        </span>
      </div>
    </div>
  )
}

/** An older state has no trail: its distance cards in play order, then whatever
 *  the safety bonuses added as one hop at the end. */
function fallbackTrail(distance: number, pile: CardInstance[]): TrailHop[] {
  const hops: TrailHop[] = pile.map((c) => ({ v: CARD_DEFS[c.kind].value ?? 0, kind: c.kind }))
  const bonus = distance - hops.reduce((a, h) => a + h.v, 0)
  if (bonus > 0) hops.push({ v: bonus, kind: 'bonus', bonus: true })
  return hops
}
