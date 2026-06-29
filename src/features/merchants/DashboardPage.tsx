import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { startOfMonth } from '@/lib/dates'
import { brandStyle } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const { merchant, sub, limits, loading } = useMerchantSub()
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [monthlyTx, setMonthlyTx] = useState<number | null>(null)
  const [nearingReward, setNearingReward] = useState<number | null>(null)

  useEffect(() => {
    if (!merchant) return

    getDocs(collection(db, 'merchants', merchant.id, 'customers'))
      .then((snap) => setCustomerCount(snap.size))
      .catch(console.error)

    const monthStart = startOfMonth()
    getDocs(
      query(
        collection(db, 'merchants', merchant.id, 'transactions'),
        where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      )
    )
      .then((snap) => setMonthlyTx(snap.size))
      .catch(console.error)

    const campaignIds = merchant.activeCampaignIds?.length
      ? merchant.activeCampaignIds
      : merchant.activeCampaignId ? [merchant.activeCampaignId] : []

    if (campaignIds.length > 0) {
      Promise.all(campaignIds.map((id) => getDoc(doc(db, 'merchants', merchant.id, 'campaigns', id))))
        .then(async (snaps) => {
          const campaigns = snaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, requiredStamps: (s.data()['requiredStamps'] as number) ?? 0 }))

          const counts = await Promise.all(
            campaigns.map(async (c) => {
              const threshold = Math.max(1, c.requiredStamps - 1)
              const mSnap = await getDocs(
                query(collection(db, 'merchants', merchant.id, 'memberships'), where('campaignId', '==', c.id))
              )
              return mSnap.docs.filter((d) => {
                const stamps = (d.data()['currentStamps'] as number) ?? 0
                // 1 eksik veya zaten hakkı var (ödül almadan devam etmiş)
                return d.data()['status'] === 'active' && stamps >= threshold
              }).length
            })
          )
          setNearingReward(counts.reduce((a, b) => a + b, 0))
        })
        .catch(console.error)
    } else {
      setNearingReward(0)
    }
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

  const plan = sub?.plan ?? 'trial'
  const subscription = sub

  const cardStyle = brandStyle(merchant.brandColor ?? '#6366f1', merchant.brandColor2)

  return (
    <div className="space-y-5">
      {/* Mağaza kimlik kartı */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black/20 backdrop-blur-sm flex items-center justify-center shrink-0 overflow-hidden relative">
              <span className="text-2xl font-black text-white">
                {merchant.name[0]?.toLocaleUpperCase('tr')}
              </span>
              {merchant.logoUrl && (
                <img
                  src={merchant.logoUrl}
                  alt={merchant.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  onError={(e) => e.currentTarget.remove()}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold text-white leading-tight truncate">{merchant.name}</h1>
              <p className="text-sm text-white/75 mt-0.5">{merchant.sector}</p>
              <p className="text-xs text-white/55">{merchant.city}, {merchant.district}</p>
            </div>
          </div>

          <a
            href={`/m/${merchant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-between bg-black/15 hover:bg-black/25 transition-colors rounded-xl px-3 py-2.5"
          >
            <span className="text-sm font-medium text-white">🏪 İşletme Sayfam</span>
            <span className="text-xs text-white/60">puaniva.app/m/{merchant.slug} ↗</span>
          </a>
        </div>
      </div>

      {/* Plan uyarısı */}
      {plan === 'trial' && subscription && (() => {
        const msLeft = subscription.currentPeriodEnd.toDate().getTime() - Date.now()
        const daysLeft = Math.ceil(msLeft / 86_400_000)
        const expired = msLeft <= 0
        return (
          <div className={`rounded-xl p-4 text-sm ${expired ? 'bg-red-50 border border-red-200 text-red-700' : daysLeft <= 3 ? 'bg-orange-50 border border-orange-200 text-orange-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
            {expired ? (
              <>Deneme süreniz sona erdi. Panele erişmek için{' '}<Link to="/app/subscription" className="font-semibold underline">bir plan seçin</Link>.</>
            ) : (
              <>
                Deneme sürümündesiniz — <strong>{daysLeft} gün</strong> kaldı.{' '}
                <Link to="/app/subscription" className="font-semibold underline">Plan seçin →</Link>
              </>
            )}
          </div>
        )
      })()}

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
        <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Ödül Hakkı / Yakın</p>
            <p className="text-2xl font-bold text-amber-800 mt-1">
              {nearingReward ?? '…'}
              <span className="text-sm font-normal text-amber-600 ml-1.5">müşteri</span>
            </p>
          </div>
          <div className="text-3xl">🎯</div>
        </div>
      </div>

      {/* Hızlı erişim */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/app/stamp" icon="✅" label="Damga Ekle" color="bg-green-50 text-green-700" />
        <QuickLink to="/app/redeem" icon="🎁" label="Ödül Kullandır" color="bg-purple-50 text-purple-700" />
        <QuickLink to="/app/customers/new" icon="👤" label="Yeni Müşteri" color="bg-blue-50 text-blue-700" />
        <QuickLink to="/app/campaigns" icon="🎯" label="Kampanyalar" color="bg-amber-50 text-amber-700" />
      </div>

      {/* Aktif kampanyalar */}
      {(() => {
        const ids = merchant.activeCampaignIds && merchant.activeCampaignIds.length > 0
          ? merchant.activeCampaignIds
          : merchant.activeCampaignId ? [merchant.activeCampaignId] : []
        if (ids.length === 0) return null
        return (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
              Aktif Kampanya{ids.length > 1 ? 'lar' : ''}
            </p>
            {ids.map((id) => (
              <ActiveCampaignCard key={id} merchantId={merchant.id} campaignId={id} />
            ))}
          </div>
        )
      })()}

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
  const [data, setData] = useState<{ name: string; type: string } | null>(null)
  useEffect(() => {
    getDoc(doc(db, 'merchants', merchantId, 'campaigns', campaignId))
      .then((snap) => {
        if (snap.exists()) setData({ name: snap.data()['name'] as string, type: snap.data()['type'] as string })
      })
      .catch(console.error)
  }, [merchantId, campaignId])
  if (!data) return null
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-sm">{data.type === 'points' ? '🏆' : '✅'}</span>
      <p className="text-sm font-semibold text-gray-900">{data.name}</p>
    </div>
  )
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
