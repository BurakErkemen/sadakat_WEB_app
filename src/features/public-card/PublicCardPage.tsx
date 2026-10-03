import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { brandStyle, onBrandClasses } from '@/lib/utils'
import type { PublicCard, Merchant, Campaign } from '@/types'

function toInstagramUrl(val: string): string {
  if (val.startsWith('http')) return val
  return `https://instagram.com/${val.replace(/^@/, '').trim()}`
}

type LoadState = 'loading' | 'not_found' | 'passive' | 'active'

export default function PublicCardPage() {
  const { cardToken } = useParams<{ cardToken: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [card, setCard] = useState<PublicCard | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  useEffect(() => {
    if (!cardToken) { setState('not_found'); return }

    async function load() {
      try {
        // 1. publicCards/{cardToken} get
        const cardSnap = await getDoc(doc(db, 'publicCards', cardToken!))
        if (!cardSnap.exists()) { setState('not_found'); return }
        const cardData = cardSnap.data() as PublicCard
        setCard(cardData)

        // 2. merchants/{merchantId} get
        const mSnap = await getDoc(doc(db, 'merchants', cardData.merchantId))
        if (!mSnap.exists() || mSnap.data()['status'] !== 'active' || mSnap.data()['archived'] === true) { setState('passive'); return }
        setMerchant({ id: mSnap.id, ...mSnap.data() } as Merchant)

        // 3. campaigns/{campaignId} get
        const cSnap = await getDoc(doc(db, 'merchants', cardData.merchantId, 'campaigns', cardData.campaignId))
        if (cSnap.exists()) setCampaign({ id: cSnap.id, ...cSnap.data() } as Campaign)

        setState(cardData.status === 'active' ? 'active' : 'passive')
      } catch (err) {
        console.error(err)
        setState('not_found')
      }
    }

    void load()
  }, [cardToken])

  if (state === 'loading') return <LoadingScreen />
  if (state === 'not_found') return <ErrorScreen message="Kart bulunamadı. Link yanlış veya süresi dolmuş olabilir." />
  if (state === 'passive') return <ErrorScreen message="Bu sadakat kartı şu an aktif değil. İşletmenizle iletişime geçin." />

  const requiredStamps = campaign?.requiredStamps ?? 0
  const currentStamps = card?.currentStamps ?? 0
  const isPoints = campaign?.type === 'points'
  const label = isPoints ? 'puan' : 'damga'
  const rewardCount = requiredStamps > 0 ? Math.floor(currentStamps / requiredStamps) : 0
  const hasReward = rewardCount > 0
  const stampsInProgress = requiredStamps > 0 ? currentStamps % requiredStamps : 0
  const displayStamps = hasReward ? stampsInProgress : currentStamps
  const brandColor = merchant?.brandColor ?? '#6366f1'
  const cardStyle = brandStyle(brandColor, merchant?.brandColor2)
  const on = onBrandClasses(brandColor, merchant?.brandColor2) // açık marka renginde koyu metin
  const progressPct = requiredStamps > 0 ? Math.min(100, (displayStamps / requiredStamps) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* İşletme başlığı */}
        <div className="text-center mb-5">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${on.text} text-2xl font-bold shadow-lg shadow-black/10`}
            style={cardStyle}
          >
            <span>{merchant?.name?.[0] ?? '?'}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">{merchant?.name ?? '—'}</h1>
          <p className="text-sm text-gray-500">{merchant?.sector} · {merchant?.city}</p>
        </div>

        {/* Sadakat kartı */}
        <div
          className={`relative rounded-3xl p-6 ${on.text} shadow-xl shadow-black/15 mb-5 overflow-hidden`}
          style={cardStyle}
        >
          {/* Parlaklık dokusu */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-black/10 blur-2xl" />

          <div className="relative flex items-start justify-between mb-4">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${on.faint}`}>Sadakat Kartı</p>
              <p className="font-bold text-lg mt-0.5">{card?.customerDisplayName ?? '—'}</p>
            </div>
            {hasReward && (
              <div className={`${on.chip} backdrop-blur-sm rounded-2xl px-3 py-1.5 text-center animate-bounce-soft`}>
                <p className="text-xl leading-none">🎁</p>
                <p className="text-[10px] font-bold mt-1">{rewardCount} ÖDÜL</p>
              </div>
            )}
          </div>

          {/* Damga ızgarası — kademeli pop animasyonu */}
          {!isPoints && requiredStamps > 0 && requiredStamps <= 30 && (
            <div className="relative flex flex-wrap gap-2 mt-3">
              {Array.from({ length: requiredStamps }).map((_, i) => (
                <div
                  key={i}
                  style={i < displayStamps ? { animationDelay: `${i * 60}ms` } : undefined}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    i < displayStamps
                      ? `${on.stampOn} shadow-md animate-stamp-pop`
                      : `${on.stampOff} border border-dashed`
                  }`}
                >
                  {i < displayStamps ? '✓' : ''}
                </div>
              ))}
            </div>
          )}

          {/* Puan modu — büyük sayaç */}
          {isPoints && (
            <div className="relative mt-2">
              <p className="text-4xl font-black tracking-tight">
                {displayStamps}
                <span className={`text-base font-semibold ${on.faint} ml-1.5`}>/ {requiredStamps} puan</span>
              </p>
            </div>
          )}

          {/* İlerleme çubuğu */}
          {requiredStamps > 0 && (
            <div className="relative mt-4">
              <div className={`h-1.5 rounded-full ${on.bar} overflow-hidden`}>
                <div
                  className={`h-full rounded-full ${on.barFill} transition-[width] duration-700 ease-out`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className={`mt-2 flex items-center justify-between text-xs ${on.sub}`}>
                {hasReward ? (
                  <p>{stampsInProgress} / {requiredStamps} {label} · sonraki ödül</p>
                ) : (
                  <>
                    <p>{displayStamps} / {requiredStamps} {label}</p>
                    <p className="font-semibold">{requiredStamps - displayStamps} {label} kaldı</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ödül kazanıldı */}
        {hasReward && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 text-center mb-4 shadow-sm">
            <p className="text-3xl mb-2 animate-bounce-soft inline-block">🎉</p>
            <p className="font-extrabold text-green-800 text-lg">
              {rewardCount === 1 ? '1 Ödül Kazandınız!' : `${rewardCount} Ödül Kazandınız!`}
            </p>
            <p className="text-sm text-green-700 font-medium mt-1">{campaign?.rewardDescription}</p>
            <p className="text-xs text-green-600/70 mt-2">İşletmeye gidip ödülünüzü kullandırın</p>
          </div>
        )}

        {/* Kampanya bilgisi */}
        {campaign && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2 mb-4">
            <h2 className="font-bold text-gray-900">{campaign.name}</h2>
            {campaign.description && <p className="text-sm text-gray-500 leading-relaxed">{campaign.description}</p>}
            <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-[10px] text-amber-600 uppercase font-semibold tracking-wide">Ödülünüz</p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">{campaign.rewardDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* İşletme iletişim — tek dokunuşla ara / yol tarifi / Instagram */}
        {merchant && (merchant.phone || merchant.instagram || merchant.googleMapsUrl) && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {merchant.phone && (
              <a href={`tel:${merchant.phone}`}
                className="tap-scale bg-white border border-gray-100 shadow-sm rounded-2xl py-3 flex flex-col items-center gap-1 text-xs font-medium text-gray-600">
                <span className="text-lg">📞</span>Ara
              </a>
            )}
            {merchant.googleMapsUrl && (
              <a href={merchant.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="tap-scale bg-white border border-gray-100 shadow-sm rounded-2xl py-3 flex flex-col items-center gap-1 text-xs font-medium text-gray-600">
                <span className="text-lg">📍</span>Yol Tarifi
              </a>
            )}
            {merchant.instagram && (
              <a href={toInstagramUrl(merchant.instagram)} target="_blank" rel="noopener noreferrer"
                className="tap-scale bg-white border border-gray-100 shadow-sm rounded-2xl py-3 flex flex-col items-center gap-1 text-xs font-medium text-gray-600">
                <span className="text-lg">📸</span>Instagram
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-2 pb-safe">Puaniva · Cyan Danışmanlık</p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="font-bold text-gray-900 text-lg mb-2">Kart Gösterilemiyor</h1>
        <p className="text-gray-500 text-sm">{message}</p>
        <p className="text-xs text-gray-300 mt-6">Puaniva</p>
      </div>
    </div>
  )
}
