import { useState } from 'react'
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchant } from '@/hooks/useMerchant'

// Birincil 4 sekme her zaman gösterilir
const PRIMARY_NAV = [
  { to: '/app', label: 'Ana Sayfa', icon: '🏠', end: true },
  { to: '/app/stamp', label: 'Damga Ekle', icon: '✅' },
  { to: '/app/redeem', label: 'Ödül Kullandır', icon: '🎁' },
  { to: '/app/customers', label: 'Müşteriler', icon: '👥' },
]

// "Daha Fazla" menüsündeki öğeler
const MORE_NAV = [
  { to: '/app/campaigns', label: 'Kampanyalar', icon: '🎯' },
  { to: '/app/transactions', label: 'İşlemler', icon: '📋' },
  { to: '/app/qr', label: 'QR Kod', icon: '📱' },
  { to: '/app/support', label: 'Destek', icon: '🎫' },
  { to: '/app/subscription', label: 'Abonelik', icon: '💳' },
  { to: '/app/settings', label: 'Ayarlar', icon: '⚙️' },
]

export default function AppLayout() {
  const { user } = useAuth()
  const { merchant } = useMerchant()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  async function handleSignOut() {
    await signOut(auth)
    toast.success('Çıkış yapıldı')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="font-bold text-indigo-600 text-lg">DamgaKart</Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{merchant?.name ?? user?.email}</span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* "Daha Fazla" slide-up sheet */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-20"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-30 bg-white rounded-t-2xl border-t border-gray-200 shadow-xl max-w-lg mx-auto pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />

            {/* İşletme sayfası linki */}
            {merchant && (
              <a
                href={`/m/${merchant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50"
                onClick={() => setShowMore(false)}
              >
                <span className="text-xl w-8 text-center">🏪</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">İşletme Sayfam</p>
                  <p className="text-xs text-gray-400">damgakart.com/m/{merchant.slug}</p>
                </div>
                <span className="ml-auto text-gray-300 text-xs">↗</span>
              </a>
            )}

            <div className="h-px bg-gray-100 mx-5 my-1" />

            <div className="grid grid-cols-3 gap-0">
              {MORE_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-4 text-xs transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`
                  }
                >
                  <span className="text-2xl leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="max-w-lg mx-auto flex">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400'}`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </NavLink>
          ))}

          {/* Daha Fazla butonu */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${showMore ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <span className="text-lg leading-none">⋯</span>
            <span className="leading-none">Daha</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
