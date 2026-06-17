import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatDateTime } from '@/lib/dates'
import type { Transaction } from '@/types'

const TX_LABELS: Record<string, string> = {
  stamp_add: 'Damga',
  reward_redeem: 'Ödül',
  manual_adjustment: 'Düzeltme',
}

const TX_COLORS: Record<string, string> = {
  stamp_add: 'bg-green-100 text-green-700',
  reward_redeem: 'bg-purple-100 text-purple-700',
  manual_adjustment: 'bg-amber-100 text-amber-700',
}

export default function TransactionsPage() {
  const { merchant, loading: mLoading } = useMerchant()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchant) return
    getDocs(
      query(
        collection(db, 'merchants', merchant.id, 'transactions'),
        orderBy('createdAt', 'desc'),
        limit(100),
      )
    )
      .then((snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [merchant?.id])

  if (mLoading || loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-40" />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">İşlem Geçmişi</h1>
      <p className="text-xs text-gray-400">Son 100 işlem · İşlemler değiştirilemez</p>

      {transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">Henüz işlem yok</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.map((tx) => (
          <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TX_COLORS[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {TX_LABELS[tx.type] ?? tx.type}
                </span>
                <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-700' : 'text-purple-700'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
              <span className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</span>
            </div>
            {tx.note && <p className="text-xs text-gray-400 mt-1">{tx.note}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
