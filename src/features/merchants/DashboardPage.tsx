import { useEffect, useState } from 'react'
import { collection, getDocs, getCountFromServer, query, where, Timestamp, doc, getDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { startOfMonth } from '@/lib/dates'
import { brandStyle, onBrandClasses } from '@/lib/utils'

export default function DashboardPage() {
  const { merchant, sub, limits, loading } = useMerchantSub()
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [monthlyTx, setMonthlyTx] = useState<number | null>(null)
  const [nearingReward, setNearingReward] = useState<number | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!merchant) return
    setLoadError(false)
    // Yeniden yüklemede eski değerler yerine iskelet gösterilsin
    setCustomerCount(null); setMonthlyTx(null); setNearingReward(null)

    // Aggregate count: dokümanları indirmeden sunucuda sayar (büyük listelerde hızlı açılış)
    getCountFromServer(collection(db, 'merchants', merchant.id, 'customers'))
      .then((snap) => setCustomerCount(snap.data().count))
      .catch((err) => { console.error(err); setLoadError(true) })

    const monthStart = startOfMonth()
    getCountFromServer(
      query(
        collection(db, 'merchants', merchant.id, 'transactions'),
        where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      )
    )
      .then((snap) => setMonthlyTx(snap.data().count))
      .catch((err) => { console.error(err); setLoadError(true) })

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
        .catch((err) => { console.error(err); setLoadError(true) })
    } else {
      setNearingReward(0)
    }
  }, [merchant, reloadKey])

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
  const onBrand = onBrandClasses(merchant.brandColor ?? '#6366f1', merchant.brandColor2)

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">Bazı veriler yüklenemedi.</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-sm font-semibold text-red-700 underline shrink-0"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Kompakt işletme başlığı — asıl alan günlük aksiyonlara bırakıldı */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={cardStyle}>
          <span className={`text-lg font-black ${onBrand.text}`}>
            {merchant.name[0]?.toLocaleUpperCase('tr')}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-gray-900 leading-tight truncate">{merchant.name}</h1>
          <a
            href={`/m/${merchant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 font-medium hover:underline"
          >
            🏪 İşletme Sayfam ↗
          </a>
        </div>
      </div>

      {/* Birincil aksiyonlar — esnafın günlük işi en üstte, tek dokunuş */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/app/stamp"
          className="tap-scale bg-green-600 hover:bg-green-700 text-white rounded-2xl py-5 flex flex-col items-center gap-1.5 font-bold shadow-lg shadow-green-600/20"
        >
          <span className="text-2xl">✅</span>
          Damga Ekle
        </Link>
        <Link
          to="/app/redeem"
          className="tap-scale bg-purple-600 hover:bg-purple-700 text-white rounded-2xl py-5 flex flex-col items-center gap-1.5 font-bold shadow-lg shadow-purple-600/20"
        >
          <span className="text-2xl">🎁</span>
          Ödül Kullandır
        </Link>
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
          value={customerCount}
          sub={`/ ${limits.maxCustomers === Infinity ? '∞' : limits.maxCustomers}`}
          warn={customerCount !== null && limits.maxCustomers !== Infinity && customerCount >= limits.maxCustomers * 0.9}
        />
        <StatCard
          label="Bu Ay İşlem"
          value={monthlyTx}
          sub={`/ ${limits.maxMonthlyTransactions === Infinity ? '∞' : limits.maxMonthlyTransactions}`}
          warn={monthlyTx !== null && limits.maxMonthlyTransactions !== Infinity && monthlyTx >= limits.maxMonthlyTransactions * 0.9}
        />
        {/* Tıklanınca doğrudan ödül kullandırmaya gider */}
        <Link
          to="/app/redeem"
          className="col-span-2 tap-scale bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Ödülü Hazır veya Yaklaşan</p>
            {nearingReward === null ? (
              <div className="h-8 w-20 bg-amber-100 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold text-amber-800 mt-1">
                {nearingReward}
                <span className="text-sm font-normal text-amber-600 ml-1.5">müşteri</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-3xl">🎯</span>
            <span className="text-amber-400 text-xl font-bold">›</span>
          </div>
        </Link>
      </div>

      {/* Hızlı erişim — birincil aksiyonlar yukarı taşındı, burada ikincil işler var */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/app/customers/new" icon="👤" label="Yeni Müşteri" color="bg-blue-50 text-blue-700" />
        <QuickLink to="/app/campaigns" icon="🎯" label="Kampanyalar" color="bg-amber-50 text-amber-700" />
        <QuickLink to="/app/qr" icon="📱" label="QR Kod" color="bg-indigo-50 text-indigo-700" />
        <QuickLink to="/app/analytics" icon="📊" label="Analitik" color="bg-teal-50 text-teal-700" />
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

    </div>
  )
}

function StatCard({ label, value, sub, warn }: { label: string; value: number | null; sub: string; warn?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${warn ? 'border-amber-300' : 'border-gray-100'}`}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      {value === null ? (
        <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse mt-1" />
      ) : (
        <p className={`text-2xl font-bold mt-1 ${warn ? 'text-amber-600' : 'text-gray-900'}`}>
          {value}
          <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>
        </p>
      )}
    </div>
  )
}

function QuickLink({ to, icon, label, color }: { to: string; icon: string; label: string; color: string }) {
  return (
    <Link to={to} className={`${color} tap-scale rounded-2xl p-4 flex items-center gap-3 font-semibold text-sm shadow-sm`}>
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
