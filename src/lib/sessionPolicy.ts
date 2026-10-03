const MODE_KEY = 'sadex_remember_session'
export const SESSION_START_KEY = 'sadex_session_started'
export const SHORT_SESSION_MS = 60 * 60 * 1000
export const REMEMBERED_SESSION_MS = 30 * 24 * 60 * 60 * 1000

export function rememberSession(): boolean {
  try {
    const session = sessionStorage.getItem(MODE_KEY)
    return session === 'yes' || (session === null && localStorage.getItem(MODE_KEY) === 'yes')
  } catch { return false }
}

export function setRememberSession(remember: boolean) {
  try {
    sessionStorage.setItem(MODE_KEY, remember ? 'yes' : 'no')
    if (remember) localStorage.setItem(MODE_KEY, 'yes')
    else localStorage.removeItem(MODE_KEY)
    const storage = remember ? localStorage : sessionStorage
    storage.setItem(SESSION_START_KEY, String(Date.now()))
  } catch { /* Firebase persistence başarısızlığı giriş akışında ayrıca ele alınır. */ }
}

export function activityStorage(): Storage | null {
  try { return rememberSession() ? localStorage : sessionStorage } catch { return null }
}
