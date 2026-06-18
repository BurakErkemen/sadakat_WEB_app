import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import type { Transaction, Campaign, Membership } from '@/types'

interface WeekData {
  label: string
  stamps: number
  redeems: number
}

interface CampaignStat {
  campaign: Campaign
  totalMembers: number
  rewardPending: number
  avgFill: number
}

function ProLock() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Gelişmiş Analitik</h1>
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-10 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="font-bold text-gray-900 text-lg mb-2">Pro Plan Gerekli</p>
        <p className="text-sm text-gray-500 mb-6">Gelişmiş analitik özelliği sadece Pro planda kullanılabilir.</p>
        <Link to="/app/subscription"
          className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
          Pro'ya Geç →
        </Link>
      </div>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-gray-200 rounded-2xl" />
        <div className="h-20 bg-gray-200 rounded-2xl" />
      </div>
      <div className="h-52 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )
}

export default function AnalyticsPage() {
  const { merchant, features } = useMerchantSub()
  const [period, setPeriod] = useState<4 | 12>(4)
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([])
  const [totalStamps, setTotalStamps] = useState(0)
  const [totalRedeems, setTotalRedeems] = useState(0)
  const [newCustomers, setNewCustomers] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchant) return
    setLoading(true)

    async function load() {
      try {
        const now = Date.now()
        const cutoff = new Date(now - period * 7 * 86_400_000)

        // İşlemleri çek
        const txSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'transactions'),
          where('createdAt', '>=', Timestamp.fromDate(cutoff)),
          orderBy('createdAt', 'desc')
        ))
        const transactions = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))

        // Haftalık gruplama — 0 = bu hafta, 1 = geçen hafta …
        const buckets = new Map<number, { stamps: number; redeems: number }>()
        for (let i = 0; i < period; i++) buckets.set(i, { stamps: 0, redeems: 0 })

        transactions.forEach((tx) => {
          const daysAgo = Math.floor((now - tx.createdAt.toDate().getTime()) / 86_400_000)
          const weekIdx = Math.min(Math.floor(daysAgo / 7), period - 1)
          const b = buckets.get(weekIdx)!
          if (tx.type === 'stamp_add') b.stamps++
          else if (tx.type === 'reward_redeem') b.redeems++
        })

        // Soldan sağa: eskiden yeniye
        const weekData: WeekData[] = []
        for (let i = period - 1; i >= 0; i--) {
          const weekStart = new Date(now - (i + 1) * 7 * 86_400_000)
          const label = weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
          weekData.push({ label, ...buckets.get(i)! })
        }
        setWeeks(weekData)
        setTotalStamps(transactions.filter((t) => t.type === 'stamp_add').length)
        setTotalRedeems(transactions.filter((t) => t.type === 'reward_redeem').length)

        // Dönem içinde yeni müşteri sayısı
        const custSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'customers'),
          where('createdAt', '>=', Timestamp.fromDate(cutoff))
        ))
        setNewCustomers(custSnap.size)

        // Kampanya performansı
        const campSnap = await getDocs(collection(db, 'merchants', merchant!.id, 'campaigns'))
        const campaigns = campSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign))

        const stats: CampaignStat[] = []
        for (const c of campaigns) {
          const mSnap = await getDocs(query(
            collection(db, 'merchants', merchant!.id, 'memberships'),
            where('campaignId', '==', c.id), where('status', '==', 'active')
          ))
          const mems = mSnap.docs.map((d) => d.data() as Membership)
          const total = mems.length
          const pending = mems.filter((m) => m.currentStamps >= c.requiredStamps).length
          const avgFill = total > 0
            ? Math.round(
                mems.reduce((s, m) => s + Math.min(m.currentStamps, c.requiredStamps), 0)
                / total / c.requiredStamps * 100
              )
            : 0
          stats.push({ campaign: c, totalMembers: total, rewardPending: pending, avgFill })
        }
        // Aktif olanlar önce, sonra üye sayısına göre
        stats.sort((a, b) => {
          if (a.campaign.status !== b.campaign.status)
            return a.campaign.status === 'active' ? -1 : 1
          return b.totalMembers - a.totalMembers
        })
        setCampaignStats(stats)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [merchant, period])

  if (!features.advancedAnalytics) return <ProLock />

  const maxBar = Math.max(1, ...weeks.map((w) => Math.max(w.stamps, w.redeems)))

  return (
    <div className="space-y-5">
      {/* Başlık + dönem seçici */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Gelişmiş Analitik</h1>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-medium">
          <button onClick={() => setPeriod(4)}
            className={`px-3 py-1.5 transition-colors ${period === 4 ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            4 Hafta
          </button>
          <button onClick={() => setPeriod(12)}
            className={`px-3 py-1.5 transition-colors ${period === 12 ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            12 Hafta
          </button>
        </div>
      </div>

      {loading ? <SkeletonLoader /> : (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-3.5 text-center">
              <p className="text-xs text-green-600 font-medium">Damga</p>
              <p className="text-2xl font-bold text-green-800 mt-0.5">{totalStamps}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3.5 text-center">
              <p className="text-xs text-purple-600 font-medium">Ödül</p>
              <p className="text-2xl font-bold text-purple-800 mt-0.5">{totalRedeems}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 text-center">
              <p className="text-xs text-blue-600 font-medium">Yeni Müşteri</p>
              <p className="text-2xl font-bold text-blue-800 mt-0.5">{newCustomers}</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 mb-5">Haftalık Trend</p>
            <div className="flex items-end gap-1 h-36">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <div className="w-full flex items-end gap-px h-28">
                    {/* Damga bar */}
                    <div className="flex-1 relative group">
                      <div
                        className="w-full bg-green-400 hover:bg-green-500 rounded-t-sm transition-all"
                        style={{ height: `${(w.stamps / maxBar) * 100}%`, minHeight: w.stamps > 0 ? '3px' : '0' }}
                      />
                      {w.stamps > 0 && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                          {w.stamps} damga
                        </div>
                      )}
                    </div>
                    {/* Ödül bar */}
                    <div className="flex-1 relative group">
                      <div
                        className="w-full bg-purple-400 hover:bg-purple-500 rounded-t-sm transition-all"
                        style={{ height: `${(w.redeems / maxBar) * 100}%`, minHeight: w.redeems > 0 ? '3px' : '0' }}
                      />
                      {w.redeems > 0 && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                          {w.redeems} ödül
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center leading-tight truncate w-full px-0.5">
                    {w.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Damga
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-purple-400 inline-block" /> Ödül Kullanımı
              </span>
            </div>
          </div>

          {/* Kampanya performansı */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 mb-4">Kampanya Performansı</p>
            {campaignStats.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Henüz kampanya yok</p>
            ) : (
              <div className="space-y-5">
                {campaignStats.map(({ campaign, totalMembers, rewardPending, avgFill }) => (
                  <div key={campaign.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{campaign.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {totalMembers} üye
                          {rewardPending > 0 && (
                            <span className="text-amber-600 font-medium"> · {rewardPending} ödül hakkı bekliyor</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                        campaign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {campaign.status === 'active' ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full transition-all"
                          style={{ width: `${avgFill}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8 text-right">%{avgFill}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Ortalama kart doluluk oranı</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
