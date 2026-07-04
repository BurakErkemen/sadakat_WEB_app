import { useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { useLocation, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db, addStamp } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { normalizePhone, formatPhone } from '@/lib/phone'
import QRScanner from '@/components/QRScanner'
import type { Customer, Membership, Campaign } from '@/types'

interface FoundData { customer: Customer; membership: Membership; campaign: Campaign }
interface PickerOption { membership: Membership; campaign: Campaign }
interface PickerData { customer: Customer; options: PickerOption[] }


export default function StampPage() {
  const { user } = useAuth()
  const { merchant, features } = useMerchantSub()
  const location = useLocation()

  const [phone, setPhone] = useState((location.state as { searchPhone?: string })?.searchPhone ?? '')
  const [note, setNote] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [found, setFound] = useState<FoundData | null>(null)
  const [picker, setPicker] = useState<PickerData | null>(null)
  const [noCampaign, setNoCampaign] = useState<Customer | null>(null)
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null)
  const [noMembership, setNoMembership] = useState<Customer | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
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

  async function resolveFoundData(customer: Customer, membership: Membership): Promise<void> {
    if (!merchant) return
    const campSnap = await getDoc(doc(db, 'merchants', merchant.id, 'campaigns', membership.campaignId))
    if (!campSnap.exists()) { setNoCampaign(customer); return }
    setFound({ customer, membership, campaign: { id: campSnap.id, ...campSnap.data() } as Campaign })
  }

  async function handleQRScan(cardToken: string) {
    setShowScanner(false)
    if (!merchant) return
    setSearching(true)
    setNotFoundPhone(null); setNoMembership(null); setQrError(null)
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

      await resolveFoundData(customer, membership)
    } catch (err) { console.error(err); setQrError('QR okunamadı. Tekrar deneyin veya telefonla arayın.') }
    finally { setSearching(false) }
  }

  async function searchCustomer({ normalizedPhone }: { normalizedPhone: string }) {
    if (!merchant) return
    setSearching(true); setFound(null); setPicker(null); setNoCampaign(null); setDone(false)
    setNotFoundPhone(null); setNoMembership(null); setQrError(null)
    try {
      const cSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'customers'),
        where('normalizedPhone', '==', normalizedPhone)
      ))
      if (cSnap.empty) { setNotFoundPhone(normalizedPhone); return }
      const customer = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Customer

      const mSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id), where('status', '==', 'active')
      ))
      if (mSnap.empty) { setNoMembership(customer); return }
      const memberships = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))

      // Kampanyaları çek — silinmiş olanları filtrele
      const options: PickerOption[] = []
      await Promise.all(memberships.map(async (m) => {
        const cmpSnap = await getDoc(doc(db, 'merchants', merchant.id, 'campaigns', m.campaignId))
        if (cmpSnap.exists()) options.push({ membership: m, campaign: { id: cmpSnap.id, ...cmpSnap.data() } as Campaign })
      }))

      if (options.length === 0) { setNoCampaign(customer); return }
      if (options.length === 1) {
        setFound({ customer, membership: options[0].membership, campaign: options[0].campaign })
      } else {
        setPicker({ customer, options })
      }
    } catch (err) { console.error(err); toast.error('Arama başarısız') }
    finally { setSearching(false) }
  }

  function selectCampaign(option: PickerOption) {
    if (!picker) return
    setFound({ customer: picker.customer, membership: option.membership, campaign: option.campaign })
    setPicker(null)
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

  function reset() {
    setPhone(''); setNote(''); setPurchaseAmount(''); setFound(null); setPicker(null)
    setNoCampaign(null); setNotFoundPhone(null); setNoMembership(null); setQrError(null); setDone(false)
  }

  const isPoints = found?.campaign.type === 'points'
  const earnedAmount = found ? (isPoints ? calcPoints(found.campaign) : 1) : 0
  const newTotal = found ? found.membership.currentStamps + earnedAmount : 0
  // Sadece eşiğin altındayken ve bu damgayla aşılıyorsa uyar
  const willReward = found
    ? found.membership.currentStamps < found.campaign.requiredStamps && newTotal >= found.campaign.requiredStamps
    : false

  return (
    <div className="space-y-5">
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <h1 className="text-xl font-bold text-gray-900">Damga / Puan Ekle</h1>

      {/* Arama yöntemleri */}
      <div className="bg-white rounded-2xl border-2 border-indigo-100 p-4 space-y-3">
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
                ? 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
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
            className="min-h-12 flex-1 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {/* Müşteri bulunamadı — kalıcı inline durum + tek dokunuşla çözüm */}
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

      {/* Kampanya seçici (birden fazla aktif kampanya varsa) */}
      {picker && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-3">
          <div>
            <p className="font-bold text-gray-900">{picker.customer.fullName}</p>
            <p className="text-sm text-gray-500">Hangi kampanyaya damga eklensin?</p>
          </div>
          <div className="space-y-2">
            {picker.options.map((opt) => (
              <button key={opt.campaign.id} onClick={() => selectCampaign(opt)}
                className="w-full text-left bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl p-3 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{opt.campaign.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {opt.membership.currentStamps} / {opt.campaign.requiredStamps}{' '}
                      {opt.campaign.type === 'points' ? 'puan' : 'damga'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${opt.campaign.type === 'points' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {opt.campaign.type === 'points' ? '🏆 Puan' : '✅ Damga'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setPicker(null)} className="text-xs text-gray-400 hover:text-gray-600">İptal</button>
        </div>
      )}

      {/* Kampanyası olmayan müşteri */}
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

          {willReward && (
            <Link
              to="/app/redeem"
              state={{ searchPhone: found.customer.phone }}
              className="tap-scale block w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-purple-700"
            >
              Ödülü Şimdi Kullandır
            </Link>
          )}

          {/* Sonraki işlem seçenekleri — kasiyer akışı kesintisiz devam eder */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => {
                // Yerel sayacı güncelle, aynı müşteriyle forma geri dön
                setFound((prev) => prev
                  ? { ...prev, membership: { ...prev.membership, currentStamps: prev.membership.currentStamps + earnedAmount } }
                  : prev)
                setNote(''); setPurchaseAmount(''); setDone(false)
              }}
              className="tap-scale bg-green-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-700"
            >
              ➕ Aynı Müşteriye Tekrar
            </button>
            <Link
              to="/app/qr"
              state={{ cardToken: found.membership.cardToken }}
              className="tap-scale bg-indigo-50 text-indigo-700 py-3 rounded-xl font-semibold text-sm flex items-center justify-center hover:bg-indigo-100"
            >
              📱 Kart Linkini Göster
            </Link>
          </div>
          <button onClick={reset} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm">
            Yeni İşlem
          </button>
        </div>
      )}
    </div>
  )
}
