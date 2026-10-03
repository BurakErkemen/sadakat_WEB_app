import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'
import { rememberSession } from '@/lib/sessionPolicy'

const mocks = vi.hoisted(() => ({ persistence: vi.fn(), signIn: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: null, profile: null, loading: false, isAdmin: false }) }))
vi.mock('@/firebase/auth', () => ({ auth: 'auth' }))
vi.mock('firebase/auth', () => ({
  setPersistence: mocks.persistence, signInWithEmailAndPassword: mocks.signIn,
  browserLocalPersistence: 'local', browserSessionPersistence: 'session',
}))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

it.each([false, true])('beni hatırla=%s için Firebase kalıcılığını girişten önce ayarlar', async (remember) => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  if (remember) fireEvent.click(screen.getByRole('checkbox', { name: 'Beni hatırla' }))
  fireEvent.change(screen.getByPlaceholderText('ornek@isletme.com'), { target: { value: 'owner@example.test' } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'test-password' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Giriş Yap' }).closest('form')!)
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(1))
  expect(mocks.persistence).toHaveBeenCalledWith('auth', remember ? 'local' : 'session')
  expect(mocks.persistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0])
  expect(rememberSession()).toBe(remember)
})
