const CONSENT_KEY = 'sadex_cookie_consent'
const OPTIONAL_PREFIX = 'sadex_seen_replies_'
export const PREFERENCES_EVENT = 'sadex-preferences-changed'
const memory = new Map<string, string[]>()
let fallbackChoice: 'declined' | undefined

export function readConsent(): 'accepted' | 'declined' | null {
  if (fallbackChoice) return fallbackChoice
  try {
    const record: unknown = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null')
    if (typeof record === 'object' && record !== null && 'version' in record && record.version === 2 && 'choice' in record) {
      return record.choice === 'accepted' || record.choice === 'declined' ? record.choice : null
    }
  } catch { /* Eski onay metni veya depolama kapalı. */ }
  return null
}

export function saveConsent(choice: 'accepted' | 'declined'): boolean {
  let saved = true
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 2, choice, updatedAt: new Date().toISOString() }))
    if (choice === 'declined') {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(OPTIONAL_PREFIX)) localStorage.removeItem(key)
      }
    }
    fallbackChoice = undefined
  } catch { saved = false; fallbackChoice = 'declined' }
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
  return saved
}

export function readSeenReplies(merchantId: string): string[] {
  if (readConsent() !== 'accepted') return memory.get(merchantId) ?? []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OPTIONAL_PREFIX + merchantId) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch { return memory.get(merchantId) ?? [] }
}

export function markRepliesSeen(merchantId: string, ids: string[]) {
  const next = [...new Set([...readSeenReplies(merchantId), ...ids])]
  memory.set(merchantId, next)
  if (readConsent() === 'accepted') {
    try { localStorage.setItem(OPTIONAL_PREFIX + merchantId, JSON.stringify(next)) } catch { /* Bellekte devam et. */ }
  }
}
