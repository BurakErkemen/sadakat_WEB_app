import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import LoginPage from './LoginPage'
import OnboardingPage from '@/features/onboarding/OnboardingPage'
import ProtectedRoute from '@/routes/ProtectedRoute'

interface Snapshot {
  exists: () => boolean
  data: () => { merchantId: string | null; status: string } | undefined
  metadata: { fromCache: boolean }
}

const mocks = vi.hoisted(() => ({
  auth: vi.fn<(auth: unknown, callback: (user: User | null) => void) => () => void>(),
  snapshot: vi.fn<(
    ref: unknown, options: unknown, next: (snapshot: Snapshot) => void,
    error: () => void
  ) => () => void>(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
}))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: mocks.auth }))
vi.mock('@/firebase/auth', () => ({ auth: {} }))
vi.mock('@/firebase/firestore', () => ({ db: {} }))
vi.mock('@/lib/constants', () => ({ ADMIN_UIDS: [] }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => segments.join('/'),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  onSnapshot: mocks.snapshot, getDocs: mocks.getDocs,
  getDoc: vi.fn(), setDoc: mocks.setDoc, serverTimestamp: () => 'server-time', Timestamp: {},
}))

function mount(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/app" element={<ProtectedRoute><p>İşletme paneli</p></ProtectedRoute>} />
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/pending" element={<p>Onay bekleniyor</p>} />
    <Route path="/verify-email" element={<p>E-posta doğrulama</p>} />
  </Routes></AuthProvider></MemoryRouter>)
}

async function login() {
  await waitFor(() => expect(mocks.auth).toHaveBeenCalled())
  act(() => mocks.auth.mock.calls.slice(-1)[0][1](null))
  act(() => mocks.auth.mock.calls.slice(-1)[0][1]({ uid: 'owner', emailVerified: true } as User))
}

function profile(merchantId: string | null, fromCache = false, exists = true, status = 'approved') {
  act(() => mocks.snapshot.mock.calls.slice(-1)[0][2]({
    exists: () => exists,
    data: () => exists ? { merchantId, status } : undefined,
    metadata: { fromCache },
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockReturnValue(vi.fn())
  mocks.snapshot.mockReturnValue(vi.fn())
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('giriş ve mağaza yükleme', () => {
  it('silme bekleyen hesabı mağaza sorgusu yapmadan kapalı hesap ekranına alır', async () => {
    mount()
    await login()
    profile('shop', false, true, 'deletion_requested')
    expect(screen.getByText('Hesabınız kapatıldı')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Çıkış Yap' })).toBeEnabled()
    expect(mocks.getDocs).not.toHaveBeenCalled()
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
  })

  it('açık oturum silme durumuna geçtiğinde paneli kapatır', async () => {
    mount()
    await login()
    profile('shop')
    expect(await screen.findByText('İşletme paneli')).toBeInTheDocument()
    profile('shop', false, true, 'deletion_requested')
    expect(screen.getByText('Hesabınız kapatıldı')).toBeInTheDocument()
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
  })

  it('geciken profili bekler ve mevcut mağazaya gider', async () => {
    mount()
    await login()
    expect(mocks.getDocs).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeDisabled()
    profile('shop')
    expect(await screen.findByText('İşletme paneli')).toBeInTheDocument()
  })

  it('önbellekte eksik profil ile onboarding açmaz', async () => {
    mount()
    await login()
    profile(null, true, false)
    expect(mocks.getDocs).not.toHaveBeenCalled()
    profile('shop')
    expect(await screen.findByText('İşletme paneli')).toBeInTheDocument()
  })

  it('profil okuma hatasında tekrar abone olup toparlanır', async () => {
    mount()
    await login()
    act(() => mocks.snapshot.mock.calls.slice(-1)[0][3]())
    expect(screen.getByText(/Hesap bilgileriniz yüklenemedi/)).toBeInTheDocument()
    expect(mocks.getDocs).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }))
    await waitFor(() => expect(mocks.auth).toHaveBeenCalledTimes(2))
    act(() => mocks.auth.mock.calls.slice(-1)[0][1]({ uid: 'owner', emailVerified: true } as User))
    profile('shop')
    expect(await screen.findByText('İşletme paneli')).toBeInTheDocument()
  })

  it('sunucuda profil bulunamadığında yeni mağaza açmaz', async () => {
    mount()
    await login()
    profile(null, false, false)
    expect(screen.getByText(/Hesap profiliniz bulunamadı/)).toBeInTheDocument()
    expect(mocks.getDocs).not.toHaveBeenCalled()
  })

  it('önceki oturumun geç gelen profilini kullanmaz', async () => {
    mount()
    await login()
    const previous = mocks.snapshot.mock.calls.slice(-1)[0][2]
    act(() => mocks.auth.mock.calls.slice(-1)[0][1]({ uid: 'other' } as User))
    act(() => previous({ exists: () => true, data: () => ({ merchantId: 'old', status: 'approved' }), metadata: { fromCache: false } }))
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
    expect(mocks.getDocs).not.toHaveBeenCalled()
  })

  it('mağaza sorgusu hata verirse form açmaz ve yeniden dener', async () => {
    mocks.getDocs.mockRejectedValueOnce(new Error('permission-denied'))
    mocks.getDocs.mockResolvedValueOnce({ empty: true, metadata: { fromCache: false } })
    mount()
    await login()
    profile(null)
    expect(await screen.findByText(/Mevcut işletmeniz kontrol edilemedi/)).toBeInTheDocument()
    expect(screen.queryByText('İşletmeyi Oluştur')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }))
    expect(await screen.findByText('İşletmeyi Oluştur')).toBeInTheDocument()
  })

  it('önbellekten boş mağaza sonucu geldiğinde form açmaz', async () => {
    mocks.getDocs.mockResolvedValue({ empty: true, metadata: { fromCache: true } })
    mount()
    await login()
    profile(null)
    expect(await screen.findByText(/Mevcut işletmeniz kontrol edilemedi/)).toBeInTheDocument()
    expect(screen.queryByText('İşletmeyi Oluştur')).not.toBeInTheDocument()
  })

  it('mevcut mağazayı bulunca yalnızca kurtarma seçeneği sunar', async () => {
    mocks.getDocs.mockResolvedValue({ empty: false, metadata: { fromCache: false }, docs: [
      { id: 'shop', data: () => ({ name: 'Kafe', createdAt: null }) },
    ] })
    mount()
    await login()
    profile(null)
    expect(await screen.findByText('Mevcut İşletme Bulundu')).toBeInTheDocument()
    expect(screen.queryByText('Yeni işletme oluştur')).not.toBeInTheDocument()
  })

  it('doğrudan panel girişinde eksik profille içeriği göstermez', async () => {
    mount('/app')
    await waitFor(() => expect(mocks.auth).toHaveBeenCalled())
    act(() => mocks.auth.mock.calls.slice(-1)[0][1]({ uid: 'owner', emailVerified: true } as User))
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
    profile(null, false, false)
    expect(screen.getByText(/Hesap profiliniz bulunamadı/)).toBeInTheDocument()
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
    expect(mocks.getDocs).not.toHaveBeenCalled()
  })

  it.each(['pending', 'rejected'])('%s hesap için mağaza sorgusu başlatmaz', async (status) => {
    mount()
    await login()
    profile(null, false, true, status)
    expect(await screen.findByText('Onay bekleniyor')).toBeInTheDocument()
    expect(mocks.getDocs).not.toHaveBeenCalled()
  })

  it('doğrulanmamış hesabı e-posta doğrulamasına yönlendirir', async () => {
    mount()
    await login()
    act(() => mocks.auth.mock.calls.slice(-1)[0][1]({ uid: 'owner', emailVerified: false } as User))
    profile('shop')
    expect(await screen.findByText('E-posta doğrulama')).toBeInTheDocument()
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
  })

  it('çıkıştan sonra eski profil veya hata paneli geri getirmez', async () => {
    mount()
    await login()
    const previous = mocks.snapshot.mock.calls.slice(-1)[0]
    profile('shop')
    expect(await screen.findByText('İşletme paneli')).toBeInTheDocument()
    act(() => mocks.auth.mock.calls.slice(-1)[0][1](null))
    act(() => {
      previous[2]({ exists: () => true, data: () => ({ merchantId: 'shop', status: 'approved' }), metadata: { fromCache: false } })
      previous[3]()
    })
    expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeEnabled()
    expect(screen.queryByText('İşletme paneli')).not.toBeInTheDocument()
    expect(screen.queryByText(/Hesap bilgileriniz yüklenemedi/)).not.toBeInTheDocument()
  })

  it('mağaza kontrolü sürerken oluşturma formunu açmaz', async () => {
    let resolveQuery!: (result: unknown) => void
    mocks.getDocs.mockReturnValue(new Promise<unknown>((resolve) => { resolveQuery = resolve }))
    mount()
    await login()
    profile(null)
    await waitFor(() => expect(mocks.getDocs).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('İşletmeyi Oluştur')).not.toBeInTheDocument()
    expect(mocks.setDoc).not.toHaveBeenCalled()
    await act(async () => resolveQuery({ empty: true, metadata: { fromCache: false } }))
    expect(await screen.findByText('İşletmeyi Oluştur')).toBeInTheDocument()
  })

  it('kurtarmada yeni mağaza açmadan mevcut mağaza bağlantısını yazar', async () => {
    mocks.getDocs.mockResolvedValue({ empty: false, metadata: { fromCache: false }, docs: [
      { id: 'existing-shop', data: () => ({ name: 'Kafe', createdAt: null }) },
    ] })
    mocks.setDoc.mockResolvedValue(undefined)
    mount()
    await login()
    profile(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Panelime Git' }))
    await waitFor(() => expect(mocks.setDoc).toHaveBeenCalledExactlyOnceWith(
      'users/owner', { merchantId: 'existing-shop', updatedAt: 'server-time' }, { merge: true },
    ))
    expect(screen.queryByText('İşletmeyi Oluştur')).not.toBeInTheDocument()
  })

  it('kurtarma yazımı başarısızsa aynı mağaza için yeniden denenebilir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getDocs.mockResolvedValue({ empty: false, metadata: { fromCache: false }, docs: [
      { id: 'existing-shop', data: () => ({ name: 'Kafe', createdAt: null }) },
    ] })
    mocks.setDoc.mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValueOnce(undefined)
    mount()
    await login()
    profile(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Panelime Git' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Panelime Git' })).toBeEnabled())
    expect(screen.queryByText('İşletmeyi Oluştur')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Panelime Git' }))
    await waitFor(() => expect(mocks.setDoc).toHaveBeenCalledTimes(2))
    expect(mocks.setDoc.mock.calls[1]).toEqual(mocks.setDoc.mock.calls[0])
  })
})
