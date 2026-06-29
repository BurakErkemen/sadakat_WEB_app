import { useState, useEffect } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { brandStyle } from '@/lib/utils'

function toInstagramUrl(val: string): string {
  if (!val) return ''
  if (val.startsWith('http')) return val
  const handle = val.replace(/^@/, '').trim()
  return `https://instagram.com/${handle}`
}

export default function SettingsPage() {
  const { merchant } = useMerchant()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [menuUrl, setMenuUrl] = useState('')
  const [brandColor, setBrandColor] = useState('#6366f1')
  const [brandColor2, setBrandColor2] = useState('')
  const [useGradient, setUseGradient] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoError, setLogoError] = useState(false)
  const [sector, setSector] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!merchant) return
    setName(merchant.name)
    setPhone(merchant.phone)
    setInstagram(merchant.instagram ?? '')
    setGoogleMapsUrl(merchant.googleMapsUrl ?? '')
    setMenuUrl(merchant.menuUrl ?? '')
    setBrandColor(merchant.brandColor ?? '#6366f1')
    const c2 = merchant.brandColor2 ?? ''
    setBrandColor2(c2 || '#a855f7')
    setUseGradient(!!c2)
    setSector(merchant.sector ?? '')
    setLogoUrl(merchant.logoUrl ?? '')
    setLogoError(false)
    setCity(merchant.city ?? '')
    setDistrict(merchant.district ?? '')
  }, [merchant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    setLoading(true)
    try {
      await updateDoc(doc(db, 'merchants', merchant.id), {
        name,
        phone,
        logoUrl: logoUrl.trim() || null,
        instagram: instagram || null,
        googleMapsUrl: googleMapsUrl || null,
        menuUrl: menuUrl || null,
        brandColor,
        brandColor2: useGradient ? brandColor2 : null,
        sector: sector.trim() || merchant.sector,
        city: city.trim() || merchant.city,
        district: district.trim() || merchant.district,
        updatedAt: serverTimestamp(),
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

  const instagramLink = instagram ? toInstagramUrl(instagram) : null
  const previewStyle = brandStyle(brandColor, useGradient ? brandColor2 : null)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">İşletme Ayarları</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">

        {/* Logo */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {logoUrl && !logoError ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-3xl select-none">🏪</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => { setLogoUrl(e.target.value); setLogoError(false) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-400 mt-1">Logonuzun direkt bağlantısını girin. Public sayfada ve müşteri kartında görünür.</p>
            {logoError && <p className="text-xs text-red-500 mt-0.5">Resim yüklenemedi — URL'yi kontrol edin.</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">İşletme Adı</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram (opsiyonel)</label>
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="@isletmem veya kullanici_adi" />
          {instagramLink && (
            <a href={instagramLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs text-violet-600 hover:underline">
              ↗ {instagramLink}
            </a>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Linki (opsiyonel)</label>
          <input type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="https://maps.google.com/…" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            QR Menü Linki (opsiyonel)
          </label>
          <input type="url" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="https://menunuz.com/qr veya Google Drive linki" />
          <p className="text-xs text-gray-400 mt-0.5">Müşteri sayfasında "Menüyü Gör" butonu olarak görünür</p>
        </div>

        {/* ── Marka Rengi ───────────────────────────────────── */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Marka Rengi</label>

          {/* Gradient toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
            <span className="text-sm text-gray-600">Gradient (geçişli iki renk) kullan</span>
          </label>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-lg cursor-pointer" />
              <span className="text-xs text-gray-400">{useGradient ? 'Başlangıç' : 'Renk'}</span>
            </div>

            {useGradient && (
              <>
                <svg className="text-gray-300 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <div className="flex flex-col items-center gap-1">
                  <input type="color" value={brandColor2} onChange={(e) => setBrandColor2(e.target.value)}
                    className="h-10 w-14 border border-gray-300 rounded-lg cursor-pointer" />
                  <span className="text-xs text-gray-400">Bitiş</span>
                </div>
              </>
            )}
          </div>

          {/* Önizleme */}
          <div
            className="h-12 rounded-xl w-full transition-all"
            style={previewStyle}
          />
          <p className="text-xs text-gray-400">
            {useGradient ? `${brandColor} → ${brandColor2}` : brandColor}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sektör</label>
            <input type="text" value={sector} onChange={(e) => setSector(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="ör. Kafe, Restoran, Berber" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="ör. Muğla" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İlçe</label>
              <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="ör. Bodrum" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
          <p><span className="font-medium">İşletme Linki:</span> /m/{merchant.slug}</p>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all">
          {loading ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>
    </div>
  )
}
