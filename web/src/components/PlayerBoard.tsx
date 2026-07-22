import { CARD_DEFS, DISTANCE_VALUES, LANES, WIN_DISTANCE, type CardInstance } from '../game/cards'
import { activeHazard, hazardTurnsLeft, SELF_HEAL_MAX, speedLimited, type PlayerState } from '../game/engine'
import { Card } from './Card'
import { MomentumMeter } from './MomentumMeter'
import './PlayerBoard.css'

interface PlayerBoardProps {
  player: PlayerState
  isOpponent: boolean
  active: boolean
  /** transient hit-recoil / recovery-spring animation, keyed so it can retrigger */
  impact?: 'hit' | 'recover' | null
  /** MOMENTUM mode only: this player's banked charge + cap; null = mode off (no gauge) */
  momentum?: { charge: number; cap: number } | null
  /** MOMENTUM: the human can spend right now → the gauge becomes a tappable SPEND */
  canBurst?: boolean
  /** spend the meter for a breakaway (wired only when canBurst) */
  onBurst?: () => void
  /** SELF-HEALING HAZARDS mode is on → render the paralysis timer over blocked lanes */
  selfHeal?: boolean
}

const OFFSET = 5 // px each card peeks below the one in front of it

// The paralysis-timer ring counts DOWN over the victim's turns: a fresh block
// reads N-1 (it aged to 1 at this turn-start) and steps 3→2→1, then heals. So
// the visible max is N-1.
const HEAL_BARS = Math.max(1, SELF_HEAL_MAX - 1)

/** hue lerps red(0°) → green(130°) as the block nears recovery (full = red). */
function healHue(left: number, max: number): number {
  const t = max <= 1 ? 0 : 1 - (left - 1) / (max - 1) // 0 when full, 1 when 1 left
  return Math.round(t * 130)
}

/** Word-free PARALYSIS TIMER on a blocked lane. The whole hazard card is wrapped
 * in a draining radial ring (a literal clock face): the lit arc = turns-left/max
 * and it visibly steps DOWN one notch at the start of each of the victim's turns
 * — so a non-reader ANTICIPATES "this block wears off soon" instead of being
 * surprised by a silent recovery. A capsule of segment bars (3→2→1) reinforces
 * the count for the smallest viewers, and the colour drains red → green as
 * freedom nears. Both are React-keyed on turns-left so the SVG/bars remount each
 * tick → a step-down pop replays (a felt beat). */
function HealCountdown({ left, max }: { left: number; max: number }) {
  const R = 46 // ring radius in the 100×100 viewBox
  const C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(1, left / max))
  const bars = Array.from({ length: max }, (_, i) => i < left)
  return (
    <div className="heal-timer" aria-hidden>
      <svg className="heal-timer__ring" viewBox="0 0 100 100" key={left}>
        <circle className="heal-timer__track" cx="50" cy="50" r={R} />
        <circle
          className="heal-timer__arc"
          cx="50"
          cy="50"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="heal-timer__bars" key={`b${left}`}>
        {bars.map((on, i) => (
          <span key={i} className={`heal-bar ${on ? 'heal-bar--on' : 'heal-bar--off'}`} />
        ))}
      </div>
    </div>
  )
}

/** A vertical pile of related cards — front card fully visible, rest peeking. */
function Stack({
  cards,
  showValue = false,
  badge = false,
  blocking = false,
  limiting = false,
  healLeft = null,
  healMax = HEAL_BARS,
}: {
  cards: CardInstance[]
  showValue?: boolean
  badge?: boolean
  blocking?: boolean
  limiting?: boolean
  healLeft?: number | null
  healMax?: number
}) {
  const h = `calc(var(--tab-h) + ${(cards.length - 1) * OFFSET}px)`
  const healing = healLeft != null && healLeft > 0
  const style: Record<string, string | number> = { height: h }
  if (healing) style['--heal-hue'] = healHue(healLeft, healMax)
  return (
    <div
      className={`stack ${blocking ? 'stack--blocking' : ''} ${limiting ? 'stack--limiting' : ''} ${
        healing ? 'stack--healing' : ''
      }`}
      style={style as React.CSSProperties}
    >
      {cards.map((c, i) => (
        <div className="stack__card" style={{ top: i * OFFSET, zIndex: i }} key={c.uid}>
          <Card kind={c.kind} size="sm" showName={false} showValue={showValue} />
        </div>
      ))}
      {healing && <HealCountdown left={healLeft} max={healMax} />}
      {badge && cards.length > 1 && <span className="stack__badge">×{cards.length}</span>}
    </div>
  )
}

export function PlayerBoard({ player, isOpponent, active, impact, momentum, canBurst, onBurst, selfHeal = false }: PlayerBoardProps) {
  const hzr = activeHazard(player)
  const slow = speedLimited(player)
  const pct = Math.min(100, (player.distance / WIN_DISTANCE) * 100)

  // Persistent ambient state — communicated purely with colour/motion (no icon,
  // no text). BLOCKED is a red emergency (stopped, powered-down, awaiting a
  // remedy); LIMITED is a milder amber "tethered" feel (tractor speed-limit);
  // CRUISING is calm; DOCKED is dormant (not yet launched). A hidden aria-label
  // keeps the state available to assistive tech without putting words on-screen.
  const ambient = !player.started ? 'dormant' : hzr ? 'blocked' : slow ? 'limited' : 'cruising'
  const ambientLabel = !player.started
    ? 'docked'
    : hzr
      ? `stopped — needs ${CARD_DEFS[hzr].title}`
      : slow
        ? 'speed-limited by Tractor Beam'
        : 'cruising'

  const distanceGroups = DISTANCE_VALUES.map((v) => ({
    v,
    cards: player.distancePile.filter((c) => CARD_DEFS[c.kind].value === v),
  })).filter((g) => g.cards.length > 0)

  const laneStacks = LANES.map((lane) => ({ lane, cards: player.battle[lane] })).filter((g) => g.cards.length > 0)

  const nothingInPlay = distanceGroups.length === 0 && laneStacks.length === 0 && player.safeties.length === 0

  return (
    <section
      className={`board board--${ambient} ${active ? 'board--active' : ''} ${
        isOpponent ? 'board--opp' : ''
      } ${impact ? `board--${impact}` : ''}`}
      aria-label={`${player.name} — ${ambientLabel}`}
    >
      <header className="board__head">
        <div className="board__meter" title={`${player.distance} of ${WIN_DISTANCE} light-years`}>
          <div className="board__meter-fill" style={{ width: `${pct}%` }} />
          <span className="board__meter-num" aria-hidden>{player.distance}</span>
        </div>
        {momentum && (
          <MomentumMeter
            charge={momentum.charge}
            cap={momentum.cap}
            spendable={!!canBurst}
            isOpponent={isOpponent}
            onBurst={onBurst}
          />
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
            healLeft={hazardTurnsLeft(selfHeal, player, g.lane)}
            healMax={HEAL_BARS}
          />
        ))}

        {player.safeties.length > 0 && <span className="board__div board__div--gold" />}

        {player.safeties.map((kind) => {
          // a safety won via Slingshot stands PORTRAIT like every other safety
          // (sideways coup-fourré render retired 2026-07-20 — it broke the row's
          // line-up); the reversal is marked by a 💫 badge on the card instead.
          const coup = player.coupSafeties?.includes(kind)
          return (
            <div
              className="stack stack--safety"
              key={kind}
              style={{ height: 'var(--tab-h)' }}
              title={coup ? 'Slingshot!' : undefined}
            >
              <div className="stack__card" style={{ top: 0, zIndex: 0 }}>
                <Card kind={kind} size="sm" showName={false} />
              </div>
              {coup && (
                <span className="stack__sling" aria-label="Won by Slingshot">
                  💫
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
