import { useState, useEffect } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'

export default function SettingsPage() {
  const { merchant } = useMerchant()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [brandColor, setBrandColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!merchant) return
    setName(merchant.name)
    setPhone(merchant.phone)
    setInstagram(merchant.instagram ?? '')
    setGoogleMapsUrl(merchant.googleMapsUrl ?? '')
    setBrandColor(merchant.brandColor ?? '#6366f1')
  }, [merchant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    setLoading(true)
    try {
      await updateDoc(doc(db, 'merchants', merchant.id), {
        name, phone, instagram: instagram || null,
        googleMapsUrl: googleMapsUrl || null,
        brandColor, updatedAt: serverTimestamp(),
      })
      toast.success('Ayarlar kaydedildi')
    } catch (err) {
      console.error(err)
      toast.error('Kayıt başarısız')
    } finally {
      setLoading(false)
    }
  }

  if (!merchant) return null

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">İşletme Ayarları</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">İşletme Adı</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram (opsiyonel)</label>
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="@isletmem" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Linki (opsiyonel)</label>
          <input type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://maps.google.com/…" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marka Rengi</label>
          <div className="flex items-center gap-3">
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer" />
            <span className="text-sm text-gray-500">{brandColor}</span>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <p><span className="font-medium">Sektör:</span> {merchant.sector}</p>
          <p><span className="font-medium">Şehir/İlçe:</span> {merchant.city} / {merchant.district}</p>
          <p><span className="font-medium">İşletme Linki:</span> /m/{merchant.slug}</p>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  )
}
