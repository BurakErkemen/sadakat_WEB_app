import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import type { Merchant, Subscription } from '@/types'
import { recordAdminAction } from './adminAudit'

type EntryType = 'revenue' | 'firebase_expense' | 'other_expense'
type FinanceEntry = { id: string; type: EntryType; amount: number; occurredAt: Timestamp; description: string; merchantId?: string | null; merchantName?: string | null }
type MerchantSub = Merchant & { subscription?: Subscription }

const labels: Record<EntryType, string> = { revenue: 'Tahsilat', firebase_expense: 'Firebase gideri', other_expense: 'Diğer gider' }
const defaults: Record<string, { monthlyPrice: number; yearlyPrice: number }> = { trial: { monthlyPrice: 0, yearlyPrice: 0 }, mini: { monthlyPrice: 99, yearlyPrice: 79 }, standard: { monthlyPrice: 199, yearlyPrice: 159 }, pro: { monthlyPrice: 399, yearlyPrice: 319 } }
function money(value: number) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value) }

function firestoreErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) return 'Yetki reddedildi. Oturumu kapatıp admin hesabıyla yeniden giriş yapın.'
  if (code.includes('unavailable')) return 'Firebase bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.'
  return 'Finans kaydı eklenemedi.'
}

export default function AdminFinanceTab() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [merchants, setMerchants] = useState<MerchantSub[]>([])
  const [pricing, setPricing] = useState<Record<string, { monthlyPrice?: number; yearlyPrice?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [type, setType] = useState<EntryType>('revenue')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [occurredDate, setOccurredDate] = useState(() => new Date().toISOString().slice(0, 10))

  async function load() {
    setLoading(true)
    const [entrySnap, merchantSnap, pricingSnap] = await Promise.all([
      getDocs(query(collection(db, 'financeEntries'), orderBy('occurredAt', 'desc'))),
      getDocs(collection(db, 'merchants')),
      getDoc(doc(db, 'config', 'pricing')),
    ])
    const merchantList = await Promise.all(merchantSnap.docs.map(async (item) => {
      const merchant = { id: item.id, ...item.data() } as Merchant
      const sub = await getDoc(doc(db, 'merchants', item.id, 'subscription', 'current'))
      return { ...merchant, subscription: sub.exists() ? sub.data() as Subscription : undefined }
    }))
    setEntries(entrySnap.docs.map((item) => ({ id: item.id, ...item.data() } as FinanceEntry)))
    setMerchants(merchantList)
    setPricing(pricingSnap.exists() ? pricingSnap.data() as DocumentData : {})
    setLoading(false)
  }

  useEffect(() => { void load().catch((error) => { console.error(error); setLoading(false) }) }, [])

  const totals = useMemo(() => {
    const today = new Date()
    const monthEntries = entries.filter((entry) => {
      const date = entry.occurredAt.toDate()
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
    })
    const revenue = monthEntries.filter((entry) => entry.type === 'revenue').reduce((sum, entry) => sum + entry.amount, 0)
    const firebase = monthEntries.filter((entry) => entry.type === 'firebase_expense').reduce((sum, entry) => sum + entry.amount, 0)
    const other = monthEntries.filter((entry) => entry.type === 'other_expense').reduce((sum, entry) => sum + entry.amount, 0)
    const mrr = merchants.reduce((sum, merchant) => {
      const sub = merchant.subscription
      if (!sub || sub.status !== 'active') return sum
      const planPrice = pricing[sub.plan] ?? defaults[sub.plan]
      return sum + (sub.billingCycle === 'yearly' ? (planPrice?.yearlyPrice ?? 0) : (planPrice?.monthlyPrice ?? 0))
    }, 0)
    return { revenue, firebase, other, mrr, net: revenue - firebase - other }
  }, [entries, merchants, pricing])

  async function save() {
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !description.trim() || !occurredDate) { toast.error('Tarih, tutar ve açıklama zorunlu'); return }
    setSaving(true)
    try {
      const merchant = merchants.find((item) => item.id === merchantId)
      const occurredAt = Timestamp.fromDate(new Date(`${occurredDate}T12:00:00`))
      const ref = await addDoc(collection(db, 'financeEntries'), { type, amount: numericAmount, description: description.trim(), merchantId: merchant?.id ?? null, merchantName: merchant?.name ?? null, occurredAt, createdAt: serverTimestamp() })
      const auditRecorded = await recordAdminAction({ action: 'finance.entry_created', targetType: 'finance', targetId: ref.id, merchantId: merchant?.id, summary: `${labels[type]} kaydı oluşturuldu: ${money(numericAmount)}`, metadata: { type, amount: numericAmount } })
      if (!auditRecorded) {
        toast.error('Kayıt eklendi ancak işlem logu yazılamadı.')
      }
      setAmount(''); setDescription(''); setMerchantId('')
      toast.success('Finans kaydı eklendi')
      await load()
    } catch (error) { console.error(error); toast.error(firestoreErrorMessage(error)) } finally { setSaving(false) }
  }

  async function remove(entry: FinanceEntry) {
    const approved = confirm(`${labels[entry.type]} kaydını silmek istediğinize emin misiniz?\n${entry.description} · ${money(entry.amount)}\n\nSilme işlemi audit logunda kalır.`)
    if (!approved) return
    setDeletingId(entry.id)
    try {
      await deleteDoc(doc(db, 'financeEntries', entry.id))
      setEntries((current) => current.filter((item) => item.id !== entry.id))
      const auditRecorded = await recordAdminAction({
        action: 'finance.entry_deleted',
        targetType: 'finance',
        targetId: entry.id,
        merchantId: entry.merchantId,
        summary: `${labels[entry.type]} kaydı silindi: ${money(entry.amount)} · ${entry.description}`,
        metadata: { type: entry.type, amount: entry.amount },
      })
      if (!auditRecorded) toast.error('Kayıt silindi ancak işlem logu yazılamadı.')
      toast.success('Finans kaydı silindi')
    } catch (error) {
      console.error(error)
      toast.error(firestoreErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="h-72 bg-gray-200 rounded-xl animate-pulse" />
  return <div className="space-y-5 sm:space-y-6 min-w-0"><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">{[
    ['Tahmini MRR', totals.mrr, 'Aktif aboneliklerden'], ['Aylık tahsilat', totals.revenue, 'Bu ay kaydedilen'], ['Firebase gideri', totals.firebase, 'Bu ay kaydedilen'], ['Diğer gider', totals.other, 'Bu ay kaydedilen'], ['Aylık net', totals.net, 'Bu ay tahsilat eksi gider'],
  ].map(([label, value, helper]) => <div key={String(label)} className="border border-gray-200 rounded-xl p-4 min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="text-lg sm:text-xl font-bold text-gray-900 mt-2 truncate">{money(Number(value))}</p><p className="text-[11px] text-gray-400 mt-1">{helper}</p></div>)}</div>
  <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800">Firebase gerçek fatura verisi Web SDK’dan otomatik alınamaz. Firebase Console faturanızı “Firebase gideri” olarak kaydedin; tahmini MRR gerçek tahsilat değildir.</div>
  <section className="border-t border-gray-200 pt-5"><h2 className="text-sm font-semibold text-gray-900 mb-3">Finans kaydı ekle</h2><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[150px_130px_145px_1fr_1fr_auto] gap-2"><select value={type} onChange={(event) => setType(event.target.value as EntryType)} className="min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"><option value="revenue">Tahsilat</option><option value="firebase_expense">Firebase gideri</option><option value="other_expense">Diğer gider</option></select><input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Tutar (TL)" className="min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"/><input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} className="min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"/><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Açıklama / fatura dönemi" className="min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"/><select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} className="min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"><option value="">İşletme yok / genel</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select><button type="button" onClick={() => void save()} disabled={saving} className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50">{saving ? 'Kaydediliyor' : 'Ekle'}</button></div></section>
  <div className="space-y-2 md:hidden">{entries.map((entry) => <article key={entry.id} className="bg-white border border-gray-200 rounded-lg p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-gray-900">{labels[entry.type]}</p><p className="text-[11px] text-gray-400 mt-0.5">{entry.occurredAt.toDate().toLocaleDateString('tr-TR')} · {entry.merchantName ?? 'Genel'}</p></div><p className={`text-sm font-bold whitespace-nowrap ${entry.type === 'revenue' ? 'text-emerald-700' : 'text-red-700'}`}>{entry.type === 'revenue' ? '+' : '-'}{money(entry.amount)}</p></div><p className="text-sm text-gray-700 mt-2 break-words">{entry.description}</p><button type="button" onClick={() => void remove(entry)} disabled={deletingId === entry.id} className="mt-3 w-full border border-red-200 text-red-600 rounded-lg py-2 text-xs font-medium disabled:opacity-40">{deletingId === entry.id ? 'Siliniyor...' : 'Kaydı sil'}</button></article>)}</div>
  <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl"><table className="w-full min-w-[760px] text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="text-left px-4 py-3 font-medium">Tarih</th><th className="text-left px-3 py-3 font-medium">Tür</th><th className="text-left px-3 py-3 font-medium">İşletme</th><th className="text-left px-3 py-3 font-medium">Açıklama</th><th className="text-right px-3 py-3 font-medium">Tutar</th><th className="w-16 px-4 py-3"><span className="sr-only">İşlemler</span></th></tr></thead><tbody className="divide-y divide-gray-100">{entries.map((entry) => <tr key={entry.id}><td className="px-4 py-3 text-xs text-gray-500">{entry.occurredAt.toDate().toLocaleDateString('tr-TR')}</td><td className="px-3 py-3">{labels[entry.type]}</td><td className="px-3 py-3 text-gray-500">{entry.merchantName ?? 'Genel'}</td><td className="px-3 py-3 text-gray-700">{entry.description}</td><td className={`px-3 py-3 text-right font-semibold ${entry.type === 'revenue' ? 'text-emerald-700' : 'text-red-700'}`}>{entry.type === 'revenue' ? '+' : '-'}{money(entry.amount)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void remove(entry)} disabled={deletingId === entry.id} title="Finans kaydını sil" aria-label={`${entry.description} kaydını sil`} className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40">{deletingId === entry.id ? '...' : 'Sil'}</button></td></tr>)}</tbody></table></div>{entries.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Henüz finans kaydı yok.</p>}</div>
}
