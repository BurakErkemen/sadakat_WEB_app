import { beforeEach, expect, it, vi } from 'vitest'
import { deleteMerchant } from './deleteMerchant'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(),
}))
vi.mock('@/firebase/firestore', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  serverTimestamp: () => 'now',
  runTransaction: async (_db: unknown, callback: (tx: typeof mocks) => Promise<void>) => callback(mocks),
}))
beforeEach(() => { vi.resetAllMocks() })
const snapshot = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data })

it('mağaza, profil ve slug bağlantısını birlikte kapatır', async () => {
  mocks.get.mockResolvedValueOnce(snapshot({ ownerId: 'owner', slug: 'cafe' }))
    .mockResolvedValueOnce(snapshot({ merchantId: 'shop' }))
    .mockResolvedValueOnce(snapshot({ merchantId: 'shop' }))
  await deleteMerchant('shop', 'owner')
  expect(mocks.update).toHaveBeenCalledWith('merchants/shop', { archived: true, status: 'passive', deletedAt: 'now', updatedAt: 'now' })
  expect(mocks.update).toHaveBeenCalledWith('users/owner', { merchantId: null, updatedAt: 'now' })
  expect(mocks.update).toHaveBeenCalledWith('publicSlugs/cafe', { isActive: false })
  expect(Math.max(...mocks.get.mock.invocationCallOrder)).toBeLessThan(mocks.update.mock.invocationCallOrder[0])
})

it('başka kullanıcının mağazasını değiştirmez', async () => {
  mocks.get.mockResolvedValueOnce(snapshot({ ownerId: 'other' }))
    .mockResolvedValueOnce(snapshot({ merchantId: 'shop' }))
  await expect(deleteMerchant('shop', 'owner')).rejects.toThrow()
  expect(mocks.update).not.toHaveBeenCalled()
})

it('başka mağazaya yönlenen slug kaydına dokunmaz', async () => {
  mocks.get.mockResolvedValueOnce(snapshot({ ownerId: 'owner', slug: 'cafe' }))
    .mockResolvedValueOnce(snapshot({ merchantId: 'shop' }))
    .mockResolvedValueOnce(snapshot({ merchantId: 'other-shop' }))
  await deleteMerchant('shop', 'owner')
  expect(mocks.update).toHaveBeenCalledTimes(2)
})
