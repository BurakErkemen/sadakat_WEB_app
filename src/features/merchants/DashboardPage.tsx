import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchant } from '@/hooks/useMerchant'
import { startOfMonth } from '@/lib/dates'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Subscription } from '@/types'

export default function DashboardPage() {
  const { user } = useAuth()
  const { merchant, loading } = useMerchant()
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [monthlyTx, setMonthlyTx] = useState<number | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)

  useEffect(() => {
    if (!merchant) return

    // Müşteri sayısı
    getDocs(collection(db, 'merchants', merchant.id, 'customers'))
      .then((snap) => setCustomerCount(snap.size))
      .catch(console.error)

    // Bu ayki işlem sayısı
    const monthStart = startOfMonth()
    getDocs(
      query(
        collection(db, 'merchants', merchant.id, 'transactions'),
        where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      )
    )
      .then((snap) => setMonthlyTx(snap.size))
      .catch(console.error)

    // Abonelik — list yasak, get ile doğrudan 'current' dökümanını çek
    getDoc(doc(db, 'merchants', merchant.id, 'subscription', 'current'))
      .then((snap) => { if (snap.exists()) setSubscription(snap.data() as Subscription) })
      .catch(console.error)
  }, [merchant])

  if (loading) return <LoadingSkeleton />
  if (!merchant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Henüz bir işletmeniz yok.</p>
        <Link to="/onboarding" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold">
          İşletme Oluştur
        </Link>
      </div>
    )
  }

  const plan = subscription?.plan ?? 'trial'
  const limits = PLAN_LIMITS[plan]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{merchant.name}</h1>
        <p className="text-sm text-gray-500">{merchant.sector} · {merchant.city}, {merchant.district}</p>
      </div>

      {/* Plan uyarısı */}
      {plan === 'trial' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Deneme sürümündesiniz. Abonelik planı için{' '}
          <Link to="/app/subscription" className="font-semibold underline">buraya tıklayın</Link>.
        </div>
      )}

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Müşteri"
          value={customerCount ?? '…'}
          sub={`/ ${limits.maxCustomers === Infinity ? '∞' : limits.maxCustomers}`}
          warn={customerCount !== null && limits.maxCustomers !== Infinity && customerCount >= limits.maxCustomers * 0.9}
        />
        <StatCard
          label="Bu Ay İşlem"
          value={monthlyTx ?? '…'}
          sub={`/ ${limits.maxMonthlyTransactions === Infinity ? '∞' : limits.maxMonthlyTransactions}`}
          warn={monthlyTx !== null && limits.maxMonthlyTransactions !== Infinity && monthlyTx >= limits.maxMonthlyTransactions * 0.9}
        />
      </div>

      {/* Hızlı erişim */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/app/stamp" icon="✅" label="Damga Ekle" color="bg-green-50 text-green-700" />
        <QuickLink to="/app/redeem" icon="🎁" label="Ödül Kullandır" color="bg-purple-50 text-purple-700" />
        <QuickLink to="/app/customers/new" icon="👤" label="Yeni Müşteri" color="bg-blue-50 text-blue-700" />
        <QuickLink to="/app/campaigns" icon="🎯" label="Kampanyalar" color="bg-amber-50 text-amber-700" />
      </div>

      {/* İşletme sayfası önizleme */}
      <a
        href={`/m/${merchant.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between bg-white rounded-xl border border-indigo-100 px-4 py-3 hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🏪</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">İşletme Sayfam</p>
            <p className="text-xs text-gray-400">/m/{merchant.slug}</p>
          </div>
        </div>
        <span className="text-indigo-400 text-sm">↗ Görüntüle</span>
      </a>

      {/* Aktif kampanya */}
      {merchant.activeCampaignId && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Aktif Kampanya</p>
          <ActiveCampaignCard merchantId={merchant.id} campaignId={merchant.activeCampaignId} />
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-gray-400">Giriş: {user?.email}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, warn }: { label: string; value: number | string; sub: string; warn?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${warn ? 'border-amber-300' : 'border-gray-100'}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${warn ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
        <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>
      </p>
    </div>
  )
}

function QuickLink({ to, icon, label, color }: { to: string; icon: string; label: string; color: string }) {
  return (
    <Link to={to} className={`${color} rounded-xl p-4 flex items-center gap-3 font-medium text-sm`}>
      <span className="text-xl">{icon}</span>
      {label}
    </Link>
  )
}

function ActiveCampaignCard({ merchantId, campaignId }: { merchantId: string; campaignId: string }) {
  const [name, setName] = useState('')
  useEffect(() => {
    getDoc(doc(db, 'merchants', merchantId, 'campaigns', campaignId))
      .then((snap) => { if (snap.exists()) setName(snap.data()['name'] as string) })
      .catch(console.error)
  }, [merchantId, campaignId])
  if (!name) return null
  return <p className="text-sm font-semibold text-gray-900 mt-1">{name}</p>
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-48" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-gray-200 rounded-xl" />
        <div className="h-20 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
