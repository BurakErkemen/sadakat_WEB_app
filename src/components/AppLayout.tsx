import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth } from '@/firebase/auth'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { MerchantSubProvider, useMerchantSub } from '@/contexts/MerchantSubContext'
import { trapTabKey } from '@/lib/focusTrap'

const PRIMARY_NAV = [
  { to: '/app', label: 'Ana Sayfa', icon: '🏠', end: true },
  { to: '/app/stamp', label: 'Damga Ekle', icon: '✅' },
  { to: '/app/redeem', label: 'Ödül Kullandır', icon: '🎁' },
  { to: '/app/customers', label: 'Müşteriler', icon: '👥' },
]

const MORE_NAV = [
  { to: '/app/campaigns', label: 'Kampanyalar', icon: '🎯' },
  { to: '/app/transactions', label: 'İşlemler', icon: '📋' },
  { to: '/app/analytics', label: 'Analitik', icon: '📊' },
  { to: '/app/qr', label: 'QR Kod', icon: '📱' },
  { to: '/app/support', label: 'Destek', icon: '🎫' },
  { to: '/app/subscription', label: 'Abonelik', icon: '💳' },
  { to: '/app/settings', label: 'Ayarlar', icon: '⚙️' },
]

function daysLeft(endMs: number): number {
  return Math.ceil((endMs - Date.now()) / 86_400_000)
}

function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-xl w-1/3" />
      <div className="h-32 bg-gray-200 rounded-2xl" />
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="h-24 bg-gray-200 rounded-2xl" />
    </div>
  )
}

function AppLayoutInner() {
  const { user } = useAuth()
  const { merchant, sub, loading } = useMerchantSub()
  useInactivityLogout()
  const [showMore, setShowMore] = useState(false)
  const [supportUnread, setSupportUnread] = useState(0)
  const isFirstSupportLoad = useRef(true)
  const notifiedIds = useRef(new Set<string>())
  const sheetRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  // "Daha" sheet erişilebilirliği: Escape ile kapanır, açılınca odak sheet'e taşınır,
  // kapanınca odak tetikleyen butona geri döner.
  useEffect(() => {
    if (!showMore) return
    const trigger = moreButtonRef.current
    sheetRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowMore(false); return }
      trapTabKey(sheetRef.current, e) // odak sheet dışına kaçmasın
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      trigger?.focus()
    }
  }, [showMore])

  useEffect(() => {
    const mid = merchant?.id
    if (!mid) { setSupportUnread(0); return }
    isFirstSupportLoad.current = true
    notifiedIds.current = new Set()
    const storageKey = `sadex_seen_replies_${mid}`
    function getSeenIds() {
      try { return new Set<string>(JSON.parse(localStorage.getItem(storageKey) ?? '[]')) }
      catch { return new Set<string>() }
    }
    const unsub = onSnapshot(
      query(collection(db, 'supportTickets'), where('merchantId', '==', mid)),
      (snap) => {
        const seenIds = getSeenIds()
        const unread = snap.docs.filter((d) => d.data().adminReply && !seenIds.has(d.id))
        setSupportUnread(unread.length)
        if (!isFirstSupportLoad.current) {
          const fresh = unread.filter((d) => !notifiedIds.current.has(d.id))
          if (fresh.length > 0) {
            fresh.forEach((d) => notifiedIds.current.add(d.id))
            toast.success('Destek talebinize yanıt geldi!', { duration: 6000, icon: '💬' })
          }
        }
        isFirstSupportLoad.current = false
      },
      console.error,
    )
    function onSeen() { setSupportUnread(0) }
    window.addEventListener('support-replies-seen', onSeen)
    return () => { unsub(); window.removeEventListener('support-replies-seen', onSeen) }
  }, [merchant?.id])

  const endMs = sub?.currentPeriodEnd?.toDate().getTime() ?? 0
  const isExpired = endMs > 0 && endMs < Date.now()
  const daysRemaining = endMs > 0 ? daysLeft(endMs) : null

  async function handleSignOut() {
    await signOut(auth)
    window.location.replace('/login')
  }

  if (!loading && merchant?.status === 'passive') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <img src="/logo.png" alt="Puaniva" className="h-9 w-auto"
              style={{ objectFit: 'contain', maxWidth: '140px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-xs">
            <p className="text-5xl mb-4">🔒</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">İşletme Askıya Alındı</h1>
            <p className="text-sm text-gray-500 mb-6">
              İşletmeniz şu an pasif durumda. Detaylı bilgi için yöneticinizle iletişime geçin.
            </p>
            <button onClick={handleSignOut}
              className="text-sm font-medium text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Top Bar */}
      <header className="bg-white/85 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app">
            <img src="/logo.png" alt="Puaniva" className="h-9 w-auto"
              style={{ objectFit: 'contain', maxWidth: '140px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 truncate max-w-[140px]">
              {merchant?.name ?? user?.email}
            </span>
          </div>
        </div>
      </header>

      {/* Abonelik durum çubuğu */}
      {!loading && sub && (
        sub.status === 'canceled' ? (
          <div className="bg-red-600 text-white text-center text-xs py-2.5 px-4 font-medium">
            Aboneliğiniz iptal edildi.{' '}
            <Link to="/app/subscription" className="underline font-bold">Yeniden abone ol →</Link>
          </div>
        ) : sub.status === 'past_due' ? (
          <div className="bg-orange-500 text-white text-center text-xs py-2.5 px-4 font-medium">
            Ödemeniz gecikmiş — lütfen aboneliğinizi yenileyin.{' '}
            <Link to="/app/subscription" className="underline font-bold">Aboneliğe git →</Link>
          </div>
        ) : isExpired ? (
          <div className="bg-red-500 text-white text-center text-xs py-2.5 px-4 font-medium">
            {sub.status === 'trialing' ? 'Deneme süreniz doldu.' : 'Aboneliğiniz sona erdi.'}{' '}
            <Link to="/app/subscription" className="underline font-bold">Plan seçin →</Link>
          </div>
        ) : daysRemaining !== null && daysRemaining <= 7 ? (
          <div className={`text-center text-xs py-2 px-4 font-medium ${daysRemaining <= 2 ? 'bg-red-500 text-white' : daysRemaining <= 4 ? 'bg-amber-400 text-amber-900' : 'bg-amber-100 text-amber-800'}`}>
            {sub.status === 'trialing' ? 'Deneme sürenizin' : 'Aboneliğinizin'} bitmesine{' '}
            <strong>{daysRemaining}</strong> gün kaldı.{' '}
            <Link to="/app/subscription" className="underline">
              {sub.status === 'trialing' ? 'Plan seçin →' : 'Aboneliği yenile →'}
            </Link>
          </div>
        ) : null
      )}

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-28 animate-fade-in-up">
        {loading ? <ContentSkeleton /> : <Outlet />}
      </main>

      {/* "Daha Fazla" slide-up sheet */}
      {showMore && (
        <>
          <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-20" onClick={() => setShowMore(false)} aria-hidden="true" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Diğer sayfalar"
            tabIndex={-1}
            className="fixed bottom-16 left-0 right-0 z-30 bg-white rounded-t-3xl border-t border-gray-100 shadow-2xl max-w-lg mx-auto pb-2 overflow-y-auto max-h-[80vh] animate-slide-up focus:outline-none"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />

            {merchant && (
              <a href={`/m/${merchant.slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50"
                onClick={() => setShowMore(false)}>
                <span className="text-xl w-8 text-center">🏪</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">İşletme Sayfam</p>
                  <p className="text-xs text-gray-400">puaniva.app/m/{merchant.slug}</p>
                </div>
                <span className="ml-auto text-gray-300 text-xs">↗</span>
              </a>
            )}

            <div className="h-px bg-gray-100 mx-5 my-1" />

            <div className="grid grid-cols-3 gap-0">
              {MORE_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-4 text-xs transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}>
                  <span className="relative text-2xl leading-none">
                    {item.icon}
                    {item.to === '/app/support' && supportUnread > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none">
                        {supportUnread}
                      </span>
                    )}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="h-px bg-gray-100 mx-5 my-1" />
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-5 py-3 text-red-500 hover:bg-red-50">
              <span className="text-xl w-8 text-center">🚪</span>
              <span className="text-sm font-medium">Çıkış Yap</span>
            </button>
          </div>
        </>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200/70 z-10 pb-safe">
        <div className="max-w-lg mx-auto flex px-1 py-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-1.5 text-[11px] gap-0.5 rounded-xl mx-0.5 transition-all ${
                  isActive ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-gray-400 active:bg-gray-50'
                }`}>
              {({ isActive }) => (
                <>
                  <span className={`text-lg leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                  <span className="leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button ref={moreButtonRef} onClick={() => setShowMore((v) => !v)}
            aria-haspopup="dialog" aria-expanded={showMore}
            className={`flex-1 flex flex-col items-center py-1.5 text-[11px] gap-0.5 rounded-xl mx-0.5 transition-all ${
              showMore ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-gray-400 active:bg-gray-50'
            }`}>
            <span className="relative text-lg leading-none">
              ⋯
              {supportUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
            <span className="leading-none">Daha</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default function AppLayout() {
  return (
    <MerchantSubProvider>
      <AppLayoutInner />
    </MerchantSubProvider>
  )
}
