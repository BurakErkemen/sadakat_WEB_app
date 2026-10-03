import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { auth } from '@/firebase/auth'
import { db } from '@/firebase/firestore'
import { ADMIN_UIDS } from '@/lib/constants'

// Auth kullanıcı silme işlemi ayrı olarak Firebase Console'da tamamlanır.
// Profil korunur: erişim kapatılır ve tamamlanmamış Auth silme işi görünür kalır.
export async function requestAccountDeletion(userId: string) {
  const actor = auth.currentUser
  if (!actor || actor.uid === userId || ADMIN_UIDS.includes(userId)) {
    throw new Error('Bu hesap için silme işlemi başlatılamaz.')
  }
  const merchants = await getDocs(query(collection(db, 'merchants'), where('ownerId', '==', userId)))
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', userId), {
    status: 'deletion_requested',
    deletionRequestedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  merchants.docs.forEach((merchant) => {
    batch.update(merchant.ref, { status: 'passive', updatedAt: serverTimestamp() })
  })
  batch.set(doc(collection(db, 'adminAuditLogs')), {
    action: 'user.deletion_requested', targetType: 'user', targetId: userId,
    summary: 'Hesap erişimi kapatıldı; Firebase Authentication silme adımı bekleniyor.',
    actorUid: actor.uid, createdAt: serverTimestamp(),
  })
  await batch.commit()
}
