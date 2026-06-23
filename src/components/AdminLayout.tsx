import { Outlet, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { useAuth } from '@/features/auth/AuthContext'

export default function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(auth)
    toast.success('Çıkış yapıldı')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/sadex.png"
              alt="Sadex"
              className="h-8 sm:h-9 w-auto max-w-[96px] sm:max-w-[140px]"
              style={{ objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-[10px] sm:text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              Yönetim Paneli
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="text-sm text-gray-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  )
}
