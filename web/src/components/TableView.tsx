import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react'
import type { CardDef } from '../game/cards'
import type { GameState, Move } from '../game'
import { MOMENTUM_CAP } from '../game/rules'
import { Card } from './Card'
import { GameLog } from './GameLog'
import { Hand } from './Hand'
import { Icon } from './Icon'
import { PlayerBoard } from './PlayerBoard'

// The REAL table presentation, lifted out of Table.tsx verbatim so it has ONE
// implementation. It is a PURE PRESENTER of `game` (the single source of truth):
//   • the normal app's <Table> owns the game + interaction and passes a full
//     `play` bundle → identical interactive table as before (byte-for-byte).
//   • the TV STAGE passes a relay-synced `game` and NO `play` → the same boards /
//     piles / icon log render statically, with the hand + action bar + drag
//     affordances HIDDEN (moves arrive over the relay, not from the screen).
// Every interactive value is read through `play?.…`; when `play` is present the
// branches resolve to exactly what Table rendered before, so the live app is
// unchanged. When `play` is absent the static branch renders (the stage).

/** The interaction surface the normal app threads in. Absent on the stage. */
export interface TablePlay {
  oppHandRef: RefObject<HTMLDivElement>
  deckRef: RefObject<HTMLDivElement>
  discardRef: RefObject<HTMLDivElement>
  handRef: RefObject<HTMLDivElement>
  dragUid: string | null
  hoverZone: string | null
  drop: { opp: boolean; self: boolean; discard: boolean }
  impact: { seat: number; tone: 'hit' | 'recover' } | null
  canDrawDeck: boolean
  canDrawDiscard: boolean
  drawFrom: (source: 'deck' | 'discard') => void
  drawNudge: boolean
  hideDiscardTop: boolean
  mustDiscard: boolean
  drawPhaseHuman: boolean
  nudgeToDraw: () => void
  yourTurn: boolean
  humanCanBurst: boolean
  doBurst: () => void
  selectedUid: string | null
  setSelectedUid: Dispatch<SetStateAction<string | null>>
  playableUids: Set<string>
  incomingUid: string | null
  /** card-name overlays on hand cards (off once the label auto-hide kicks in) */
  showLabels: boolean
  cardDrag: { begin: (e: ReactPointerEvent, uid: string, kind: string) => void; wasDragged: () => boolean }
  selectedDef: CardDef | undefined
  selectedKind: string | undefined
  selectedPlay: Extract<Move, { type: 'play' }> | undefined
  playLabel: string
  doPlay: () => void
  doDiscard: () => void
}

export function TableView({ game, play, showLog }: { game: GameState; play?: TablePlay; showLog: boolean }) {
  const opp = game.players[1]
  const human = game.players[0]
  const momentumOn = game.rules.momentum
  const humanMomentum = momentumOn ? { charge: game.momentum[0], cap: MOMENTUM_CAP } : null
  const oppMomentum = momentumOn ? { charge: game.momentum[1], cap: MOMENTUM_CAP } : null
  const topDiscard = game.discard[game.discard.length - 1]
  // self board "active": Table gated this on yourTurn (turn 0 + play phase); the
  // stage (no play) lights it whenever it's seat 0's turn.
  const selfActive = play ? play.yourTurn : game.turn === 0 && game.phase !== 'roundOver'

  return (
    <div className="table__body">
      <div className="table__main">
        {/* the board recedes onto a perspective plane for depth; the hand stays
            flat below it (outside this wrapper) so it reads face-on to the player */}
        <div className="table__plane">
          <div
            data-drop="opp"
            ref={play?.oppHandRef}
            className={`dropzone ${play?.dragUid ? (play.drop.opp ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
              play && play.hoverZone === 'opp' && play.drop.opp ? 'dropzone--hot' : ''
            }`}
          >
            <PlayerBoard
              player={opp}
              isOpponent
              active={game.turn === 1 && game.phase !== 'roundOver'}
              impact={play && play.impact?.seat === opp.seat ? play.impact.tone : null}
              momentum={oppMomentum}
              selfHeal={game.rules.selfHeal}
            />
            {play?.drop.opp && (
              <span className="dropzone__tag dropzone__tag--hazard" aria-label="Drop to attack"><Icon name="burst" /></span>
            )}
          </div>

          <div className="table__center">
            <div
              ref={play?.deckRef}
              className={`pile ${play?.canDrawDeck ? 'pile--draw' : ''} ${play?.drawNudge ? 'pile--nudge' : ''}`}
              title={play?.canDrawDeck ? 'Tap to draw' : undefined}
            >
              <Card faceDown size="md" onClick={play?.canDrawDeck ? () => play.drawFrom('deck') : undefined} />
              <span className="pile__count">{game.deck.length}</span>
              {/* drawability is shown by the bespoke pulsing ring on .pile--draw (CSS) */}
            </div>
            <div
              ref={play?.discardRef}
              data-drop="discard"
              className={`pile dropzone ${play?.dragUid ? (play.drop.discard ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
                play && play.hoverZone === 'discard' && play.drop.discard ? 'dropzone--hot' : ''
              } ${play?.canDrawDiscard ? 'pile--draw' : ''} ${play?.drawNudge ? 'pile--nudge' : ''} ${
                play?.hideDiscardTop ? 'pile--ghost' : ''
              } ${play?.mustDiscard ? 'pile--invite' : ''}`}
              title={play?.canDrawDiscard ? 'Tap to take this card' : undefined}
            >
              {topDiscard ? (
                <Card
                  key={topDiscard.uid}
                  kind={topDiscard.kind}
                  size="md"
                  showName={false}
                  onClick={play?.canDrawDiscard ? () => play.drawFrom('discard') : undefined}
                />
              ) : (
                <div className="pile__empty" />
              )}
            </div>
          </div>

          <div
            data-drop="self"
            className={`dropzone ${play?.dragUid ? (play.drop.self ? 'dropzone--ok' : 'dropzone--dim') : ''} ${
              play && play.hoverZone === 'self' && play.drop.self ? 'dropzone--hot' : ''
            } ${game.breakaway === 0 ? 'dropzone--breakaway' : ''}`}
          >
            <PlayerBoard
              player={human}
              isOpponent={false}
              active={selfActive}
              impact={play && play.impact?.seat === human.seat ? play.impact.tone : null}
              momentum={humanMomentum}
              canBurst={play?.humanCanBurst}
              onBurst={play?.doBurst}
              selfHeal={game.rules.selfHeal}
            />
            {play?.drop.self && <span className="dropzone__tag" aria-label="Drop to play"><Icon name="check" /></span>}
          </div>
        </div>

        {/* tap-catcher behind a selected card + action bar (interactive only) */}
        {play && play.selectedUid && play.yourTurn && !play.dragUid && (
          <div className="select-scrim" onClick={() => play.setSelectedUid(null)} aria-hidden />
        )}

        {/* the hand — only on the interactive app; HIDDEN on the stage (it lives on
            the phone). The board above renders identically either way. */}
        {play && (
          <div
            ref={play.handRef}
            className="hand-wrap"
            onPointerDownCapture={play.drawPhaseHuman ? play.nudgeToDraw : undefined}
          >
            <Hand
              player={human}
              playableUids={play.playableUids}
              selectedUid={play.selectedUid}
              draggingUid={play.dragUid}
              incomingUid={play.incomingUid}
              yourTurn={play.yourTurn}
              showLabels={play.showLabels}
              onSelect={(uid) => play.setSelectedUid((c) => (c === uid ? null : uid))}
              onDragStart={(e, uid) => play.cardDrag.begin(e, uid, human.hand.find((c) => c.uid === uid)?.kind ?? '')}
              wasDragged={play.cardDrag.wasDragged}
            />
          </div>
        )}
      </div>

      {showLog && (
        <aside className="table__log" aria-label="Game log">
          <GameLog log={game.log} limit={18} />
        </aside>
      )}

      {/* commit panel (interactive only) */}
      {play && (
        <div className={`actionbar ${play.selectedUid && play.yourTurn ? 'actionbar--show' : ''}`}>
          {play.selectedDef && play.selectedKind && (
            <>
              <span className="actionbar__thumb">
                <Card kind={play.selectedKind} size="sm" showName={false} />
              </span>
              <button
                className="btn btn--play btn--bigicon"
                onClick={play.doPlay}
                disabled={!play.selectedPlay}
                title={play.playLabel}
                aria-label={play.playLabel}
              >
                <Icon name={play.selectedDef.type === 'hazard' ? 'burst' : 'play'} />
              </button>
              <button
                className="btn btn--discard btn--bigicon"
                onClick={play.doDiscard}
                title="Discard"
                aria-label="Discard"
              >
                <Icon name="bin" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
