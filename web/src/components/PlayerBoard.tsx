import { CARD_DEFS, DISTANCE_VALUES, LANES, WIN_DISTANCE, type CardInstance } from '../game/cards'
import { activeHazard, speedLimited, type PlayerState } from '../game/engine'
import { Card } from './Card'
import './PlayerBoard.css'

interface PlayerBoardProps {
  player: PlayerState
  isOpponent: boolean
  active: boolean
  avatar: string
}

const OFFSET = 5 // px each card peeks below the one in front of it

/** A vertical pile of related cards — front card fully visible, rest peeking. */
function Stack({
  cards,
  showValue = false,
  badge = false,
  blocking = false,
  limiting = false,
}: {
  cards: CardInstance[]
  showValue?: boolean
  badge?: boolean
  blocking?: boolean
  limiting?: boolean
}) {
  const h = `calc(var(--tab-h) + ${(cards.length - 1) * OFFSET}px)`
  return (
    <div className={`stack ${blocking ? 'stack--blocking' : ''} ${limiting ? 'stack--limiting' : ''}`} style={{ height: h }}>
      {cards.map((c, i) => (
        <div className="stack__card" style={{ top: i * OFFSET, zIndex: i }} key={c.uid}>
          <Card kind={c.kind} size="sm" showName={false} showValue={showValue} />
        </div>
      ))}
      {badge && cards.length > 1 && <span className="stack__badge">×{cards.length}</span>}
    </div>
  )
}

export function PlayerBoard({ player, isOpponent, active, avatar }: PlayerBoardProps) {
  const hzr = activeHazard(player)
  const slow = speedLimited(player)
  const pct = Math.min(100, (player.distance / WIN_DISTANCE) * 100)

  const status = !player.started
    ? { icon: '⏸️', label: 'Docked', cls: 'docked' }
    : hzr
      ? { icon: '⚠️', label: CARD_DEFS[hzr].title, cls: 'hazard' }
      : { icon: '▶️', label: 'Cruising', cls: 'rolling' }

  const distanceGroups = DISTANCE_VALUES.map((v) => ({
    v,
    cards: player.distancePile.filter((c) => CARD_DEFS[c.kind].value === v),
  })).filter((g) => g.cards.length > 0)

  const laneStacks = LANES.map((lane) => ({ lane, cards: player.battle[lane] })).filter((g) => g.cards.length > 0)

  const nothingInPlay = distanceGroups.length === 0 && laneStacks.length === 0 && player.safeties.length === 0

  return (
    <section className={`board ${active ? 'board--active' : ''} ${isOpponent ? 'board--opp' : ''}`}>
      <header className="board__head">
        <span className={`board__avatar ${active ? 'board__avatar--active' : ''}`} title={player.name} aria-label={player.name}>
          {avatar}
        </span>
        <div className="board__meter" title={`${player.distance} of ${WIN_DISTANCE} light-years`}>
          <div className="board__meter-fill" style={{ width: `${pct}%` }}>
            <span className="board__rocket" aria-hidden>🚀</span>
          </div>
          <span className="board__meter-num" aria-hidden>{player.distance}</span>
          <span className="board__flag" aria-hidden>🏁</span>
        </div>
        <span
          className={`board__status board__status--${status.cls}`}
          title={status.label}
          aria-label={status.label}
        >
          {status.icon}
        </span>
        {slow && (
          <span className="board__slow" title="Speed limit — 50 ly or less" aria-label="Speed limit 50 or less">
            🐌
          </span>
        )}
      </header>

      <div className="board__tableau">
        {nothingInPlay && <span className="board__empty" aria-hidden />}

        {distanceGroups.map((g) => (
          <Stack key={`d${g.v}`} cards={g.cards} showValue badge />
        ))}

        {laneStacks.length > 0 && distanceGroups.length > 0 && <span className="board__div" />}

        {laneStacks.map((g) => (
          <Stack
            key={`l${g.lane}`}
            cards={g.cards}
            blocking={!!hzr && CARD_DEFS[hzr].lane === g.lane}
            limiting={slow && g.lane === 'restraint'}
          />
        ))}

        {player.safeties.length > 0 && <span className="board__div board__div--gold" />}

        {player.safeties.map((kind) => (
          <div className="stack stack--safety" key={kind} style={{ height: 'var(--tab-h)' }}>
            <div className="stack__card" style={{ top: 0, zIndex: 0 }}>
              <Card kind={kind} size="sm" showName={false} />
            </div>
          </div>
        ))}

        {player.coupFourres > 0 && (
          <span className="board__coup" title="Slingshot!" aria-label={`${player.coupFourres} slingshot`}>
            ⚡{player.coupFourres > 1 ? `×${player.coupFourres}` : ''}
          </span>
        )}
      </div>
    </section>
  )
}
