import { getFirestore, writeBatch, runTransaction, doc, collection, query, where, getDocs, increment, serverTimestamp } from 'firebase/firestore'
import { app } from './config'
import { generateCardToken } from '@/lib/token'
import { normalizePhone } from '@/lib/phone'
import { maskName } from '@/lib/utils'

export const db = getFirestore(app)

// ─── 13.1 Müşteri + Kart Oluşturma ──────────────────────────────────────────
export async function createCustomerWithCard(p: {
  merchantId: string
  campaignId: string
  fullName: string
  phone: string
  note?: string
}) {
  const cardToken = generateCardToken()
  const normalizedPhone = normalizePhone(p.phone)

  const customerRef = doc(collection(db, 'merchants', p.merchantId, 'customers'))
  const membershipRef = doc(collection(db, 'merchants', p.merchantId, 'memberships'))
  const publicCardRef = doc(db, 'publicCards', cardToken)

  const batch = writeBatch(db)
  batch.set(customerRef, {
    fullName: p.fullName,
    phone: p.phone,
    normalizedPhone,
    note: p.note ?? null,
    consentAccepted: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(membershipRef, {
    customerId: customerRef.id,
    campaignId: p.campaignId,
    cardToken,
    currentStamps: 0,
    totalEarnedStamps: 0,
    totalRedeemedRewards: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(publicCardRef, {
    // PII YOK
    merchantId: p.merchantId,
    campaignId: p.campaignId,
    membershipId: membershipRef.id,
    cardToken,
    currentStamps: 0,
    status: 'active',
    customerDisplayName: maskName(p.fullName),
    lastUpdatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return { customerId: customerRef.id, membershipId: membershipRef.id, cardToken }
}

// ─── 13.2 Damga / Puan Ekleme ────────────────────────────────────────────────
export async function addStamp(p: {
  merchantId: string
  membershipId: string
  cardToken: string
  campaignId: string
  customerId: string
  ownerUid: string
  amount?: number          // damga=1 (default), puan=hesaplanan değer
  purchaseAmount?: number  // puan modunda harcanan TL
  note?: string
}) {
  const amount = p.amount ?? 1
  const membershipRef = doc(db, 'merchants', p.merchantId, 'memberships', p.membershipId)
  const publicCardRef = doc(db, 'publicCards', p.cardToken)
  const txRef = doc(collection(db, 'merchants', p.merchantId, 'transactions'))

  const batch = writeBatch(db)
  batch.update(membershipRef, {
    currentStamps: increment(amount),
    totalEarnedStamps: increment(amount),
    updatedAt: serverTimestamp(),
  })
  batch.update(publicCardRef, {
    currentStamps: increment(amount),
    lastUpdatedAt: serverTimestamp(),
  })
  batch.set(txRef, {
    customerId: p.customerId,
    campaignId: p.campaignId,
    membershipId: p.membershipId,
    type: 'stamp_add',
    amount,
    purchaseAmount: p.purchaseAmount ?? null,
    note: p.note ?? null,
    createdBy: p.ownerUid,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}

// ─── 13.3 Ödül Kullandırma ───────────────────────────────────────────────────
export async function redeemReward(p: {
  merchantId: string
  membershipId: string
  cardToken: string
  campaignId: string
  customerId: string
  ownerUid: string
  note?: string
}) {
  const membershipRef = doc(db, 'merchants', p.merchantId, 'memberships', p.membershipId)
  const campaignRef = doc(db, 'merchants', p.merchantId, 'campaigns', p.campaignId)
  const publicCardRef = doc(db, 'publicCards', p.cardToken)

  await runTransaction(db, async (tx) => {
    const mSnap = await tx.get(membershipRef)
    const cSnap = await tx.get(campaignRef)
    if (!mSnap.exists()) throw new Error('Üyelik bulunamadı')
    if (!cSnap.exists()) throw new Error('Kampanya bulunamadı')

    const current = (mSnap.data()['currentStamps'] as number) ?? 0
    const required = (cSnap.data()['requiredStamps'] as number) ?? 0
    if (current < required) throw new Error('Ödül hakkı yok: Yeterli damga bulunmuyor')

    const txRef = doc(collection(db, 'merchants', p.merchantId, 'transactions'))
    tx.update(membershipRef, {
      currentStamps: current - required,
      totalRedeemedRewards: increment(1),
      updatedAt: serverTimestamp(),
    })
    tx.update(publicCardRef, {
      currentStamps: current - required,
      lastUpdatedAt: serverTimestamp(),
    })
    tx.set(txRef, {
      customerId: p.customerId,
      campaignId: p.campaignId,
      membershipId: p.membershipId,
      type: 'reward_redeem',
      amount: -required,
      note: p.note ?? null,
      createdBy: p.ownerUid,
      createdAt: serverTimestamp(),
    })
  })
}

// ─── 14. Kampanya Aktif Etme ──────────────────────────────────────────────────
export async function activateCampaign(merchantId: string, campaignId: string) {
  const activeQ = query(
    collection(db, 'merchants', merchantId, 'campaigns'),
    where('status', '==', 'active'),
  )
  const activeSnap = await getDocs(activeQ)

  const batch = writeBatch(db)
  activeSnap.forEach((d) => {
    if (d.id !== campaignId) batch.update(d.ref, { status: 'passive', updatedAt: serverTimestamp() })
  })
  batch.update(doc(db, 'merchants', merchantId, 'campaigns', campaignId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'merchants', merchantId), {
    activeCampaignId: campaignId,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}
