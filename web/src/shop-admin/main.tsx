import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ShopAdmin } from './ShopAdmin'
import './ShopAdmin.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopAdmin />
  </StrictMode>,
)
