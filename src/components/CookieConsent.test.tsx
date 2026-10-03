import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import CookieConsent from './CookieConsent'
import { readConsent } from '@/lib/browserPreferences'

beforeEach(() => localStorage.clear())
afterEach(cleanup)
it('kabul, tercihleri yeniden açma ve geri çekmeyi uygular', () => {
  render(<CookieConsent />)
  fireEvent.click(screen.getByRole('button', { name: 'Tercihleri Hatırla' }))
  expect(readConsent()).toBe('accepted')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Çerez Tercihleri' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yalnızca Zorunlu' }))
  expect(readConsent()).toBe('declined')
})
