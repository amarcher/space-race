import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './index.css'

// Register the PWA service worker on WEB ONLY. Inside the native iOS app
// (Capacitor) the assets are served from disk, so Workbox caching is pure
// overhead — gate it off. Web behavior is unchanged (autoUpdate SW still
// registers immediately). See docs/ios-roadmap.md Phase 1.
if (!Capacitor.isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
