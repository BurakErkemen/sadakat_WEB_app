import { useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { toSlug, isValidSlug } from '@/lib/slug'

const SECTORS = ['Kafe', 'Kuaför', 'Oto Yıkama', 'Restaurant', 'Pastane', 'Berber', 'Diğer']

export default function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sector, setSector] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  function handleNameChange(val: string) {
    setName(val)
    if (!slugTouched) setSlug(toSlug(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!isValidSlug(slug)) {
      toast.error('İşletme linki geçersiz. Sadece küçük harf, rakam ve tire kullanın.')
      return
    }

    setLoading(true)
    try {
      // Slug kontrolü — önce get
      const slugRef = doc(db, 'publicSlugs', slug)
      const slugSnap = await getDoc(slugRef)
      if (slugSnap.exists()) {
        toast.error('Bu işletme linki alınmış. Farklı bir link deneyin.')
        setLoading(false)
        return
      }

      // Merchant oluştur
      const merchantRef = doc(db, 'merchants', `${user.uid}_${Date.now()}`)
      await setDoc(merchantRef, {
        name,
        slug,
        sector,
        city,
        district,
        phone,
        instagram: null,
        googleMapsUrl: null,
        logoUrl: null,
        brandColor: '#6366f1',
        ownerId: user.uid,
        activeCampaignId: null,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // users.merchantId pointer yaz (merge: doc yoksa oluşturur, varsa sadece pointer güncellenir)
      await setDoc(doc(db, 'users', user.uid), {
        merchantId: merchantRef.id,
        updatedAt: serverTimestamp(),
      }, { merge: true })

      // publicSlugs oluştur (Rules: merchant önce var olmalı, bu sıra gerekli)
      await setDoc(slugRef, {
        merchantId: merchantRef.id,
        isActive: true,
        createdAt: serverTimestamp(),
      })

      toast.success('İşletmeniz oluşturuldu!')
      navigate('/app')
    } catch (err: unknown) {
      console.error(err)
      toast.error('İşletme oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">İşletmenizi Kurun</h1>
          <p className="text-gray-500 mt-1">Sadakat programınız birkaç dakikada hazır</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İşletme Adı</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ahmet'in Kafe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İşletme Linki
              <span className="text-gray-400 font-normal ml-1">(damgakart.com/<strong>{slug || 'linkiniz'}</strong>)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugTouched(true) }}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ahmetinkafe"
            />
            {slug && !isValidSlug(slug) && (
              <p className="text-xs text-red-500 mt-1">Sadece küçük harf, rakam ve tire kullanın (min. 3 karakter)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sektör</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Seçin…</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="İstanbul"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İlçe</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Kadıköy"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İşletme Telefonu</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0212 000 00 00"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Oluşturuluyor…' : 'İşletmeyi Oluştur'}
          </button>
        </form>
      </div>
    </div>
  )
}
