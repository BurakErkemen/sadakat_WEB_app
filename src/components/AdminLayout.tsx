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
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-600 text-lg">DamgaKart</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-semibold text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
              Yönetim Paneli
            </span>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
