import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db, createCustomerWithCard } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { normalizePhone } from '@/lib/phone'
import type { Campaign } from '@/types'

export default function NewCustomerPage() {
  const { merchant } = useMerchant()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ cardToken: string; customerId: string } | null>(null)
  const [duplicate, setDuplicate] = useState<{ id: string; fullName: string } | null>(null)

  useEffect(() => {
    if (!merchant) return
    getDocs(query(collection(db, 'merchants', merchant.id, 'campaigns'), where('status', '==', 'active')))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign))
        setCampaigns(list)
        if (list.length > 0) setCampaignId(list[0].id)
      })
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id])

  async function checkDuplicate(rawPhone: string): Promise<{ id: string; fullName: string } | null> {
    if (!merchant) return null
    const norm = normalizePhone(rawPhone)
    if (norm.length !== 10) return null
    const snap = await getDocs(query(
      collection(db, 'merchants', merchant.id, 'customers'),
      where('normalizedPhone', '==', norm)
    ))
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, fullName: d.data()['fullName'] as string }
  }

  async function handlePhoneBlur() {
    setDuplicate(null)
    const found = await checkDuplicate(phone)
    if (found) setDuplicate(found)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    if (!campaignId) {
      toast.error('Önce aktif bir kampanya oluşturun')
      return
    }
    const norm = normalizePhone(phone)
    if (norm.length !== 10) {
      toast.error('Geçerli bir telefon numarası girin')
      return
    }
    // Final guard — submit anında da kontrol et
    const found = await checkDuplicate(phone)
    if (found) {
      setDuplicate(found)
      return
    }
    setLoading(true)
    try {
      const res = await createCustomerWithCard({
        merchantId: merchant.id,
        campaignId,
        fullName,
        phone,
        note: note || undefined,
      })
      setResult(res)
      toast.success('Müşteri oluşturuldu!')
    } catch (err) {
      console.error(err)
      toast.error('Müşteri oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const cardUrl = `${window.location.origin}/c/${result.cardToken}`
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Müşteri Oluşturuldu ✅</h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <p className="text-sm text-gray-500">Sadakat kartı linki:</p>
          <div className="bg-gray-50 rounded-xl p-3 break-all text-sm font-mono text-gray-700">{cardUrl}</div>
          <div className="flex gap-3">
            <button
              onClick={() => { void navigator.clipboard.writeText(cardUrl); toast.success('Kopyalandı!') }}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm"
            >
              Linki Kopyala
            </button>
            <button
              onClick={() => navigate('/app/qr', { state: { cardToken: result.cardToken } })}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm"
            >
              QR Göster
            </button>
          </div>
          <button onClick={() => { setResult(null); setFullName(''); setPhone(''); setNote('') }} className="w-full text-sm text-gray-400 py-2">
            Yeni Müşteri Ekle
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">Yeni Müşteri</h1>
      </div>

      {campaigns.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Aktif kampanya yok. Önce bir kampanya oluşturun ve aktif edin.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ahmet Yılmaz"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDuplicate(null) }}
            onBlur={() => { void handlePhoneBlur() }}
            required
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${duplicate ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`}
            placeholder="0532 000 00 00"
          />
          {duplicate && (
            <div className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5">
              <span>Bu numara zaten kayıtlı:</span>
              <Link
                to={`/app/customers/${duplicate.id}`}
                className="font-semibold underline"
              >
                {duplicate.fullName} →
              </Link>
            </div>
          )}
        </div>
        {campaigns.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kampanya</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Not (opsiyonel)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="VIP müşteri, doğum günü…"
          />
        </div>
        <button
          type="submit"
          disabled={loading || campaigns.length === 0 || !!duplicate}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Oluşturuluyor…' : 'Müşteri Oluştur ve Kart Bağla'}
        </button>
      </form>
    </div>
  )
}
