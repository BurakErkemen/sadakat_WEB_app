import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatPhone } from '@/lib/phone'
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
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!merchant) return

    async function load() {
      const mSnap = await getDocs(
        query(collection(db, 'merchants', merchant!.id, 'memberships'), where('status', '==', 'active'))
      )
      const memberships = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))

      // Müşteri adlarını çek
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

    load().catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id])

  const cardUrl = selected ? `${window.location.origin}/c/${selected}` : ''

  async function handleCopy() {
    if (!cardUrl) return
    await navigator.clipboard.writeText(cardUrl)
    setCopied(true)
    toast.success('Link kopyalandı!')
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedItem = items.find((i) => i.cardToken === selected)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">QR Kod</h1>

      {loading && <div className="h-48 bg-gray-200 rounded-2xl animate-pulse" />}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p>Henüz müşteri kartı yok.</p>
          <p className="text-sm mt-1">Önce bir müşteri ekleyin.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Seç</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {items.map((m) => (
                <option key={m.cardToken} value={m.cardToken}>
                  {m.customerName ?? 'İsimsiz'}
                  {m.customerPhone ? ` — ${formatPhone(m.customerPhone)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="bg-indigo-50 rounded-xl px-4 py-2 text-sm text-indigo-700 flex items-center justify-between">
              <span>{selectedItem.customerName}</span>
              <span className="font-semibold">{selectedItem.currentStamps} damga/puan</span>
            </div>
          )}

          {cardUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-4">
              <QRCodeSVG value={cardUrl} size={200} level="M" />
              <p className="text-xs text-gray-400 break-all text-center">{cardUrl}</p>
              <button
                onClick={() => void handleCopy()}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
