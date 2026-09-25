// Which takeover clips could play soon, given the cards actually in play.
// Re-run on every state change (each draw / play). A clip is warmed the moment
// a card that could trigger it is in someone's hand:
//   your hazards   — only if the rival isn't immune to them
//   your remedies  — only if they fix something on you now (Ignition too when
//                    you haven't launched or sit in a Black Hole)
//   your safeties  — always (a safety is always playable)
//   your 200       — while you may still play one
//   rival hazards  — only if they can land on you (you get the takeover)
//   Slingshot pairs, both directions (the dodge cinematic + the reveal)
// Cards playable THIS turn are urgent and download first.
import { CARD_DEFS, type CardInstance } from '../game/cards'
import { canAttack, hazardsOn, legalMoves, MAX_200_PER_PLAYER, type GameState, type PlayerState } from '../game'
import { cardHeroVideo, cardPoster, cardSlingshotHeroVideo, cardSlingshotVideo, cardVideo } from '../game/cardArt'
import { warmClips, warmPosters } from './clipCache'

const WIDE_MIN_PX = 761

/** the clip a takeover for `kind` will actually play at this viewport (mirrors CardTakeover) */
export function takeoverClip(kind: string): string | undefined {
  const std = cardVideo(kind, ['idle', 'hover'])
  const wide = typeof window !== 'undefined' && window.innerWidth >= WIDE_MIN_PX
  return (wide ? cardHeroVideo(kind) : undefined) ?? std
}

const slingClip = (safety: string, hazard: string) => {
  const wide = typeof window !== 'undefined' && window.innerWidth >= WIDE_MIN_PX
  return (wide ? cardSlingshotHeroVideo(safety, hazard) : undefined) ?? cardSlingshotVideo(safety, hazard)
}

function wanted(me: PlayerState, opp: PlayerState): string[] {
  const kinds: string[] = []
  const onMe = hazardsOn(me)
  for (const c of me.hand) {
    const d = CARD_DEFS[c.kind]
    if (d.type === 'hazard' && canAttack(opp, c.kind)) kinds.push(c.kind)
    else if (d.type === 'safety') kinds.push(c.kind)
    else if (d.type === 'remedy') {
      const fixesSomething = d.fixes ? onMe.includes(d.fixes) : false
      const launches = d.isGo && (!me.started || onMe.includes('black-hole'))
      if (fixesSomething || launches) kinds.push(c.kind)
    } else if (d.type === 'distance' && d.value === 200 && me.count200 < MAX_200_PER_PLAYER) kinds.push(c.kind)
  }
  return kinds
}

function slingPairs(hazardHand: CardInstance[], safetyHand: CardInstance[]): [string, string][] {
  const out: [string, string][] = []
  for (const hz of hazardHand) {
    if (CARD_DEFS[hz.kind]?.type !== 'hazard') continue
    for (const sf of safetyHand) if ((CARD_DEFS[sf.kind].immuneTo ?? []).includes(hz.kind)) out.push([sf.kind, hz.kind])
  }
  return out
}

export function warmForState(state: GameState): void {
  if (state.phase === 'roundOver') return
  const [you, rival] = state.players
  const mine = wanted(you, rival)
  const theirs = rival.hand.filter((c) => CARD_DEFS[c.kind].type === 'hazard' && canAttack(you, c.kind)).map((c) => c.kind)
  const pairs = [...slingPairs(rival.hand, you.hand), ...slingPairs(you.hand, rival.hand)]

  // playable right now (your play phase) → urgent
  const now = new Set<string>()
  if (state.turn === 0 && state.phase === 'play') {
    for (const m of legalMoves(state)) {
      if (m.type !== 'play') continue
      const k = you.hand.find((c) => c.uid === m.uid)?.kind
      if (k) now.add(k)
    }
  } else if (state.turn === 1) {
    theirs.forEach((k) => now.add(k)) // the rival is about to move
  }

  warmClips([...new Set([...mine, ...theirs])].filter((k) => now.has(k)).map(takeoverClip), true)
  warmClips([...new Set([...mine, ...theirs])].map(takeoverClip))
  warmClips(pairs.flatMap(([s, h]) => [slingClip(s, h), takeoverClip(s)]))
  warmPosters([...mine, ...theirs, ...pairs.map(([s]) => s)].map(cardPoster))
}
