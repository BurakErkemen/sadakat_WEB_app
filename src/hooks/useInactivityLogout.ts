import { useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/auth'

const INACTIVITY_MS = 60 * 60 * 1000 // 1 saat
const STORAGE_KEY = 'sadex_last_activity'

export function useInactivityLogout() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function scheduleLogout() {
      if (timer.current) clearTimeout(timer.current)
      const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
      const elapsed = Date.now() - (lastActivity || Date.now())
      const remaining = Math.max(0, INACTIVITY_MS - elapsed)

      timer.current = setTimeout(() => {
        signOut(auth).catch(console.error).finally(() => {
          window.location.replace('/login')
        })
      }, remaining)
    }

    function reset() {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
      scheduleLogout()
    }

    // Başka sekmelerdeki aktiviteyi yakala
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) scheduleLogout()
    }

    // Sekme tekrar görünür olunca son aktiviteye göre yeniden hesapla
    function onVisibility() {
      if (document.visibilityState === 'visible') scheduleLogout()
    }

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'click', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    reset()

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])
}
