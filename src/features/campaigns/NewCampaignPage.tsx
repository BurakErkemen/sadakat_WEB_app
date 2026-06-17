import { useState } from 'react'
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'

type CampaignType = 'stamp' | 'points'

export default function NewCampaignPage() {
  const { merchant } = useMerchant()
  const navigate = useNavigate()
  const [type, setType] = useState<CampaignType>('stamp')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [requiredStamps, setRequiredStamps] = useState(5)
  const [pointsPerUnit, setPointsPerUnit] = useState(1)   // 1 puan / 10 TL → user girer
  const [unitAmount, setUnitAmount] = useState(10)        // kaç TL'ye 1 birim
  const [rewardDescription, setRewardDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const computedPointsPerUnit = pointsPerUnit / unitAmount  // TL başına puan

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    if (requiredStamps < 1) { toast.error('Hedef en az 1 olmalı'); return }
    if (type === 'points' && unitAmount < 1) { toast.error('Birim tutar en az 1 TL olmalı'); return }

    setLoading(true)
    try {
      const campaignRef = doc(collection(db, 'merchants', merchant.id, 'campaigns'))
      await setDoc(campaignRef, {
        name,
        description,
        type,
        requiredStamps,
        pointsPerUnit: type === 'points' ? computedPointsPerUnit : null,
        rewardDescription,
        status: 'passive',
        startDate: Timestamp.now(),
        coverImageUrl: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Kampanya oluşturuldu')
      navigate('/app/campaigns')
    } catch (err) {
      console.error(err)
      toast.error('Kampanya oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">Yeni Kampanya</h1>
      </div>

      {/* Sistem tipi seçimi */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setType('stamp')}
          className={`rounded-xl border-2 p-4 text-left transition-colors ${type === 'stamp' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}
        >
          <p className="text-xl mb-1">✅</p>
          <p className="font-semibold text-gray-900">Damga</p>
          <p className="text-xs text-gray-500 mt-0.5">Her ziyarette sabit damga. "5 al 1 bedava"</p>
        </button>
        <button
          type="button"
          onClick={() => setType('points')}
          className={`rounded-xl border-2 p-4 text-left transition-colors ${type === 'points' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}
        >
          <p className="text-xl mb-1">🏆</p>
          <p className="font-semibold text-gray-900">Puan</p>
          <p className="text-xs text-gray-500 mt-0.5">Harcamaya göre puan. "100 TL = 10 puan"</p>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kampanya Adı</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={type === 'stamp' ? '5 Kahve 1 Bedava' : '100 TL = 10 Puan'} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Kısaca kampanyayı anlatın" />
        </div>

        {type === 'stamp' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kaç Damga → Ödül?</label>
            <input type="number" value={requiredStamps} onChange={(e) => setRequiredStamps(Number(e.target.value))}
              min={1} max={50} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="text-xs text-gray-400 mt-1">{requiredStamps} damga toplandığında ödül hakkı kazanılır</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kazanılan Puan</label>
                <input type="number" value={pointsPerUnit} onChange={(e) => setPointsPerUnit(Number(e.target.value))}
                  min={1} max={100} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Her (TL) Harcamada</label>
                <input type="number" value={unitAmount} onChange={(e) => setUnitAmount(Number(e.target.value))}
                  min={1} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg px-3 py-2 text-sm text-purple-700">
              Her <strong>{unitAmount} TL</strong> harcamada <strong>{pointsPerUnit} puan</strong> kazanılır
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kaç Puan → Ödül?</label>
              <input type="number" value={requiredStamps} onChange={(e) => setRequiredStamps(Number(e.target.value))}
                min={1} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400 mt-1">{requiredStamps} puan toplandığında ödül hakkı kazanılır</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ödül Ne?</label>
          <input type="text" value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="1 ücretsiz kahve / %15 indirim" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Oluşturuluyor…' : 'Kampanya Oluştur (Pasif Başlar)'}
        </button>
      </form>
    </div>
  )
}
