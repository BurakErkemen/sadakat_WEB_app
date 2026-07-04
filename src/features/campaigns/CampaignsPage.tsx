import { useEffect, useState } from 'react'
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { activateCampaign, deactivateCampaign } from '@/firebase/firestore'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { formatDate } from '@/lib/dates'
import type { Campaign } from '@/types'

export default function CampaignsPage() {
  const { merchant, plan, limits, loading: subLoading } = useMerchantSub()
  const { maxCampaigns, maxActiveCampaigns } = limits
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const atCampaignLimit = maxCampaigns !== Infinity && campaigns.length >= maxCampaigns
  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const atActiveCampaignLimit = maxActiveCampaigns !== Infinity && activeCampaigns.length >= maxActiveCampaigns
  const multiActiveAllowed = maxActiveCampaigns > 1

  async function load() {
    if (!merchant) return
    setLoading(true)
    const snap = await getDocs(collection(db, 'merchants', merchant.id, 'campaigns'))
    setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [merchant?.id])

  async function handleActivate(campaignId: string) {
    if (!merchant) return
    setActionId(campaignId)
    try {
      await activateCampaign(merchant.id, campaignId, multiActiveAllowed)
      toast.success('Kampanya aktif edildi')
      await load()
    } catch (err) {
      console.error(err)
      toast.error('Kampanya aktif edilemedi')
    } finally {
      setActionId(null)
    }
  }

  async function handleDeactivate(campaignId: string) {
    if (!merchant) return
    setActionId(campaignId)
    try {
      await deactivateCampaign(merchant.id, campaignId)
      toast.success('Kampanya pasife alındı')
      await load()
    } catch (err) {
      console.error(err)
      toast.error('İşlem başarısız')
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(c: Campaign) {
    if (!merchant) return
    if (!confirm(`"${c.name}" kampanyasını silmek istediğinize emin misiniz?\nBu işlem geri alınamaz.`)) return
    setActionId(c.id + '_del')
    try {
      if (c.status === 'active') {
        await deactivateCampaign(merchant.id, c.id)
      }
      await deleteDoc(doc(db, 'merchants', merchant.id, 'campaigns', c.id))
      toast.success('Kampanya silindi')
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id))
    } catch (err) {
      console.error(err)
      toast.error('Kampanya silinemedi')
    } finally {
      setActionId(null)
    }
  }

  if (subLoading || loading) return <LoadingSkeleton />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kampanyalar</h1>
          <div className="flex gap-3 mt-0.5">
            {maxCampaigns !== Infinity && (
              <p className="text-xs text-gray-400">{campaigns.length} / {maxCampaigns} kampanya</p>
            )}
            {multiActiveAllowed ? (
              <p className="text-xs text-green-600 font-medium">{activeCampaigns.length} aktif</p>
            ) : (
              <p className="text-xs text-gray-400">{activeCampaigns.length > 0 ? '1 aktif' : '0 aktif'}</p>
            )}
          </div>
        </div>
        {atCampaignLimit ? (
          <div className="text-right">
            <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
              Kampanya limitine ulaşıldı
            </span>
          </div>
        ) : (
          <Link to="/app/campaigns/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
            + Yeni
          </Link>
        )}
      </div>

      {atCampaignLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <span className="font-semibold">{plan === 'trial' ? 'Deneme' : plan === 'mini' ? 'Mini' : plan === 'standard' ? 'Standart' : 'Pro'} planı</span> için maksimum{' '}
          <strong>{maxCampaigns} kampanya</strong> oluşturabilirsiniz.{' '}
          <Link to="/app/subscription" className="underline font-medium">Planı yükselt →</Link>
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 font-medium mb-4">Damga toplamaya başlamak için önce bir kampanya oluşturun.</p>
          {!atCampaignLimit && (
            <Link to="/app/campaigns/new" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
              İlk Kampanyayı Oluştur
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => {
          const deleting = actionId === c.id + '_del'
          const acting = actionId === c.id
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.type === 'points' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {c.type === 'points' ? '🏆 Puan' : '✅ Damga'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{c.rewardDescription}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.requiredStamps} {c.type === 'points' ? 'puan' : 'damga'} → ödül
                    {c.type === 'points' && c.pointsPerUnit ? ` · her ${Math.round(1 / c.pointsPerUnit)} TL = 1 puan` : ''}
                    {' · '}{formatDate(c.startDate)}'den itibaren
                  </p>
                </div>
                {/* Düzenle / Sil */}
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/app/campaigns/${c.id}/edit`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Düzenle">
                    ✏️
                  </Link>
                  <button
                    onClick={() => void handleDelete(c)}
                    disabled={deleting || acting}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Sil">
                    {deleting ? '…' : '🗑'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                {c.status === 'passive' ? (
                  atActiveCampaignLimit ? (
                    <div className="flex-1 text-center text-xs text-amber-600 bg-amber-50 border border-amber-200 py-2 rounded-lg">
                      Aktif limit doldu{multiActiveAllowed ? '' : ' · Önce diğerini pasife alın'}
                    </div>
                  ) : (
                    <button onClick={() => void handleActivate(c.id)} disabled={acting || deleting}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {acting ? 'Aktif ediliyor…' : 'Aktif Et'}
                    </button>
                  )
                ) : (
                  <button onClick={() => void handleDeactivate(c.id)} disabled={acting || deleting}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                    {acting ? 'İşleniyor…' : 'Pasife Al'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-40" />
      <div className="h-28 bg-gray-200 rounded-xl" />
      <div className="h-28 bg-gray-200 rounded-xl" />
    </div>
  )
}
