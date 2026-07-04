import { useEffect, useState } from 'react'
import { doc, getDoc, collection, getDocs, query, where, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db, enrollCustomerInCampaign } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { formatDate, formatDateTime } from '@/lib/dates'
import { maskName } from '@/lib/utils'
import type { Customer, Membership, Campaign, Transaction } from '@/types'

const TX_LABELS: Record<string, string> = {
  stamp_add: 'Damga / Puan',
  reward_redeem: 'Ödül',
  manual_adjustment: 'Düzeltme',
}
const TX_COLORS: Record<string, string> = {
  stamp_add: 'bg-green-100 text-green-700',
  reward_redeem: 'bg-purple-100 text-purple-700',
  manual_adjustment: 'bg-amber-100 text-amber-700',
}

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const { merchant } = useMerchant()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [allMemberships, setAllMemberships] = useState<Membership[]>([])
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [campaignMap, setCampaignMap] = useState<Map<string, Campaign>>(new Map())
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollCampaignId, setEnrollCampaignId] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    if (!merchant || !customer) return
    setDeleting(true)
    try {
      // Müşteri + tüm üyelikleri + public kartları tek batch'te silinir (orphan kart kalmaz)
      const memSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id)
      ))
      const batch = writeBatch(db)
      memSnap.docs.forEach((d) => {
        const cardToken = d.data()['cardToken'] as string | undefined
        if (cardToken) batch.delete(doc(db, 'publicCards', cardToken))
        batch.delete(d.ref)
      })
      batch.delete(doc(db, 'merchants', merchant.id, 'customers', customer.id))
      await batch.commit()
      toast.success('Müşteri silindi')
      navigate('/app/customers')
    } catch (err) {
      console.error(err)
      toast.error('Silme başarısız')
      setDeleting(false)
    }
  }

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null)

  function selectMembership(mem: Membership) {
    setMembership(mem)
    setSelectedMembershipId(mem.id)
    setCampaign(campaignMap.get(mem.campaignId) ?? null)
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant || !customer || !enrollCampaignId) return
    setEnrolling(true)
    try {
      await enrollCustomerInCampaign({
        merchantId: merchant.id,
        customerId: customer.id,
        campaignId: enrollCampaignId,
        customerDisplayName: customer.fullName,
      })
      toast.success('Müşteri kampanyaya eklendi')
      setEnrollCampaignId('')
      // Üyelikleri yenile
      const mSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id), where('status', '==', 'active')
      ))
      const mems = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))
      setAllMemberships(mems)
      if (mems.length > 0 && !membership) {
        setMembership(mems[0])
        const campSnap = await getDoc(doc(db, 'merchants', merchant.id, 'campaigns', mems[0].campaignId))
        if (campSnap.exists()) setCampaign({ id: campSnap.id, ...campSnap.data() } as Campaign)
      }
    } catch (err) {
      console.error(err)
      toast.error('Kampanyaya eklenemedi')
    } finally {
      setEnrolling(false)
    }
  }

  function startEdit() {
    if (!customer) return
    setEditName(customer.fullName)
    setEditPhone(customer.phone)
    setEditNote(customer.note ?? '')
    setEditPhoneError(null)
    setEditing(true)
  }

  async function checkPhoneDuplicate(rawPhone: string): Promise<string | null> {
    if (!merchant || !customer) return null
    const norm = normalizePhone(rawPhone)
    if (norm.length !== 10) return null
    if (norm === customer.normalizedPhone) return null // aynı numara, sorun yok
    const snap = await getDocs(query(
      collection(db, 'merchants', merchant.id, 'customers'),
      where('normalizedPhone', '==', norm)
    ))
    if (snap.empty) return null
    const other = snap.docs[0].data()['fullName'] as string
    return `Bu numara zaten kayıtlı: ${other}`
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant || !customer) return
    const norm = normalizePhone(editPhone)
    if (norm.length !== 10) { toast.error('Geçerli bir telefon numarası girin'); return }
    const dupErr = await checkPhoneDuplicate(editPhone)
    if (dupErr) { setEditPhoneError(dupErr); return }
    setEditSaving(true)
    try {
      const trimmedName = editName.trim()
      const batch = writeBatch(db)

      // Müşteri dokümanı
      batch.update(doc(db, 'merchants', merchant.id, 'customers', customer.id), {
        fullName: trimmedName,
        phone: editPhone.trim(),
        normalizedPhone: norm,
        note: editNote.trim() || null,
        updatedAt: serverTimestamp(),
      })

      // Bu müşteriye ait tüm public kartları güncelle (aktif + pasif)
      const allMemSnap = await getDocs(query(
        collection(db, 'merchants', merchant.id, 'memberships'),
        where('customerId', '==', customer.id)
      ))
      allMemSnap.docs.forEach((d) => {
        const cardToken = d.data()['cardToken'] as string
        if (cardToken) {
          batch.update(doc(db, 'publicCards', cardToken), {
            customerDisplayName: maskName(trimmedName), // public dokümanda tam ad tutulmaz
            lastUpdatedAt: serverTimestamp(),
          })
        }
      })

      await batch.commit()
      setCustomer((prev) => prev ? { ...prev, fullName: trimmedName, phone: editPhone.trim(), normalizedPhone: norm, note: editNote.trim() || null } : prev)
      toast.success('Müşteri bilgileri güncellendi')
      setEditing(false)
    } catch (err) {
      console.error(err)
      toast.error('Güncelleme başarısız')
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    if (!merchant || !customerId) return

    async function load() {
      setLoading(true)
      try {
        const cSnap = await getDoc(doc(db, 'merchants', merchant!.id, 'customers', customerId!))
        if (!cSnap.exists()) { navigate('/app/customers'); return }
        const cust = { id: cSnap.id, ...cSnap.data() } as Customer
        setCustomer(cust)

        // Tüm üyelikler
        const mSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'memberships'),
          where('customerId', '==', customerId), where('status', '==', 'active')
        ))
        const mems = mSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))
        setAllMemberships(mems)
        if (mems.length > 0) {
          setMembership(mems[0])
          setSelectedMembershipId(mems[0].id)
        }

        // Tüm kampanyalar — hem selector hem enroll için
        const campAllSnap = await getDocs(collection(db, 'merchants', merchant!.id, 'campaigns'))
        const allCamps = campAllSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign))
        setAllCampaigns(allCamps)
        const cMap = new Map(allCamps.map((c) => [c.id, c]))
        setCampaignMap(cMap)
        if (mems.length > 0) setCampaign(cMap.get(mems[0].campaignId) ?? null)

        // İşlem geçmişi
        const txSnap = await getDocs(query(
          collection(db, 'merchants', merchant!.id, 'transactions'),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc')
        ))
        setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id, customerId])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32" />
      <div className="h-28 bg-gray-200 rounded-2xl" />
      <div className="h-40 bg-gray-200 rounded-2xl" />
    </div>
  )

  if (!customer) return null

  const isPoints = campaign?.type === 'points'
  const label = isPoints ? 'puan' : 'damga'
  const progress = membership && campaign
    ? Math.min(100, (membership.currentStamps / campaign.requiredStamps) * 100)
    : 0
  const hasReward = membership && campaign
    ? membership.currentStamps >= campaign.requiredStamps
    : false

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">Müşteri Detayı</h1>
      </div>

      {/* Müşteri bilgisi */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        {editing ? (
          <form onSubmit={(e) => { void handleSaveEdit(e) }} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ad Soyad</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => { setEditPhone(e.target.value); setEditPhoneError(null) }}
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${editPhoneError ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`}
              />
              {editPhoneError && <p className="text-xs text-red-600 mt-1">{editPhoneError}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Not (opsiyonel)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="VIP müşteri, doğum günü…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={editSaving}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {editSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">
                İptal
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">{customer.fullName}</p>
                <p className="text-gray-500">{formatPhone(customer.normalizedPhone)}</p>
                {customer.note && <p className="text-sm text-gray-400 mt-1">{customer.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">{formatDate(customer.createdAt)}</p>
                <button onClick={startEdit}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Düzenle" aria-label="Müşteri bilgilerini düzenle">
                  ✏️
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/app/stamp"
                state={{ searchPhone: customer.normalizedPhone }}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center"
              >
                ✅ {isPoints ? 'Puan Ekle' : 'Damga Ekle'}
              </Link>
              <Link
                to="/app/redeem"
                state={{ searchPhone: customer.normalizedPhone }}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold text-center"
              >
                🎁 Ödül Kullandır
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Çoklu kampanya seçici — birden fazla aktif üyelik varsa göster */}
      {allMemberships.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Kampanya Seç</p>
          <div className="flex flex-col gap-1.5">
            {allMemberships.map((mem) => {
              const camp = campaignMap.get(mem.campaignId)
              const isSelected = selectedMembershipId === mem.id
              return (
                <button key={mem.id} onClick={() => selectMembership(mem)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50'
                  }`}>
                  <span className="font-medium">{camp?.name ?? '—'}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {mem.currentStamps} / {camp?.requiredStamps ?? '?'} {camp?.type === 'points' ? 'puan' : 'damga'}
                  </span>
                  {mem.currentStamps >= (camp?.requiredStamps ?? Infinity) && (
                    <span className="text-xs text-green-600 font-semibold ml-2">🎁 Ödül var</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Üyelik / Kart durumu */}
      {membership && campaign ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">{campaign.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isPoints ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {isPoints ? '🏆 Puan' : '✅ Damga'}
            </span>
          </div>

          {/* İlerleme çubuğu */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{membership.currentStamps} {label}</span>
              <span className="text-gray-400">Hedef: {campaign.requiredStamps}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isPoints ? 'bg-purple-500' : 'bg-indigo-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {hasReward && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-semibold">
              🎉 Ödül hakkı mevcut! — {campaign.rewardDescription}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Toplam Kazanılan</p>
              <p className="font-bold text-gray-900">{membership.totalEarnedStamps}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Mevcut</p>
              <p className="font-bold text-gray-900">{membership.currentStamps}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Kullanılan Ödül</p>
              <p className="font-bold text-gray-900">{membership.totalRedeemedRewards}</p>
            </div>
          </div>

          {/* Kart linki */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-500">Müşteri Kart Linki</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/c/${membership.cardToken}`)
                    toast.success('Link kopyalandı!')
                  }}
                  className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 px-2 py-1 rounded-lg transition-colors"
                >
                  📋 Kopyala
                </button>
                <a
                  href={`/c/${membership.cardToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-2 py-1 rounded-lg transition-colors"
                >
                  ↗ Aç
                </a>
              </div>
            </div>
            <p className="text-xs font-mono text-gray-400 break-all">/c/{membership.cardToken}</p>
          </div>
          <p className="text-xs text-gray-400">Oluşturulma: {formatDate(membership.createdAt)}</p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Bu müşterinin aktif üyeliği yok.
        </div>
      )}

      {/* Yeni kampanyaya ekle */}
      {(() => {
        const joinedIds = new Set(allMemberships.map((m) => m.campaignId))
        const available = allCampaigns.filter((c) => !joinedIds.has(c.id))
        if (available.length === 0) return null
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 mb-3">Kampanyaya Ekle</p>
            <form onSubmit={(e) => { void handleEnroll(e) }} className="flex gap-2">
              <select
                value={enrollCampaignId}
                onChange={(e) => setEnrollCampaignId(e.target.value)}
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Kampanya seçin…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="submit" disabled={enrolling || !enrollCampaignId}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {enrolling ? '…' : 'Ekle'}
              </button>
            </form>
          </div>
        )
      })()}

      {/* Müşteri sil */}
      <div className="bg-white rounded-2xl border border-red-100 p-5">
        <p className="font-semibold text-gray-900 mb-1">Tehlikeli Alan</p>
        <p className="text-xs text-gray-400 mb-3">
          Müşteri kaydı, tüm kampanya üyelikleri ve sadakat kartları kalıcı olarak silinir;
          müşterinin kart linki artık açılmaz. İşlem geçmişi denetim için saklanır.
        </p>
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700 font-medium">Emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex gap-2">
              <button onClick={() => void handleDelete()} disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {deleting ? 'Siliniyor…' : 'Evet, Sil'}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">
                İptal
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
            🗑️ Müşteriyi Sil
          </button>
        )}
      </div>

      {/* İşlem geçmişi */}
      <div>
        <p className="font-semibold text-gray-900 mb-3">İşlem Geçmişi ({transactions.length})</p>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Henüz işlem yok</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TX_COLORS[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TX_LABELS[tx.type] ?? tx.type}
                    </span>
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-700' : 'text-purple-700'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} {label}
                    </span>
                    {tx.purchaseAmount != null && (
                      <span className="text-xs text-gray-400">{tx.purchaseAmount} TL</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</span>
                </div>
                {tx.note && <p className="text-xs text-gray-400 mt-1">{tx.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
