import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/auth'
import { useAuth } from '@/features/auth/AuthContext'

export default function PendingPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.status === 'approved') {
      navigate('/onboarding', { replace: true })
    }
  }, [profile?.status, navigate])

  async function handleSignOut() {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  const isRejected = profile?.status === 'rejected'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">

        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-sm border border-gray-100 mx-auto">
          {isRejected ? (
            <span className="text-4xl">❌</span>
          ) : (
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
            </div>
          )}
        </div>

        {isRejected ? (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Başvuru Reddedildi</h1>
              <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                Başvurunuz incelendi ancak onaylanamadı.
                Daha fazla bilgi için bizimle iletişime geçebilirsiniz.
              </p>
            </div>
            <a
              href="mailto:info@cyandanismanlik.com?subject=Başvuru Hakkında"
              className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all"
            >
              İletişime Geç
            </a>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Başvurunuz Alındı</h1>
              <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                Hesabınız inceleniyor. Onaylandığında otomatik olarak
                yönlendirileceksiniz — bu sayfayı açık bırakın.
              </p>
            </div>

            {/* E-posta göster */}
            {user?.email && (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm text-gray-600">
                <span className="text-gray-400">Hesap:</span>{' '}
                <span className="font-medium">{user.email}</span>
              </div>
            )}

            <div className="bg-violet-50 rounded-xl border border-violet-100 px-4 py-3 text-xs text-violet-700">
              Genellikle 1 iş günü içinde onaylanır.
            </div>
          </>
        )}

        <button
          onClick={() => void handleSignOut()}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Çıkış yap
        </button>
      </div>
    </div>
  )
}
