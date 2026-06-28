import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import AppRouter from './routes/AppRouter'
import CookieConsent from './components/CookieConsent'

const root = document.getElementById('root')
if (!root) throw new Error('No root element')

createRoot(root).render(
  <StrictMode>
    <AppRouter />
    <CookieConsent />
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: { borderRadius: '12px', fontSize: '14px' },
      }}
    />
  </StrictMode>,
)
