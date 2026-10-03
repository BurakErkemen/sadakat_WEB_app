import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { toSlug, isValidSlug } from '@/lib/slug'
import ErrorState from '@/components/ErrorState'

const TRIAL_DAYS = 14

const SECTORS = ['Kafe', 'Kuaför', 'Oto Yıkama', 'Restaurant', 'Pastane', 'Berber', 'Diğer']

export default function OnboardingPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sector, setSector] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  // Mevcut işletme kurtarma: kullanıcının daha önce oluşturduğu mağaza varsa tekrar bağla
  const [existingMerchant, setExistingMerchant] = useState<{ id: string; name: string } | null>(null)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [checkError, setCheckError] = useState(false)
  const [checkAttempt, setCheckAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setCheckingExisting(true)
    setCheckError(false)
    setExistingMerchant(null)
    getDocs(query(collection(db, 'merchants'), where('ownerId', '==', user.uid)))
      .then((snap) => {
        if (cancelled) return
        if (snap.metadata.fromCache) {
          setCheckError(true)
          return
        }
        if (snap.empty) return
        const sorted = snap.docs.filter((item) => item.data().archived !== true).sort((a, b) => {
          const aT = (a.data().createdAt as { toMillis(): number } | null)?.toMillis() ?? 0
          const bT = (b.data().createdAt as { toMillis(): number } | null)?.toMillis() ?? 0
          return bT - aT
        })
        const m = sorted[0]
        if (!m) return
        setExistingMerchant({ id: m.id, name: m.data().name as string })
      })
      .catch(() => { if (!cancelled) setCheckError(true) })
      .finally(() => { if (!cancelled) setCheckingExisting(false) })
    return () => { cancelled = true }
  }, [user, checkAttempt])

  async function handleRecover() {
    if (!user || !existingMerchant) return
    setLoading(true)
    try {
      await setDoc(doc(db, 'users', user.uid), {
        merchantId: existingMerchant.id,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      // AuthContext onSnapshot ile değişikliği alır, OnboardingGuard /app'e yönlendirir
    } catch (err) {
      console.error(err)
      toast.error('Bağlantı kurulamadı. Lütfen tekrar deneyin.')
      setLoading(false)
    }
  }

  function handleNameChange(val: string) {
    setName(val)
    if (!slugTouched) setSlug(toSlug(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || checkingExisting || checkError || existingMerchant) return
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

      // users.merchantId pointer yaz
      await setDoc(doc(db, 'users', user.uid), {
        merchantId: merchantRef.id,
        updatedAt: serverTimestamp(),
      }, { merge: true })

      // publicSlugs oluştur
      await setDoc(slugRef, {
        merchantId: merchantRef.id,
        isActive: true,
        createdAt: serverTimestamp(),
      })

      // 14 günlük deneme aboneliği oluştur
      const now = Timestamp.now()
      const trialEnd = Timestamp.fromMillis(now.toMillis() + TRIAL_DAYS * 24 * 3600 * 1000)
      await setDoc(doc(db, 'merchants', merchantRef.id, 'subscription', 'current'), {
        plan: 'trial',
        status: 'trialing',
        billingCycle: null,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        updatedAt: serverTimestamp(),
      })

      toast.success('İşletmeniz oluşturuldu!')
      setDone(true)
      // navigate('/app') — OnboardingGuard onSnapshot ile otomatik yönlendirir
    } catch (err: unknown) {
      console.error(err)
      toast.error('İşletme oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    )
  }

  if (checkError) {
    return <ErrorState message="Mevcut işletmeniz kontrol edilemedi. Lütfen tekrar deneyin." onRetry={() => {
      setCheckingExisting(true)
      setCheckAttempt((value) => value + 1)
    }} />
  }

  if (existingMerchant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-5">
            <div className="text-5xl">🏪</div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Mevcut İşletme Bulundu</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hesabınıza bağlı bir işletme var. Panele devam etmek için bağlantıyı yenileyin.
              </p>
              <div className="mt-3 bg-indigo-50 rounded-xl px-4 py-3">
                <p className="font-semibold text-indigo-800">{existingMerchant.name}</p>
              </div>
            </div>
            <button
              onClick={handleRecover}
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? 'Bağlanıyor…' : 'Panelime Git'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto" />
          <p className="text-sm text-gray-500">Paneliniz hazırlanıyor…</p>
        </div>
      </div>
    )
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
              <span className="text-gray-400 font-normal ml-1">(puaniva.app/<strong>{slug || 'linkiniz'}</strong>)</span>
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
