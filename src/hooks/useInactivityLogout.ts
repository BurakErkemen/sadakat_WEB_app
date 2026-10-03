import { useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/auth'
import { activityStorage, rememberSession, REMEMBERED_SESSION_MS, SHORT_SESSION_MS, SESSION_START_KEY } from '@/lib/sessionPolicy'

export function useInactivityLogout() {
  useEffect(() => {
    const key = `sadex_last_activity_${auth.currentUser?.uid ?? 'session'}`
    const storage = activityStorage()
    const timeout = rememberSession() ? REMEMBERED_SESSION_MS : SHORT_SESSION_MS
    let last = Date.now()
    let exiting = false
    try {
      const stored = Number(storage?.getItem(key))
      if (Number.isFinite(stored) && stored > 0) last = Math.max(stored, Number(storage?.getItem(SESSION_START_KEY)) || 0)
      else storage?.setItem(key, String(last))
    } catch { /* Bellekte devam et. */ }
    function check() {
      try {
        const stored = Number(storage?.getItem(key))
        if (Number.isFinite(stored) && stored > last) last = stored
      } catch { /* Bellekte devam et. */ }
      if (!exiting && Date.now() - last >= timeout) {
        exiting = true
        void signOut(auth).then(() => window.location.replace('/login')).catch(() => { exiting = false })
      }
    }
    function activity() {
      check()
      if (exiting) return
      last = Date.now()
      try { storage?.setItem(key, String(last)) } catch { /* Bellekte devam et. */ }
    }
    check()
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const interval = setInterval(check, 60_000)
    return () => {
      clearInterval(interval)
      events.forEach((event) => window.removeEventListener(event, activity))
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
}
