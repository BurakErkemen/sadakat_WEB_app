import { useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/auth'

const INACTIVITY_MS = 60 * 60 * 1000 // 1 saat
const CHECK_INTERVAL_MS = 60 * 1000   // her 60 saniyede kontrol
const LS_KEY = 'sadex_last_activity'

// localStorage tabanlı cross-tab model:
// Aktivite tüm sekmelerde ortak localStorage key'e yazılır.
// Herhangi bir sekme yeterince uzun süre hareketsiz kalırsa tüm sekmelerde
// auth.signOut() tetiklenir (Firebase Auth state sekmeler arası otomatik senkronize olur).
export function useInactivityLogout() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function doLogout() {
      signOut(auth).catch(console.error).finally(() => {
        window.location.replace('/login')
      })
    }

    function onActivity() {
      localStorage.setItem(LS_KEY, String(Date.now()))
    }

    function getLastActivity(): number {
      return Number(localStorage.getItem(LS_KEY) ?? Date.now())
    }

    function checkInactivity() {
      if (Date.now() - getLastActivity() >= INACTIVITY_MS) {
        doLogout()
      }
    }

    // Sekme öne gelince anında kontrol (arka planda 1 saat geçmişse hemen çıkış)
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        checkInactivity()
      }
    }

    // Başlangıçta timestamp yoksa şimdiki zamanı yaz
    if (!localStorage.getItem(LS_KEY)) {
      localStorage.setItem(LS_KEY, String(Date.now()))
    }

    const EVENTS = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'click', 'scroll'] as const
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)

    intervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS)

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}
