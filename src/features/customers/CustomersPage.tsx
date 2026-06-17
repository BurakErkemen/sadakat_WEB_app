import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatPhone } from '@/lib/phone'
import { formatDate } from '@/lib/dates'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const { merchant, loading: mLoading } = useMerchant()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!merchant) return
    getDocs(query(collection(db, 'merchants', merchant.id, 'customers'), orderBy('createdAt', 'desc')))
      .then((snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [merchant?.id])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.normalizedPhone.includes(q.replace(/\D/g, ''))
    )
  })

  if (mLoading || loading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Müşteriler</h1>
        <Link to="/app/customers/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          + Yeni
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ad veya telefon ile ara…"
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {search ? 'Arama sonucu bulunamadı' : 'Henüz müşteri eklemediniz'}
          </p>
          {!search && (
            <Link to="/app/customers/new" className="mt-4 inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
              İlk Müşteriyi Ekle
            </Link>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{c.fullName}</p>
                <p className="text-sm text-gray-500">{formatPhone(c.normalizedPhone)}</p>
                {c.note && <p className="text-xs text-gray-400 mt-0.5">{c.note}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                <Link to={`/app/customers/${c.id}`} className="text-xs text-indigo-600 font-medium block">
                  Detay →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-40" />
      <div className="h-10 bg-gray-200 rounded-xl" />
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
    </div>
  )
}
