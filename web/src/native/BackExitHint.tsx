// The "Press back again to exit" toast for the Android Back button (see
// backButton.ts). A real Android-style transient hint, self-contained (no extra
// Capacitor plugin): it listens for the `spacerace:back-hint` event that onBack()
// fires on the first root-level Back press and auto-hides after ~2s — the same
// window in which a second press exits the app. Renders nothing on web/iOS.
import { useEffect, useState } from 'react'
import './BackExitHint.css'

export function BackExitHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function onHint() {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), 2000)
    }
    window.addEventListener('spacerace:back-hint', onHint)
    return () => {
      window.removeEventListener('spacerace:back-hint', onHint)
      clearTimeout(timer)
    }
  }, [])

  if (!visible) return null
  return (
    <div className="back-exit-hint" role="status" aria-live="polite">
      Press back again to exit
    </div>
  )
}
