import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatPhone } from '@/lib/phone'
import ErrorState from '@/components/ErrorState'
import type { Membership, Customer } from '@/types'

interface MembershipWithCustomer extends Membership {
  customerName?: string
  customerPhone?: string
}

export default function QRPage() {
  const { merchant } = useMerchant()
  const location = useLocation()
  const passedToken = (location.state as { cardToken?: string })?.cardToken
  const [items, setItems] = useState<MembershipWithCustomer[]>([])
  const [selected, setSelected] = useState<string>(passedToken ?? '')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!merchant) return
    setLoading(true)
    setLoadError(false)

    async function load() {
      const mSnap = await getDocs(
        query(collection(db, 'merchants', merchant!.id, 'memberships'), where('status', '==', 'active'))
      )
      const memberships = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))

      const cSnap = await getDocs(collection(db, 'merchants', merchant!.id, 'customers'))
      const customerMap = new Map<string, Customer>()
      cSnap.docs.forEach((d) => customerMap.set(d.id, { id: d.id, ...d.data() } as Customer))

      const enriched: MembershipWithCustomer[] = memberships.map((m) => {
        const c = customerMap.get(m.customerId)
        return { ...m, customerName: c?.fullName, customerPhone: c?.normalizedPhone }
      })

      setItems(enriched)
      if (!selected && enriched.length > 0) setSelected(enriched[0].cardToken)
      setLoading(false)
    }

    load().catch((err) => {
      console.error(err)
      setLoadError(true)
      setLoading(false) // hata durumunda iskelet ekranda takılı kalmasın
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id, reloadKey])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return items.slice(0, 8)
    return items
      .filter((m) =>
        (m.customerName ?? '').toLowerCase().includes(q) ||
        (m.customerPhone ?? '').includes(q)
      )
      .slice(0, 10)
  }, [items, search])

  const selectedItem = items.find((i) => i.cardToken === selected)
  const cardUrl = selected ? `${window.location.origin}/c/${selected}` : ''

  async function handleCopy() {
    if (!cardUrl) return
    await navigator.clipboard.writeText(cardUrl)
    setCopied(true)
    toast.success('Link kopyalandı!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">QR Kod</h1>

      {loading && <div className="h-48 bg-gray-200 rounded-2xl animate-pulse" />}

      {!loading && loadError && <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />}

      {!loading && !loadError && items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p>Henüz müşteri kartı yok.</p>
          <p className="text-sm mt-1">Önce bir müşteri ekleyin.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* Arama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Ara</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim veya telefon ile ara…"
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Müşteri listesi */}
          <div className="space-y-1.5">
            {filtered.map((m) => (
              <button
                key={m.cardToken}
                onClick={() => { setSelected(m.cardToken); setSearch('') }}
                className={`w-full text-left flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                  selected === m.cardToken
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{m.customerName ?? 'İsimsiz'}</p>
                  {m.customerPhone && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatPhone(m.customerPhone)}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-3">{m.currentStamps} puan/damga</span>
              </button>
            ))}
            {filtered.length === 0 && search && (
              <p className="text-sm text-center text-gray-400 py-6">Müşteri bulunamadı</p>
            )}
          </div>

          {/* QR Kodu */}
          {selectedItem && cardUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-4">
              <div className="text-center">
                <p className="font-semibold text-gray-900">{selectedItem.customerName}</p>
                {selectedItem.customerPhone && (
                  <p className="text-xs text-gray-400 mt-0.5">{formatPhone(selectedItem.customerPhone)}</p>
                )}
                <p className="text-xs text-indigo-600 mt-1">{selectedItem.currentStamps} puan/damga</p>
              </div>
              <QRCodeSVG value={cardUrl} size={200} level="M" />
              <p className="text-xs text-gray-400 break-all text-center">{cardUrl}</p>
              <button
                onClick={() => void handleCopy()}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copied ? '✓ Kopyalandı!' : 'Linki Kopyala'}
              </button>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">Nasıl Kullanılır?</p>
            <p>Bu QR kodu müşterinize gösterin. Müşteri kendi telefonuyla okutup kartını görebilir.</p>
          </div>
        </>
      )}
    </div>
  )
}
