import { useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db, redeemReward } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { normalizePhone, formatPhone } from '@/lib/phone'
import QRScanner from '@/components/QRScanner'
import { Link, useLocation } from 'react-router-dom'
import type { Customer, Membership, Campaign } from '@/types'

interface FoundData { customer: Customer; membership: Membership; campaign: Campaign }
interface PickerOption { membership: Membership; campaign: Campaign }
interface PickerData { customer: Customer; options: PickerOption[] }


export default function RedeemPage() {
  const { user } = useAuth()
  const { merchant, features } = useMerchantSub()
  const location = useLocation()
  const [phone, setPhone] = useState((location.state as { searchPhone?: string })?.searchPhone ?? '')
  const [note, setNote] = useState('')
  const [found, setFound] = useState<FoundData | null>(null)
  const [picker, setPicker] = useState<PickerData | null>(null)
  const [noCampaign, setNoCampaign] = useState<Customer | null>(null)
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null)
  const [noMembership, setNoMembership] = useState<Customer | null>(null)
  const [insufficient, setInsufficient] = useState<{ customer: Customer; option: PickerOption } | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
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

    // Ödül hakkı olanları filtrele — en çok ilerlemiş üyelik ekranda kalıcı gösterilir
    const redeemable = options.filter((o) => o.membership.currentStamps >= o.campaign.requiredStamps)
    if (redeemable.length === 0) {
      const best = options.reduce((a, b) =>
        (b.membership.currentStamps / Math.max(1, b.campaign.requiredStamps)) >
        (a.membership.currentStamps / Math.max(1, a.campaign.requiredStamps)) ? b : a
      )
      setInsufficient({ customer, option: best })
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
    setNotFoundPhone(null); setNoMembership(null); setInsufficient(null); setQrError(null)
    try {
      const cardSnap = await getDoc(doc(db, 'publicCards', cardToken))
      if (!cardSnap.exists()) { setQrError('Kart bulunamadı. Link yanlış veya kart silinmiş olabilir.'); return }
      const { membershipId, merchantId } = cardSnap.data() as { membershipId: string; merchantId: string }
      if (merchantId !== merchant.id) { setQrError('Bu kart sizin işletmenize ait değil.'); return }

      const mSnap = await getDoc(doc(db, 'merchants', merchant.id, 'memberships', membershipId))
      if (!mSnap.exists()) { setQrError('Bu karta bağlı üyelik bulunamadı.'); return }
      const membership = { id: mSnap.id, ...mSnap.data() } as Membership

      const cSnap = await getDoc(doc(db, 'merchants', merchant.id, 'customers', membership.customerId))
      if (!cSnap.exists()) { setQrError('Bu karta bağlı müşteri kaydı bulunamadı.'); return }
      const customer = { id: cSnap.id, ...cSnap.data() } as Customer

      await resolveFoundData(customer, [membership])
    } catch (err) { console.error(err); setQrError('QR okunamadı. Tekrar deneyin veya telefonla arayın.') }
    finally { setSearching(false) }
  }

  async function findByPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    const norm = normalizePhone(phone)
    if (norm.length !== 10) { toast.error('Geçerli bir telefon girin'); return }
    setSearching(true); setFound(null); setPicker(null); setNoCampaign(null); setDone(false)
    setNotFoundPhone(null); setNoMembership(null); setInsufficient(null); setQrError(null)
    try {
      const cSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'customers'),
        where('normalizedPhone', '==', norm)
      ))
      if (cSnap.empty) { setNotFoundPhone(norm); return }
      const customer = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Customer

      const mSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id), where('status', '==', 'active')
      ))
      if (mSnap.empty) { setNoMembership(customer); return }
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

  function reset() {
    setPhone(''); setNote(''); setFound(null); setPicker(null)
    setNoCampaign(null); setNotFoundPhone(null); setNoMembership(null); setInsufficient(null); setQrError(null); setDone(false)
  }

  const isPoints = found?.campaign.type === 'points'
  const label = isPoints ? 'puan' : 'damga'
  const remaining = found ? Math.max(0, found.membership.currentStamps - found.campaign.requiredStamps) : 0

  return (
    <div className="space-y-5">
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <h1 className="text-xl font-bold text-gray-900">Ödül Kullandır</h1>

      {/* Arama yöntemleri */}
      <div className="bg-white rounded-2xl border-2 border-purple-100 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hızlı müşteri bul</p>
            <p className="text-sm text-gray-500">Telefon yazın veya kart QR'ını okutun.</p>
          </div>
          <button
            type="button"
            onClick={() => features.qrLookup ? setShowScanner(true) : undefined}
            disabled={!features.qrLookup}
            aria-label={features.qrLookup ? 'QR tara' : 'QR tarama bu planda pasif'}
            className={`tap-scale min-h-12 rounded-xl px-4 text-sm font-semibold shrink-0 border transition-colors ${
              features.qrLookup
                ? 'bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100'
                : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {features.qrLookup ? 'QR Tara' : 'QR Kilitli'}
          </button>
        </div>
        <form onSubmit={findByPhone} className="flex gap-2">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="search"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            className="min-h-12 flex-1 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="0532 000 00 00"
          />
          <button type="submit" disabled={searching}
            className="tap-scale min-h-12 bg-gray-900 text-white px-5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {searching ? 'Aranıyor…' : 'Ara'}
          </button>
        </form>
      </div>

      {/* QR hatası — kalıcı inline durum */}
      {qrError && !found && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-3">
          <p className="text-3xl">📵</p>
          <p className="text-sm font-semibold text-red-800">{qrError}</p>
          <button
            onClick={() => { setQrError(null); setShowScanner(true) }}
            className="tap-scale w-full bg-red-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            📷 Tekrar Tara
          </button>
        </div>
      )}

      {/* Müşteri bulunamadı — kalıcı inline durum */}
      {notFoundPhone && !found && (
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-center space-y-3">
          <p className="text-3xl">🔍</p>
          <div>
            <p className="font-bold text-gray-900">Müşteri bulunamadı</p>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium">{formatPhone(notFoundPhone)}</span> numarasıyla kayıtlı müşteri yok.
            </p>
          </div>
          <Link
            to="/app/customers/new"
            state={{ phone: formatPhone(notFoundPhone) }}
            className="tap-scale block w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            👤 Yeni Müşteri Ekle
          </Link>
        </div>
      )}

      {/* Aktif üyeliği olmayan müşteri */}
      {noMembership && !found && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-amber-900">{noMembership.fullName}</p>
              <p className="text-sm text-amber-700 mt-1">
                Bu müşterinin aktif kampanya üyeliği yok. Müşteri detayından bir kampanyaya ekleyin.
              </p>
            </div>
          </div>
          <Link
            to={`/app/customers/${noMembership.id}`}
            className="tap-scale block w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center hover:bg-amber-700 transition-colors"
          >
            Müşteri Detayına Git →
          </Link>
        </div>
      )}

      {/* Yetersiz damga/puan — müşteri ve eksik miktar ekranda kalıcı */}
      {insufficient && !found && (() => {
        const { customer, option } = insufficient
        const unit = option.campaign.type === 'points' ? 'puan' : 'damga'
        const current = option.membership.currentStamps
        const required = option.campaign.requiredStamps
        const missing = Math.max(0, required - current)
        const pct = required > 0 ? Math.min(100, (current / required) * 100) : 0
        return (
          <div className="bg-white border-2 border-purple-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900 text-lg">{customer.fullName}</p>
                <p className="text-sm text-gray-500">{option.campaign.name}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium shrink-0">
                Henüz ödül yok
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-2xl font-bold text-purple-700">
                  {current}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {required} {unit}</span>
                </p>
                <p className="text-sm font-semibold text-amber-600">{missing} {unit} eksik</p>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link
              to="/app/stamp"
              state={{ searchPhone: customer.phone }}
              className="tap-scale block w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold text-center hover:bg-green-700 transition-colors"
            >
              ✅ Damga Ekle
            </Link>
          </div>
        )
      })()}

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
          <Link
            to="/app/stamp"
            state={{ searchPhone: found.customer.phone }}
            className="tap-scale block w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-700"
          >
            Bu Müşteriye Damga Ekle
          </Link>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link
              to="/app/qr"
              state={{ cardToken: found.membership.cardToken }}
              className="tap-scale bg-indigo-50 text-indigo-700 py-3 rounded-xl font-semibold text-sm flex items-center justify-center hover:bg-indigo-100"
            >
              📱 Kart Linkini Göster
            </Link>
            <button onClick={reset} className="tap-scale bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm">
              Yeni İşlem
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
