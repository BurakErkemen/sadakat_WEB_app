import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [kvkkAccepted, setKvkkAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (!termsAccepted || !kvkkAccepted) {
      toast.error('Devam etmek için tüm onayları vermeniz gerekiyor.')
      return
    }
    setEmailError(null)
    setLoading(true)
    try {
      // Firebase submit anında dinamik yüklenir; form boyaması SDK'yı beklemez (mobil LCP)
      const [
        { createUserWithEmailAndPassword, updateProfile, sendEmailVerification },
        { doc, setDoc, serverTimestamp },
        { auth },
        { db },
      ] = await Promise.all([
        import('firebase/auth'),
        import('firebase/firestore'),
        import('@/firebase/auth'),
        import('@/firebase/firestore'),
      ])

      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })
      const consentDate = serverTimestamp()
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName,
        email,
        phone: null,
        merchantId: null,
        status: 'pending',
        // Yasal onay kayıtları — KVKK ispat yükümlülüğü için
        consents: {
          terms: true,
          kvkk: true,
          consentDate,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      sendEmailVerification(cred.user).catch(console.error)
      navigate('/verify-email')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kayıt başarısız.'
      if (msg.includes('email-already-in-use')) {
        setEmailError('Bu e-posta adresi zaten kullanımda.')
      } else {
        toast.error('Kayıt başarısız. Lütfen tekrar deneyin.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img src="/logo.png" alt="Puaniva" className="h-12 w-auto mx-auto"
              style={{ objectFit: 'contain', maxWidth: '180px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <p className="text-gray-500 mt-1 text-sm">Yeni İşletme Kaydı</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-3 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Ahmet Yılmaz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
              required
              className={`w-full border rounded-lg px-3 py-3 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:border-transparent ${emailError ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-violet-500'}`}
              placeholder="ornek@isletme.com"
            />
            {emailError && (
              <div className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <span>{emailError}</span>
                <Link to="/login" className="font-semibold underline inline-block py-2 -my-2 px-1">Giriş yapmak ister misiniz?</Link>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-3 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="En az 6 karakter"
            />
          </div>

          {/* Yasal onaylar */}
          <div className="space-y-3 border-t border-gray-100 pt-3">
            {/* Label'ın tamamı tıklanabilir; py-2 ile dokunma alanı büyütüldü.
                Metin içi linkler py/negatif-margin ile düzeni bozmadan 44px'e yaklaştırıldı. */}
            <label className="flex items-start gap-3 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-6 h-6 rounded border-gray-300 text-violet-600 focus:ring-violet-500 shrink-0"
              />
              <span className="text-xs text-gray-600 leading-loose">
                <Link to="/kullanim-kosullari" target="_blank" className="text-violet-600 hover:underline font-medium inline-block py-2.5 -my-2.5">Kullanım Koşullarını</Link>,{' '}
                <Link to="/gizlilik" target="_blank" className="text-violet-600 hover:underline font-medium inline-block py-2.5 -my-2.5">Gizlilik Politikasını</Link>{' '}
                ve{' '}
                <Link to="/kvkk" target="_blank" className="text-violet-600 hover:underline font-medium inline-block py-2.5 -my-2.5">Çerez Politikasını</Link>{' '}
                okudum, kabul ediyorum.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={kvkkAccepted}
                onChange={(e) => setKvkkAccepted(e.target.checked)}
                className="mt-0.5 w-6 h-6 rounded border-gray-300 text-violet-600 focus:ring-violet-500 shrink-0"
              />
              <span className="text-xs text-gray-600 leading-loose">
                6698 sayılı{' '}
                <Link to="/kvkk" target="_blank" className="text-violet-600 hover:underline font-medium inline-block py-2.5 -my-2.5">KVKK</Link>{' '}
                kapsamında kişisel verilerimin işlenmesine, hizmet iyileştirme ve iletişim amacıyla kullanılmasına onay veriyorum.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !termsAccepted || !kvkkAccepted}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? 'Kaydediliyor…' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="text-center space-y-2 mt-4">
          <p className="text-sm text-gray-500">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="inline-flex items-center min-h-[44px] px-1 text-violet-600 font-medium hover:underline">
              Giriş Yap
            </Link>
          </p>
          <p>
            <Link to="/" className="inline-flex items-center min-h-[44px] px-2 text-xs text-gray-400 hover:text-violet-600 transition-colors">
              ← Ana Sayfaya Dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
