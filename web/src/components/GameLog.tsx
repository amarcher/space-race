import { CARD_DEFS } from '../game/cards'
import type { LogEntry } from '../game'
import { PlayerTag } from './PlayerTag'
import { Icon, type IconName } from './Icon'
import { useCardPreview } from './useCardPreview'

// The game log, extracted from Table.tsx so the TV STAGE and the normal app render
// the SAME icon log (and it can't drift). Pure presentation — no game state owned.

export const whoFor = (seat: number): 'you' | 'cpu' => (seat === 0 ? 'you' : 'cpu')

// Icon vocabulary — the UI leans on pictures so a non-reader can follow along.
const LOG_ICON: Record<string, IconName> = {
  hazard: 'burst',
  remedy: 'wrench',
  safety: 'shield',
  distance: 'thrust',
  coup: 'bolt',
  win: 'trophy',
  info: 'dot',
}

// Resolve the specific card a log row is about, in the RENDER layer (engine.ts
// untouched) — by matching CARD_DEFS titles/values against the entry text. Rows
// that don't name a specific card (deck spent, launch, win) return null → no
// preview. A line may mention two cards ("clears X with Y") — the entry's
// LogKind picks the one actually PLAYED (remedy/hazard/safety; the revealed
// safety for a coup); info rows (discards/takes) fall back to the named card.
function logCardKind({ text, kind }: LogEntry): string | null {
  if (kind === 'distance') {
    const m = text.match(/(\d+)\s*ly/)
    const k = m ? `warp-${m[1]}` : ''
    return CARD_DEFS[k] ? k : null
  }
  const hits = Object.values(CARD_DEFS).filter((d) => text.includes(d.title))
  if (!hits.length) return null
  const wantType = kind === 'coup' ? 'safety' : kind // hazard | remedy | safety
  const typed = hits.find((d) => d.type === wantType)
  if (typed) return typed.kind
  // info rows ("discards X" / "takes X from the discard"): the longest title hit
  return [...hits].sort((a, b) => b.title.length - a.title.length)[0].kind
}

/** One game-log row; if it resolves to a card, hovering/pressing pops that card. */
export function LogRow({ entry, who }: { entry: LogEntry; who: (seat: number) => 'you' | 'cpu' }) {
  const kind = logCardKind(entry)
  const { handlers, popover, open } = useCardPreview(kind)
  return (
    <li
      className={`log__line log__line--${entry.kind} ${kind ? 'log__line--card' : ''} ${open ? 'log__line--on' : ''}`}
      title={entry.text}
      {...handlers}
    >
      {entry.seat >= 0 && (
        <span className="log__who">
          <PlayerTag who={who(entry.seat)} />
        </span>
      )}
      <span className="log__icon">
        <Icon name={LOG_ICON[entry.kind] ?? 'dot'} />
      </span>
      {popover}
    </li>
  )
}

/** The full log list (newest first), styled by `.log` in Table.css. `limit` caps
 * how many recent rows are shown. */
export function GameLog({ log, limit = 18 }: { log: LogEntry[]; limit?: number }) {
  const recent = log.slice(-limit).reverse()
  return (
    <ul className="log">
      {recent.map((e) => (
        <LogRow key={e.id} entry={e} who={whoFor} />
      ))}
    </ul>
  )
}
