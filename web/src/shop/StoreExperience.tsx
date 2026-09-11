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
            ? 'A Black Hole. A hidden Rescue Shuttle. A comeback worth celebrating.'
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
          <p className="store-intro">
            The card game for your next great game night
          </p>
          <h1 id="store-title">
            A thousand
            <br />
            light-years.
            <br />
            One more game.
          </h1>
          <p>
            Outrace your family. Outsmart a black hole. Turn one little card
            into a very big comeback.
          </p>
          <div className="store-actions">
            <a className="shop__buy" href="#get-the-game">
              Bring home the game
            </a>
            <button className="store-watch" onClick={onWatch}>
              <span>
                <PlayIcon />
              </span>{' '}
              Watch the film <small>0:30</small>
            </button>
          </div>
          <p className="store-hero__note">
            A real deck. A shared table. A whole universe between you.
          </p>
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
          <span className="store-hero__art-note">
            Small cards. Cosmic comebacks.
          </span>
        </div>
      </section>
      <div className="store-facts" aria-label="Game details">
        <p>
          <strong>2–4</strong>
          <span>players at the table</span>
        </p>
        <p>
          <strong>15–30</strong>
          <span>minutes per race</span>
        </p>
        <p>
          <strong>107</strong>
          <span>cards in the box</span>
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
        <p className="store-intro">For the look on their face.</p>
        <h2 id="film-heading">
          They thought
          <br />
          they had you.
        </h2>
        <p>Then you play the card you've been saving.</p>
        <p>
          Space Race is a race to 1,000 light-years, full of narrow escapes,
          sneaky hazards, and last-second reversals. The best part happens right
          across the table.
        </p>
        <div className="store-film__beats">
          <span>Launch your ship.</span>
          <span>Stall your rivals.</span>
          <span>Turn the tables.</span>
        </div>
        <a className="store-text-link" href="#your-move">
          Try a comeback yourself <span aria-hidden="true">↗</span>
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
        <div>
          <p className="store-intro">A little taste of the game</p>
          <h2 id="moment-heading">Your move, pilot.</h2>
        </div>
        <p>
          The race can turn on a single card.
          <br />
          Here's how a Slingshot works.
        </p>
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
            <p className="store-intro">
              {escaped
                ? 'From 400 to 600 light-years'
                : 'You have a secret weapon.'}
            </p>
            <h3>
              {escaped
                ? 'Now who’s ahead?'
                : 'A black hole stops your ship. Unless…'}
            </h3>
            <p>
              {escaped
                ? 'Reveal the matching safety immediately: the hazard is discarded, you draw an extra card, and your Rescue Shuttle earns 200 light-years. That’s a Slingshot.'
                : 'You’re holding Rescue Shuttle, the safety that beats Black Hole. Play it the instant the hazard lands to turn trouble into a 200 light-year jump.'}
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
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Play the full game ↗
                </a>
              </div>
            </>
          ) : (
            <button
              className="moment-play-card"
              onClick={() => setEscaped(true)}
            >
              <img src="/shop/rescue-shuttle.jpg" alt="" loading="lazy" />
              <span>
                Play Rescue Shuttle<small>Reveal your safety</small>
              </span>
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
      <p>The next adventure starts at your table.</p>
      <div>
        <a href="/get">Ways to play</a>
        <a href="/privacy.html">Privacy</a>
      </div>
    </footer>
  )
}
