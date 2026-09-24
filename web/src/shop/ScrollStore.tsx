import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import './scroll/scrollcraft.css'
import './ScrollStore.css'
import { runScrollStore, type ScrollStoreHandle } from './scroll/scrollStore'
import { UNIT_PRICE_CENTS } from './constants'

// The scroll-craft store: a race to 1,000 light-years played by scrolling,
// ending on the order panel. Built with the scroll-craft skill.
// Everything except the order panel is static markup the engine drives.

const S = '/shop/scroll'
const card = (kind: string) => `${S}/printed/${kind}.webp`
const turn = (plays: object[]) => JSON.stringify(plays)
const price = (cents: number) => `$${(cents / 100).toFixed(2)}`

function Card({ kind, alt = '', lazy = false }: { kind: string; alt?: string; lazy?: boolean }) {
  return <img className="card" src={card(kind)} alt={alt} width="600" height="840" loading={lazy ? 'lazy' : undefined} />
}

export function ScrollStore({
  hidden,
  quantity,
  onQuantity,
  maxQuantity,
  soldOut,
  availability,
  checkoutConfigured,
  metaCart,
  onBuy,
  buyRef,
}: {
  hidden: boolean
  quantity: number
  onQuantity: (n: number) => void
  maxQuantity: number
  soldOut: boolean
  availability: string
  checkoutConfigured: boolean
  metaCart: number | null
  onBuy: () => void
  buyRef: RefObject<HTMLButtonElement>
}) {
  const root = useRef<HTMLDivElement>(null)
  const store = useRef<ScrollStoreHandle | null>(null)

  useLayoutEffect(() => {
    if (store.current) return
    store.current = runScrollStore(root.current!)
    // A Meta Shops cart arrives ready to buy: land on the order panel.
    if (metaCart !== null) {
      const land = () => store.current!.jumpToOrder()
      requestAnimationFrame(land)
      document.fonts?.ready.then(() => requestAnimationFrame(land))
    }
  }, [metaCart])

  // Hidden behind the checkout view, every act measured zero. Re-measure in
  // the commit, before the product page restores its scroll position.
  useLayoutEffect(() => {
    if (!hidden) store.current?.relayout()
  }, [hidden])

  return (
    <div className="scroll-store" ref={root} hidden={hidden}>
      <a className="scroll-skip" href="#get-the-game" data-jump="order">
        Skip to ordering
      </a>
      <div className="sc-grain" aria-hidden="true"></div>
      <a className="mark" href="#turn-1" aria-label="Space Race, back to the top">
        SPACE RACE<small>1,000 light-years</small>
      </a>

      <main id="top">
        {/* 1 · TABLE: layered depth. Plays Ignition. */}
        <section id="turn-1" className="table" data-sc-act="pin" data-sc-span="1.8" data-sc-drift="#0d0a08"
          data-turn={turn([{ card: 'ignition', ly: 0, at: 0, label: 'Ignition' }])}>
          <div data-sc-stage="" className="table__stage">
            <div className="plane plane--room" data-depth="room">
              <picture>
                <source media="(max-width: 860px)" srcSet={`${S}/table-m.webp`} />
                <img className="plate" src={`${S}/table-d.webp`} alt="" width="1920" height="1088" fetchPriority="high" />
              </picture>
            </div>
            <div className="glow" data-depth="glow"></div>
            <div className="plane ground" data-depth="ground">
              <div className="strewn" aria-hidden="true">
                <Card kind="warp-100" />
                <Card kind="rescue-shuttle" />
                <Card kind="asteroid-strike" />
                <Card kind="warp-25" />
              </div>
              <div className="boxwrap" role="img" aria-label="The Space Race First Edition tuck box standing on a kitchen table">
                <div className="boxshadow"></div>
                <div className="box" data-depth="box">
                  <div className="box__f box__f--back"></div>
                  <div className="box__f box__f--left"></div>
                  <div className="box__f box__f--right"></div>
                  <div className="box__f box__f--top"></div>
                  <div className="box__f box__f--front"></div>
                </div>
              </div>
            </div>
            <div className="hero-scrim" aria-hidden="true"></div>
            <div className="hero-copy" data-sc-cue="0 0.62 0 0.25">
              <h1 className="sc-display">A race to 1,000 light-years, dealt on your kitchen table.</h1>
              <p>Space Race is a card game of hazards, narrow escapes and family rivalry. 2–4 players, 15–30 minutes.</p>
              <a className="go" href="#get-the-game" data-jump="order">Buy the deck</a>
            </div>
          </div>
        </section>

        {/* 2 · DEAL: a real six-card hand. Plays 100. */}
        <section id="turn-2" data-sc-act="pin" data-sc-span="2" data-sc-drift="#140e0a"
          data-turn={turn([{ card: 'warp-100', ly: 100, at: 0.5, label: '100 Light-Years' }])}>
          <div data-sc-stage="" className="deal__stage">
            <div className="deal__copy" data-sc-cue="0 1 0 0.12">
              <h2 className="sc-display">107 real cards.</h2>
              <p>You hold six at a time. Printed, UV-coated and made to be shuffled, with no phone, app or batteries anywhere near the table.</p>
            </div>
            <div className="fan" data-fan="" aria-hidden="true">
              {['warp-200', 'warp-100', 'warp-75', 'asteroid-strike', 'fuel-cell', 'rescue-shuttle'].map((k) => (
                <Card key={k} kind={k} />
              ))}
            </div>
          </div>
        </section>

        {/* 3 · TURN: four kinds of card, lateral. Plays 200. */}
        <section id="turn-3" data-sc-act="pan" data-sc-span="2.8" data-sc-drift="#120e0b"
          data-turn={turn([{ card: 'warp-200', ly: 200, at: 0.55, label: '200 Light-Years' }])}>
          <div data-sc-stage="" className="turn__stage">
            <div className="rail" data-sc-pan="0.04">
              <div className="rail__lead">
                <h2 className="sc-display">One card a turn.</h2>
                <p>Draw, then play. Push your own ship forward or throw something in your rival's way. First to 1,000 light-years wins.</p>
              </div>
              {[
                ['warp-200', 'The 200 Light-Years distance card', 'Distance', 'Moves your ship 25 to 200 light-years.', '46 cards'],
                ['asteroid-strike', 'The Asteroid Strike hazard card', 'Hazard', 'Stops your rival until they fix it.', '18 cards'],
                ['repair-drone', 'The Repair Drone repair card', 'Repair', 'Clears one hazard and gets you moving.', '38 cards'],
                ['ace-pilot', 'The Ace Pilot safety card', 'Safety', 'Makes you immune to one hazard for good.', '4 cards, one of each'],
              ].map(([kind, alt, name, does, deck], k) => (
                <article key={kind} className="kind" style={{ '--k': k } as CSSProperties}>
                  <Card kind={kind} alt={alt} lazy />
                  <h3>{name}</h3>
                  <dl>
                    <dt>Does</dt>
                    <dd>{does}</dd>
                    <dt>Deck</dt>
                    <dd>{deck}</dd>
                  </dl>
                </article>
              ))}
              <p className="rail__end">
                Hold the right Safety when its hazard hits you, and it's a <em>Slingshot</em>.
              </p>
            </div>
          </div>
        </section>

        {/* 4 · SAFETIES: the glorious cards. Plays Ace Pilot, +100. */}
        <section id="turn-4" className="safe" data-sc-act="flow" data-sc-drift="#140f07"
          data-turn={turn([{ card: 'ace-pilot', ly: 100, at: 0.5, label: 'Ace Pilot, +100' }])}>
          <div className="sc-wrap safe__grid">
            <div className="safe__head" data-sc-in="">
              <h2 className="sc-display">Four cards change everything.</h2>
              <p>There's exactly one of each Safety in the deck. Play one and you're immune to its hazard for the rest of the race, and your ship jumps 100 light-years.</p>
            </div>
            {[
              ['ace-pilot', 'Ace Pilot', 'Asteroid Strikes can’t touch you.', '0.06 0.28'],
              ['antimatter-fuel-cell', 'Antimatter Fuel Cell', 'You never run on Empty.', '0.14 0.36'],
              ['diamond-thruster', 'Diamond Thruster', 'No more Busted Thrusters.', '0.22 0.44'],
              ['rescue-shuttle', 'Rescue Shuttle', 'Tractor Beams and Black Holes both let you go.', '0.3 0.52'],
            ].map(([kind, name, line, at]) => (
              <figure key={kind} className="sf" data-sc-reveal="up" data-sc-reveal-at={at}>
                <Card kind={kind} alt={`${name} safety card`} lazy />
                <figcaption>
                  <b>{name}</b>
                  {line}
                </figcaption>
              </figure>
            ))}
            <p className="safe__coda" data-sc-in="">
              The real trick is to <span>hold one</span>. Wait until your rival plays the hazard it beats, then throw it down. That's a Slingshot.
            </p>
          </div>
        </section>

        {/* 5 · BLACK HOLE: the peak. The only video. Authored silence first. */}
        <section id="turn-5" data-sc-act="scrub" data-sc-span="3.4" data-sc-drift="#06050a"
          data-turn={turn([
            { card: 'black-hole', ly: 0, at: 0.1, label: 'Black Hole', stuck: true },
            { card: 'rescue-shuttle', ly: 200, at: 0.51, label: 'Rescue Shuttle: Slingshot, +200' },
          ])}>
          <div data-sc-stage="" className="bh__stage" data-bh="">
            <p className="bh__quiet" data-sc-cue="0 0.08 0 0.03">Your rival draws.</p>
            <div className="bh__ambient" aria-hidden="true">
              <img src={`${S}/peak-poster.jpg`} alt="" width="810" height="1440" loading="lazy" />
            </div>
            <div className="bh__frame">
              <img className="sc-stage__poster" src={`${S}/peak-poster.jpg`} alt="" width="810" height="1440" loading="lazy" />
              <video data-sc-scrub="" data-sc-src={`${S}/peak.mp4`} data-sc-src-mobile={`${S}/peak-m.mp4`} muted playsInline
                aria-label="A black hole pulls a ship in, and the Rescue Shuttle breaks free"></video>
              <img className="bh__card" src={card('black-hole')} alt="" width="600" height="840" loading="lazy" />
            </div>
            <img className="bh__play" data-play="" src={card('rescue-shuttle')} alt="" width="600" height="840" loading="lazy" />
            <p className="bh__you" data-sc-cue="0.35 0.53 0.04 0.04">You play the Rescue Shuttle.</p>
            <div className="bh__scrim" aria-hidden="true"></div>
            <div className="bh__copy bh__copy--l" data-sc-cue="0.06 0.46 0.1 0.08">
              <h2 className="sc-display">Black Hole.</h2>
              <p>Played on you. Your ship stops dead, and it isn't moving until you find an Ignition.</p>
            </div>
            <div className="bh__copy bh__copy--r" data-sc-cue="0.5 1 0.08 0.12">
              <h2 className="sc-display">Slingshot.</h2>
              <p>Unless you're holding the Rescue Shuttle. Play it right now and you tear out of there, 200 light-years ahead.</p>
            </div>
          </div>
        </section>

        {/* 6 · ADDING: poster type. Plays 75 three times. */}
        <section id="turn-6" data-sc-act="pin" data-sc-span="1.8" data-sc-drift="#1b1206"
          data-turn={turn([0.14, 0.26, 0.38].map((at) => ({ card: 'warp-75', ly: 75, at, label: '75 Light-Years' })))}>
          <div data-sc-stage="" className="add__stage">
            <div data-sc-cue="0.04 1 0.12 0.1">
              <p className="sum" data-sc-kinetic="words">
                75 <span className="op">+</span> 75 <span className="op">+</span> 75
              </p>
            </div>
            <p className="equals" data-sc-cue="0.42 1 0.08 0.1">= 225</p>
            <p className="add__note" data-sc-cue="0.5 1 0.1 0.1">Every turn is a sum, and somebody at the table has to keep the running total.</p>
          </div>
        </section>

        {/* 7 · BOX: labels, not pitch. Plays 100. */}
        <section id="turn-7" className="inbox" data-sc-act="flow" data-sc-drift="#0f0b08"
          data-turn={turn([{ card: 'warp-100', ly: 100, at: 0.55, label: '100 Light-Years' }])}>
          <div className="sc-wrap inbox__grid">
            <figure className="inbox__photo" data-sc-in="">
              <img src="/shop/hero.jpg" data-sc-parallax="0.9" width="1200" height="1600" loading="lazy"
                alt="The real Space Race First Edition on a wooden table: the tuck box, rulebook, and all nineteen kinds of card laid out" />
            </figure>
            <div data-sc-in="" data-sc-stagger="60" className="sc-stack">
              <h2 className="sc-display">What's in the box.</h2>
              <dl className="facts">
                <dt>Cards</dt><dd>107, UV-coated</dd>
                <dt>Box</dt><dd>Illustrated tuck box</dd>
                <dt>Rules</dt><dd>Rulebook with advanced modes</dd>
                <dt>Players</dt><dd>2–4</dd>
                <dt>Time</dt><dd>15–30 minutes</dd>
                <dt>Ages</dt><dd>4 and up</dd>
              </dl>
              <p className="promise">Shipped to US addresses, with tracking emailed when it goes out. Return it within 30 days for a refund. If it's damaged or lost on the way, you choose a free replacement or a full refund.</p>
            </div>
          </div>
        </section>

        {/* 8 · FINISH: the track resolves into the order. Plays the last 75. */}
        <section id="get-the-game" data-sc-act="pin" data-sc-span="1.3" data-sc-drift="#0d0a08" aria-label="Order Space Race"
          data-turn={turn([{ card: 'warp-75', ly: 75, at: 0.02, label: '75 Light-Years' }])}>
          <div data-sc-stage="" className="fin__stage">
            <div className="fin__inner">
              <div className="odo-col">
                <p className="odo" data-sc-cue="0 1 0 0" aria-label="1,000 light-years">
                  <span className="odo__n">
                    <span className="odo__size" aria-hidden="true">1,000</span>
                    <span data-sc-count="925 1,000" data-sc-count-at="0.02 0.32">925</span>
                  </span>
                  <small>light-years. You win.</small>
                </p>
              </div>
              <div className="order" data-sc-cue="0 1 0 0">
                {metaCart !== null && (
                  <div className="order__cart" aria-label="Your cart">
                    <p className="order__cart-h">Your cart</p>
                    <p className="order__cart-line">
                      <span>{quantity} × First Edition</span>
                      <span>{price(quantity * UNIT_PRICE_CENTS)}</span>
                    </p>
                  </div>
                )}
                <h2>Space Race: 1,000 Light-Years, First Edition</h2>
                <p className="order__price">
                  {price(UNIT_PRICE_CENTS)} <small>per game, + shipping and any sales tax</small>
                </p>
                <div className="order__row">
                  <label>
                    Copies
                    <select value={quantity} disabled={soldOut} onChange={(e) => onQuantity(Number(e.target.value))}>
                      {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button ref={buyRef} className="buy" disabled={soldOut || !checkoutConfigured} onClick={onBuy}>
                    {soldOut ? 'Sold out' : 'Buy the deck'}
                  </button>
                </div>
                {!checkoutConfigured && <p className="order__error">The store isn't open yet. Check back soon.</p>}
                <p className="order__small">{soldOut ? 'This edition is currently sold out.' : `${availability}. Secure checkout. Up to 3 copies per order.`}</p>
              </div>
            </div>
            <footer className="foot">
              <span>© 2026 Andrew Archer. Space Race: 1,000 Light-Years.</span>
              <span>
                <a href="/get">Play the free app</a> · <a href="/privacy.html">Privacy</a>
              </span>
            </footer>
          </div>
        </section>
      </main>

      <nav className="track" aria-label="Race track: cards played so far">
        <p className="track__total" aria-live="polite">
          <span data-total="">0</span>
          <small>of 1,000 ly</small>
        </p>
        <div className="track__hand" data-hand=""></div>
        <div className="track__line" aria-hidden="true">
          <div className="track__rail"></div>
          <div className="track__fill" data-fill=""></div>
          {[0, 250, 500, 750, 1000].map((v) => (
            <span key={v} className="track__tick" style={{ left: `${v / 10}%` }}>{v.toLocaleString('en-US')}</span>
          ))}
          <div className="ship" data-ship="">
            <img src="/ui/ship-marker.png" alt="" />
          </div>
        </div>
        <a className="finish" href="#get-the-game" data-jump="order" aria-label={`Buy the deck, ${price(UNIT_PRICE_CENTS)}`}>
          <b>Buy the deck</b>
          <span>{price(UNIT_PRICE_CENTS)}</span>
        </a>
      </nav>
    </div>
  )
}
