import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, isAdmin, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Zaten giriş yapmışsa doğru yere yönlendir
  useEffect(() => {
    if (loading) return
    if (!user) return
    if (isAdmin) { navigate('/yonetim', { replace: true }); return }
    if (profile?.merchantId) { navigate('/app', { replace: true }); return }
    navigate('/onboarding', { replace: true })
  }, [user, isAdmin, profile, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Yönlendirme yukarıdaki useEffect tarafından yapılır
    } catch (err: unknown) {
      toast.error('Giriş başarısız. E-posta veya şifre hatalı.')
      console.error(err)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DamgaKart</h1>
          <p className="text-gray-500 mt-1">Giriş Yap</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ornek@isletme.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-indigo-600 font-medium hover:underline">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  )
}
