import { useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db, addStamp } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchant } from '@/hooks/useMerchant'
import { normalizePhone, formatPhone } from '@/lib/phone'
import QRScanner from '@/components/QRScanner'
import type { Customer, Membership, Campaign } from '@/types'

interface FoundData { customer: Customer; membership: Membership; campaign: Campaign }

export default function StampPage() {
  const { user } = useAuth()
  const { merchant } = useMerchant()
  const location = useLocation()

  const [phone, setPhone] = useState((location.state as { searchPhone?: string })?.searchPhone ?? '')
  const [note, setNote] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [found, setFound] = useState<FoundData | null>(null)
  const [searching, setSearching] = useState(false)
  const [stamping, setStamping] = useState(false)
  const [done, setDone] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function findByPhone(e: React.FormEvent) {
    e.preventDefault()
    const norm = normalizePhone(phone)
    if (norm.length !== 10) { toast.error('Geçerli bir telefon girin'); return }
    await searchCustomer({ normalizedPhone: norm })
  }

  async function fetchActiveCampaign() {
    if (!merchant?.activeCampaignId) { toast.error('Aktif kampanya yok. Lütfen önce bir kampanya aktif edin.'); return null }
    const campSnap = await getDoc(doc(db, 'merchants', merchant.id, 'campaigns', merchant.activeCampaignId))
    if (!campSnap.exists()) { toast.error('Kampanya bulunamadı'); return null }
    return { id: campSnap.id, ...campSnap.data() } as Campaign
  }

  async function handleQRScan(cardToken: string) {
    setShowScanner(false)
    if (!merchant) return
    setSearching(true)
    try {
      const cardSnap = await getDoc(doc(db, 'publicCards', cardToken))
      if (!cardSnap.exists()) { toast.error('Kart bulunamadı'); return }
      const { membershipId, merchantId } = cardSnap.data() as { membershipId: string; merchantId: string }
      if (merchantId !== merchant.id) { toast.error('Bu kart sizin işletmenize ait değil'); return }

      const mSnap = await getDoc(doc(db, 'merchants', merchant.id, 'memberships', membershipId))
      if (!mSnap.exists()) { toast.error('Üyelik bulunamadı'); return }
      const membership = { id: mSnap.id, ...mSnap.data() } as Membership

      const cSnap = await getDoc(doc(db, 'merchants', merchant.id, 'customers', membership.customerId))
      const customer = { id: cSnap.id, ...cSnap.data() } as Customer

      const campaign = await fetchActiveCampaign()
      if (!campaign) return

      setFound({ customer, membership, campaign })
    } catch (err) { console.error(err); toast.error('QR okuma başarısız') }
    finally { setSearching(false) }
  }

  async function searchCustomer({ normalizedPhone }: { normalizedPhone: string }) {
    if (!merchant) return
    setSearching(true); setFound(null); setDone(false)
    try {
      const cSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'customers'),
        where('normalizedPhone', '==', normalizedPhone)
      ))
      if (cSnap.empty) { toast.error('Müşteri bulunamadı'); return }
      const customer = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Customer

      const mSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id), where('status', '==', 'active')
      ))
      if (mSnap.empty) { toast.error('Aktif üyelik bulunamadı'); return }
      const membership = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() } as Membership

      const campaign = await fetchActiveCampaign()
      if (!campaign) return

      setFound({ customer, membership, campaign })
    } catch (err) { console.error(err); toast.error('Arama başarısız') }
    finally { setSearching(false) }
  }

  // Puan modunda kazanılacak puan miktarını hesapla
  function calcPoints(campaign: Campaign): number {
    if (campaign.type !== 'points' || !campaign.pointsPerUnit) return 1
    const amt = parseFloat(purchaseAmount)
    if (isNaN(amt) || amt <= 0) return 0
    return Math.floor(amt * campaign.pointsPerUnit)
  }

  async function handleStamp() {
    if (!found || !merchant || !user) return
    const campaign = found.campaign
    const amount = campaign.type === 'points' ? calcPoints(campaign) : 1

    if (campaign.type === 'points' && amount <= 0) {
      toast.error('Geçerli bir tutar girin'); return
    }

    setStamping(true)
    try {
      await addStamp({
        merchantId: merchant.id,
        membershipId: found.membership.id,
        cardToken: found.membership.cardToken,
        campaignId: found.campaign.id,
        customerId: found.customer.id,
        ownerUid: user.uid,
        amount,
        purchaseAmount: campaign.type === 'points' ? parseFloat(purchaseAmount) : undefined,
        note: note || undefined,
      })
      setDone(true)
      toast.success(campaign.type === 'points' ? `${amount} puan eklendi! 🏆` : 'Damga eklendi! ✅')
    } catch (err) { console.error(err); toast.error('İşlem başarısız') }
    finally { setStamping(false) }
  }

  function reset() { setPhone(''); setNote(''); setPurchaseAmount(''); setFound(null); setDone(false) }

  const isPoints = found?.campaign.type === 'points'
  const earnedAmount = found ? (isPoints ? calcPoints(found.campaign) : 1) : 0
  const newTotal = found ? found.membership.currentStamps + earnedAmount : 0
  const willReward = found ? newTotal >= found.campaign.requiredStamps : false

  return (
    <div className="space-y-5">
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <h1 className="text-xl font-bold text-gray-900">Damga / Puan Ekle</h1>

      {/* Arama yöntemleri */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`bg-white rounded-xl border-2 p-3 ${!found ? 'border-indigo-200' : 'border-gray-100'}`}>
          <form onSubmit={findByPhone} className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefon ile Ara</label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0532 000 00 00"
            />
            <button type="submit" disabled={searching}
              className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {searching ? 'Aranıyor…' : 'Ara'}
            </button>
          </form>
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="bg-white rounded-xl border-2 border-gray-100 p-3 flex flex-col items-center justify-center gap-2 hover:border-indigo-200 transition-colors"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-gray-700">QR Tara</span>
          <span className="text-xs text-gray-400 text-center">Müşterinin kartını tara</span>
        </button>
      </div>

      {/* Bulunan müşteri */}
      {found && !done && (
        <div className={`bg-white rounded-2xl border-2 p-5 space-y-4 ${isPoints ? 'border-purple-200' : 'border-indigo-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900 text-lg">{found.customer.fullName}</p>
              <p className="text-sm text-gray-500">{formatPhone(found.customer.normalizedPhone)}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${isPoints ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {isPoints ? '🏆 Puan' : '✅ Damga'}
            </span>
          </div>

          {/* Mevcut durum */}
          <div className={`rounded-xl p-4 ${isPoints ? 'bg-purple-50' : 'bg-indigo-50'}`}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1 opacity-60">Mevcut</p>
            <p className={`text-2xl font-bold ${isPoints ? 'text-purple-700' : 'text-indigo-700'}`}>
              {found.membership.currentStamps}
              <span className="text-sm font-normal opacity-60 ml-1">/ {found.campaign.requiredStamps} {isPoints ? 'puan' : 'damga'}</span>
            </p>
            <p className="text-sm mt-0.5 opacity-70">{found.campaign.name}</p>
          </div>

          {/* Puan modunda tutar girişi */}
          {isPoints && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alışveriş Tutarı (TL)
                {found.campaign.pointsPerUnit && (
                  <span className="text-gray-400 font-normal ml-1">
                    → {calcPoints(found.campaign) > 0 ? calcPoints(found.campaign) : '?'} puan kazanacak
                  </span>
                )}
              </label>
              <input
                type="number" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)}
                min={1} step={0.01} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="150.00"
              />
              {found.campaign.pointsPerUnit && (
                <p className="text-xs text-gray-400 mt-1">
                  Her {Math.round(1 / found.campaign.pointsPerUnit)} TL = 1 puan
                </p>
              )}
            </div>
          )}

          {/* Not */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Not (opsiyonel)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={isPoints ? 'Büyük boy sipariş' : 'Kahve, pasta…'} />
          </div>

          {willReward && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-medium text-center">
              🎉 Bu işlem sonrası ödül hakkı kazanıyor!
            </div>
          )}

          <button onClick={() => void handleStamp()} disabled={stamping || (isPoints && !purchaseAmount)}
            className={`w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50 text-white ${isPoints ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {stamping ? 'Ekleniyor…' : isPoints ? `🏆 ${earnedAmount > 0 ? earnedAmount + ' Puan' : 'Puan'} Ekle` : '✅ Damga Ekle'}
          </button>
        </div>
      )}

      {/* Başarı */}
      {done && found && (
        <div className={`rounded-2xl border p-6 text-center space-y-2 ${isPoints ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-4xl">{isPoints ? '🏆' : '✅'}</p>
          <p className="font-bold text-gray-900 text-lg">{isPoints ? `${earnedAmount} puan eklendi!` : 'Damga eklendi!'}</p>
          <p className="text-sm text-gray-600">{found.customer.fullName}</p>
          <p className="text-lg font-bold">{newTotal} / {found.campaign.requiredStamps} {isPoints ? 'puan' : 'damga'}</p>
          {willReward && <p className="font-semibold text-green-700">🎁 Ödül hakkı kazandı!</p>}
          <button onClick={reset} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm mt-2">
            Yeni İşlem
          </button>
        </div>
      )}
    </div>
  )
}
