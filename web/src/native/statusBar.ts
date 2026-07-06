// Status-bar setup for the native iOS app (Capacitor).
//
// The game sits on a near-black starfield (#07071a), so the status-bar text/icons
// must be LIGHT. `Style.Dark` means "dark background" → light content (Apple's
// naming is inverted from what you'd guess). The webview OVERLAYS the status bar
// (edge-to-edge, like Safari with viewport-fit=cover) so the starfield flows
// under the clock instead of a dead black strip; the safe-area insets keep the
// app's own UI clear of the notch/Dynamic-Island.
//
// No-ops on web. Called once at app boot behind the native check.
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export function initStatusBar(): void {
  if (!Capacitor.isNativePlatform()) return
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
}
