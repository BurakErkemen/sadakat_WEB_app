import { useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db, redeemReward } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { normalizePhone, formatPhone } from '@/lib/phone'
import QRScanner from '@/components/QRScanner'
import { Link } from 'react-router-dom'
import type { Customer, Membership, Campaign } from '@/types'

interface FoundData { customer: Customer; membership: Membership; campaign: Campaign }
interface PickerOption { membership: Membership; campaign: Campaign }
interface PickerData { customer: Customer; options: PickerOption[] }


export default function RedeemPage() {
  const { user } = useAuth()
  const { merchant } = useMerchantSub()
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [found, setFound] = useState<FoundData | null>(null)
  const [picker, setPicker] = useState<PickerData | null>(null)
  const [noCampaign, setNoCampaign] = useState<Customer | null>(null)
  const [searching, setSearching] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [done, setDone] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function resolveFoundData(customer: Customer, memberships: Membership[]): Promise<void> {
    if (!merchant) return
    // Kampanyaları çek — silinmiş olanları filtrele
    const options: PickerOption[] = []
    await Promise.all(memberships.map(async (m) => {
      const cmpSnap = await getDoc(doc(db, 'merchants', merchant.id, 'campaigns', m.campaignId))
      if (cmpSnap.exists()) options.push({ membership: m, campaign: { id: cmpSnap.id, ...cmpSnap.data() } as Campaign })
    }))
    if (options.length === 0) { setNoCampaign(customer); return }

    // Ödül hakkı olanları filtrele
    const redeemable = options.filter((o) => o.membership.currentStamps >= o.campaign.requiredStamps)
    if (redeemable.length === 0) {
      const best = options[0]
      toast.error(`Yeterli ${best.campaign.type === 'points' ? 'puan' : 'damga'} yok. ${best.membership.currentStamps}/${best.campaign.requiredStamps}`)
      return
    }
    if (redeemable.length === 1) {
      setFound({ customer, membership: redeemable[0].membership, campaign: redeemable[0].campaign })
    } else {
      setPicker({ customer, options: redeemable })
    }
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

      await resolveFoundData(customer, [membership])
    } catch (err) { console.error(err); toast.error('QR okuma başarısız') }
    finally { setSearching(false) }
  }

  async function findByPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    const norm = normalizePhone(phone)
    if (norm.length !== 10) { toast.error('Geçerli bir telefon girin'); return }
    setSearching(true); setFound(null); setPicker(null); setNoCampaign(null); setDone(false)
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
      const memberships = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))
      await resolveFoundData(customer, memberships)
    } catch (err) { console.error(err); toast.error('Arama başarısız') }
    finally { setSearching(false) }
  }

  function selectCampaign(option: PickerOption) {
    if (!picker) return
    setFound({ customer: picker.customer, membership: option.membership, campaign: option.campaign })
    setPicker(null)
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

  function reset() { setPhone(''); setNote(''); setFound(null); setPicker(null); setNoCampaign(null); setDone(false) }

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

      {noCampaign && !found && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-amber-900">{noCampaign.fullName}</p>
              <p className="text-sm text-amber-700 mt-1">
                Bu müşterinin kayıtlı kampanyası silinmiş veya bulunamadı.
                Müşteri detayından yeni bir kampanyaya ekleyebilirsiniz.
              </p>
            </div>
          </div>
          <Link
            to={`/app/customers/${noCampaign.id}`}
            className="block w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center hover:bg-amber-700 transition-colors"
          >
            Müşteri Detayına Git →
          </Link>
        </div>
      )}

      {picker && (
        <div className="bg-white rounded-2xl border border-purple-200 p-5 space-y-3">
          <div>
            <p className="font-bold text-gray-900">{picker.customer.fullName}</p>
            <p className="text-sm text-gray-500">Hangi kampanya ödülü kullandırılsın?</p>
          </div>
          <div className="space-y-2">
            {picker.options.map((opt) => (
              <button key={opt.campaign.id} onClick={() => selectCampaign(opt)}
                className="w-full text-left bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-xl p-3 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{opt.campaign.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.campaign.rewardDescription}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ödül hakkı var</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setPicker(null)} className="text-xs text-gray-400 hover:text-gray-600">İptal</button>
        </div>
      )}

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
