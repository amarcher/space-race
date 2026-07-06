// Haptic feedback shim for the native iOS app (Capacitor).
//
// Same idea as sfx.ts: a thin, semantic layer the game calls at its dramatic
// beats. Every function no-ops on web (`!Capacitor.isNativePlatform()`) — the
// Taptic Engine only exists on device — and swallows its own errors so a missing
// plugin or a simulator (which has no haptics) never throws into gameplay.
//
// Strength ladder, tuned to mirror the sfx mix:
//   Light  — a card moving under your fingers (pick, drop, discard, remedy)
//   Medium — an impact against a ship (hazard hit) / a charged momentum unleash
//   Heavy + success notification — the rare, triumphant beats (coup-fourré, win)
//
// Fire-and-forget: callers don't await. Wired at the same seams as playSfx().
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const native = Capacitor.isNativePlatform()

function impact(style: ImpactStyle): void {
  if (!native) return
  Haptics.impact({ style }).catch(() => {})
}

function notify(type: NotificationType): void {
  if (!native) return
  Haptics.notification({ type }).catch(() => {})
}

/** A hand/pile card lifts under your finger (draw, scry pick). */
export const cardPick = () => impact(ImpactStyle.Light)

/** A card lands on the board (distance/safety play, discard). */
export const cardDrop = () => impact(ImpactStyle.Light)

/** A ship takes a hazard — the one buzz that should feel like a knock. */
export const hazardHit = () => impact(ImpactStyle.Medium)

/** A remedy clears the lane — a small reassuring tick. */
export const remedyPlay = () => impact(ImpactStyle.Light)

/** A big momentum move: the 200-ly warp or a breakaway burst. */
export const boost = () => impact(ImpactStyle.Medium)

/** Coup-fourré — the game's showiest reversal. Heavy hit + success ring. */
export const coupFourre = () => {
  impact(ImpactStyle.Heavy)
  notify(NotificationType.Success)
}

/** You reach 1,000 light-years. The victory buzz. */
export const win = () => {
  impact(ImpactStyle.Heavy)
  notify(NotificationType.Success)
}
