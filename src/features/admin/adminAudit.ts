import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth } from '@/firebase/auth'
import { db } from '@/firebase/firestore'

export type AdminAction =
  | 'user.status_changed' | 'user.deleted'
  | 'merchant.plan_changed' | 'merchant.status_changed' | 'merchant.location_changed'
  | 'campaign.status_changed' | 'campaign.deleted'
  | 'pricing.updated' | 'support.replied' | 'support.status_changed'
  | 'finance.entry_created' | 'finance.entry_deleted' | 'audit.view_cleared'

export async function recordAdminAction(input: {
  action: AdminAction
  targetType: 'user' | 'merchant' | 'campaign' | 'pricing' | 'support' | 'finance' | 'audit'
  targetId: string
  merchantId?: string | null
  summary: string
  metadata?: Record<string, string | number | boolean | null>
}): Promise<boolean> {
  const user = auth.currentUser
  if (!user) {
    console.error('Admin audit log yazılamadı: oturum bulunamadı')
    return false
  }

  try {
    await addDoc(collection(db, 'adminAuditLogs'), {
      ...input,
      merchantId: input.merchantId ?? null,
      metadata: input.metadata ?? {},
      actorUid: user.uid,
      actorEmail: user.email ?? null,
      createdAt: serverTimestamp(),
    })
    return true
  } catch (error) {
    console.error('Admin audit log yazılamadı', error)
    return false
  }
}
