import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadTickets() }, [merchant?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!merchant) return

    const trimmedSubject = subject.trim()
    const trimmedMessage = message.trim()

    if (!trimmedSubject) { toast.error('Lütfen konu başlığı girin'); return }
    if (trimmedMessage.length < 10) { toast.error('Açıklama en az 10 karakter olmalı'); return }

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'supportTickets'), {
        merchantId: merchant.id,
        merchantName: merchant.name,
        subject: trimmedSubject,
        message: trimmedMessage,
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
      const msg = err instanceof Error ? err.message : String(err)
      const isPermission = msg.includes('permission') || msg.includes('insufficient')
      toast.error(isPermission
        ? 'İzin hatası. Destek için info@cyandanismanlik.com adresine mail atın.'
        : 'Gönderim başarısız. Lütfen tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setShowForm(false)
    setSubject('')
    setMessage('')
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Geri</button>
        <h1 className="text-xl font-bold text-gray-900">Destek</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
            + Yeni Talep
          </button>
        )}
      </div>

      {/* Yeni talep formu */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5">
          <p className="font-semibold text-gray-900 mb-4">Yeni Destek Talebi</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Fatura sorunu, teknik yardım…"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1 text-xs">(en az 10 karakter)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Sorununuzu veya talebinizi ayrıntılı açıklayın…"
              />
              <p className="text-xs text-gray-400 mt-0.5 text-right">{message.trim().length} / 10 min</p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                {submitting ? 'Gönderiliyor…' : 'Gönder'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* İletişim bilgisi */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Hızlı Yardım</p>
        <p>E-posta: <a href="mailto:info@cyandanismanlik.com" className="underline">info@cyandanismanlik.com</a></p>
        <p>Yanıt süresi: Mesai günlerinde 24 saat</p>
      </div>

      {/* Talepler listesi */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🎫</p>
          <p>Henüz destek talebiniz yok</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">
            İlk talebinizi oluşturun
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 text-sm">{t.subject}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[t.status]}`}>
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
