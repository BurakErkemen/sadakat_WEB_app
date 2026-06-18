import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatDateTime } from '@/lib/dates'
import type { Transaction, Customer, Campaign } from '@/types'

const TX_ICON: Record<string, string> = {
  stamp_add: '✅',
  reward_redeem: '🎁',
  manual_adjustment: '✏️',
}

const TX_LABEL: Record<string, string> = {
  stamp_add: 'Damga / Puan',
  reward_redeem: 'Ödül Kullandırma',
  manual_adjustment: 'Manuel Düzeltme',
}

const TX_COLOR: Record<string, string> = {
  stamp_add: 'text-green-700',
  reward_redeem: 'text-purple-700',
  manual_adjustment: 'text-amber-700',
}

const TX_BG: Record<string, string> = {
  stamp_add: 'bg-green-50 border-green-100',
  reward_redeem: 'bg-purple-50 border-purple-100',
  manual_adjustment: 'bg-amber-50 border-amber-100',
}

type EnrichedTx = Transaction & {
  customerName?: string
  campaignName?: string
  campaignType?: 'stamp' | 'points'
}

export default function TransactionsPage() {
  const { merchant, loading: mLoading } = useMerchant()
  const [transactions, setTransactions] = useState<EnrichedTx[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchant) return

    async function load() {
      setLoading(true)
      try {
        // Tüm verileri paralel çek
        const [txSnap, custSnap, campSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'merchants', merchant!.id, 'transactions'),
            orderBy('createdAt', 'desc'),
            limit(200),
          )),
          getDocs(collection(db, 'merchants', merchant!.id, 'customers')),
          getDocs(collection(db, 'merchants', merchant!.id, 'campaigns')),
        ])

        const custMap = new Map<string, Customer>()
        custSnap.docs.forEach((d) => custMap.set(d.id, { id: d.id, ...d.data() } as Customer))

        const campMap = new Map<string, Campaign>()
        campSnap.docs.forEach((d) => campMap.set(d.id, { id: d.id, ...d.data() } as Campaign))

        const enriched: EnrichedTx[] = txSnap.docs.map((d) => {
          const tx = { id: d.id, ...d.data() } as Transaction
          const cust = custMap.get(tx.customerId)
          const camp = campMap.get(tx.campaignId)
          return {
            ...tx,
            customerName: cust?.fullName,
            campaignName: camp?.name,
            campaignType: camp?.type,
          }
        })

        setTransactions(enriched)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id])

  if (mLoading || loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-40" />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">İşlem Geçmişi</h1>
        <span className="text-xs text-gray-400">Son 200 işlem</span>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-gray-400">Henüz işlem yok</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.map((tx) => {
          const isPoints = tx.campaignType === 'points'
          const unit = isPoints ? 'puan' : 'damga'
          const colorClass = TX_COLOR[tx.type] ?? 'text-gray-600'
          const bgClass = TX_BG[tx.type] ?? 'bg-gray-50 border-gray-100'

          return (
            <div key={tx.id} className={`rounded-xl border p-4 ${bgClass}`}>
              {/* Üst satır: tip + miktar + tarih */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0">{TX_ICON[tx.type] ?? '•'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${colorClass}`}>
                        {TX_LABEL[tx.type] ?? tx.type}
                      </span>
                      {tx.type !== 'reward_redeem' && (
                        <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount} {unit}
                        </span>
                      )}
                      {tx.type === 'reward_redeem' && (
                        <span className="text-sm text-purple-700 font-bold">−{Math.abs(tx.amount)} {unit}</span>
                      )}
                    </div>
                    {/* Müşteri adı */}
                    {tx.customerName && (
                      <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{tx.customerName}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(tx.createdAt)}</span>
              </div>

              {/* Alt satır: kampanya + tutar + not */}
              <div className="mt-2 pl-8 space-y-0.5">
                {tx.campaignName && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="opacity-50">{isPoints ? '🏆' : '✅'}</span>
                    {tx.campaignName}
                  </p>
                )}
                {tx.purchaseAmount != null && tx.purchaseAmount > 0 && (
                  <p className="text-xs text-gray-500">
                    Alışveriş: <span className="font-medium text-gray-700">₺{tx.purchaseAmount.toFixed(2)}</span>
                  </p>
                )}
                {tx.note && (
                  <p className="text-xs text-gray-400 italic">{tx.note}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-center text-gray-300 pb-4">İşlemler değiştirilemez (audit log)</p>
    </div>
  )
}
