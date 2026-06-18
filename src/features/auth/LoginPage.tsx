import { useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, isAdmin, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Zaten giriş yapmışsa doğru yere yönlendir
  useEffect(() => {
    if (loading) return
    if (!user) return
    if (isAdmin) { navigate('/yonetim', { replace: true }); return }
    if (profile?.merchantId) { navigate('/app', { replace: true }); return }
    navigate('/onboarding', { replace: true })
  }, [user, isAdmin, profile, loading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      await signInWithEmailAndPassword(auth, email, password)
      // Yönlendirme yukarıdaki useEffect tarafından yapılır
    } catch (err: unknown) {
      toast.error('Giriş başarısız. E-posta veya şifre hatalı.')
      console.error(err)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Anasayfaya geri butonu */}
      <Link
        to="/"
        className="fixed top-4 left-4 flex items-center gap-1.5 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:text-violet-600 hover:border-violet-200 transition-colors"
      >
        ← Anasayfa
      </Link>

      <div className="w-full max-w-sm">
        {/* Logo + başlık */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img src="/sadex.png" alt="Sadex" className="h-12 w-auto mx-auto"
              style={{ objectFit: 'contain', maxWidth: '180px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <p className="text-gray-500 mt-1 text-sm">İşletme panelinize giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="ornek@isletme.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Şifre</label>
              <Link to="/forgot-password" className="text-xs text-violet-600 hover:underline">
                Şifremi Unuttum
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Beni Hatırla */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-sm text-gray-600">Beni hatırla</span>
          </label>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-violet-600 font-medium hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
