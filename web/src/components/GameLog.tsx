import { cardPoster } from '../game/cardArt'
import { CARD_DEFS, artUrl } from '../game/cards'
import type { LogEntry } from '../game'
import { PlayerTag } from './PlayerTag'
import { Icon, type IconName } from './Icon'
import { useCardPreview } from './useCardPreview'
import './GameLog.css'

// The game log, extracted from Table.tsx so the TV STAGE and the normal app render
// the SAME log (and it can't drift). Pure presentation — no game state owned.
//
// THE LOG SHOWS CARDS, NOT SENTENCES. Every row is the card art itself, at thumb
// size, with a small badge for the VERB — a trash can over a faded card for a
// discard, a burst for a hit, a wrench for a repair. Cards a row took OFF the
// board (the hazard a remedy cleared, the hazard a Slingshot dodged) trail behind
// it, greyed and struck through. A non-reader — or anyone glancing mid-turn —
// gets the history at a glance; `entry.text` survives only as the tooltip and the
// screen-reader line.

export const whoFor = (seat: number): 'you' | 'cpu' => (seat === 0 ? 'you' : 'cpu')

// The badge is the row's VERB. `act` wins wherever it's set (a discard is a
// discard whatever the card's type); otherwise the LogKind supplies it. Rows that
// name no card (the win, the spent deck) render the same glyph on its own.
const ACT_ICON: Record<string, IconName> = { discard: 'bin', take: 'take', heal: 'wrench' }
const KIND_ICON: Record<string, IconName> = {
  hazard: 'burst',
  remedy: 'wrench',
  safety: 'shield',
  distance: 'thrust',
  coup: 'bolt',
  win: 'trophy',
  info: 'dot',
}
const badgeFor = (e: LogEntry): IconName => (e.act && ACT_ICON[e.act]) || KIND_ICON[e.kind] || 'dot'

/** How a thumbnail reads: still in play, spent (discarded / self-healed), or
 * voided by the row's card (cleared, dodged, swept off a lane). */
type Tone = 'live' | 'spent' | 'void'

/**
 * A card at log-row size. Deliberately NOT <Card> — this is a plain <img>, so a
 * dozen-plus rows cost no tilt handlers, hover state or <video> elements. It
 * borrows the clip poster where there is one, so the thumb is framed exactly like
 * the card on the table.
 */
function LogCard({ kind, tone = 'live', badge }: { kind: string; tone?: Tone; badge?: IconName }) {
  const def = CARD_DEFS[kind]
  if (!def) return null
  return (
    <span className={`logcard logcard--${tone}`} data-type={def.type}>
      <span className="logcard__frame">
        <img className="logcard__art" src={cardPoster(kind) ?? artUrl(def)} alt="" draggable={false} loading="lazy" />
        {/* distance art carries no baked numeral (the table overlays it too) and
            the numeral IS the information on a warp row — keep it. */}
        {def.type === 'distance' && def.value != null && <b className="logcard__value">{def.value}</b>}
        {tone === 'void' && <span className="logcard__slash" aria-hidden />}
      </span>
      {badge && (
        <span className="logcard__badge">
          <Icon name={badge} />
        </span>
      )}
    </span>
  )
}

/** One game-log row; hovering/pressing pops the row's card at readable size. */
export function LogRow({ entry, who }: { entry: LogEntry; who: (seat: number) => 'you' | 'cpu' }) {
  const { card, against, act } = entry
  const { handlers, popover, open } = useCardPreview(card)
  // a discarded or self-healed card has LEFT play — show it filtered back, which
  // is what the trash / wrench badge is sitting on.
  const tone: Tone = act === 'discard' || act === 'heal' ? 'spent' : 'live'
  return (
    <li
      className={`log__line log__line--${entry.kind} ${card ? 'log__line--card' : ''} ${open ? 'log__line--on' : ''}`}
      title={entry.text}
      {...handlers}
    >
      {/* always rendered, empty for the seatless rows, so the thumbs line up in a column */}
      <span className="log__who">{entry.seat >= 0 && <PlayerTag who={who(entry.seat)} />}</span>
      {card ? (
        <LogCard kind={card} tone={tone} badge={badgeFor(entry)} />
      ) : (
        <span className="log__glyph">
          <Icon name={badgeFor(entry)} />
        </span>
      )}
      {against?.map((k) => (
        <LogCard key={k} kind={k} tone="void" />
      ))}
      <span className="log__sr">{entry.text}</span>
      {popover}
    </li>
  )
}

/** The full log list (newest first), styled by `.log` in GameLog.css. `limit` caps
 * how many recent rows are shown — card rows are far taller than the old icon
 * rows, so this is a shorter history than it used to be. */
export function GameLog({ log, limit = 14 }: { log: LogEntry[]; limit?: number }) {
  const recent = log.slice(-limit).reverse()
  return (
    <ul className="log">
      {recent.map((e) => (
        <LogRow key={e.id} entry={e} who={whoFor} />
      ))}
    </ul>
  )
}
