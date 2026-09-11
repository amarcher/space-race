import { useEffect, useRef, useState } from 'react'

// Available-now derivative of the approved v11 campaign; original preserved.
export const TRAILER_URL =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3DJZHPWadiWvqmgkNAUYZ9knRyh/048ff9f8-750e-4c3f-bc47-a11d4f674927.mp4'

export function Brand() {
  return (
    <a className="store-brand" href="/shop.html" aria-label="Space Race store">
      <span>SPACE RACE</span>
      <small>1,000 light-years</small>
    </a>
  )
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  )
}

export function Trailer({
  open,
  onClose,
  variant = 'campaign',
}: {
  open: boolean
  onClose: () => void
  variant?: 'campaign' | 'escape'
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const source =
    variant === 'campaign'
      ? TRAILER_URL
      : '/cards/video/rescue-shuttle.vs-black-hole.slingshot.mp4'
  const descriptionId = `${variant}-description`
  useEffect(() => {
    const element = dialog.current
    if (open) {
      element?.showModal()
      setFailed(false)
    } else element?.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])
  return (
    <dialog
      ref={dialog}
      className="trailer-dialog"
      aria-label={
        variant === 'campaign'
          ? 'Space Race promotional film'
          : 'Rescue Shuttle escape'
      }
      onClose={() => {
        video.current?.pause()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}
    >
      <div className="trailer-dialog__inner">
        <button
          autoFocus
          className="trailer-dialog__close"
          onClick={() => dialog.current?.close()}
          aria-label={
            variant === 'campaign' ? 'Close film' : 'Close escape video'
          }
        >
          ✕
        </button>
        {open && (
          <video
            ref={video}
            src={source}
            poster={
              variant === 'campaign'
                ? '/shop/release-cover-v11.jpg'
                : '/cards/video/rescue-shuttle.poster.webp'
            }
            controls
            muted={variant === 'escape'}
            autoPlay
            playsInline
            preload="none"
            onError={() => setFailed(true)}
            aria-describedby={descriptionId}
          >
            {variant === 'campaign' && (
              <track
                kind="captions"
                src="/shop/trailer-captions.vtt"
                srcLang="en"
                label="English"
              />
            )}
          </video>
        )}
        <p id={descriptionId}>
          {variant === 'campaign'
            ? 'The Space Race film.'
            : 'Rescue Shuttle escaping a black hole, from the digital game.'}
        </p>
        {variant === 'campaign' && (
          <p className="trailer-credits">
            Music: “Rainbows” by{' '}
            <a
              href="https://www.scottbuckley.com.au/library/rainbows/"
              target="_blank"
              rel="noreferrer"
            >
              Scott Buckley
            </a>
            , released under{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            . Excerpt trimmed, mixed, and faded.
          </p>
        )}
        {failed && (
          <p role="alert">
            The film couldn't load.{' '}
            <a href={source} target="_blank" rel="noreferrer">
              Open the film directly
            </a>{' '}
            or close this window to explore the game.
          </p>
        )}
      </div>
    </dialog>
  )
}

export function StoreHero({ onWatch }: { onWatch: () => void }) {
  return (
    <>
      <section className="store-hero" aria-labelledby="store-title">
        <div className="store-hero__light" aria-hidden="true" />
        <div className="store-hero__copy">
          <h1 id="store-title">
            Race to{' '}
            <br />
            1,000 light-years.
          </h1>
          <p>A card game of hazards, narrow escapes, and family rivalry.</p>
          <div className="store-actions">
            <a className="shop__buy" href="#get-the-game">
              Get the game
            </a>
            <button className="store-watch" onClick={onWatch}>
              <span>
                <PlayIcon />
              </span>{' '}
              Watch the film <small>0:30</small>
            </button>
          </div>
        </div>
        <div
          className="store-hero__art"
          aria-label="Space Race's printed Black Hole, 100 Light-Years and Rescue Shuttle cards"
          role="img"
        >
          <div className="store-orbit" />
          <img
            className="hero-card hero-card--distance"
            src="/shop/warp-100.jpg"
            alt=""
            width="600"
            height="818"
          />
          <img
            className="hero-card hero-card--hazard"
            src="/shop/black-hole.jpg"
            alt=""
            width="600"
            height="818"
          />
          <img
            className="hero-card hero-card--rescue"
            src="/shop/rescue-shuttle.jpg"
            alt=""
            width="600"
            height="818"
          />
        </div>
      </section>
      <div className="store-facts" aria-label="Game details">
        <p>
          <strong>2–4</strong>
          <span>players</span>
        </p>
        <p>
          <strong>15–30</strong>
          <span>minutes</span>
        </p>
        <p>
          <strong>107</strong>
          <span>cards</span>
        </p>
        <p>
          <strong>1,000</strong>
          <span>light-years to win</span>
        </p>
      </div>
    </>
  )
}

export function FilmSection({ onWatch }: { onWatch: () => void }) {
  return (
    <section
      className="store-film store-section"
      id="the-film"
      aria-labelledby="film-heading"
    >
      <button
        className="store-film__poster"
        onClick={onWatch}
        aria-label="Watch the 30-second Space Race film"
      >
        <img
          src="/shop/release-cover-v11.jpg"
          alt="A young player celebrates a clever comeback in the Space Race film"
          loading="lazy"
          width="1080"
          height="1920"
        />
        <span className="store-film__play">
          <PlayIcon /> Play the film <small>0:30</small>
        </span>
      </button>
      <div className="store-film__copy">
        <h2 id="film-heading">Space Race in 30 seconds.</h2>
        <a className="store-text-link" href="#get-the-game">
          Get the game <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  )
}

export function GameMoment() {
  const [escaped, setEscaped] = useState(false)
  const [showClip, setShowClip] = useState(false)
  return (
    <section
      className="store-moment store-section"
      id="your-move"
      aria-labelledby="moment-heading"
    >
      <div className="store-moment__heading">
        <h2 id="moment-heading">Try a turn.</h2>
      </div>
      <div className={`moment-table${escaped ? ' moment-table--escaped' : ''}`}>
        <div className="moment-table__scene">
          <img
            className="moment-table__backdrop"
            src={
              escaped ? '/cards/rescue-shuttle.webp' : '/cards/black-hole.webp'
            }
            alt=""
            loading="lazy"
          />
          <div className="moment-score">
            <span>
              You{' '}
              <strong>
                {escaped ? '600' : '400'} <small>ly</small>
              </strong>
            </span>
            <span>
              Rival{' '}
              <strong>
                450 <small>ly</small>
              </strong>
            </span>
            <span>
              Finish{' '}
              <strong>
                1,000 <small>ly</small>
              </strong>
            </span>
          </div>
          <div className="moment-track" aria-hidden="true">
            <span style={{ width: escaped ? '60%' : '40%' }} />
            <img
              src="/ui/ship-marker.png"
              alt=""
              style={{ left: escaped ? '60%' : '40%' }}
            />
          </div>
          <img
            className="moment-table__card"
            src={escaped ? '/shop/rescue-shuttle.jpg' : '/shop/black-hole.jpg'}
            alt={
              escaped
                ? 'Rescue Shuttle: immune to Tractor Beam and Black Hole'
                : 'Black Hole: fixed by Ignition'
            }
            loading="lazy"
            width="600"
            height="818"
          />
          <p className="moment-table__caption">
            {escaped
              ? 'Slingshot! +200 light-years'
              : 'Your rival just played Black Hole.'}
          </p>
        </div>
        <div className="moment-table__choice">
          <div aria-live="polite" aria-atomic="true">
            <h3>
              {escaped ? 'You’re ahead.' : 'Your ship is stuck.'}
            </h3>
            <p>
              {escaped
                ? 'Hazard discarded. Draw an extra card and jump 200 light-years.'
                : 'Play Rescue Shuttle immediately to escape and earn 200 light-years.'}
            </p>
          </div>
          {escaped ? (
            <>
              <button
                className="shop__buy"
                onClick={() => {
                  setShowClip(true)
                }}
              >
                <PlayIcon /> Watch the escape
              </button>
              <div className="moment-links">
                <button
                  className="store-text-link"
                  onClick={() => {
                    setEscaped(false)
                    setShowClip(false)
                  }}
                >
                  Try again
                </button>
                <a
                  className="store-text-link"
                  href="#get-the-game"
                >
                  Get the game ↗
                </a>
              </div>
            </>
          ) : (
            <button
              className="moment-play-card"
              onClick={() => setEscaped(true)}
            >
              <img src="/shop/rescue-shuttle.jpg" alt="" loading="lazy" />
              <span>Play Rescue Shuttle</span>
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </div>
      <Trailer
        open={showClip}
        onClose={() => setShowClip(false)}
        variant="escape"
      />
    </section>
  )
}

export function StoreFooter() {
  return (
    <footer className="store-footer">
      <Brand />
      <div>
        <a href="/get">Ways to play</a>
        <a href="/privacy.html">Privacy</a>
      </div>
    </footer>
  )
}
