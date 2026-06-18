import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useParams } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import type { PublicCard, Merchant, Campaign } from '@/types'

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
        if (mSnap.exists()) setMerchant({ id: mSnap.id, ...mSnap.data() } as Merchant)

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* İşletme başlığı */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: brandColor }}
          >
            {merchant?.logoUrl
              ? <img src={merchant.logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
              : (merchant?.name?.[0] ?? '?')}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{merchant?.name ?? '—'}</h1>
          <p className="text-sm text-gray-500">{merchant?.sector} · {merchant?.city}</p>
        </div>

        {/* Kart */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg mb-6"
          style={{ backgroundColor: brandColor }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs opacity-70">Dijital İşletme Kartı</p>
              <p className="font-bold text-lg">{card?.customerDisplayName ?? '—'}</p>
            </div>
            {hasReward && (
              <div className="bg-white bg-opacity-25 rounded-xl px-3 py-1.5 text-center">
                <p className="text-xs font-bold">{rewardCount} ÖDÜL</p>
                <p className="text-xl">🎁</p>
              </div>
            )}
          </div>

          {/* Damga ızgarası — sabit 40px daireler */}
          {!isPoints && requiredStamps > 0 && requiredStamps <= 30 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Array.from({ length: requiredStamps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                    i < displayStamps
                      ? 'bg-white text-gray-700 shadow-sm'
                      : 'bg-white bg-opacity-20 border border-white border-opacity-30'
                  }`}
                >
                  {i < displayStamps ? '✓' : ''}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm opacity-80">
            {hasReward ? (
              <p>{stampsInProgress} / {requiredStamps} {label} · sonraki ödül</p>
            ) : (
              <>
                <p>{displayStamps} / {requiredStamps} {label}</p>
                {requiredStamps > 0 && <p>{requiredStamps - displayStamps} {label} kaldı</p>}
              </>
            )}
          </div>
        </div>

        {/* Ödül kazanıldı */}
        {hasReward && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center mb-4">
            <p className="text-3xl mb-2">🎉</p>
            <p className="font-bold text-green-800 text-lg">
              {rewardCount === 1 ? '1 Ödül Kazandınız!' : `${rewardCount} Ödül Kazandınız!`}
            </p>
            <p className="text-sm text-green-700 font-medium mt-1">{campaign?.rewardDescription}</p>
            <p className="text-xs text-green-500 mt-2">İşletmeye gidip ödülünüzü kullandırın</p>
          </div>
        )}

        {/* Kampanya bilgisi */}
        {campaign && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <h2 className="font-semibold text-gray-900">{campaign.name}</h2>
            {campaign.description && <p className="text-sm text-gray-500">{campaign.description}</p>}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Ödülünüz</p>
              <p className="font-semibold text-gray-900 mt-1">{campaign.rewardDescription}</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">Sadex · Cyan Danışmanlık</p>
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
        <p className="text-xs text-gray-300 mt-6">Sadex</p>
      </div>
    </div>
  )
}
