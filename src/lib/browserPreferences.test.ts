import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules() })

it('izin yokken destek yanıtlarını kalıcı saklamaz', async () => {
  const p = await import('./browserPreferences')
  p.markRepliesSeen('shop', ['reply'])
  expect(localStorage.getItem('sadex_seen_replies_shop')).toBeNull()
  expect(p.readSeenReplies('shop')).toEqual(['reply'])
})

it('izin verilince saklar, geri çekilince yalnızca isteğe bağlı verileri siler', async () => {
  const p = await import('./browserPreferences')
  localStorage.setItem('firebase:authUser', 'essential-session')
  p.saveConsent('accepted')
  p.markRepliesSeen('shop', ['reply', 'reply'])
  expect(JSON.parse(localStorage.getItem('sadex_seen_replies_shop')!)).toEqual(['reply'])
  p.saveConsent('declined')
  expect(localStorage.getItem('sadex_seen_replies_shop')).toBeNull()
  expect(localStorage.getItem('firebase:authUser')).toBe('essential-session')
  expect(p.readConsent()).toBe('declined')
})

it('eski veya bozuk onayı yeni kapsam için izin saymaz', async () => {
  const p = await import('./browserPreferences')
  localStorage.setItem('sadex_cookie_consent', 'accepted')
  expect(p.readConsent()).toBeNull()
  localStorage.setItem('sadex_cookie_consent', '{bad json')
  expect(p.readConsent()).toBeNull()
})

it('depolama engelliyken reddi bellekte uygular', async () => {
  const p = await import('./browserPreferences')
  p.saveConsent('accepted')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  expect(p.saveConsent('declined')).toBe(false)
  expect(p.readConsent()).toBe('declined')
  p.markRepliesSeen('shop', ['reply'])
  expect(localStorage.getItem('sadex_seen_replies_shop')).toBeNull()
  spy.mockRestore()
})
