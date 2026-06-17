import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { formatDateTime } from '@/lib/dates'
import type { SupportTicket } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  open: 'Açık',
  in_progress: 'İşlemde',
  closed: 'Kapandı',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
}

export default function SupportPage() {
  const { merchant } = useMerchant()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadTickets() {
    if (!merchant) return
    setLoading(true)
    try {
      const snap = await getDocs(query(
        collection(db, 'supportTickets'),
        where('merchantId', '==', merchant.id),
        orderBy('createdAt', 'desc')
      ))
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket)))
    } catch (err) {
      console.error(err)
      toast.error('Talepler yüklenemedi. Lütfen sayfayı yenileyin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTickets() }, [merchant?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return
    if (message.trim().length < 10) { toast.error('Lütfen daha ayrıntılı açıklayın'); return }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'supportTickets'), {
        merchantId: merchant.id,
        merchantName: merchant.name,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        adminReply: null,
        repliedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Destek talebiniz alındı!')
      setShowForm(false)
      setSubject('')
      setMessage('')
      await loadTickets()
    } catch (err) {
      console.error(err)
      toast.error('Gönderim başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Destek</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          + Yeni Talep
        </button>
      </div>

      {/* Yeni talep formu */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-4">
          <p className="font-semibold text-gray-900">Yeni Destek Talebi</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konu</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Fatura sorunu, teknik yardım…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Sorununuzu veya talebinizi ayrıntılı açıklayın…" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
              {submitting ? 'Gönderiliyor…' : 'Gönder'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm">
              İptal
            </button>
          </div>
        </form>
      )}

      {/* İletişim bilgisi */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Hızlı Yardım</p>
        <p>E-posta: <a href="mailto:info@cyandanismanlik.com" className="underline">info@cyandanismanlik.com</a></p>
        <p>Yanıt süresi: Mesai günlerinde 24 saat</p>
      </div>

      {/* Talepler */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🎫</p>
          <p>Henüz destek talebiniz yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-gray-900">{t.subject}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">{t.message}</p>
              {t.adminReply && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Admin Yanıtı</p>
                  <p className="text-sm text-green-800">{t.adminReply}</p>
                  {t.repliedAt && <p className="text-xs text-green-500 mt-1">{formatDateTime(t.repliedAt)}</p>}
                </div>
              )}
              <p className="text-xs text-gray-400">{formatDateTime(t.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
