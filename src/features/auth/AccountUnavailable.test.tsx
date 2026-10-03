import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import AccountUnavailable from './AccountUnavailable'

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(), signOut: vi.fn(), auth: { currentUser: { uid: 'owner' } },
}))
vi.mock('firebase/auth', () => ({ deleteUser: mocks.deleteUser, signOut: mocks.signOut }))
vi.mock('@/firebase/auth', () => ({ auth: mocks.auth }))
const user = { uid: 'owner', email: 'owner@example.test' } as User
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.currentUser = { uid: 'owner' }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('profilsiz hesabı kendiliğinden silmez; iptal edilen onayda Auth çağrısı yapmaz', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<AccountUnavailable user={user} />)
  expect(mocks.deleteUser).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Giriş Hesabımı Kalıcı Sil' }))
  expect(mocks.deleteUser).not.toHaveBeenCalled()
})

it('silme yalnızca mevcut kullanıcının Auth kaydını hedefler ve yeniden giriş gereğini açıklar', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mocks.deleteUser.mockRejectedValue({ code: 'auth/requires-recent-login' })
  render(<AccountUnavailable user={user} deletionRequested />)
  fireEvent.click(screen.getByRole('button', { name: 'Giriş Hesabımı Kalıcı Sil' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('şifrenizle tekrar giriş yapın')
  expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(mocks.auth.currentUser)
  expect(screen.getByRole('button', { name: 'Çıkış Yap' })).toBeEnabled()
})

it('ekran açıkken oturum değişirse diğer hesabı silmez', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mocks.auth.currentUser = { uid: 'other' }
  render(<AccountUnavailable user={user} />)
  fireEvent.click(screen.getByRole('button', { name: 'Giriş Hesabımı Kalıcı Sil' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(mocks.deleteUser).not.toHaveBeenCalled()
})

it('çıkış başarısız olursa silme çağrısı yapmadan tekrar denemeye izin verir', async () => {
  mocks.signOut.mockRejectedValue(new Error('offline'))
  render(<AccountUnavailable user={user} />)
  fireEvent.click(screen.getByRole('button', { name: 'Çıkış Yap' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(mocks.signOut).toHaveBeenCalledTimes(1)
  expect(mocks.deleteUser).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Çıkış Yap' })).toBeEnabled()
})
