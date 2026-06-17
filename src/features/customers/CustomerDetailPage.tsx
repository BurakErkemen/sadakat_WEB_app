import { useEffect, useState } from 'react'
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatPhone } from '@/lib/phone'
import { formatDate, formatDateTime } from '@/lib/dates'
import type { Customer, Membership, Campaign, Transaction } from '@/types'

const TX_LABELS: Record<string, string> = {
  stamp_add: 'Damga / Puan',
  reward_redeem: 'Ödül',
  manual_adjustment: 'Düzeltme',
}
const TX_COLORS: Record<string, string> = {
  stamp_add: 'bg-green-100 text-green-700',
  reward_redeem: 'bg-purple-100 text-purple-700',
  manual_adjustment: 'bg-amber-100 text-amber-700',
}

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const { merchant } = useMerchant()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchant || !customerId) return

    async function load() {
      setLoading(true)
      try {
        const cSnap = await getDoc(doc(db, 'merchants', merchant!.id, 'customers', customerId!))
        if (!cSnap.exists()) { navigate('/app/customers'); return }
        const cust = { id: cSnap.id, ...cSnap.data() } as Customer
        setCustomer(cust)

        // Aktif üyelik
        const mSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'memberships'),
          where('customerId', '==', customerId), where('status', '==', 'active')
        ))
        if (!mSnap.empty) {
          const mem = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() } as Membership
          setMembership(mem)

          // Merchant'ın şu anki aktif kampanyasını göster
          const activeCampId = merchant!.activeCampaignId ?? mem.campaignId
          const campSnap = await getDoc(doc(db, 'merchants', merchant!.id, 'campaigns', activeCampId))
          if (campSnap.exists()) setCampaign({ id: campSnap.id, ...campSnap.data() } as Campaign)
        }

        // İşlem geçmişi
        const txSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'transactions'),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc')
        ))
        setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [merchant?.id, customerId])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32" />
      <div className="h-28 bg-gray-200 rounded-2xl" />
      <div className="h-40 bg-gray-200 rounded-2xl" />
    </div>
  )

  if (!customer) return null

  const isPoints = campaign?.type === 'points'
  const label = isPoints ? 'puan' : 'damga'
  const progress = membership && campaign
    ? Math.min(100, (membership.currentStamps / campaign.requiredStamps) * 100)
    : 0
  const hasReward = membership && campaign
    ? membership.currentStamps >= campaign.requiredStamps
    : false

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">Müşteri Detayı</h1>
      </div>

      {/* Müşteri bilgisi */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-gray-900">{customer.fullName}</p>
            <p className="text-gray-500">{formatPhone(customer.normalizedPhone)}</p>
            {customer.note && <p className="text-sm text-gray-400 mt-1">{customer.note}</p>}
          </div>
          <p className="text-xs text-gray-400">{formatDate(customer.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/app/stamp"
            state={{ searchPhone: customer.normalizedPhone }}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center"
          >
            ✅ {isPoints ? 'Puan Ekle' : 'Damga Ekle'}
          </Link>
          <Link
            to="/app/redeem"
            state={{ searchPhone: customer.normalizedPhone }}
            className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center"
          >
            🎁 Ödül Kullandır
          </Link>
        </div>
      </div>

      {/* Üyelik / Kart durumu */}
      {membership && campaign ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">{campaign.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isPoints ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {isPoints ? '🏆 Puan' : '✅ Damga'}
            </span>
          </div>

          {/* İlerleme çubuğu */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{membership.currentStamps} {label}</span>
              <span className="text-gray-400">Hedef: {campaign.requiredStamps}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isPoints ? 'bg-purple-500' : 'bg-indigo-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {hasReward && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-semibold">
              🎉 Ödül hakkı mevcut! — {campaign.rewardDescription}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Toplam Kazanılan</p>
              <p className="font-bold text-gray-900">{membership.totalEarnedStamps}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Mevcut</p>
              <p className="font-bold text-gray-900">{membership.currentStamps}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Kullanılan Ödül</p>
              <p className="font-bold text-gray-900">{membership.totalRedeemedRewards}</p>
            </div>
          </div>

          <div className="text-xs text-gray-400 space-y-0.5">
            <p>Kart linki: <span className="font-mono">/c/{membership.cardToken.slice(0, 12)}…</span></p>
            <p>Oluşturulma: {formatDate(membership.createdAt)}</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Bu müşterinin aktif üyeliği yok.
        </div>
      )}

      {/* İşlem geçmişi */}
      <div>
        <p className="font-semibold text-gray-900 mb-3">İşlem Geçmişi ({transactions.length})</p>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Henüz işlem yok</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TX_COLORS[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TX_LABELS[tx.type] ?? tx.type}
                    </span>
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-700' : 'text-purple-700'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} {label}
                    </span>
                    {tx.purchaseAmount != null && (
                      <span className="text-xs text-gray-400">{tx.purchaseAmount} TL</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</span>
                </div>
                {tx.note && <p className="text-xs text-gray-400 mt-1">{tx.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
