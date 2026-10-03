import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/firestore'

// İşlem geçmişi korunur; mağaza ve bağlantıları atomik olarak kapatılır.
export async function deleteMerchant(merchantId: string, ownerId: string) {
  await runTransaction(db, async (tx) => {
    const merchantRef = doc(db, 'merchants', merchantId)
    const userRef = doc(db, 'users', ownerId)
    const merchant = await tx.get(merchantRef)
    const profile = await tx.get(userRef)
    if (!merchant.exists() || !profile.exists() || merchant.data().ownerId !== ownerId || profile.data().merchantId !== merchantId) {
      throw new Error('Mağaza hesabınıza bağlı değil. Sayfayı yenileyin.')
    }
    const slug = merchant.data().slug as string | undefined
    const slugRef = slug ? doc(db, 'publicSlugs', slug) : null
    const slugSnap = slugRef ? await tx.get(slugRef) : null
    tx.update(merchantRef, { archived: true, status: 'passive', deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    tx.update(userRef, { merchantId: null, updatedAt: serverTimestamp() })
    if (slugRef && slugSnap?.exists() && slugSnap.data().merchantId === merchantId) {
      tx.update(slugRef, { isActive: false })
    }
  })
}
