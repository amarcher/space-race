import { useEffect, useRef, useState } from 'react'
import { scoreRound, type GameState } from '../game'
import { playSfx } from '../audio/sfx'
import { win as hapticWin } from '../native/haptics'
import { canShare, shareContent } from '../native/share'
import { prefersReducedMotion } from '../motion'
import { Icon, type IconName } from './Icon'
import { RaceTrack } from './RaceTrack'
import { END_POSTER, endClipSrc, warmEndClips } from './endClips'
import './WinTakeover.css'

/** Score-line glyphs from engine.ts → the app's own SVG set. The ⚡/🏁/🏆 rows
 * only show up under NAVIGATOR'S LEDGER (slingshots + the Mille Bornes trip
 * bonuses); classic scoring only ever emits the first two. */
const SCORE_ICON: Record<string, IconName> = {
  '🚀': 'thrust',
  '🛡️': 'shield',
  '⚡': 'bolt',
  '🏁': 'gate',
  '🏆': 'trophy',
}

// ─── Timing ─────────────────────────────────────────────────────────────────
// 1. HERO  — the outcome clip plays through to its last frame (~4s).
// 2. TALLY — the clip HOLDS on that frame (the pilot still celebrating) and the
//    results rise over it. Nothing is ever cut short: the hero ends on the clip's
//    own `ended`, capped at HERO_CAP_MS. If the clip hasn't started within
//    START_WAIT_MS (a cold, slow network), the poster still carries the moment
//    for POSTER_HOLD_MS instead of stalling.
const START_WAIT_MS = 2000
const POSTER_HOLD_MS = 2400
const HERO_CAP_MS = 7000

export type WinVariant = 'win' | 'lose'

interface WinTakeoverProps {
  state: GameState
  onDone: () => void // "race again"
  onDismiss?: () => void // close to inspect the final board
}

/**
 * Full-screen end-of-round moment: the outcome clip, then the results over its
 * final frame: who won, both players' race tracks as they finished, the totals
 * (and the ledger's point lines when that mode is on), Slingshots, and a big
 * Race Again. z-index 72 — above the Slingshot hero (70) and CardTakeover (68).
 * Reduced motion: no clip; the poster still and the results, at once.
 */
export function WinTakeover({ state, onDone, onDismiss }: WinTakeoverProps) {
  const humanWon = state.winner === 0
  const aiWon = state.winner === 1
  const variant: WinVariant = humanWon ? 'win' : 'lose'
  const [phase, setPhase] = useState<'hero' | 'tally'>(prefersReducedMotion() ? 'tally' : 'hero')
  const [still, setStill] = useState(prefersReducedMotion()) // show the poster instead of the clip
  const [src] = useState(() => endClipSrc(variant))
  const poster = END_POSTER[variant]

  // warm the clips in case the round ended before the Table got to it
  useEffect(() => warmEndClips(), [])

  // audio + buzz, once (StrictMode-safe)
  const audioFired = useRef(false)
  useEffect(() => {
    if (audioFired.current) return
    audioFired.current = true
    playSfx(humanWon ? 'win-takeover' : 'lose-takeover')
    if (humanWon) hapticWin()
  }, [humanWon])

  // hero → tally: on the clip's end, with a start deadline and a hard cap
  const started = useRef(false)
  const toTally = () => setPhase('tally')
  useEffect(() => {
    if (phase !== 'hero') return
    const cap = window.setTimeout(toTally, HERO_CAP_MS)
    const wait = window.setTimeout(() => {
      if (started.current) return
      setStill(true)
      window.setTimeout(toTally, POSTER_HOLD_MS)
    }, START_WAIT_MS)
    return () => {
      window.clearTimeout(cap)
      window.clearTimeout(wait)
    }
  }, [phase])

  const setVideo = (el: HTMLVideoElement | null) => {
    if (!el) return
    el.muted = true
    el.defaultMuted = true
  }

  const scores = scoreRound(state)
  const ledger = state.rules.ledgerScoring
  const title = humanWon ? 'You win!' : aiWon ? 'Rival wins' : 'Photo finish'
  const showShare = humanWon && canShare()
  const doShare = () =>
    void shareContent({
      title: 'Space Race',
      text: 'I raced to 1,000 light-years in Space Race!',
      url: 'https://game.spaceexplorer.tech',
    })

  return (
    <div
      className={`wt wt--${variant} ${phase === 'tally' ? 'wt--tally' : ''}`}
      role={phase === 'tally' ? 'dialog' : undefined}
      aria-modal={phase === 'tally' ? 'true' : undefined}
      aria-label={title}
    >
      {/* the moment: the clip, holding on its final frame for the results */}
      <div className="wt__stage" aria-hidden>
        {still ? (
          <img className="wt__media" src={poster} alt="" draggable={false} />
        ) : (
          <video
            ref={setVideo}
            className="wt__media"
            src={src}
            poster={poster}
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlaying={() => {
              started.current = true
            }}
            onEnded={toTally}
            onCanPlay={(e) => {
              const v = e.currentTarget
              if (v.paused) v.play?.().catch(() => setStill(true)) // autoplay blocked: the still carries it
            }}
            onError={() => setStill(true)}
          />
        )}
        <div className="wt__shade" />
      </div>

      {phase === 'tally' && onDismiss && (
        <button className="wt__close" onClick={onDismiss} aria-label="See the final board" title="See the final board">
          <Icon name="cards" size={22} />
        </button>
      )}

      {phase === 'tally' && (
        <div className="wt__results" onClick={(e) => e.stopPropagation()} ref={(el) => el?.focus({ preventScroll: true })} tabIndex={-1}>
          <h2 className="wt__title">{title}</h2>

          <div className="wt__race">
            {state.players.map((p) => {
              const score = scores.find((s) => s.seat === p.seat)
              const won = state.winner === p.seat
              return (
                <div key={p.seat} className={`wt__lane ${won ? 'wt__lane--won' : ''}`}>
                  <div className="wt__lane-head">
                    <span className="wt__who">{p.seat === 0 ? 'You' : 'Rival'}</span>
                    {p.coupFourres > 0 && (
                      <span className="wt__sling" title={`${p.coupFourres} Slingshot${p.coupFourres > 1 ? 's' : ''}`}>
                        <Icon name="bolt" size={14} /> {p.coupFourres}
                      </span>
                    )}
                    <span className="wt__total" title={ledger ? 'Points' : 'Light-years'}>
                      {(score?.total ?? p.distance).toLocaleString('en-US')}
                      <small>{ledger ? 'pts' : 'ly'}</small>
                    </span>
                  </div>
                  <RaceTrack distance={p.distance} trail={p.trail} pile={p.distancePile} state="cruising" isOpponent={p.seat !== 0} />
                  {ledger && score && (
                    <ul className="wt__lines">
                      {score.lines.map((l, i) => (
                        <li key={i} title={l.label}>
                          <Icon name={SCORE_ICON[l.icon] ?? 'shield'} size={13} />
                          {l.points}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          <div className="wt__actions">
            <button className="wt__again" onClick={onDone} aria-label="Race again" title="Race again">
              <Icon name="restart" size={34} />
            </button>
            {showShare && (
              <button className="wt__share" onClick={doShare} aria-label="Share your win" title="Share your win">
                <Icon name="share" size={24} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
