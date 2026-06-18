import { useState } from 'react'
import { sendEmailVerification, signOut } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { useAuth } from './AuthContext'

export default function VerifyEmailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)

  async function resend() {
    if (!user) return
    setResending(true)
    try {
      await sendEmailVerification(user)
      toast.success('Doğrulama e-postası tekrar gönderildi. Gelen kutunuzu kontrol edin.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('too-many-requests')) {
        toast.error('Çok sık istek gönderildi. Birkaç dakika bekleyip tekrar deneyin.')
      } else {
        toast.error('Gönderilemedi. Lütfen tekrar deneyin.')
      }
    } finally {
      setResending(false) }
  }

  async function checkVerification() {
    if (!user) return
    setChecking(true)
    try {
      await user.reload()
      if (auth.currentUser?.emailVerified) {
        toast.success('E-posta doğrulandı!')
        navigate('/onboarding', { replace: true })
      } else {
        toast.error('E-posta henüz doğrulanmadı. Gelen kutunuzu kontrol edin.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setChecking(false)
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login')
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
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-5">
          <div className="text-5xl">📬</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">E-postanızı doğrulayın</h2>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{user?.email}</strong> adresine bir doğrulama bağlantısı gönderdik.
              Bağlantıya tıkladıktan sonra aşağıdaki butona basın.
            </p>
          </div>

          <button
            onClick={checkVerification}
            disabled={checking}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
          >
            {checking ? 'Kontrol ediliyor…' : 'Doğruladım, Devam Et'}
          </button>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs text-gray-400">E-posta gelmediyse spam klasörünü kontrol edin.</p>
            <button
              onClick={resend}
              disabled={resending}
              className="text-sm text-violet-600 hover:underline disabled:opacity-50"
            >
              {resending ? 'Gönderiliyor…' : 'Tekrar gönder'}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600">
            Farklı hesapla giriş yap
          </button>
        </div>
      </div>
    </div>
  )
}
