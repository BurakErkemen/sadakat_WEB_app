import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { PLAN_LIMITS } from '@/lib/constants'
import { formatDate } from '@/lib/dates'
import type { Subscription } from '@/types'

const PLAN_LABELS: Record<string, string> = {
  trial: 'Deneme',
  mini: 'Mini — 99 TL/ay',
  standard: 'Standart — 199 TL/ay',
  pro: 'Pro — 399 TL/ay',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  trialing: 'Deneme',
  past_due: 'Ödeme Gecikmiş',
  canceled: 'İptal Edildi',
}

export default function SubscriptionPage() {
  const { merchant } = useMerchant()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchant) return
    getDoc(doc(db, 'merchants', merchant.id, 'subscription', 'current'))
      .then((snap) => { if (snap.exists()) setSub(snap.data() as Subscription) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [merchant?.id])

  const plan = sub?.plan ?? 'trial'
  const limits = PLAN_LIMITS[plan]

  if (loading) return <div className="h-48 bg-gray-200 rounded-2xl animate-pulse" />

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Abonelik</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Mevcut Plan</p>
            <p className="font-bold text-gray-900 text-lg">{PLAN_LABELS[plan] ?? plan}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${sub?.status === 'active' || sub?.status === 'trialing' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {STATUS_LABELS[sub?.status ?? 'trialing'] ?? sub?.status}
          </span>
        </div>
        {sub && (
          <div className="text-sm text-gray-500 space-y-1">
            <p>Dönem: {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <p className="font-semibold text-gray-900">Plan Limitleri</p>
        <div className="space-y-2 text-sm">
          <LimitRow label="Maksimum Müşteri" value={limits.maxCustomers === Infinity ? 'Sınırsız' : limits.maxCustomers.toString()} />
          <LimitRow label="Aylık İşlem" value={limits.maxMonthlyTransactions === Infinity ? 'Sınırsız' : limits.maxMonthlyTransactions.toString()} />
          <LimitRow label="Kampanya" value={limits.maxCampaigns === Infinity ? 'Sınırsız' : limits.maxCampaigns.toString()} />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Plan değişikliği için lütfen destek ekibiyle iletişime geçin. Abonelik değişikliği yalnızca platform yöneticisi tarafından yapılabilir.
      </div>

      <div className="space-y-3">
        {(['mini', 'standard', 'pro'] as const).map((p) => (
          <div key={p} className={`rounded-xl border p-4 ${p === plan ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">{PLAN_LABELS[p]}</p>
              {p === plan && <span className="text-xs text-indigo-600 font-medium">Mevcut</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {PLAN_LIMITS[p].maxCustomers === Infinity ? 'Sınırsız' : PLAN_LIMITS[p].maxCustomers} müşteri ·{' '}
              {PLAN_LIMITS[p].maxMonthlyTransactions === Infinity ? 'Sınırsız' : PLAN_LIMITS[p].maxMonthlyTransactions} işlem/ay
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
