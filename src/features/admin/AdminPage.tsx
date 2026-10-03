import { useEffect, useState } from 'react'
import {
  collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, Timestamp,
  query, orderBy,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { formatDate, formatDateTime } from '@/lib/dates'
import type { Merchant, Subscription, SupportTicket, UserProfile, Campaign } from '@/types'
import AdminMerchantReport from './AdminMerchantReport'
import AdminAuditTab from './AdminAuditTab'
import AdminFinanceTab from './AdminFinanceTab'
import { recordAdminAction } from './adminAudit'
import { requestAccountDeletion } from './accountDeletion'

type Tab = 'merchants' | 'pricing' | 'support' | 'users' | 'finance' | 'audit'

// ─── Plan tanımları (label, limitler) ────────────────────────────────────────
const PLAN_META = [
  {
    id: 'trial', label: 'Deneme (Trial)', defaultMonthly: 0, defaultYearly: 0,
    defaultMaxCustomers: 50, defaultMaxTx: 200, defaultMaxCampaigns: 1,
    features: ['50 müşteri', '200 işlem/ay', '1 kampanya', 'QR + Telefon arama', '14 gün ücretsiz'],
  },
  {
    id: 'mini', label: 'Mini', defaultMonthly: 99, defaultYearly: 79,
    defaultMaxCustomers: 200, defaultMaxTx: 500, defaultMaxCampaigns: 2,
    features: ['200 müşteri', '500 işlem/ay', '2 kampanya', 'E-posta destek', '❌ QR/Telefon arama yok'],
  },
  {
    id: 'standard', label: 'Standart', defaultMonthly: 199, defaultYearly: 159,
    defaultMaxCustomers: 1000, defaultMaxTx: 3000, defaultMaxCampaigns: 5,
    features: ['1.000 müşteri', '3.000 işlem/ay', '5 kampanya', 'QR + Telefon arama', 'Öncelikli destek'],
    isPopular: true,
  },
  {
    id: 'pro', label: 'Pro', defaultMonthly: 399, defaultYearly: 319,
    defaultMaxCustomers: -1, defaultMaxTx: -1, defaultMaxCampaigns: -1,
    features: ['Sınırsız müşteri', 'Sınırsız işlem', 'Sınırsız kampanya', 'QR + Telefon arama', '7/24 destek', 'Gelişmiş analitik'],
  },
]

type PlanData = {
  id: string; label: string; isPopular?: boolean
  monthlyPrice: number; yearlyPrice: number
  shopierMonthlyUrl: string; shopierYearlyUrl: string
  features: string[]
  maxCustomers: number; maxMonthlyTransactions: number; maxCampaigns: number
}

function TabBtn({ tab, active, label, badge, onClick }: { tab: Tab; active: Tab; label: string; badge?: number; onClick: (t: Tab) => void }) {
  return (
    <button onClick={() => onClick(tab)}
      className={`min-w-0 py-2.5 px-1 text-xs sm:text-sm font-medium rounded-lg transition-colors relative ${active === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('merchants')
  const [openTickets, setOpenTickets] = useState(0)
  const [pendingApps, setPendingApps] = useState(0)

  useEffect(() => {
    getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')))
      .then((snap) => setOpenTickets(snap.docs.filter((d) => d.data()['status'] === 'open').length))
      .catch(console.error)
    // badge: son 7 günde kayıt olan kullanıcı sayısı
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
        setPendingApps(snap.docs.filter((d) => {
          const ts = d.data()['createdAt']
          return ts && ts.toMillis && ts.toMillis() > weekAgo
        }).length)
      })
      .catch(console.error)
  }, [])

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      <div className="bg-white rounded-xl border border-gray-200 p-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sticky top-[57px] z-[5]">
        <TabBtn tab="merchants" active={tab} label="İşletmeler" onClick={setTab} />
        <TabBtn tab="users" active={tab} label="Üyeler" badge={pendingApps} onClick={setTab} />
        <TabBtn tab="pricing" active={tab} label="Fiyatlandırma" onClick={setTab} />
        <TabBtn tab="finance" active={tab} label="Finans" onClick={setTab} />
        <TabBtn tab="audit" active={tab} label="Loglar" onClick={setTab} />
        <TabBtn tab="support" active={tab} label="Destek" badge={openTickets} onClick={setTab} />
      </div>

      {tab === 'merchants' && <MerchantsTab />}
      {tab === 'users' && <UsersTab onCountChange={setPendingApps} />}
      {tab === 'pricing' && <PricingTab />}
      {tab === 'finance' && <AdminFinanceTab />}
      {tab === 'audit' && <AdminAuditTab />}
      {tab === 'support' && <SupportTab onCountChange={setOpenTickets} />}
    </div>
  )
}

// ─── 0. Üyeler ───────────────────────────────────────────────────────────────
type AppUser = UserProfile & { id: string }
type UserRow = AppUser & { subscription?: Subscription }

function UsersTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const adminUids = (import.meta.env.VITE_ADMIN_UIDS ?? '').split(',').filter(Boolean)
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppUser))
        .filter((u) => !adminUids.includes(u.id))

      // Her kullanıcı için varsa aboneliği çek
      const withSubs = await Promise.all(all.map(async (u): Promise<UserRow> => {
        if (!u.merchantId) return u
        try {
          const subSnap = await getDoc(doc(db, 'merchants', u.merchantId, 'subscription', 'current'))
          return { ...u, subscription: subSnap.exists() ? (subSnap.data() as Subscription) : undefined }
        } catch { return u }
      }))

      // En yeni kayıt üste
      const sorted = withSubs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tb = b.createdAt?.toMillis?.() ?? 0
        return tb - ta
      })
      setUsers(sorted)

      // Badge: son 7 günde kayıt
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
      onCountChange(sorted.filter((u) => (u.createdAt?.toMillis?.() ?? 0) > weekAgo).length)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])

  async function setUserStatus(u: UserRow, status: 'approved' | 'rejected') {
    setApprovingId(u.id + status)
    try {
      await updateDoc(doc(db, 'users', u.id), { status, updatedAt: serverTimestamp() })
      await recordAdminAction({ action: 'user.status_changed', targetType: 'user', targetId: u.id, merchantId: u.merchantId, summary: `${u.displayName || u.email} kullanıcısının durumu ${status} olarak değiştirildi`, metadata: { status } })
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status } : x))
      toast.success(status === 'approved' ? 'Kullanıcı onaylandı' : 'Kullanıcı reddedildi')
    } catch (err) { console.error(err); toast.error('İşlem başarısız') }
    finally { setApprovingId(null) }
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`"${u.displayName || u.email}" hesabının erişimi kapatılacak ve işletmeleri pasife alınacak.\nAuth hesabını kalıcı silmek için ardından Firebase Console → Authentication bölümündeki kaydı silmelisiniz. Devam edilsin mi?`)) return
    setDeletingId(u.id)
    try {
      await requestAccountDeletion(u.id)
      toast.success('Erişim kapatıldı. Auth silme adımını tamamlayın.')
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: 'deletion_requested' } : x))
    } catch (err) { console.error(err); toast.error('Silinemedi') }
    finally { setDeletingId(null) }
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return !!(u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  })

  if (loading) return <div className="space-y-3 animate-pulse">{[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{users.length} kullanıcı</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara…" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-56" />
      </div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const sub = u.subscription
          const msLeft = sub?.currentPeriodEnd ? sub.currentPeriodEnd.toDate().getTime() - Date.now() : null
          const daysLeft = msLeft !== null ? Math.ceil(msLeft / 86_400_000) : null
          const isExpired = msLeft !== null && msLeft <= 0
          const isNew = (u.createdAt?.toMillis?.() ?? 0) > Date.now() - 7 * 24 * 3600 * 1000

          return (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{u.displayName ?? <span className="text-gray-400 font-normal">—</span>}</p>
                    {isNew && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Yeni</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{u.email ?? <span className="italic">e-posta yok</span>}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Kayıt: {u.createdAt ? formatDateTime(u.createdAt) : '—'}
                  </p>
                </div>

                <div className="flex flex-row flex-wrap sm:flex-col sm:items-end gap-1 shrink-0">
                  <button
                    disabled={deletingId === u.id || u.status === 'deletion_requested'}
                    onClick={() => void deleteUser(u)}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                    title="Hesap silme işlemini başlat"
                    aria-label="Hesap silme işlemini başlat"
                  >
                    {deletingId === u.id ? '…' : '🗑'}
                  </button>
                  {/* Kullanıcı durumu */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.status === 'approved' ? 'bg-green-100 text-green-700' :
                    u.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {u.status === 'deletion_requested' ? 'Erişim kapalı · Auth silme kontrolü gerekli' : u.status === 'approved' ? 'Aktif' : u.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                  </span>
                  {u.status === 'deletion_requested' && (
                    <div className="max-w-xs space-y-1 text-xs text-gray-600">
                      <p>Authentication kullanıcı listesinden bu UID'yi kontrol edip silin. Auth kaydı otomatik silinmez.</p>
                      <p className="font-mono break-all select-all">{u.id}</p>
                      <a href={`https://console.firebase.google.com/project/${encodeURIComponent(import.meta.env.VITE_FIREBASE_PROJECT_ID)}/authentication/users`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Firebase Authentication'ı Aç</a>
                    </div>
                  )}
                  {/* Onay / Red butonları */}
                  {u.status === 'pending' && (
                    <>
                      <button
                        disabled={!!approvingId}
                        onClick={() => void setUserStatus(u, 'approved')}
                        className="text-xs px-2 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                      >
                        {approvingId === u.id + 'approved' ? '…' : '✓ Onayla'}
                      </button>
                      <button
                        disabled={!!approvingId}
                        onClick={() => void setUserStatus(u, 'rejected')}
                        className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        {approvingId === u.id + 'rejected' ? '…' : '✕ Reddet'}
                      </button>
                    </>
                  )}
                  {u.status === 'rejected' && (
                    <button
                      disabled={!!approvingId}
                      onClick={() => void setUserStatus(u, 'approved')}
                      className="text-xs px-2 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                    >
                      {approvingId === u.id + 'approved' ? '…' : '↩ Yeniden Onayla'}
                    </button>
                  )}

                  {/* İşletme / abonelik durumu */}
                  {u.merchantId ? (
                    sub ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isExpired ? 'bg-red-100 text-red-600' :
                        sub.status === 'trialing' ? 'bg-violet-100 text-violet-700' :
                        sub.status === 'active' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {sub.status === 'trialing'
                          ? (isExpired ? 'Deneme Bitti' : `Deneme · ${daysLeft}g`)
                          : sub.status === 'active'
                          ? `${sub.plan === 'mini' ? 'Mini' : sub.plan === 'standard' ? 'Standart' : 'Pro'} · Aktif`
                          : sub.status === 'canceled' ? 'İptal' : 'Gecikmiş'}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">İşletme var</span>
                    )
                  ) : (
                    <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">Onboarding bekliyor</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 1. İşletmeler ───────────────────────────────────────────────────────────
type MerchantRow = Merchant & {
  subscription?: Subscription
  ownerEmail?: string | null
  ownerPhone?: string | null
  ownerName?: string | null
}
type CampaignRow = Campaign & { id: string }

const PLAN_LABEL: Record<string, string> = { trial: 'Deneme', mini: 'Mini', standard: 'Standart', pro: 'Pro' }
const SUB_STATUS_LABEL: Record<string, string> = { active: 'Aktif', trialing: 'Deneme', canceled: 'İptal', past_due: 'Gecikmiş' }

// Açılır detay paneli — owner email + kampanyalar
function MerchantDetailPanel({ merchant, subscription, onPlanChange, onStatusChange, onLocationUpdate }: {
  merchant: MerchantRow
  subscription?: Subscription
  onPlanChange: (plan: string, cycle: 'monthly' | 'yearly' | null) => Promise<void>
  onStatusChange: (status: 'active' | 'passive') => Promise<void>
  onLocationUpdate: (sector: string, city: string, district: string) => void
}) {
  const [ownerEmail, setOwnerEmail] = useState<string | null>(merchant.ownerEmail ?? null)
  const [ownerPhone, setOwnerPhone] = useState<string | null>(merchant.ownerPhone ?? null)
  const [ownerName, setOwnerName] = useState<string | null>(merchant.ownerName ?? null)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [editingLocation, setEditingLocation] = useState(false)
  const [editSector, setEditSector] = useState(merchant.sector)
  const [editCity, setEditCity] = useState(merchant.city)
  const [editDistrict, setEditDistrict] = useState(merchant.district)
  const [savingLocation, setSavingLocation] = useState(false)

  useEffect(() => {
    setLoadingDetail(true)
    Promise.all([
      getDoc(doc(db, 'users', merchant.ownerId)).then((s) => {
        const owner = s.exists() ? (s.data() as UserProfile) : null
        setOwnerEmail(owner?.email ?? null)
        setOwnerPhone(owner?.phone ?? null)
        setOwnerName(owner?.displayName ?? null)
      }).catch(console.error),
      getDocs(collection(db, 'merchants', merchant.id, 'campaigns')).then((s) => {
        setCampaigns(s.docs.map((d) => ({ id: d.id, ...d.data() } as CampaignRow)))
      }).catch(console.error),
    ]).finally(() => setLoadingDetail(false))
  }, [merchant.id, merchant.ownerId])

  async function toggleCampaign(c: CampaignRow) {
    setActionId(c.id)
    try {
      const next = c.status === 'active' ? 'passive' : 'active'
      await updateDoc(doc(db, 'merchants', merchant.id, 'campaigns', c.id), { status: next, updatedAt: serverTimestamp() })
      await recordAdminAction({ action: 'campaign.status_changed', targetType: 'campaign', targetId: c.id, merchantId: merchant.id, summary: `${merchant.name} / ${c.name} kampanyası ${next} yapıldı`, metadata: { status: next } })
      setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: next } : x))
    } catch (err) { console.error(err); toast.error('İşlem başarısız') }
    finally { setActionId(null) }
  }

  async function saveLocation() {
    if (!editSector.trim() || !editCity.trim() || !editDistrict.trim()) {
      toast.error('Tüm alanları doldurun')
      return
    }
    setSavingLocation(true)
    try {
      await updateDoc(doc(db, 'merchants', merchant.id), {
        sector: editSector.trim(),
        city: editCity.trim(),
        district: editDistrict.trim(),
        updatedAt: serverTimestamp(),
      })
      await recordAdminAction({ action: 'merchant.location_changed', targetType: 'merchant', targetId: merchant.id, merchantId: merchant.id, summary: `${merchant.name} konum bilgileri güncellendi`, metadata: { sector: editSector.trim(), city: editCity.trim(), district: editDistrict.trim() } })
      onLocationUpdate(editSector.trim(), editCity.trim(), editDistrict.trim())
      setEditingLocation(false)
      toast.success('Konum bilgileri güncellendi')
    } catch (err) {
      console.error(err)
      toast.error('Güncelleme başarısız')
    } finally {
      setSavingLocation(false)
    }
  }

  async function deleteCampaign(c: CampaignRow) {
    if (!confirm(`"${c.name}" kampanyasını silmek istediğinize emin misiniz?`)) return
    setActionId(c.id + 'del')
    try {
      await deleteDoc(doc(db, 'merchants', merchant.id, 'campaigns', c.id))
      await recordAdminAction({ action: 'campaign.deleted', targetType: 'campaign', targetId: c.id, merchantId: merchant.id, summary: `${merchant.name} / ${c.name} kampanyası silindi` })
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id))
      toast.success('Kampanya silindi')
    } catch (err) { console.error(err); toast.error('Silinemedi') }
    finally { setActionId(null) }
  }

  const sub = subscription

  return (
    <div className="border-t border-gray-100 pt-3 space-y-4">

      {/* İşletme bilgileri */}
      {loadingDetail ? (
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      ) : (
        <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {ownerEmail && (
            <div className="sm:col-span-2 flex items-center gap-1.5 text-gray-700">
              <span>✉️</span>
              <a href={`mailto:${ownerEmail}`} className="hover:underline truncate">{ownerEmail}</a>
            </div>
          )}
          {(ownerName || ownerPhone) && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700">
              {ownerName && <span className="truncate">👤 {ownerName}</span>}
              {ownerPhone && <a href={`tel:${ownerPhone}`} className="hover:underline truncate">📱 {ownerPhone}</a>}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-gray-600"><span>📞</span>{merchant.phone}</div>
          <div className="sm:col-span-2 flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-gray-600"><span>🏪</span>{merchant.sector}</div>
              <div className="flex items-center gap-1.5 text-gray-600"><span>📍</span>{merchant.city}, {merchant.district}</div>
            </div>
            <button onClick={() => setEditingLocation((v) => !v)}
              className="text-indigo-500 hover:text-indigo-700 text-xs underline shrink-0">
              {editingLocation ? 'İptal' : 'Düzenle'}
            </button>
          </div>
          {editingLocation && (
            <div className="sm:col-span-2 space-y-2 pt-1">
              <input
                value={editSector} onChange={(e) => setEditSector(e.target.value)}
                placeholder="Sektör"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={editCity} onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Şehir"
                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)}
                  placeholder="İlçe"
                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button onClick={() => void saveLocation()} disabled={savingLocation}
                className="w-full bg-indigo-600 text-white text-xs py-1.5 rounded-lg disabled:opacity-50">
                {savingLocation ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-gray-600 sm:col-span-2 min-w-0">
            <span>🔗</span>
            <a href={`/m/${merchant.slug}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              /m/{merchant.slug}
            </a>
          </div>
          {merchant.instagram && (
            <div className="flex items-center gap-1.5 text-gray-600 sm:col-span-2 min-w-0">
              <span>📷</span>
              <a href={`https://instagram.com/${merchant.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                @{merchant.instagram.replace(/^@/, '')}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Abonelik detayı */}
      {sub && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs space-y-1">
          <p className="font-semibold text-violet-800 mb-1.5">Abonelik</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
            <div className="flex justify-between col-span-2">
              <span>Plan</span>
              <span className="font-medium text-gray-800">
                {PLAN_LABEL[sub.plan] ?? sub.plan}
                {sub.billingCycle ? ` · ${sub.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}` : ''}
              </span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>Durum</span>
              <span className="font-medium text-gray-800">{SUB_STATUS_LABEL[sub.status] ?? sub.status}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>Başlangıç</span>
              <span className="font-medium text-gray-800">{formatDate(sub.currentPeriodStart)}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span>Bitiş</span>
              <span className={`font-medium ${sub.currentPeriodEnd.toDate() < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                {formatDate(sub.currentPeriodEnd)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Plan değiştir */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Değiştir</p>
        <div className="flex flex-wrap gap-1.5">
          <button disabled={!!actionId || sub?.plan === 'trial'}
            onClick={() => void onPlanChange('trial', null)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${sub?.plan === 'trial' ? 'bg-amber-100 border-amber-300 text-amber-700 font-medium' : 'border-gray-200 hover:bg-amber-50 hover:border-amber-300'}`}>
            Deneme (14g)
          </button>
          {(['mini','standard','pro'] as const).map((p) => (
            <div key={p} className="flex gap-0.5">
              <button disabled={!!actionId}
                onClick={() => void onPlanChange(p, 'monthly')}
                className={`text-xs px-2 py-1.5 rounded-l-lg border transition-colors disabled:opacity-40 ${sub?.plan === p && sub?.billingCycle === 'monthly' ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'border-gray-200 hover:bg-indigo-50 hover:border-indigo-300'}`}>
                {p}/ay
              </button>
              <button disabled={!!actionId}
                onClick={() => void onPlanChange(p, 'yearly')}
                className={`text-xs px-2 py-1.5 rounded-r-lg border-t border-r border-b transition-colors disabled:opacity-40 ${sub?.plan === p && sub?.billingCycle === 'yearly' ? 'bg-violet-100 border-violet-300 text-violet-700 font-medium' : 'border-gray-200 hover:bg-violet-50 hover:border-violet-300'}`}>
                /yıl
              </button>
            </div>
          ))}
        </div>
        <button disabled={!!actionId}
          onClick={() => void onStatusChange(merchant.status === 'active' ? 'passive' : 'active')}
          className={`text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40 ${merchant.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
          {merchant.status === 'active' ? 'İşletmeyi Pasife Al' : 'İşletmeyi Aktif Et'}
        </button>
      </div>

      {/* Kampanyalar */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Kampanyalar ({campaigns.length})
        </p>
        {loadingDetail ? (
          <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Henüz kampanya yok</p>
        ) : (
          <div className="space-y-1.5">
            {campaigns.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.type === 'stamp' ? 'Damga' : 'Puan'} · {c.requiredStamps} hedef
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:ml-2 shrink-0 self-end sm:self-auto">
                  <button
                    disabled={actionId === c.id}
                    onClick={() => void toggleCampaign(c)}
                    className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${c.status === 'active' ? 'border-gray-200 text-gray-500 hover:bg-gray-100' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                    {c.status === 'active' ? 'Pasife Al' : 'Aktif Et'}
                  </button>
                  <button
                    disabled={actionId === c.id + 'del'}
                    onClick={() => void deleteCampaign(c)}
                    className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MerchantsTab() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function digitsOnly(value?: string | null): string {
    return (value ?? '').replace(/\D/g, '')
  }

  function phoneSearchKeys(value?: string | null): string[] {
    const digits = digitsOnly(value)
    if (!digits) return []
    const withoutCountry = digits.startsWith('90') && digits.length > 10 ? digits.slice(2) : digits
    const withoutLeadingZero = withoutCountry.startsWith('0') ? withoutCountry.slice(1) : withoutCountry
    return [...new Set([digits, withoutCountry, withoutLeadingZero].filter(Boolean))]
  }

  async function load() {
    setLoading(true); setError(null)
    try {
      const snap = await getDocs(collection(db, 'merchants'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MerchantRow))
      const withSubs = await Promise.all(list.map(async (m): Promise<MerchantRow> => {
        try {
          const [subDoc, ownerDoc] = await Promise.all([
            getDoc(doc(db, 'merchants', m.id, 'subscription', 'current')),
            getDoc(doc(db, 'users', m.ownerId)),
          ])
          const owner = ownerDoc.exists() ? (ownerDoc.data() as UserProfile) : null
          return {
            ...m,
            subscription: subDoc.exists() ? (subDoc.data() as Subscription) : undefined,
            ownerEmail: owner?.email ?? null,
            ownerPhone: owner?.phone ?? null,
            ownerName: owner?.displayName ?? null,
          }
        } catch { return m }
      }))
      setMerchants(withSubs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isPermission = msg.includes('permission') || msg.includes('insufficient')
      setError(isPermission
        ? 'İzin reddedildi. Firestore kurallarını deploy edin: firebase deploy --only firestore:rules'
        : 'İşletmeler yüklenemedi. Sayfayı yenileyin veya konsolu kontrol edin.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function setPlan(merchantId: string, plan: string, billingCycle: 'monthly' | 'yearly' | null = null) {
    try {
      const subRef = doc(db, 'merchants', merchantId, 'subscription', 'current')
      const now = Timestamp.now()
      const days = plan === 'trial' ? 14 : billingCycle === 'yearly' ? 365 : 30
      await setDoc(subRef, {
        plan,
        status: plan === 'trial' ? 'trialing' : 'active',
        billingCycle: billingCycle ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: Timestamp.fromMillis(now.toMillis() + days * 24 * 3600 * 1000),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      const merchantName = merchants.find((item) => item.id === merchantId)?.name ?? merchantId
      await recordAdminAction({ action: 'merchant.plan_changed', targetType: 'merchant', targetId: merchantId, merchantId, summary: `${merchantName} planı ${plan} olarak değiştirildi`, metadata: { plan, billingCycle } })
      toast.success(`Plan güncellendi: ${plan}${billingCycle ? ` (${billingCycle === 'yearly' ? 'yıllık' : 'aylık'})` : ''}`)
      await load()
    } catch (err) { console.error(err); toast.error('Güncelleme başarısız') }
  }

  async function setStatus(merchantId: string, status: 'active' | 'passive') {
    try {
      await updateDoc(doc(db, 'merchants', merchantId), { status, updatedAt: serverTimestamp() })
      const merchantName = merchants.find((item) => item.id === merchantId)?.name ?? merchantId
      await recordAdminAction({ action: 'merchant.status_changed', targetType: 'merchant', targetId: merchantId, merchantId, summary: `${merchantName} işletmesi ${status} yapıldı`, metadata: { status } })
      toast.success(`İşletme ${status === 'active' ? 'aktif' : 'pasif'} edildi`)
      await load()
    } catch (err) { console.error(err); toast.error('İşlem başarısız') }
  }

  const filtered = merchants.filter((m) => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return true
    const qDigits = digitsOnly(q)
    const qPhoneKeys = phoneSearchKeys(q)
    const textHaystack = [
      m.name,
      m.city,
      m.district,
      m.sector,
      m.slug,
      m.phone,
      m.ownerName,
      m.ownerEmail,
      m.ownerPhone,
    ].filter(Boolean).join(' ').toLocaleLowerCase('tr')
    const phoneKeys = [m.phone, m.ownerPhone].flatMap(phoneSearchKeys)
    return textHaystack.includes(q) ||
      (qDigits.length > 0 && qPhoneKeys.some((key) => phoneKeys.some((phone) => phone.includes(key))))
  })

  if (loading) return <div className="space-y-3 animate-pulse">{[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
      <p className="text-red-700 font-medium">{error}</p>
      <p className="text-xs text-red-500">
        Terminalde: <code className="bg-red-100 px-1 py-0.5 rounded">firebase deploy --only firestore:rules</code>
      </p>
      <button onClick={() => void load()} className="text-sm text-red-600 underline">Tekrar Dene</button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{merchants.length} işletme</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="İşletme, sahip maili veya telefon ara…" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-80" />
      </div>

      <div className="space-y-2">
        {filtered.map((m) => {
          const sub = m.subscription
          const msLeft = sub ? sub.currentPeriodEnd.toDate().getTime() - Date.now() : null
          const daysLeft = msLeft !== null ? Math.ceil(msLeft / 86_400_000) : null
          const expired = msLeft !== null && msLeft <= 0
          const isExpanded = expandedId === m.id

          return (
            <div key={m.id} className={`bg-white rounded-xl border transition-colors ${isExpanded ? 'border-indigo-200' : 'border-gray-100'}`}>
              {/* Özet satırı — tıklanınca açılır */}
              <button
                className="w-full text-left p-4"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.status === 'active' ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{m.sector} · {m.city}</p>
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-gray-500">
                      {m.ownerEmail && <span className="truncate">Sahip: {m.ownerEmail}</span>}
                      {(m.ownerPhone || m.phone) && (
                        <span className="truncate">
                          {m.ownerPhone ? `Sahip Tel: ${m.ownerPhone}` : `İşletme Tel: ${m.phone}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {sub ? (
                      <>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          expired ? 'bg-red-100 text-red-700' :
                          sub.status === 'trialing' ? 'bg-violet-100 text-violet-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {PLAN_LABEL[sub.plan] ?? sub.plan}
                          {sub.billingCycle === 'yearly' ? '/yıl' : sub.billingCycle === 'monthly' ? '/ay' : ''}
                        </span>
                        <span className={`text-xs ${expired ? 'text-red-500 font-semibold' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {expired ? '⚠ Bitti' : `${daysLeft}g kaldı`}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Abonelik yok</span>
                    )}
                    <span className="text-gray-300 text-xs mt-0.5">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {/* Detay paneli */}
              {isExpanded && (
                <div className="px-3 sm:px-4 pb-4">
                  <MerchantDetailPanel
                    merchant={m}
                    subscription={m.subscription}
                    onPlanChange={async (plan, cycle) => {
                      await setPlan(m.id, plan, cycle)
                    }}
                    onStatusChange={async (status) => {
                      await setStatus(m.id, status)
                    }}
                    onLocationUpdate={(sector, city, district) => {
                      setMerchants((prev) => prev.map((x) => x.id === m.id ? { ...x, sector, city, district } : x))
                    }}
                  />
                  <AdminMerchantReport merchantId={m.id} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 2. Fiyatlandırma ─────────────────────────────────────────────────────────
function PricingTab() {
  const [plans, setPlans] = useState<PlanData[]>(
    PLAN_META.map((p) => ({
      ...p,
      monthlyPrice: p.defaultMonthly,
      yearlyPrice: p.defaultYearly,
      shopierMonthlyUrl: '',
      shopierYearlyUrl: '',
      maxCustomers: p.defaultMaxCustomers,
      maxMonthlyTransactions: p.defaultMaxTx,
      maxCampaigns: p.defaultMaxCampaigns,
    }))
  )
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<PlanData>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'config', 'pricing')).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setPlans((prev) => prev.map((p) => {
        const d = data[p.id] as Partial<PlanData> | undefined
        if (!d) return p
        return {
          ...p,
          monthlyPrice: d.monthlyPrice ?? p.monthlyPrice,
          yearlyPrice: d.yearlyPrice ?? p.yearlyPrice,
          shopierMonthlyUrl: d.shopierMonthlyUrl ?? '',
          shopierYearlyUrl: d.shopierYearlyUrl ?? '',
          maxCustomers: d.maxCustomers ?? p.maxCustomers,
          maxMonthlyTransactions: d.maxMonthlyTransactions ?? p.maxMonthlyTransactions,
          maxCampaigns: d.maxCampaigns ?? p.maxCampaigns,
          features: (d.features && d.features.length > 0) ? d.features : p.features,
        }
      }))
    }).catch(console.error)
  }, [])

  function startEdit(plan: PlanData) {
    setEditing(plan.id)
    setDraft({
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      shopierMonthlyUrl: plan.shopierMonthlyUrl,
      shopierYearlyUrl: plan.shopierYearlyUrl,
      maxCustomers: plan.maxCustomers,
      maxMonthlyTransactions: plan.maxMonthlyTransactions,
      maxCampaigns: plan.maxCampaigns,
      features: plan.features,
    })
  }

  async function savePlan(planId: string) {
    const monthlyPrice = Number(draft.monthlyPrice)
    const yearlyPrice = Number(draft.yearlyPrice)
    const maxCustomers = Number(draft.maxCustomers)
    const maxMonthlyTransactions = Number(draft.maxMonthlyTransactions)
    const maxCampaigns = Number(draft.maxCampaigns)
    if (isNaN(monthlyPrice) || monthlyPrice < 0) { toast.error('Geçersiz aylık fiyat'); return }
    if (isNaN(yearlyPrice) || yearlyPrice < 0) { toast.error('Geçersiz yıllık fiyat'); return }

    setSaving(true)
    try {
      const savedFeatures = (draft.features ?? []).map((f) => f.trim()).filter(Boolean)
      await setDoc(doc(db, 'config', 'pricing'), {
        [planId]: {
          monthlyPrice,
          yearlyPrice,
          shopierMonthlyUrl: draft.shopierMonthlyUrl ?? '',
          shopierYearlyUrl: draft.shopierYearlyUrl ?? '',
          maxCustomers: isNaN(maxCustomers) ? null : maxCustomers,
          maxMonthlyTransactions: isNaN(maxMonthlyTransactions) ? null : maxMonthlyTransactions,
          maxCampaigns: isNaN(maxCampaigns) ? null : maxCampaigns,
          features: savedFeatures,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true })
      await recordAdminAction({ action: 'pricing.updated', targetType: 'pricing', targetId: planId, summary: `${planId} fiyatlandırma ve limitleri güncellendi`, metadata: { monthlyPrice, yearlyPrice } })

      setPlans((prev) => prev.map((p) => p.id === planId
        ? { ...p, monthlyPrice, yearlyPrice, shopierMonthlyUrl: draft.shopierMonthlyUrl ?? '', shopierYearlyUrl: draft.shopierYearlyUrl ?? '', maxCustomers, maxMonthlyTransactions, maxCampaigns, features: savedFeatures }
        : p
      ))
      toast.success('Plan güncellendi')
      setEditing(null)
    } catch (err) { console.error(err); toast.error('Güncelleme başarısız') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Shopier entegrasyonu</p>
        <p>Her plan için aylık ve yıllık ödeme linklerini buraya girin. Linkler anasayfadaki fiyatlandırma bölümünde otomatik aktif olur.</p>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-xl border p-5 space-y-4 ${plan.isPopular ? 'border-indigo-300' : 'border-gray-200'}`}>
            {/* Plan başlığı */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 text-base">{plan.label}</p>
                {plan.isPopular && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Popüler</span>}
              </div>
              {editing !== plan.id && (
                <button
                  onClick={() => startEdit(plan)}
                  className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 font-medium">
                  Düzenle
                </button>
              )}
            </div>

            {editing === plan.id ? (
              /* Düzenleme formu */
              <div className="space-y-4 border-t border-gray-100 pt-4">
                {plan.id !== 'trial' && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fiyatlar</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Aylık Fiyat (TL)</label>
                        <input
                          type="number" min={0}
                          value={draft.monthlyPrice ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, monthlyPrice: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Yıllık Fiyat (TL/ay)</label>
                        <input
                          type="number" min={0}
                          value={draft.yearlyPrice ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, yearlyPrice: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Yıllık ödemede aylık fiyat</p>
                      </div>
                    </div>
                  </>
                )}

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Limitler</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Müşteri</label>
                    <input
                      type="number" min={-1}
                      value={draft.maxCustomers ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, maxCustomers: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="-1=∞"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">İşlem/ay</label>
                    <input
                      type="number" min={-1}
                      value={draft.maxMonthlyTransactions ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, maxMonthlyTransactions: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="-1=∞"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Kampanya</label>
                    <input
                      type="number" min={-1}
                      value={draft.maxCampaigns ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, maxCampaigns: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="-1=∞"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">-1 girin = Sınırsız</p>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Özellikler</p>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Her satıra bir özellik yazın</label>
                  <textarea
                    rows={5}
                    value={(draft.features ?? []).join('\n')}
                    onChange={(e) => setDraft((d) => ({ ...d, features: e.target.value.split('\n') }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono"
                    placeholder={'200 müşteri\n500 işlem/ay\n2 kampanya'}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Bu liste anasayfa ve abonelik ekranında görünür.</p>
                </div>

                {plan.id !== 'trial' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Shopier — Aylık Ödeme Linki</label>
                      <input
                        type="url"
                        value={draft.shopierMonthlyUrl ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, shopierMonthlyUrl: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://shopier.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Shopier — Yıllık Ödeme Linki</label>
                      <input
                        type="url"
                        value={draft.shopierYearlyUrl ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, shopierYearlyUrl: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://shopier.com/..."
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => void savePlan(plan.id)} disabled={saving}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button onClick={() => setEditing(null)} className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium">
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              /* Görüntüleme */
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {plan.id === 'trial' ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                    Ücretsiz deneme paketi · 14 gün · Ödeme alınmaz
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Aylık</p>
                      <p className="font-bold text-gray-900">₺{plan.monthlyPrice}<span className="text-gray-400 font-normal text-xs">/ay</span></p>
                      {plan.shopierMonthlyUrl ? (
                        <a href={plan.shopierMonthlyUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline truncate block mt-0.5">
                          Shopier linki ✓
                        </a>
                      ) : (
                        <p className="text-xs text-gray-300 mt-0.5">Link girilmedi</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Yıllık (ay başına)</p>
                      <p className="font-bold text-gray-900">₺{plan.yearlyPrice}<span className="text-gray-400 font-normal text-xs">/ay</span></p>
                      {plan.shopierYearlyUrl ? (
                        <a href={plan.shopierYearlyUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline truncate block mt-0.5">
                          Shopier linki ✓
                        </a>
                      ) : (
                        <p className="text-xs text-gray-300 mt-0.5">Link girilmedi</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span>👥 {plan.maxCustomers === -1 ? '∞' : plan.maxCustomers} müşteri</span>
                  <span>·</span>
                  <span>📋 {plan.maxMonthlyTransactions === -1 ? '∞' : plan.maxMonthlyTransactions} işlem/ay</span>
                  <span>·</span>
                  <span>🎯 {plan.maxCampaigns === -1 ? '∞' : plan.maxCampaigns} kampanya</span>
                </div>
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. Destek ────────────────────────────────────────────────────────────────
type MerchantDetails = {
  phone: string
  sector: string
  city: string
  district: string
  plan: string
  planStatus?: string
  instagram?: string | null
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Deneme', mini: 'Mini', standard: 'Standart', pro: 'Pro',
}

function SupportTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [merchantMap, setMerchantMap] = useState<Map<string, MerchantDetails>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket))
      setTickets(all)
      onCountChange(all.filter((t) => t.status === 'open').length)

      // Unique merchantId'lere ait firma + abonelik verisi
      const uniqueIds = [...new Set(all.map((t) => t.merchantId).filter(Boolean))]
      const entries = await Promise.all(
        uniqueIds.map(async (mid): Promise<[string, MerchantDetails | null]> => {
          try {
            const [mSnap, subSnap] = await Promise.all([
              getDoc(doc(db, 'merchants', mid)),
              getDoc(doc(db, 'merchants', mid, 'subscription', 'current')),
            ])
            if (!mSnap.exists()) return [mid, null]
            const m = mSnap.data() as Merchant
            const sub = subSnap.exists() ? (subSnap.data() as Subscription) : null
            return [mid, {
              phone: m.phone,
              sector: m.sector,
              city: m.city,
              district: m.district,
              plan: sub?.plan ?? 'trial',
              planStatus: sub?.status,
              instagram: m.instagram ?? null,
            }]
          } catch { return [mid, null] }
        })
      )
      const map = new Map<string, MerchantDetails>()
      entries.forEach(([mid, d]) => { if (d) map.set(mid, d) })
      setMerchantMap(map)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])

  async function sendReply(ticket: SupportTicket) {
    if (!replyText.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'supportTickets', ticket.id), {
        adminReply: replyText.trim(),
        repliedAt: serverTimestamp(),
        status: 'closed',
        updatedAt: serverTimestamp(),
      })
      await recordAdminAction({ action: 'support.replied', targetType: 'support', targetId: ticket.id, merchantId: ticket.merchantId, summary: `${ticket.merchantName} destek talebi yanıtlanıp kapatıldı` })
      toast.success('Yanıt gönderildi')
      setReplyingId(null)
      setReplyText('')
      await load()
    } catch (err) { console.error(err); toast.error('Gönderim başarısız') }
    finally { setSaving(false) }
  }

  async function setStatus(id: string, status: SupportTicket['status']) {
    try {
      await updateDoc(doc(db, 'supportTickets', id), { status, updatedAt: serverTimestamp() })
      const ticket = tickets.find((item) => item.id === id)
      await recordAdminAction({ action: 'support.status_changed', targetType: 'support', targetId: id, merchantId: ticket?.merchantId, summary: `Destek talebi ${status} durumuna alındı`, metadata: { status } })
      await load()
    } catch (err) { console.error(err) }
  }

  const filtered = tickets.filter((t) =>
    filter === 'all' ? true : filter === 'open' ? t.status !== 'closed' : t.status === 'closed'
  )

  if (loading) return <div className="space-y-3 animate-pulse">{[1,2,3].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['open','all','closed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f === 'open' ? `Açık (${tickets.filter(t => t.status !== 'closed').length})` : f === 'all' ? 'Tümü' : 'Kapandı'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Talep yok</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const md = merchantMap.get(t.merchantId)
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {/* Başlık */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{t.subject}</p>
                    <p className="text-xs text-gray-400">{t.merchantName} · {formatDateTime(t.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'open' ? 'bg-blue-100 text-blue-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status === 'open' ? 'Açık' : t.status === 'in_progress' ? 'İşlemde' : 'Kapandı'}
                  </span>
                </div>

                {/* Firma bilgileri */}
                {md && (
                  <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <a href={`tel:${md.phone}`}
                      className="flex items-center gap-1.5 text-gray-700 hover:text-violet-700 transition-colors sm:col-span-2 font-medium min-w-0 break-all">
                      <span>📞</span> {md.phone}
                    </a>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span>🏪</span> {md.sector}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span>📍</span> {md.city}{md.district ? `, ${md.district}` : ''}
                    </div>
                    <div className="flex items-center gap-1.5 sm:col-span-2 flex-wrap">
                      <span>💳</span>
                      <span className="font-semibold text-gray-800">{PLAN_LABELS[md.plan] ?? md.plan}</span>
                      {md.planStatus && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${md.planStatus === 'active' ? 'bg-green-100 text-green-700' : md.planStatus === 'trialing' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                          {md.planStatus === 'active' ? 'Aktif' : md.planStatus === 'trialing' ? 'Deneme' : md.planStatus}
                        </span>
                      )}
                    </div>
                    {md.instagram && (
                      <a href={`https://instagram.com/${md.instagram.replace(/^@/, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-gray-600 hover:text-pink-600 transition-colors sm:col-span-2 min-w-0 break-all">
                        <span>📷</span> @{md.instagram.replace(/^@/, '')}
                      </a>
                    )}
                  </div>
                )}

                {/* Mesaj */}
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words">{t.message}</p>

                {t.adminReply && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-700 mb-1">Yanıtınız</p>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{t.adminReply}</p>
                    {t.repliedAt && (
                      <p className="text-xs text-green-500 mt-1">{formatDateTime(t.repliedAt)}</p>
                    )}
                  </div>
                )}

                {replyingId === t.id ? (
                  <div className="space-y-2">
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Yanıtınızı yazın…" />
                    <div className="flex gap-2">
                      <button onClick={() => void sendReply(t)} disabled={saving || !replyText.trim()}
                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                        {saving ? 'Gönderiliyor…' : 'Yanıtla ve Kapat'}
                      </button>
                      <button onClick={() => { setReplyingId(null); setReplyText('') }}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setReplyingId(t.id); setReplyText(t.adminReply ?? '') }}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium">
                      {t.adminReply ? 'Yanıtı Düzenle' : 'Yanıtla'}
                    </button>
                    {t.status !== 'in_progress' && t.status !== 'closed' && (
                      <button onClick={() => void setStatus(t.id, 'in_progress')}
                        className="bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-sm font-medium">
                        İşlemde
                      </button>
                    )}
                    {t.status !== 'closed' && (
                      <button onClick={() => void setStatus(t.id, 'closed')}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm">
                        Kapat
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
