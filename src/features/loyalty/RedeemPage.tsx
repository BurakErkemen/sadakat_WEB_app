import { useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db, redeemReward } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchant } from '@/hooks/useMerchant'
import { normalizePhone, formatPhone } from '@/lib/phone'
import QRScanner from '@/components/QRScanner'
import type { Customer, Membership, Campaign } from '@/types'

interface FoundData { customer: Customer; membership: Membership; campaign: Campaign }

export default function RedeemPage() {
  const { user } = useAuth()
  const { merchant } = useMerchant()
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [found, setFound] = useState<FoundData | null>(null)
  const [searching, setSearching] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [done, setDone] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function fetchActiveCampaign(): Promise<Campaign | null> {
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

      if (membership.currentStamps < campaign.requiredStamps) {
        toast.error(`Yeterli ${campaign.type === 'points' ? 'puan' : 'damga'} yok. ${membership.currentStamps}/${campaign.requiredStamps}`)
        return
      }
      setFound({ customer, membership, campaign })
    } catch (err) { console.error(err); toast.error('QR okuma başarısız') }
    finally { setSearching(false) }
  }

  async function findByPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    const norm = normalizePhone(phone)
    if (norm.length !== 10) { toast.error('Geçerli bir telefon girin'); return }
    setSearching(true); setFound(null); setDone(false)
    try {
      const cSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'customers'),
        where('normalizedPhone', '==', norm)
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

      if (membership.currentStamps < campaign.requiredStamps) {
        toast.error(`Yeterli ${campaign.type === 'points' ? 'puan' : 'damga'} yok. ${membership.currentStamps}/${campaign.requiredStamps}`)
        return
      }
      setFound({ customer, membership, campaign })
    } catch (err) { console.error(err); toast.error('Arama başarısız') }
    finally { setSearching(false) }
  }

  async function handleRedeem() {
    if (!found || !merchant || !user) return
    setRedeeming(true)
    try {
      await redeemReward({
        merchantId: merchant.id,
        membershipId: found.membership.id,
        cardToken: found.membership.cardToken,
        campaignId: found.membership.campaignId,
        customerId: found.customer.id,
        ownerUid: user.uid,
        note: note || undefined,
      })
      setDone(true)
      toast.success('Ödül kullandırıldı! 🎁')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg.includes('Ödül hakkı yok') ? 'Ödül hakkı yok' : 'İşlem başarısız')
    } finally { setRedeeming(false) }
  }

  function reset() { setPhone(''); setNote(''); setFound(null); setDone(false) }

  const isPoints = found?.campaign.type === 'points'
  const label = isPoints ? 'puan' : 'damga'
  const remaining = found ? Math.max(0, found.membership.currentStamps - found.campaign.requiredStamps) : 0

  return (
    <div className="space-y-5">
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <h1 className="text-xl font-bold text-gray-900">Ödül Kullandır</h1>

      {/* Arama yöntemleri */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border-2 border-gray-100 p-3">
          <form onSubmit={findByPhone} className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefon ile Ara</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="0532 000 00 00" />
            <button type="submit" disabled={searching}
              className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {searching ? 'Aranıyor…' : 'Ara'}
            </button>
          </form>
        </div>
        <button onClick={() => setShowScanner(true)}
          className="bg-white rounded-xl border-2 border-gray-100 p-3 flex flex-col items-center justify-center gap-2 hover:border-purple-200 transition-colors">
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-gray-700">QR Tara</span>
          <span className="text-xs text-gray-400 text-center">Müşterinin kartını tara</span>
        </button>
      </div>

      {found && !done && (
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900 text-lg">{found.customer.fullName}</p>
              <p className="text-sm text-gray-500">{formatPhone(found.customer.normalizedPhone)}</p>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
              {isPoints ? '🏆 Puan' : '✅ Damga'}
            </span>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 space-y-1">
            <p className="text-2xl font-bold text-purple-700">
              {found.membership.currentStamps} {label}
            </p>
            <p className="text-sm text-purple-600">{found.campaign.rewardDescription}</p>
            <p className="text-xs text-purple-400">
              {found.campaign.requiredStamps} {label} harcandı · Kullanım sonrası {remaining} {label} kalacak
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Not (opsiyonel)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>

          <button onClick={() => void handleRedeem()} disabled={redeeming}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 disabled:opacity-50">
            {redeeming ? 'İşleniyor…' : '🎁 Ödülü Kullandır'}
          </button>
        </div>
      )}

      {done && found && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-center space-y-2">
          <p className="text-4xl">🎁</p>
          <p className="font-bold text-gray-900 text-lg">Ödül kullandırıldı!</p>
          <p className="text-sm text-gray-500">{found.customer.fullName}</p>
          <p className="text-sm text-gray-500">{found.campaign.rewardDescription}</p>
          <button onClick={reset} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm mt-2">
            Yeni İşlem
          </button>
        </div>
      )}
    </div>
  )
}
