// Android hardware / gesture BACK button (native app, Capacitor).
//
// By default Capacitor lets Back exit the app instantly — which feels broken if
// you just wanted to close a menu mid-game. This is the React-Native `BackHandler`
// pattern ported to `@capacitor/app`: components register interceptors while
// their overlay is open (LIFO), and a Back press runs the topmost one. When
// nothing intercepts, we fall back to double-tap-to-exit so a stray swipe never
// drops you out of a game.
//
// Everything no-ops on web and iOS (there is no hardware Back there — iOS uses
// its own edge-swipe, which the webview doesn't drive). Wired once at boot via
// initBackButton(); components subscribe with the useBackHandler() hook.
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/** Return true to consume the Back press (stop here); false to fall through. */
type BackHandler = () => boolean

const handlers: BackHandler[] = []
let initialized = false
let lastBackPress = 0

/** Register an interceptor (LIFO). Returns an unregister fn. Prefer useBackHandler. */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const i = handlers.lastIndexOf(handler)
    if (i !== -1) handlers.splice(i, 1)
  }
}

function onBack(): void {
  // Topmost interceptor first — first one to consume wins.
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return
  }
  // Nothing consumed it → we're at the root. Double-tap within 2s to exit,
  // otherwise show a hint (rendered by <BackExitHint/> listening for this event).
  const now = Date.now()
  if (now - lastBackPress < 2000) {
    App.exitApp()
  } else {
    lastBackPress = now
    window.dispatchEvent(new CustomEvent('spacerace:back-hint'))
  }
}

/** Register the Android Back listener once at app boot. No-op off native. */
export function initBackButton(): void {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true
  App.addListener('backButton', onBack)
}

/**
 * Subscribe an interceptor while `active` is true (e.g. an open modal).
 * The handler runs on Android Back; return true to consume it. Handler identity
 * can change every render — we keep a ref so only `active` drives (un)subscribe.
 */
export function useBackHandler(handler: BackHandler, active = true): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return
    return pushBackHandler(() => ref.current())
  }, [active])
}
