import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('user-not-found')) {
        toast.error('Bu e-posta adresiyle kayıtlı hesap bulunamadı.')
      } else {
        toast.error('Gönderim başarısız. Lütfen tekrar deneyin.')
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img src="/sadex.png" alt="Sadex" className="h-12 w-auto mx-auto"
              style={{ objectFit: 'contain', maxWidth: '180px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <p className="text-gray-500 mt-1 text-sm">Şifre Sıfırlama</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
            <div className="text-4xl">📧</div>
            <div>
              <p className="font-semibold text-gray-900">E-posta gönderildi!</p>
              <p className="text-sm text-gray-500 mt-1">
                <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderildi.
                Gelen kutunuzu (ve spam klasörünüzü) kontrol edin.
              </p>
            </div>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-violet-600 hover:underline"
            >
              Farklı e-posta ile dene
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Kayıtlı e-posta adresinizi girin. Şifre sıfırlama bağlantısı göndereceğiz.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="ornek@isletme.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
          </form>
        )}

        <div className="text-center mt-4 space-y-1">
          <p>
            <Link to="/login" className="text-sm text-violet-600 font-medium hover:underline">
              ← Girişe Dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
