import { useEffect, useState } from 'react'
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import type { Campaign, Customer, Membership, Transaction } from '@/types'
import { buildAnalyticsSnapshot, type AnalyticsSnapshot } from '@/features/analytics/analyticsModel'

function number(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="border-l-2 border-gray-200 pl-3"><p className="text-[11px] text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p><p className="text-[11px] text-gray-400">{helper}</p></div>
}

export default function AdminMerchantReport({ merchantId }: { merchantId: string }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const cutoff = new Date(now.getTime() - 24 * 7 * 86_400_000)
    setLoading(true)
    setError(false)

    void Promise.all([
      getDocs(query(collection(db, 'merchants', merchantId, 'transactions'), where('createdAt', '>=', Timestamp.fromDate(cutoff)))),
      getDocs(query(collection(db, 'merchants', merchantId, 'customers'), where('createdAt', '>=', Timestamp.fromDate(cutoff)))),
      getDocs(collection(db, 'merchants', merchantId, 'campaigns')),
      getDocs(collection(db, 'merchants', merchantId, 'memberships')),
    ]).then(([txSnap, customerSnap, campaignSnap, membershipSnap]) => {
      if (cancelled) return
      setSnapshot(buildAnalyticsSnapshot({
        now, periodWeeks: 12,
        transactions: txSnap.docs.map((item) => {
          const tx = { id: item.id, ...item.data() } as Transaction
          return { ...tx, purchaseAmount: tx.purchaseAmount ?? null, createdAt: tx.createdAt.toDate() }
        }),
        customers: customerSnap.docs.map((item) => {
          const customer = { id: item.id, ...item.data() } as Customer
          return { id: customer.id, createdAt: customer.createdAt.toDate() }
        }),
        campaigns: campaignSnap.docs.map((item) => {
          const campaign = { id: item.id, ...item.data() } as Campaign
          return { id: campaign.id, name: campaign.name, type: campaign.type, requiredStamps: campaign.requiredStamps, status: campaign.status }
        }),
        memberships: membershipSnap.docs.map((item) => {
          const membership = { id: item.id, ...item.data() } as Membership
          return { campaignId: membership.campaignId, customerId: membership.customerId, currentStamps: membership.currentStamps, status: membership.status }
        }),
      }))
    }).catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [merchantId])

  if (loading) return <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
  if (error || !snapshot) return <p className="text-xs text-red-600 py-3">İşletme raporu yüklenemedi.</p>

  const stamp = snapshot.programs.stamp.current
  const points = snapshot.programs.points.current
  return (
    <section className="border-t border-gray-200 pt-4 space-y-4" aria-label="İşletme performans raporu">
      <div><h3 className="text-sm font-semibold text-gray-900">Son 12 hafta performansı</h3><p className="text-xs text-gray-500 mt-0.5">Damga ve puan programları ayrı hesaplanır</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Aktif müşteri" value={number(snapshot.current.activeCustomers)} helper={`%${snapshot.current.repeatRate} tekrar oranı`} />
        <Metric label="Yeni müşteri" value={number(snapshot.current.newCustomers)} helper="Son 12 haftada" />
        <Metric label="Damga" value={number(stamp.earnedUnits)} helper={`${stamp.transactionEvents} işlem · ${stamp.redemptions} ödül`} />
        <Metric label="Puan" value={number(points.earnedUnits)} helper={`${points.transactionEvents} işlem · ${points.redemptions} ödül`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3"><p className="font-semibold text-emerald-900">Damga programları</p><p className="text-emerald-800 mt-1">{stamp.activeCampaigns} aktif kampanya · {stamp.activeMembers} üye · {stamp.rewardReady} ödüle hazır</p></div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3"><p className="font-semibold text-blue-900">Puan programları</p><p className="text-blue-800 mt-1">{points.activeCampaigns} aktif kampanya · {points.activeMembers} üye · {points.rewardReady} ödüle hazır</p></div>
      </div>
    </section>
  )
}
