import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestAccountDeletion } from './accountDeletion'

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'admin' } as { uid: string } | null },
  getDocs: vi.fn(), update: vi.fn(), set: vi.fn(), commit: vi.fn(),
}))
vi.mock('@/firebase/auth', () => ({ auth: mocks.auth }))
vi.mock('@/firebase/firestore', () => ({ db: {} }))
vi.mock('@/lib/constants', () => ({ ADMIN_UIDS: ['admin', 'other-admin'] }))
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => path,
  doc: (_db: unknown, ...path: string[]) => path.join('/') || 'audit-log',
  query: vi.fn(), where: vi.fn(), serverTimestamp: () => 'now', getDocs: mocks.getDocs,
  writeBatch: () => ({ update: mocks.update, set: mocks.set, commit: mocks.commit }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.currentUser = { uid: 'admin' }
  mocks.getDocs.mockResolvedValue({ docs: [{ ref: 'merchants/shop-1' }, { ref: 'merchants/shop-2' }] })
  mocks.commit.mockResolvedValue(undefined)
})

describe('admin hesap silme isteği', () => {
  it('profili koruyarak bütün mağazaları ve audit kaydını tek batch ile yazar', async () => {
    await requestAccountDeletion('owner')
    expect(mocks.update).toHaveBeenCalledWith('users/owner', {
      status: 'deletion_requested', deletionRequestedAt: 'now', updatedAt: 'now',
    })
    for (const shop of ['shop-1', 'shop-2']) {
      expect(mocks.update).toHaveBeenCalledWith(`merchants/${shop}`, { status: 'passive', updatedAt: 'now' })
    }
    expect(mocks.set).toHaveBeenCalledWith('audit-log', expect.objectContaining({
      action: 'user.deletion_requested', actorUid: 'admin', targetId: 'owner',
    }))
    expect(mocks.commit).toHaveBeenCalledTimes(1)
  })

  it('mağazasız hesabın erişimini de kapatır', async () => {
    mocks.getDocs.mockResolvedValueOnce({ docs: [] })
    await requestAccountDeletion('owner')
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.commit).toHaveBeenCalledTimes(1)
  })

  it.each(['admin', 'other-admin'])('admin hesabını kapatmaz: %s', async (uid) => {
    await expect(requestAccountDeletion(uid)).rejects.toThrow()
    expect(mocks.getDocs).not.toHaveBeenCalled()
    expect(mocks.commit).not.toHaveBeenCalled()
  })

  it('mağaza sorgusu hatasında kısmi kapatma yapmaz', async () => {
    mocks.getDocs.mockRejectedValueOnce(new Error('offline'))
    await expect(requestAccountDeletion('owner')).rejects.toThrow('offline')
    expect(mocks.commit).not.toHaveBeenCalled()
  })

  it('batch başarısızlığını çağırana bildirir', async () => {
    mocks.commit.mockRejectedValueOnce(new Error('permission-denied'))
    await expect(requestAccountDeletion('owner')).rejects.toThrow('permission-denied')
  })
})
