import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { formatDateTime } from '@/lib/dates'
import toast from 'react-hot-toast'
import { recordAdminAction } from './adminAudit'

type AuditLog = { id: string; action: string; summary: string; actorEmail?: string | null; targetType: string; createdAt: Timestamp }

export default function AdminAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    void Promise.all([
      getDocs(query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(200))),
      getDoc(doc(db, 'adminSettings', 'auditLogView')),
    ])
      .then(([snap, settingSnap]) => {
        const visibleFrom = settingSnap.exists() ? settingSnap.data()['visibleFrom'] as Timestamp | undefined : undefined
        const items = snap.docs.map((item) => ({ id: item.id, ...item.data() } as AuditLog))
        setLogs(visibleFrom ? items.filter((item) => item.createdAt.toMillis() >= visibleFrom.toMillis()) : items)
      })
      .finally(() => setLoading(false))
  }, [])

  async function clearView() {
    if (!confirm('Mevcut logları panelden temizlemek istediğinize emin misiniz? Kayıtlar güvenlik amacıyla Firestore geçmişinde korunur.')) return
    setClearing(true)
    try {
      const visibleFrom = Timestamp.now()
      await setDoc(doc(db, 'adminSettings', 'auditLogView'), { visibleFrom, updatedAt: serverTimestamp() }, { merge: true })
      setLogs([])
      await recordAdminAction({ action: 'audit.view_cleared', targetType: 'audit', targetId: 'auditLogView', summary: 'Admin log görünümü temizlendi' })
      toast.success('Log görünümü temizlendi')
    } catch (error) {
      console.error(error)
      toast.error('Log görünümü temizlenemedi')
    } finally {
      setClearing(false)
    }
  }

  if (loading) return <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Admin işlem günlüğü</h2>
          <p className="text-xs text-gray-500 mt-1">Son 200 kayıt · temizlenen geçmiş güvenlik amacıyla saklanır</p>
        </div>
        <button type="button" onClick={() => void clearView()} disabled={clearing || logs.length === 0} className="w-full sm:w-auto border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40">
          {clearing ? 'Temizleniyor...' : 'Görünümü temizle'}
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {logs.map((log) => (
          <article key={log.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded break-all">{log.action}</span>
              <time className="text-[11px] text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</time>
            </div>
            <p className="text-sm text-gray-800 break-words">{log.summary}</p>
            <p className="text-xs text-gray-500 truncate">{log.actorEmail ?? 'Admin'}</p>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="text-left px-4 py-3 font-medium">Zaman</th><th className="text-left px-3 py-3 font-medium">Admin</th><th className="text-left px-3 py-3 font-medium">İşlem</th><th className="text-left px-4 py-3 font-medium">Açıklama</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{logs.map((log) => <tr key={log.id}><td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td><td className="px-3 py-3 text-xs text-gray-600">{log.actorEmail ?? 'Admin'}</td><td className="px-3 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{log.action}</span></td><td className="px-4 py-3 text-gray-800">{log.summary}</td></tr>)}</tbody>
        </table>
      </div>
      {logs.length === 0 && <p className="text-center text-sm text-gray-400 py-12">Henüz log kaydı yok.</p>}
    </div>
  )
}
