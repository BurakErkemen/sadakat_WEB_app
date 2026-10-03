import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useParams, Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { auth } from '@/firebase/auth'
import { brandStyle } from '@/lib/utils'
import type { Merchant, Campaign } from '@/types'

// Public rota AuthProvider dışında kaldığı için hafif yerel oturum kontrolü:
// giriş yapmış ve işletmesi olan kullanıcıya "Panele Dön" gösterilir.
function useHasPanel(): boolean {
  const [hasPanel, setHasPanel] = useState(false)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { setHasPanel(false); return }
      getDoc(doc(db, 'users', u.uid))
        .then((s) => setHasPanel(s.exists() && Boolean(s.data()['merchantId'])))
        .catch(() => setHasPanel(false))
    })
    return unsub
  }, [])
  return hasPanel
}

type State = 'loading' | 'not_found' | 'inactive' | 'ready'

function toInstagramUrl(val: string): string {
  if (!val) return ''
  if (val.startsWith('http')) return val
  const handle = val.replace(/^@/, '').trim()
  return `https://instagram.com/${handle}`
}

export default function PublicMerchantPage() {
  const { slug } = useParams<{ slug: string }>()
  const hasPanel = useHasPanel()
  const [state, setState] = useState<State>('loading')
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    if (!slug) { setState('not_found'); return }

    async function load() {
      try {
        const slugSnap = await getDoc(doc(db, 'publicSlugs', slug!))
        if (!slugSnap.exists()) { setState('not_found'); return }
        const { merchantId, isActive } = slugSnap.data() as { merchantId: string; isActive: boolean }
        if (!isActive) { setState('inactive'); return }

        const mSnap = await getDoc(doc(db, 'merchants', merchantId))
        if (!mSnap.exists() || mSnap.data()['status'] !== 'active' || mSnap.data()['archived'] === true) { setState('inactive'); return }
        const m = { id: mSnap.id, ...mSnap.data() } as Merchant
        setMerchant(m)

        const activeIds: string[] =
          m.activeCampaignIds && m.activeCampaignIds.length > 0
            ? m.activeCampaignIds
            : m.activeCampaignId ? [m.activeCampaignId] : []

        if (activeIds.length > 0) {
          const snaps = await Promise.all(
            activeIds.map((id) => getDoc(doc(db, 'merchants', merchantId, 'campaigns', id)))
          )
          setCampaigns(snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() } as Campaign)))
        }

        setState('ready')
      } catch (err) {
        console.error(err)
        setState('not_found')
      }
    }

    void load()
  }, [slug])

  useEffect(() => {
    if (merchant?.name) {
      document.title = `${merchant.name} — Puaniva`
      return () => { document.title = 'Puaniva — Dijital Sadakat Kartı' }
    }
  }, [merchant?.name])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (state === 'not_found') {
    return <InfoScreen icon="😕" title="Sayfa Bulunamadı" message="Bu işletme adresi mevcut değil veya silinmiş olabilir." />
  }

  if (state === 'inactive') {
    return <InfoScreen icon="🔒" title="Sayfa Şu An Kapalı" message="Bu işletme şu an aktif değil. Daha sonra tekrar deneyin." />
  }

  const brand = merchant?.brandColor ?? '#6366f1'
  const brand2 = merchant?.brandColor2 ?? null
  const headerStyle = brandStyle(brand, brand2)
  const igHandle = merchant?.instagram ? merchant.instagram.replace(/^@/, '') : null
  const igUrl = merchant?.instagram ? toInstagramUrl(merchant.instagram) : null

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Merchant owner banner — sadece giriş yapmış işletme sahipleri görür */}
      {hasPanel && (
        <div className="bg-indigo-600 text-white text-center text-xs py-2 px-4 flex items-center justify-center gap-3">
          <span>İşletme panelinizi görüyorsunuz</span>
          <Link to="/app" className="underline font-semibold hover:text-indigo-200">← Panele Dön</Link>
        </div>
      )}

      {/* Hero */}
      <div className="relative pt-10 pb-16 px-6 text-white" style={headerStyle}>
        <div className="max-w-sm mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 select-none">
            {merchant?.name?.[0]?.toLocaleUpperCase('tr') ?? '?'}
          </div>
          <h1 className="text-2xl font-extrabold">{merchant?.name}</h1>
          <p className="text-sm text-white/70 mt-1">{merchant?.sector} · {merchant?.city}, {merchant?.district}</p>
          {igHandle && igUrl && (
            <a href={igUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/55 mt-1.5 hover:text-white/90 transition-colors">
              @{igHandle} ↗
            </a>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gray-50 rounded-t-[2.5rem]" />
      </div>

      <div className="max-w-sm mx-auto px-4 pt-5 pb-5 space-y-4">

        {/* Kampanyalar */}
        {campaigns.length > 0 ? campaigns.map((campaign) => {
          const isPoints = campaign.type === 'points'
          const total = campaign.requiredStamps

          return (
            <div key={campaign.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">

              {/* Kart başlığı */}
              <div className="px-5 py-4 text-white" style={headerStyle}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-0.5">
                      {isPoints ? 'Puan Programı' : 'Damga Programı'}
                    </p>
                    <p className="font-extrabold text-lg leading-tight">{campaign.name}</p>
                    {campaign.description && (
                      <p className="text-xs text-white/65 mt-1 leading-relaxed">{campaign.description}</p>
                    )}
                  </div>
                  <span className="text-3xl shrink-0 mt-0.5">{isPoints ? '🏆' : '✅'}</span>
                </div>
              </div>

              {/* Kart gövdesi */}
              <div className="p-4 space-y-4">

                {/* Damga ızgarası — sabit 40px daireler, flex-wrap */}
                {!isPoints && total <= 30 && (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: total }).map((_, i) => (
                        <div key={i}
                          className="w-10 h-10 rounded-full flex items-center justify-center select-none shrink-0"
                          style={{ backgroundColor: brand + '12', border: `2px dashed ${brand}40` }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brand + '50' }} />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-right">{total} damga → ödül</p>
                  </div>
                )}

                {/* Ödül bilgisi */}
                <div className="flex items-center gap-3 rounded-xl p-3.5" style={{ backgroundColor: brand + '0D' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: brand + '20' }}>
                    🎁
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-medium">Hediyeniz</p>
                    <p className="text-sm font-bold text-gray-900 leading-snug">{campaign.rewardDescription}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isPoints ? `${total} puan topla` : `${total} damga topla`}
                    </p>
                  </div>
                </div>

                {/* Puan çarpanı */}
                {isPoints && campaign.pointsPerUnit && (
                  <p className="text-center text-xs text-gray-400">
                    Her <strong className="text-gray-700">1 TL</strong> alışverişte{' '}
                    <strong style={{ color: brand }}>{campaign.pointsPerUnit.toFixed(2)} puan</strong> kazanırsınız
                  </p>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm text-gray-400">Şu an aktif kampanya yok</p>
          </div>
        )}

        {/* Nasıl katılırsınız — yatay stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <p className="font-bold text-gray-900">Nasıl Katılırsınız?</p>
          </div>

          <div className="px-5 pt-4 pb-5">
            {/* Adım göstergeleri */}
            <div className="relative flex justify-between items-start">
              {/* Bağlantı çizgisi — daire merkezlerini birleştirir */}
              <div
                className="absolute top-4 left-[calc(16.67%-1px)] right-[calc(16.67%-1px)] h-px"
                style={{ background: `linear-gradient(to right, ${brand}50, ${brand}30, ${brand}50)` }}
              />

              {[
                { num: 1, icon: '👋', title: 'Gelin', desc: 'İşletmeye gelin ve kasiyere katılmak istediğinizi söyleyin.' },
                { num: 2, icon: '📲', title: 'Kayıt Olun', desc: 'Telefonunuzu verin, dijital kartınız oluşturulsun.' },
                { num: 3, icon: '🎁', title: 'Kazanın', desc: 'Her alışverişte puan/damga biriktirip ödülünüzü alın.' },
              ].map((step) => (
                <div key={step.num} className="flex-1 flex flex-col items-center gap-2.5 text-center relative z-10 px-1">
                  {/* Numara dairesi */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm"
                    style={headerStyle}
                  >
                    {step.num}
                  </div>
                  {/* İkon kutusu */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: brand + '12' }}
                  >
                    {step.icon}
                  </div>
                  {/* Başlık + açıklama */}
                  <div>
                    <p className="text-xs font-bold text-gray-900 leading-tight">{step.title}</p>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* İletişim */}
        {(merchant?.phone || merchant?.googleMapsUrl || merchant?.instagram || merchant?.menuUrl) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="font-bold text-gray-900">İletişim</p>

            <div className="grid grid-cols-2 gap-2">
              {merchant.phone && (
                <a href={`tel:${merchant.phone}`}
                  className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-3 text-sm text-gray-700 font-medium truncate">
                  <span className="shrink-0">📞</span>
                  <span className="truncate">{merchant.phone}</span>
                </a>
              )}
              {merchant.googleMapsUrl && (
                <a href={merchant.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-3 text-sm text-gray-700 font-medium">
                  <span>📍</span> Haritada Gör
                </a>
              )}
              {igUrl && (
                <a href={igUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-50 hover:bg-pink-50 hover:text-pink-600 transition-colors rounded-xl px-3 py-3 text-sm text-gray-700 font-medium">
                  <span>📷</span> @{igHandle}
                </a>
              )}
            </div>

            {merchant.menuUrl && (
              <a href={merchant.menuUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm font-bold text-white w-full py-3.5 rounded-xl hover:opacity-90 transition-opacity"
                style={headerStyle}>
                🍽️ Menüyü Gör
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">Puaniva · Cyan Danışmanlık</p>
      </div>
    </div>
  )
}

function InfoScreen({ icon, title, message }: { icon: string; title: string; message: string }) {
  const hasPanel = useHasPanel()
  const backTo = hasPanel ? '/app' : '/'
  const backLabel = hasPanel ? '← Panele Dön' : '← Ana Sayfaya Dön'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-xs">
        <p className="text-5xl mb-4">{icon}</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500">{message}</p>
        <Link to={backTo} className="mt-6 inline-block text-sm text-indigo-600">{backLabel}</Link>
      </div>
    </div>
  )
}
