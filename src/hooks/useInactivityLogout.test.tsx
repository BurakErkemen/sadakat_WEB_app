import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useInactivityLogout } from './useInactivityLogout'
import { setRememberSession, REMEMBERED_SESSION_MS } from '@/lib/sessionPolicy'

const signOut = vi.hoisted(() => vi.fn())
vi.mock('firebase/auth', () => ({ signOut }))
vi.mock('@/firebase/auth', () => ({ auth: { currentUser: { uid: 'owner' } } }))
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
  localStorage.clear(); sessionStorage.clear(); signOut.mockReset()
  signOut.mockReturnValue(new Promise(() => {}))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('hatırlanmayan oturumu bir saat sonra kapatır', () => {
  setRememberSession(false)
  renderHook(() => useInactivityLogout())
  act(() => vi.advanceTimersByTime(60 * 60 * 1000))
  expect(signOut).toHaveBeenCalledTimes(1)
})

it('hatırlanan oturum bir saat sonra kapanmaz, 30 günde kapanır', () => {
  setRememberSession(true)
  renderHook(() => useInactivityLogout())
  act(() => vi.advanceTimersByTime(60 * 60 * 1000))
  expect(signOut).not.toHaveBeenCalled()
  vi.setSystemTime(Date.now() + REMEMBERED_SESSION_MS)
  act(() => vi.advanceTimersByTime(60_000))
  expect(signOut).toHaveBeenCalledTimes(1)
})

it('sayfa yenilemek eski etkinlik zamanını sıfırlamaz', () => {
  setRememberSession(true)
  const first = renderHook(() => useInactivityLogout())
  first.unmount()
  vi.setSystemTime(Date.now() + REMEMBERED_SESSION_MS + 1)
  renderHook(() => useInactivityLogout())
  expect(signOut).toHaveBeenCalledTimes(1)
})

it('yeni giriş eski süresi dolmuş oturuma takılmaz', () => {
  sessionStorage.setItem('sadex_last_activity_owner', String(Date.now() - REMEMBERED_SESSION_MS))
  setRememberSession(false)
  renderHook(() => useInactivityLogout())
  expect(signOut).not.toHaveBeenCalled()
})
