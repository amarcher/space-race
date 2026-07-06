// Keep the screen awake during play (native iOS app, Capacitor).
//
// A card game has long stretches with no touches (watching the AI, mid-takeover),
// so the display would dim/sleep and break the moment. We hold the screen on for
// the whole session — simple and robust; the OS still sleeps normally once the
// app is backgrounded. No-ops on web.
//
// Uses @capacitor-community/keep-awake (the canonical community plugin — there is
// no first-party @capacitor/keep-awake).
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'

export function keepScreenAwake(): void {
  if (!Capacitor.isNativePlatform()) return
  KeepAwake.keepAwake().catch(() => {})
}

export function allowScreenSleep(): void {
  if (!Capacitor.isNativePlatform()) return
  KeepAwake.allowSleep().catch(() => {})
}
