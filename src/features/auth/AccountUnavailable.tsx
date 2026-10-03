import { useState } from 'react'
import type { User } from 'firebase/auth'

export default function AccountUnavailable({ user, deletionRequested = false }: { user: User; deletionRequested?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function leave(remove: boolean) {
    if (remove && !window.confirm('Giriş hesabınız kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?')) return
    setBusy(true)
    setError(null)
    try {
      const [{ deleteUser, signOut }, { auth }] = await Promise.all([
        import('firebase/auth'), import('@/firebase/auth'),
      ])
      if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti. Lütfen sayfayı yenileyin.')
      if (remove) await deleteUser(auth.currentUser)
      else await signOut(auth)
      window.location.replace('/login')
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : ''
      setError(code === 'auth/requires-recent-login'
        ? 'Silmek için önce çıkış yapıp şifrenizle tekrar giriş yapın, ardından silmeyi yeniden deneyin.'
        : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.')
      setBusy(false)
    }
  }

  return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md bg-white rounded-2xl border p-6 space-y-4 text-center">
      <h1 className="text-xl font-bold">{deletionRequested ? 'Hesabınız kapatıldı' : 'Hesap profiliniz bulunamadı'}</h1>
      <p className="text-sm text-gray-600">{deletionRequested
        ? 'Bu hesabın uygulama erişimi kapatıldı. Giriş hesabınızın kalıcı silinmesini buradan tamamlayabilirsiniz.'
        : 'Bu giriş hesabına bağlı üyelik profili bulunamadı. Bu durum beklenmedikse destek ile iletişime geçin. Hesabı kullanmayacaksanız giriş kaydınızı silebilirsiniz.'}</p>
      <p className="text-sm text-gray-500">{user.email}</p>
      <p className="text-xs text-gray-500">Giriş hesabını silmek, işletmenin geçmiş kayıtlarını silmez.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} onClick={() => void leave(false)} className="w-full rounded-xl bg-gray-900 text-white py-3 disabled:opacity-50">Çıkış Yap</button>
      <button disabled={busy} onClick={() => void leave(true)} className="w-full rounded-xl border border-red-300 text-red-600 py-3 disabled:opacity-50">Giriş Hesabımı Kalıcı Sil</button>
    </div>
  </div>
}
