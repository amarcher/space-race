import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Shop } from './Shop'
import './Shop.css'

// Refresh an existing game service worker when returning directly to the shop.
// Do not install one just for checkout or reload a form being filled out.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration()
    .then((registration) => registration?.update())
    .catch(() => { /* Checkout still works if an offline-cache update fails. */ })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shop />
  </StrictMode>,
)
