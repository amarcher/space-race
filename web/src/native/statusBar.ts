// Status-bar setup for the native iOS app (Capacitor).
//
// The game sits on a near-black starfield (#07071a), so the status-bar text/icons
// must be LIGHT. `Style.Dark` means "dark background" → light content (Apple's
// naming is inverted from what you'd guess). We do NOT overlay the webview: the
// safe-area insets already reserve the notch/Dynamic-Island strip, so the bar
// paints over the app's own backgroundColor with no content collision.
//
// No-ops on web. Called once at app boot behind the native check.
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export function initStatusBar(): void {
  if (!Capacitor.isNativePlatform()) return
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
}
