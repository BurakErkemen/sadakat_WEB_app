import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { db } from '@/firebase/firestore'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır.')
      return
    }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName,
        email,
        phone: null,
        merchantId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      navigate('/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kayıt başarısız.'
      if (msg.includes('email-already-in-use')) {
        toast.error('Bu e-posta adresi zaten kullanımda.')
      } else {
        toast.error('Kayıt başarısız. Lütfen tekrar deneyin.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DamgaKart</h1>
          <p className="text-gray-500 mt-1">Yeni İşletme Kaydı</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ahmet Yılmaz"
            />
          </div>
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
              placeholder="En az 6 karakter"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Kaydediliyor…' : 'Kayıt Ol'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  )
}
