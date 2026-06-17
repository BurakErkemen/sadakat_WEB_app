import { useEffect, useState } from 'react'
import {
  collection, getDocs, getDoc, doc, updateDoc, setDoc, serverTimestamp, Timestamp,
  query, orderBy,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { formatDate, formatDateTime } from '@/lib/dates'
import type { Merchant, Subscription, SupportTicket } from '@/types'

type Tab = 'merchants' | 'pricing' | 'support'

// ─── Fiyat planları varsayılan tanımı ────────────────────────────────────────
const DEFAULT_PLANS = [
  { id: 'trial',    label: 'Deneme',   price: 0,   maxCustomers: 50,   maxTx: 200,   maxCamp: 1,  features: ['50 müşteri', '200 işlem/ay', '1 kampanya'], isPopular: false },
  { id: 'mini',     label: 'Mini',     price: 99,  maxCustomers: 200,  maxTx: 500,   maxCamp: 2,  features: ['200 müşteri', '500 işlem/ay', '2 kampanya'], isPopular: false },
  { id: 'standard', label: 'Standart', price: 199, maxCustomers: 1000, maxTx: 3000,  maxCamp: 5,  features: ['1000 müşteri', '3000 işlem/ay', '5 kampanya'], isPopular: true },
  { id: 'pro',      label: 'Pro',      price: 399, maxCustomers: -1,   maxTx: -1,    maxCamp: -1, features: ['Sınırsız müşteri', 'Sınırsız işlem', 'Sınırsız kampanya'], isPopular: false },
]

// ─── Yardımcı bileşen: Sekme butonu ─────────────────────────────────────────
function TabBtn({ tab, active, label, badge, onClick }: { tab: Tab; active: Tab; label: string; badge?: number; onClick: (t: Tab) => void }) {
  return (
    <button onClick={() => onClick(tab)}
      className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors relative ${active === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('merchants')
  const [openTickets, setOpenTickets] = useState(0)

  useEffect(() => {
    getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')))
      .then((snap) => setOpenTickets(snap.docs.filter((d) => d.data()['status'] === 'open').length))
      .catch(console.error)
  }, [])

  return (
    <div className="space-y-5">
      {/* Sekmeler */}
      <div className="bg-white rounded-2xl border border-gray-200 p-1 flex gap-1">
        <TabBtn tab="merchants" active={tab} label="İşletmeler" onClick={setTab} />
        <TabBtn tab="pricing" active={tab} label="Fiyatlandırma" onClick={setTab} />
        <TabBtn tab="support" active={tab} label="Destek" badge={openTickets} onClick={setTab} />
      </div>

      {tab === 'merchants' && <MerchantsTab />}
      {tab === 'pricing' && <PricingTab />}
      {tab === 'support' && <SupportTab onCountChange={setOpenTickets} />}
    </div>
  )
}

// ─── 1. İşletmeler Sekmesi ───────────────────────────────────────────────────
type MerchantRow = Merchant & { subscription?: Subscription }

function MerchantsTab() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'merchants'))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MerchantRow))
      const withSubs = await Promise.all(list.map(async (m) => {
        try {
          const subDoc = await getDoc(doc(db, 'merchants', m.id, 'subscription', 'current'))
          return { ...m, subscription: subDoc.exists() ? (subDoc.data() as Subscription) : undefined }
        } catch { return m }
      }))
      setMerchants(withSubs)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      const isPermission = msg.includes('permission') || msg.includes('insufficient')
      setError(
        isPermission
          ? 'İzin reddedildi. Firestore kurallarını deploy edin: firebase deploy --only firestore:rules'
          : 'İşletmeler yüklenemedi. Sayfayı yenileyin veya konsolu kontrol edin.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function setPlan(merchantId: string, plan: string) {
    setActionId(merchantId)
    try {
      const subRef = doc(db, 'merchants', merchantId, 'subscription', 'current')
      const now = Timestamp.now()
      await setDoc(subRef, {
        plan, status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: Timestamp.fromMillis(now.toMillis() + 30 * 24 * 3600 * 1000),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      toast.success('Plan güncellendi')
      await load()
    } catch (err) { console.error(err); toast.error('Güncelleme başarısız') }
    finally { setActionId(null) }
  }

  async function setStatus(merchantId: string, status: 'active' | 'passive') {
    setActionId(merchantId + status)
    try {
      await updateDoc(doc(db, 'merchants', merchantId), { status, updatedAt: serverTimestamp() })
      toast.success(`İşletme ${status === 'active' ? 'aktif' : 'pasif'} edildi`)
      await load()
    } catch (err) { console.error(err); toast.error('İşlem başarısız') }
    finally { setActionId(null) }
  }

  const filtered = merchants.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.city.toLowerCase().includes(search.toLowerCase()) ||
    m.sector.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="space-y-3 animate-pulse">{[1,2,3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}</div>

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{merchants.length} işletme</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Ara…" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40" />
      </div>

      <div className="space-y-3">
        {filtered.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-400">{m.sector} · {m.city}, {m.district}</p>
                <p className="text-xs text-gray-400">/m/{m.slug}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {m.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {m.subscription?.plan ?? 'trial'}
                </span>
              </div>
            </div>

            {m.subscription && (
              <p className="text-xs text-gray-400">
                Dönem: {formatDate(m.subscription.currentPeriodStart)} – {formatDate(m.subscription.currentPeriodEnd)}
                {' · '}{m.subscription.status}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(['trial','mini','standard','pro'] as const).map((p) => (
                <button key={p}
                  disabled={!!actionId || m.subscription?.plan === p}
                  onClick={() => void setPlan(m.id, p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${m.subscription?.plan === p ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'border-gray-200 hover:bg-indigo-50 hover:border-indigo-300'}`}>
                  {p}
                </button>
              ))}
              <button
                disabled={!!actionId}
                onClick={() => void setStatus(m.id, m.status === 'active' ? 'passive' : 'active')}
                className={`text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40 ${m.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                {m.status === 'active' ? 'Pasife Al' : 'Aktif Et'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 2. Fiyatlandırma Sekmesi ─────────────────────────────────────────────────
function PricingTab() {
  const [plans, setPlans] = useState(DEFAULT_PLANS)
  const [editing, setEditing] = useState<string | null>(null)
  const [tempPrice, setTempPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function savePrice(planId: string) {
    const price = parseInt(tempPrice)
    if (isNaN(price) || price < 0) { toast.error('Geçersiz fiyat'); return }
    setSaving(true)
    try {
      await setDoc(doc(db, 'config', 'pricing'), {
        [planId]: { price, updatedAt: serverTimestamp() }
      }, { merge: true })
      setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, price } : p))
      toast.success('Fiyat güncellendi')
      setEditing(null)
    } catch (err) { console.error(err); toast.error('Güncelleme başarısız') }
    finally { setSaving(false) }
  }

  useEffect(() => {
    getDoc(doc(db, 'config', 'pricing')).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setPlans((prev) => prev.map((p) => {
        const d = data[p.id] as { price?: number } | undefined
        return d?.price != null ? { ...p, price: d.price } : p
      }))
    }).catch(console.error)
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Fiyatları buradan güncelleyebilirsiniz. Mevcut abonelikler etkilenmez.</p>
      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className={`bg-white rounded-xl border p-4 space-y-3 ${plan.isPopular ? 'border-indigo-300' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{plan.label}</p>
                {plan.isPopular && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Popüler</span>}
              </div>
              {editing === plan.id ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={tempPrice} onChange={(e) => setTempPrice(e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min={0} />
                  <span className="text-sm text-gray-500">TL/ay</span>
                  <button onClick={() => void savePrice(plan.id)} disabled={saving}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg disabled:opacity-50">
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-400">İptal</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">{plan.price === 0 ? 'Ücretsiz' : `${plan.price} TL/ay`}</p>
                  <button onClick={() => { setEditing(plan.id); setTempPrice(String(plan.price)) }}
                    className="text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50">
                    Düzenle
                  </button>
                </div>
              )}
            </div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. Destek Sekmesi ────────────────────────────────────────────────────────
function SupportTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
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
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

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
      await load()
    } catch (err) { console.error(err) }
  }

  const filtered = tickets.filter((t) =>
    filter === 'all' ? true : filter === 'open' ? t.status !== 'closed' : t.status === 'closed'
  )

  if (loading) return <div className="space-y-3 animate-pulse">{[1,2,3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>

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
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{t.subject}</p>
                  <p className="text-xs text-gray-400">{t.merchantName} · {formatDateTime(t.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'open' ? 'bg-blue-100 text-blue-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status === 'open' ? 'Açık' : t.status === 'in_progress' ? 'İşlemde' : 'Kapandı'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{t.message}</p>

              {t.adminReply && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Yanıtınız</p>
                  <p className="text-sm text-green-800">{t.adminReply}</p>
                </div>
              )}

              {replyingId === t.id ? (
                <div className="space-y-2">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3}
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
          ))}
        </div>
      )}
    </div>
  )
}
