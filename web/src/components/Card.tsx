import { useState } from 'react'
import { cardVideo } from '../game/cardArt'
import { CARD_BACK_URL, CARD_DEFS, artUrl } from '../game/cards'
import { prefersReducedMotion } from '../motion'
import { useCardTilt } from './useCardTilt'
import './Card.css'

export type CardSize = 'sm' | 'md' | 'lg'

interface CardProps {
  /** card kind, e.g. 'black-hole'. Omit + faceDown for a deck back. */
  kind?: string
  faceDown?: boolean
  size?: CardSize
  selected?: boolean
  disabled?: boolean
  /** dim + desaturate, e.g. an unplayable card in hand */
  muted?: boolean
  onClick?: () => void
  /** small caption shown beneath the art on hover/focus (pure-art cards carry no text) */
  showName?: boolean
  /** the baked value numeral on distance cards (off for tiny trail thumbnails) */
  showValue?: boolean
  /** force the looping clip to play without hover/interactivity (e.g. the
   *  Slingshot hero cards) — static art stays the fallback */
  ambient?: boolean
}

/**
 * A single game card. The art is full-bleed with rounded corners and carries
 * no baked-in text — identity is surfaced only on hover/selection so the table
 * stays clean and cinematic.
 */
export function Card({
  kind,
  faceDown = false,
  size = 'md',
  selected = false,
  disabled = false,
  muted = false,
  onClick,
  showName = true,
  showValue = true,
  ambient = false,
}: CardProps) {
  const def = kind ? CARD_DEFS[kind] : undefined
  const src = faceDown || !def ? CARD_BACK_URL : artUrl(def)
  const interactive = !!onClick && !disabled
  // a card has "living art" (hover tilt + clip swap) when it's interactive OR
  // explicitly marked ambient (plays its clip on its own, e.g. the Slingshot)
  const alive = interactive || ambient
  const tilt = useCardTilt(alive)

  // Animated art: a card comes alive while hovered/selected (or always, when
  // ambient) — we swap to a looping clip (if the manifest has one) over the
  // static art, which stays as the poster/fallback. Hover-only cards keep
  // concurrency low; ambient is reserved for the few hero cards. No JS for static.
  const [hovered, setHovered] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const lively = alive && !faceDown && !prefersReducedMotion() && (ambient || hovered || selected)
  const videoSrc = lively ? cardVideo(kind, hovered ? ['hover', 'idle'] : ['idle']) : undefined

  // hover state drives the animated-art swap; compose with the tilt handlers so
  // both run (tilt owns pointermove + the lean-reset on leave)
  const onPointerEnter = alive ? () => setHovered(true) : undefined
  const onPointerLeave = alive
    ? () => {
        setHovered(false)
        tilt.handlers?.onPointerLeave?.()
      }
    : undefined

  const className = [
    'card',
    `card--${size}`,
    selected && 'card--selected',
    disabled && 'card--disabled',
    muted && 'card--muted',
    faceDown && 'card--back',
    interactive && 'card--interactive',
    def && `card--type-${def.type}`,
  ]
    .filter(Boolean)
    .join(' ')

  const label = faceDown ? 'Face-down card' : def ? `${def.title} — ${def.subtitle}` : 'Card'

  return (
    <button
      ref={tilt.ref}
      type="button"
      className={className}
      onClick={interactive ? onClick : undefined}
      disabled={disabled || !onClick}
      aria-label={label}
      title={faceDown ? undefined : def?.title}
      data-type={def?.type}
      {...tilt.handlers}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <img className="card__art" src={src} alt="" draggable={false} loading="lazy" />
      {videoSrc && (
        <video
          key={videoSrc}
          className={`card__video ${videoReady ? 'card__video--ready' : ''}`}
          src={videoSrc}
          poster={src}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
          aria-hidden
        />
      )}
      <span className="card__sheen" aria-hidden />
      <span className="card__glare" aria-hidden />
      {showValue && !faceDown && def?.type === 'distance' && def.value != null && (
        <span className="card__value" aria-hidden>
          <b>{def.value}</b>
        </span>
      )}
      {!faceDown && def && showName && (
        <span className="card__name">
          <strong>{def.title}</strong>
          <em>{def.subtitle}</em>
        </span>
      )}
    </button>
  )
}
