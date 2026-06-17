import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useParams, Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import type { Merchant, Campaign } from '@/types'

type State = 'loading' | 'not_found' | 'inactive' | 'ready'

export default function PublicMerchantPage() {
  const { slug } = useParams<{ slug: string }>()
  const [state, setState] = useState<State>('loading')
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  useEffect(() => {
    if (!slug) { setState('not_found'); return }

    async function load() {
      try {
        // 1. slug → merchantId
        const slugSnap = await getDoc(doc(db, 'publicSlugs', slug!))
        if (!slugSnap.exists()) { setState('not_found'); return }
        const { merchantId, isActive } = slugSnap.data() as { merchantId: string; isActive: boolean }
        if (!isActive) { setState('inactive'); return }

        // 2. merchant
        const mSnap = await getDoc(doc(db, 'merchants', merchantId))
        if (!mSnap.exists() || mSnap.data()['status'] !== 'active') { setState('inactive'); return }
        const m = { id: mSnap.id, ...mSnap.data() } as Merchant
        setMerchant(m)

        // 3. active campaign
        if (m.activeCampaignId) {
          const cSnap = await getDoc(doc(db, 'merchants', merchantId, 'campaigns', m.activeCampaignId))
          if (cSnap.exists()) setCampaign({ id: cSnap.id, ...cSnap.data() } as Campaign)
        }

        setState('ready')
      } catch (err) {
        console.error(err)
        setState('not_found')
      }
    }

    void load()
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
  const initial = merchant?.name?.[0]?.toUpperCase() ?? '?'
  const isPoints = campaign?.type === 'points'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-10 px-6 text-center" style={{ backgroundColor: brand }}>
        <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-bold bg-white bg-opacity-20 border-2 border-white border-opacity-40">
          {initial}
        </div>
        <h1 className="text-2xl font-bold">{merchant?.name}</h1>
        <p className="text-sm opacity-80 mt-1">{merchant?.sector} · {merchant?.city}, {merchant?.district}</p>
        {merchant?.instagram && (
          <p className="text-sm opacity-70 mt-0.5">@{merchant.instagram.replace('@', '')}</p>
        )}
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-5">
        {/* Aktif kampanya */}
        {campaign ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{isPoints ? '🏆' : '✅'}</span>
              <div>
                <p className="font-bold text-gray-900">{campaign.name}</p>
                <p className="text-xs text-gray-400">{isPoints ? 'Puan Sistemi' : 'Damga Sistemi'}</p>
              </div>
            </div>

            {campaign.description && (
              <p className="text-sm text-gray-600">{campaign.description}</p>
            )}

            {/* İlerleme görseli */}
            {!isPoints && campaign.requiredStamps <= 12 && (
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(campaign.requiredStamps, 6)}, 1fr)` }}>
                {Array.from({ length: campaign.requiredStamps }).map((_, i) => (
                  <div key={i}
                    className="aspect-square rounded-lg border-2 flex items-center justify-center"
                    style={{ borderColor: brand, opacity: 0.3 }}
                  />
                ))}
              </div>
            )}

            <div className="rounded-xl p-4 text-white space-y-1" style={{ backgroundColor: brand }}>
              <p className="text-xs opacity-80 uppercase font-medium tracking-wide">Ödülünüz</p>
              <p className="font-bold text-lg">{campaign.rewardDescription}</p>
              <p className="text-sm opacity-80">
                {isPoints
                  ? `${campaign.requiredStamps} puan topla, ödülünü kazan`
                  : `${campaign.requiredStamps} damga topla, ödülünü kazan`}
              </p>
            </div>

            {isPoints && campaign.pointsPerUnit && (
              <p className="text-xs text-gray-500 text-center">
                Her 1 TL alışverişte {campaign.pointsPerUnit.toFixed(2)} puan kazanırsınız
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">Şu an aktif kampanya yok</p>
          </div>
        )}

        {/* Nasıl katılınır */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="font-semibold text-gray-900">Nasıl Katılırsınız?</p>
          <div className="space-y-3">
            {[
              { num: '1', text: 'İşletmeye gelin ve sadakat programına dahil olmak istediğinizi söyleyin.' },
              { num: '2', text: 'Telefon numaranızı verin, size dijital sadakat kartınız oluşturulsun.' },
              { num: '3', text: 'Her alışverişinizde damganızı/puanınızı biriktirin ve ödülünüzü kazanın.' },
            ].map((s) => (
              <div key={s.num} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5"
                  style={{ backgroundColor: brand }}>
                  {s.num}
                </span>
                <p className="text-sm text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* İletişim */}
        {(merchant?.phone || merchant?.googleMapsUrl) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="font-semibold text-gray-900">İletişim</p>
            {merchant.phone && (
              <a href={`tel:${merchant.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600">
                <span>📞</span> {merchant.phone}
              </a>
            )}
            {merchant.googleMapsUrl && (
              <a href={merchant.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600">
                <span>📍</span> Haritada Gör
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300">DamgaKart · Dijital Sadakat Programı</p>
      </div>
    </div>
  )
}

function InfoScreen({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <p className="text-5xl mb-4">{icon}</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500">{message}</p>
        <Link to="/" className="mt-6 inline-block text-sm text-indigo-600">← Ana Sayfaya Dön</Link>
      </div>
    </div>
  )
}
