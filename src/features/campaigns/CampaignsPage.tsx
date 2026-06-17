import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { activateCampaign } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatDate } from '@/lib/dates'
import type { Campaign } from '@/types'

export default function CampaignsPage() {
  const { merchant, loading: mLoading } = useMerchant()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  async function load() {
    if (!merchant) return
    setLoading(true)
    const snap = await getDocs(collection(db, 'merchants', merchant.id, 'campaigns'))
    setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)))
    setLoading(false)
  }

  useEffect(() => { void load() }, [merchant?.id])

  async function handleActivate(campaignId: string) {
    if (!merchant) return
    setActionId(campaignId)
    try {
      await activateCampaign(merchant.id, campaignId)
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
      const batch = writeBatch(db)
      batch.update(doc(db, 'merchants', merchant.id, 'campaigns', campaignId), {
        status: 'passive', updatedAt: serverTimestamp(),
      })
      batch.update(doc(db, 'merchants', merchant.id), {
        activeCampaignId: null, updatedAt: serverTimestamp(),
      })
      await batch.commit()
      toast.success('Kampanya pasife alındı')
      await load()
    } catch (err) {
      console.error(err)
      toast.error('İşlem başarısız')
    } finally {
      setActionId(null)
    }
  }

  if (mLoading || loading) return <LoadingSkeleton />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kampanyalar</h1>
        <Link to="/app/campaigns/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          + Yeni
        </Link>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        MVP'de aynı anda yalnızca 1 aktif kampanya kullanılabilir.
      </p>

      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Henüz kampanya oluşturmadınız</p>
          <Link to="/app/campaigns/new" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
            İlk Kampanyayı Oluştur
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
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
            </div>
            <div className="flex gap-2">
              {c.status === 'passive' ? (
                <button
                  onClick={() => void handleActivate(c.id)}
                  disabled={actionId === c.id}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionId === c.id ? 'Aktif ediliyor…' : 'Aktif Et'}
                </button>
              ) : (
                <button
                  onClick={() => void handleDeactivate(c.id)}
                  disabled={actionId === c.id}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  {actionId === c.id ? 'İşleniyor…' : 'Pasife Al'}
                </button>
              )}
            </div>
          </div>
        ))}
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
