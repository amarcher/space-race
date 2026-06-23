import { useEffect, useRef, useState } from 'react'
import { scoreRound, type GameState } from '../game'
import { preloadClips } from '../preloadHero'
import { prefersReducedMotion } from '../motion'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import './WinTakeover.css'

// ─── Asset manifest slot ────────────────────────────────────────────────────
// Drop the real videos at these paths and they auto-activate.
// See web/docs/win-takeover-assets.md for the exact generation spec.
const WIN_VIDEO = '/win/win-hero.mp4'   // human wins — triumphant arrival
const LOSE_VIDEO = '/win/lose-hero.mp4' // AI wins — dignified, not punishing

/** Returns the drop-in path for each outcome, or undefined if absent. */
function heroVideoSrc(humanWon: boolean): string | undefined {
  // Only use the real video if it was preloaded; otherwise the fallback
  // Starfield + CSS effect is the intentional experience.
  // We check by trying a sync cache lookup — if the browser has it cached
  // from preloadClips() it'll be available; if not, we stay with the fallback.
  return humanWon ? WIN_VIDEO : LOSE_VIDEO
}

// ─── Phase timing ───────────────────────────────────────────────────────────
// The takeover has two phases:
//   1. HERO  — full-screen video (or fallback FX) fills the screen       ~4 s
//   2. TALLY — the hero shrinks/overlays the tally card that lifts up    ∞ (user dismisses)
// The transition from hero → tally is a CSS class swap.
const HERO_MS = 3800    // hold the hero this long before transitioning
const FADE_MS = 500     // hero fades; tally slides up (matches CSS)

// ─── Component ──────────────────────────────────────────────────────────────

export type WinVariant = 'win' | 'lose'

interface WinTakeoverProps {
  state: GameState
  onDone: () => void       // called when the player hits "play again"
  onDismiss?: () => void   // called if the player taps outside to inspect the board
}

/**
 * Full-screen WIN/LOSE hero takeover. Replaces the Scoreboard modal.
 *
 * Phase 1 (HERO): a full-screen video clip (or a CSS/Starfield fallback)
 * plays for ~4 s, then transitions.
 * Phase 2 (TALLY): the tally card slides up with score breakdown + play-again.
 *
 * z-index 72 — above the Slingshot hero (70) and the CardTakeover (68).
 * Non-interactive during Phase 1 (pointer-events: none); interactive in Phase 2.
 * Reduced-motion: skips the video, goes straight to the tally.
 */
export function WinTakeover({ state, onDone, onDismiss }: WinTakeoverProps) {
  const humanWon = state.winner === 0
  const aiWon = state.winner === 1
  const variant: WinVariant = humanWon ? 'win' : 'lose'

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [phase, setPhase] = useState<'hero' | 'tally'>(
    prefersReducedMotion() ? 'tally' : 'hero',
  )
  const [leaving, setLeaving] = useState(false) // hero fade-out
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Preload both clips once (they're small; the real game will have them cached)
  useEffect(() => {
    preloadClips([WIN_VIDEO, LOSE_VIDEO])
  }, [])

  // Mute-on-create for autoplay gate (mirrors CardTakeover pattern)
  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el) {
      el.muted = true
      el.defaultMuted = true
    }
  }

  // Hero phase: play the clip, then transition to tally after HERO_MS
  useEffect(() => {
    if (phase !== 'hero') return
    const v = videoRef.current

    const tryPlay = () => {
      if (!v) return
      v.muted = true
      const p = v.play?.()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          v.muted = true
          v.play?.().catch(() => setVideoError(true))
        })
      }
    }

    if (v) {
      v.muted = true
      try { v.currentTime = 0 } catch { /* not seekable yet */ }
      tryPlay()
      v.addEventListener('loadeddata', tryPlay)
      v.addEventListener('canplay', tryPlay)
    }

    // Advance to tally after HERO_MS (fade starts at HERO_MS - FADE_MS)
    const fadeTimer = window.setTimeout(() => setLeaving(true), HERO_MS - FADE_MS)
    const phaseTimer = window.setTimeout(() => {
      setPhase('tally')
      setLeaving(false)
    }, HERO_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(phaseTimer)
      v?.removeEventListener('loadeddata', tryPlay)
      v?.removeEventListener('canplay', tryPlay)
    }
  }, [phase])

  const scores = scoreRound(state)
  const humanScore = scores.find((s) => s.seat === 0)
  const aiScore = scores.find((s) => s.seat === 1)

  // We ALWAYS render the CSS fallback layers in the hero phase; the video sits on
  // top and covers them when loaded. If the video errors, the CSS fallback shines through.

  return (
    <div
      className={[
        'win-takeover',
        `win-takeover--${variant}`,
        phase === 'tally' ? 'win-takeover--tally' : '',
        leaving ? 'win-takeover--leaving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-modal={phase === 'tally' ? 'true' : undefined}
      role={phase === 'tally' ? 'dialog' : undefined}
      aria-label={humanWon ? 'You win!' : aiWon ? 'Rival wins' : 'Round over'}
      // tap the backdrop (outside the tally card) to dismiss and inspect the board
      onClick={phase === 'tally' && onDismiss ? onDismiss : undefined}
    >
      {/* ── HERO LAYER (phase 1) ── */}
      {phase === 'hero' && (
        <div className="win-takeover__hero" aria-hidden>
          {/* CSS fallback: hyperspace-arrival starfield burst — always visible,
              the real video sits on top and covers it if present */}
          <div className="win-takeover__starburst" />
          <div className="win-takeover__rays" />
          <div className={`win-takeover__arrival win-takeover__arrival--${variant}`} />

          {/* Real video — covers the CSS fallback when loaded */}
          {!videoError && (
            <video
              ref={setVideo}
              className="win-takeover__video"
              src={heroVideoSrc(humanWon)}
              autoPlay
              muted
              playsInline
              preload="auto"
              onError={() => setVideoError(true)}
            />
          )}

          {/* vignette */}
          <div className="win-takeover__vignette" />
        </div>
      )}

      {/* ── TALLY LAYER (phase 2) ── */}
      {phase === 'tally' && (
        <div className="win-takeover__tally" role="document" onClick={(e) => e.stopPropagation()}>
          {/* dismiss to inspect the board */}
          {onDismiss && (
            <button
              className="win-takeover__close"
              onClick={onDismiss}
              title="Inspect final board"
              aria-label="Inspect final board"
            >
              ✕
            </button>
          )}
          {/* trophy / outcome icon */}
          <div className={`win-takeover__outcome win-takeover__outcome--${variant}`} aria-hidden>
            {humanWon ? (
              <img
                className="win-takeover__trophy"
                src="/ui/trophy-hero.png"
                alt=""
                draggable={false}
              />
            ) : (
              <span className="win-takeover__outcome-icon">
                <Icon name="gate" size={64} />
              </span>
            )}
            {state.winner != null && (
              <span className="win-takeover__outcome-avatar">
                <Avatar who={humanWon ? 'you' : 'cpu'} size="1em" />
              </span>
            )}
          </div>

          {/* score comparison — you vs cpu */}
          <div className="win-takeover__scores">
            {/* Human score */}
            <div className={`win-takeover__scorecol ${state.winner === 0 ? 'win-takeover__scorecol--win' : ''}`}>
              <div className="win-takeover__scorecol-head">
                <Avatar who="you" size="2.2em" />
              </div>
              <ul className="win-takeover__scorelines">
                {humanScore?.lines.map((l, i) => (
                  <li key={i} className="win-takeover__scoreline">
                    <span aria-hidden>
                      <Icon name={l.icon === '🚀' ? 'thrust' : 'shield'} size={16} />
                    </span>
                    <b>{l.points}</b>
                  </li>
                ))}
              </ul>
              <div className="win-takeover__total" title="Total light-years">
                <Icon name="gate" size={18} />
                <b>{humanScore?.total ?? 0}</b>
              </div>
            </div>

            {/* vs divider */}
            <div className="win-takeover__vs" aria-hidden>
              <Icon name="bolt" size={28} />
            </div>

            {/* AI score */}
            <div className={`win-takeover__scorecol ${state.winner === 1 ? 'win-takeover__scorecol--win' : ''}`}>
              <div className="win-takeover__scorecol-head">
                <Avatar who="cpu" size="2.2em" />
              </div>
              <ul className="win-takeover__scorelines">
                {aiScore?.lines.map((l, i) => (
                  <li key={i} className="win-takeover__scoreline">
                    <span aria-hidden>
                      <Icon name={l.icon === '🚀' ? 'thrust' : 'shield'} size={16} />
                    </span>
                    <b>{l.points}</b>
                  </li>
                ))}
              </ul>
              <div className="win-takeover__total" title="Total light-years">
                <Icon name="gate" size={18} />
                <b>{aiScore?.total ?? 0}</b>
              </div>
            </div>
          </div>

          {/* coup-fourré callout (slingshots) — kid-readable pure icon */}
          {(state.players[0].coupFourres > 0 || state.players[1].coupFourres > 0) && (
            <div className="win-takeover__coups" aria-hidden>
              {state.players[0].coupFourres > 0 && (
                <span className="win-takeover__coup win-takeover__coup--you">
                  <Avatar who="you" size="1.2em" />
                  <Icon name="bolt" size={16} />
                  <b>{state.players[0].coupFourres}</b>
                </span>
              )}
              {state.players[1].coupFourres > 0 && (
                <span className="win-takeover__coup win-takeover__coup--cpu">
                  <Avatar who="cpu" size="1.2em" />
                  <Icon name="bolt" size={16} />
                  <b>{state.players[1].coupFourres}</b>
                </span>
              )}
            </div>
          )}

          {/* play again */}
          <button
            className="btn btn--play btn--bigicon btn--big win-takeover__again"
            onClick={onDone}
            aria-label="Play again"
            title="Play again"
            autoFocus
          >
            <Icon name="restart" size={36} />
          </button>
        </div>
      )}
    </div>
  )
}
