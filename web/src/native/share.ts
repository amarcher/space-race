// "Share the win" — native share sheet on iOS (Capacitor), Web Share API on the
// web, and a silent no-op where neither exists (most desktop browsers).
//
// `canShare()` lets the UI hide the button entirely when there's nothing to open,
// rather than showing a dead control. Both paths swallow the user-cancel case:
// dismissing the share sheet rejects, and that's not an error we care about.
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

const native = Capacitor.isNativePlatform()

/** True when a share sheet is reachable (native plugin or Web Share API). */
export function canShare(): boolean {
  return native || (typeof navigator !== 'undefined' && typeof navigator.share === 'function')
}

interface ShareContent {
  title: string
  text: string
  url: string
}

/** Open the platform share sheet. No-ops (and never throws) if unavailable. */
export async function shareContent({ title, text, url }: ShareContent): Promise<void> {
  try {
    if (native) {
      await Share.share({ title, text, url, dialogTitle: title })
    } else if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url })
    }
  } catch {
    // user cancelled the sheet, or share is unsupported — nothing to do
  }
}
