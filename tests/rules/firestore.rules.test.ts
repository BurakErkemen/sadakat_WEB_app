// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const projectId = process.env.GCLOUD_PROJECT ?? 'sadakat-web'
const describeWithEmulator = emulatorHost ? describe : describe.skip

describeWithEmulator('firestore security rules', () => {
  let testEnv: RulesTestEnvironment

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: emulatorHost?.split(':')[0],
        port: Number(emulatorHost?.split(':')[1] ?? 8080),
      },
    })
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('allows public card get but denies public card list', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicCards', 'card_1'), {
        merchantId: 'merchant_1',
        campaignId: 'campaign_1',
        membershipId: 'membership_1',
        cardToken: 'card_1',
        currentStamps: 0,
        status: 'active',
        customerDisplayName: 'B**** E******',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      })
    })

    const anonymousDb = testEnv.unauthenticatedContext().firestore()

    await assertSucceeds(getDoc(doc(anonymousDb, 'publicCards', 'card_1')))
    await assertFails(getDocs(query(collection(anonymousDb, 'publicCards'))))
  })

  it('rejects publicCards writes containing PII or extra fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), { status: 'approved', merchantId: 'merchant_1' })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), { ownerId: 'owner_1', name: 'Demo' })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const validCard = {
      merchantId: 'merchant_1',
      campaignId: 'campaign_1',
      membershipId: 'membership_1',
      cardToken: 'card_a',
      currentStamps: 0,
      status: 'active',
      customerDisplayName: 'B**** E******',
      lastUpdatedAt: new Date(),
      createdAt: new Date(),
    }

    // Geçerli schema → başarılı
    await assertSucceeds(setDoc(doc(ownerDb, 'publicCards', 'card_a'), validCard))

    // PII alanlarıyla create → reddedilir
    await assertFails(setDoc(doc(ownerDb, 'publicCards', 'card_b'), {
      ...validCard, cardToken: 'card_b', phone: '5551112233',
    }))
    await assertFails(setDoc(doc(ownerDb, 'publicCards', 'card_c'), {
      ...validCard, cardToken: 'card_c', fullName: 'Burak Erkemen',
    }))
    await assertFails(setDoc(doc(ownerDb, 'publicCards', 'card_d'), {
      ...validCard, cardToken: 'card_d', customerId: 'cust_1',
    }))

    // Zorunlu alan eksik → reddedilir
    const { customerDisplayName: _cdn, ...missingName } = validCard
    await assertFails(setDoc(doc(ownerDb, 'publicCards', 'card_e'), {
      ...missingName, cardToken: 'card_e',
    }))

    // Update ile PII alanı eklenemez
    await assertFails(updateDoc(doc(ownerDb, 'publicCards', 'card_a'), {
      normalizedPhone: '5551112233',
    }))
  })

  it('locks publicCards binding fields on update', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), { status: 'approved', merchantId: 'merchant_1' })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), { ownerId: 'owner_1', name: 'Demo' })
      await setDoc(doc(ctx.firestore(), 'publicCards', 'card_lock'), {
        merchantId: 'merchant_1',
        campaignId: 'campaign_1',
        membershipId: 'membership_1',
        cardToken: 'card_lock',
        currentStamps: 0,
        status: 'active',
        customerDisplayName: 'B**** E******',
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const cardRef = doc(ownerDb, 'publicCards', 'card_lock')

    await assertFails(updateDoc(cardRef, { merchantId: 'merchant_2' }))
    await assertFails(updateDoc(cardRef, { campaignId: 'campaign_2' }))
    await assertFails(updateDoc(cardRef, { membershipId: 'membership_2' }))
    await assertFails(updateDoc(cardRef, { cardToken: 'other_token' }))

    // İzinli alanlar güncellenebilir
    await assertSucceeds(updateDoc(cardRef, { currentStamps: 1, lastUpdatedAt: new Date() }))
  })

  it('prevents owners from updating subscription documents', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), {
        status: 'approved',
        merchantId: 'merchant_1',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        ownerId: 'owner_1',
        name: 'Demo',
        status: 'active',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1', 'subscription', 'current'), {
        plan: 'trial',
        status: 'trialing',
      })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()

    await assertSucceeds(getDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current')))
    await assertFails(updateDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current'), {
      plan: 'pro',
    }))
  })

  it('allows owners to create only their own trial subscription', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), {
        status: 'approved',
        merchantId: 'merchant_1',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        ownerId: 'owner_1',
        name: 'Demo',
        status: 'active',
      })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()

    // Allowlist dışı ekstra alan → reddedilir
    await assertFails(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current'), {
      plan: 'trial',
      status: 'trialing',
      customLimit: 9999,
    }))

    // Deneme süresi sınırı aşılmış → reddedilir
    await assertFails(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current'), {
      plan: 'trial',
      status: 'trialing',
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    }))

    await assertSucceeds(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current'), {
      plan: 'trial',
      status: 'trialing',
    }))

    await assertFails(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'other'), {
      plan: 'pro',
      status: 'active',
    }))

    // 'current' dışındaki docId'ye trial bile oluşturulamaz
    await assertFails(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'backup'), {
      plan: 'trial',
      status: 'trialing',
    }))
  })

  it('isolates support tickets by user merchant id', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), { merchantId: 'merchant_1', status: 'approved' })
      await setDoc(doc(ctx.firestore(), 'users', 'owner_2'), { merchantId: 'merchant_2', status: 'approved' })
      await setDoc(doc(ctx.firestore(), 'supportTickets', 'ticket_1'), {
        merchantId: 'merchant_1',
        subject: 'Konu',
        message: 'Detay',
        status: 'open',
      })
    })

    const owner1Db = testEnv.authenticatedContext('owner_1').firestore()
    const owner2Db = testEnv.authenticatedContext('owner_2').firestore()

    await assertSucceeds(getDoc(doc(owner1Db, 'supportTickets', 'ticket_1')))
    await assertFails(getDoc(doc(owner2Db, 'supportTickets', 'ticket_1')))
    await assertFails(deleteDoc(doc(owner1Db, 'supportTickets', 'ticket_1')))
    await assertSucceeds(getDocs(query(
      collection(owner1Db, 'supportTickets'),
      where('merchantId', '==', 'merchant_1'),
    )))
  })

  it('prevents user from self-updating status field', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user_1'), {
        displayName: 'Test',
        email: 'test@test.com',
        status: 'pending',
        merchantId: null,
        updatedAt: new Date(),
      })
      // merchantId sahiplik kontrolü için merchant dokümanı gerekli
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        name: 'Test Merchant',
        ownerId: 'user_1',
      })
    })

    const userDb = testEnv.authenticatedContext('user_1').firestore()

    // Kullanıcı kendi status'ünü 'approved' yapamaz
    await assertFails(updateDoc(doc(userDb, 'users', 'user_1'), {
      status: 'approved',
    }))

    // Pending kullanıcı kendi merchant'ı olsa bile merchantId bağlayamaz.
    await assertFails(updateDoc(doc(userDb, 'users', 'user_1'), {
      merchantId: 'merchant_1',
      updatedAt: new Date(),
    }))

    // Kullanıcı izinli bir alanla birlikte status değiştirmeye çalışırsa reddedilmeli.
    await assertFails(updateDoc(doc(userDb, 'users', 'user_1'), {
      displayName: 'Hacker',
      status: 'approved',
    }))

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'user_1'), { status: 'approved' })
    })

    // Admin onayından sonra kendi merchant'ını bağlayabilir.
    await assertSucceeds(updateDoc(doc(userDb, 'users', 'user_1'), {
      merchantId: 'merchant_1',
      updatedAt: new Date(),
    }))
  })

  it('allows users to create only pending self profiles', async () => {
    const userDb = testEnv.authenticatedContext('user_1').firestore()

    await assertSucceeds(setDoc(doc(userDb, 'users', 'user_1'), {
      displayName: 'User One',
      email: 'user1@test.com',
      phone: null,
      merchantId: null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    await testEnv.clearFirestore()

    await assertFails(setDoc(doc(userDb, 'users', 'user_1'), {
      displayName: 'User One',
      email: 'user1@test.com',
      phone: null,
      merchantId: null,
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    await assertFails(setDoc(doc(userDb, 'users', 'user_1'), {
      displayName: 'User One',
      email: 'user1@test.com',
      phone: null,
      merchantId: 'merchant_1',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  })

  it('prevents user from setting merchantId to a merchant owned by another user', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // user_1 mevcut merchantId'si yok
      await setDoc(doc(ctx.firestore(), 'users', 'user_1'), {
        displayName: 'User One',
        status: 'approved',
        merchantId: null,
        updatedAt: new Date(),
      })
      // merchant_2'nin sahibi user_2 (user_1 değil)
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_2'), {
        name: 'Başka Merchant',
        ownerId: 'user_2',
      })
    })

    const userDb = testEnv.authenticatedContext('user_1').firestore()

    // user_1, user_2'ye ait merchant_2'yi kendi merchantId'si yapamaz
    await assertFails(updateDoc(doc(userDb, 'users', 'user_1'), {
      merchantId: 'merchant_2',
      updatedAt: new Date(),
    }))
  })

  it('allows only approved users to create and access their merchant', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pending_1'), {
        status: 'pending',
        merchantId: null,
      })
      await setDoc(doc(ctx.firestore(), 'users', 'rejected_1'), {
        status: 'rejected',
        merchantId: null,
      })
      await setDoc(doc(ctx.firestore(), 'users', 'approved_1'), {
        status: 'approved',
        merchantId: null,
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'legacy_pending'), {
        ownerId: 'pending_1',
        name: 'Legacy Pending Merchant',
      })
    })

    const pendingDb = testEnv.authenticatedContext('pending_1').firestore()
    const rejectedDb = testEnv.authenticatedContext('rejected_1').firestore()
    const approvedDb = testEnv.authenticatedContext('approved_1').firestore()
    const missingProfileDb = testEnv.authenticatedContext('missing_profile').firestore()

    await assertFails(setDoc(doc(pendingDb, 'merchants', 'pending_merchant'), {
      ownerId: 'pending_1',
      name: 'Pending Merchant',
    }))
    await assertFails(setDoc(doc(rejectedDb, 'merchants', 'rejected_merchant'), {
      ownerId: 'rejected_1',
      name: 'Rejected Merchant',
    }))
    await assertFails(setDoc(doc(missingProfileDb, 'merchants', 'missing_profile_merchant'), {
      ownerId: 'missing_profile',
      name: 'Missing Profile Merchant',
    }))
    await assertFails(updateDoc(doc(pendingDb, 'merchants', 'legacy_pending'), {
      name: 'Bypassed',
    }))

    await assertSucceeds(setDoc(doc(approvedDb, 'merchants', 'approved_merchant'), {
      ownerId: 'approved_1',
      name: 'Approved Merchant',
    }))
  })

  it('enforces paymentConsents schema and immutability', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), {
        status: 'approved',
        merchantId: 'merchant_1',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        ownerId: 'owner_1',
        name: 'Demo',
      })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const consentCol = collection(ownerDb, 'merchants', 'merchant_1', 'paymentConsents')
    const validConsent = {
      merchantId: 'merchant_1',
      userId: 'owner_1',
      planId: 'standard',
      planLabel: 'Standart',
      billingCycle: 'monthly',
      displayedPrice: 199,
      shopierUrl: null,
      actionType: 'admin_contact',
      acceptedTermsVersion: 'Haziran 2026 / Madde 4A',
      acceptedAt: new Date(),
    }

    // Geçerli schema → başarılı
    const consentRef = doc(consentCol)
    await assertSucceeds(setDoc(consentRef, validConsent))

    // Update → reddedilmeli (immutable)
    await assertFails(updateDoc(consentRef, { planId: 'pro' }))

    // Zorunlu alan eksik → reddedilmeli
    const { planId: _p, ...missingPlanId } = validConsent
    await assertFails(setDoc(doc(consentCol), missingPlanId))

    // Geçersiz billingCycle enum → reddedilmeli
    await assertFails(setDoc(doc(consentCol), { ...validConsent, billingCycle: 'weekly' }))

    // displayedPrice sıfır → reddedilmeli
    await assertFails(setDoc(doc(consentCol), { ...validConsent, displayedPrice: 0 }))

    // Başka kullanıcı adına consent → reddedilmeli
    const otherDb = testEnv.authenticatedContext('owner_2').firestore()
    await assertFails(setDoc(
      doc(collection(otherDb, 'merchants', 'merchant_1', 'paymentConsents')),
      { ...validConsent, userId: 'owner_2' }
    ))
  })

  it('isolates merchant subcollections (campaigns, customers, transactions) between tenants', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), {
        status: 'approved', merchantId: 'merchant_1',
      })
      await setDoc(doc(ctx.firestore(), 'users', 'owner_2'), {
        status: 'approved', merchantId: 'merchant_2',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        ownerId: 'owner_1', name: 'M1',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_2'), {
        ownerId: 'owner_2', name: 'M2',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_2', 'campaigns', 'camp_2'), {
        name: 'Camp 2', status: 'active',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_2', 'customers', 'cust_2'), {
        name: 'Cust 2',
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_2', 'transactions', 'tx_2'), {
        stamps: 1, createdAt: new Date(),
      })
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1', 'transactions', 'tx_1'), {
        type: 'stamp_add', amount: 1, createdBy: 'owner_1', createdAt: new Date(),
      })
    })

    const owner1Db = testEnv.authenticatedContext('owner_1').firestore()

    // owner_1, merchant_2'nin kampanyasını listeleyemez
    await assertFails(getDocs(query(collection(owner1Db, 'merchants', 'merchant_2', 'campaigns'))))
    // owner_1, merchant_2'nin müşterisini okuyamaz
    await assertFails(getDoc(doc(owner1Db, 'merchants', 'merchant_2', 'customers', 'cust_2')))
    // owner_1, merchant_2'ye transaction yazamaz
    await assertFails(setDoc(doc(owner1Db, 'merchants', 'merchant_2', 'transactions', 'tx_new'), {
      stamps: 1, createdAt: new Date(),
    }))
    // İşlemler sahibi tarafından bile değiştirilemez / silinemez (immutable audit)
    await assertFails(updateDoc(doc(owner1Db, 'merchants', 'merchant_1', 'transactions', 'tx_1'), {
      amount: 99,
    }))
    await assertFails(deleteDoc(doc(owner1Db, 'merchants', 'merchant_1', 'transactions', 'tx_1')))
  })

  it('allows admin to update user status', async () => {
    const ADMIN_UID = 'QGdmCNKAahg6uWiUhEBt5dcGNFD3'

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user_1'), {
        displayName: 'Test',
        status: 'pending',
        merchantId: null,
        updatedAt: new Date(),
      })
    })

    const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore()

    await assertSucceeds(updateDoc(doc(adminDb, 'users', 'user_1'), {
      status: 'approved',
    }))
  })

  it('protects immutable admin audit logs', async () => {
    const adminUid = 'QGdmCNKAahg6uWiUhEBt5dcGNFD3'
    const adminDb = testEnv.authenticatedContext(adminUid).firestore()
    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const logRef = doc(adminDb, 'adminAuditLogs', 'log_1')
    const log = {
      action: 'merchant.status_changed',
      targetType: 'merchant',
      targetId: 'merchant_1',
      summary: 'İşletme pasife alındı',
      actorUid: adminUid,
      createdAt: new Date(),
    }

    await assertSucceeds(setDoc(logRef, log))
    await assertSucceeds(getDoc(logRef))
    await assertFails(updateDoc(logRef, { summary: 'Değiştirildi' }))
    await assertFails(deleteDoc(logRef))
    await assertFails(getDoc(doc(ownerDb, 'adminAuditLogs', 'log_1')))
    await assertFails(setDoc(doc(ownerDb, 'adminAuditLogs', 'forged'), { ...log, actorUid: 'owner_1' }))
  })

  it('allows only admins to change the audit log view cutoff', async () => {
    const adminUid = 'QGdmCNKAahg6uWiUhEBt5dcGNFD3'
    const adminDb = testEnv.authenticatedContext(adminUid).firestore()
    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const settingRef = doc(adminDb, 'adminSettings', 'auditLogView')

    await assertSucceeds(setDoc(settingRef, { visibleFrom: new Date(), updatedAt: new Date() }))
    await assertSucceeds(getDoc(settingRef))
    await assertSucceeds(updateDoc(settingRef, { visibleFrom: new Date() }))
    await assertFails(deleteDoc(settingRef))
    await assertFails(getDoc(doc(ownerDb, 'adminSettings', 'auditLogView')))
    await assertFails(setDoc(doc(ownerDb, 'adminSettings', 'auditLogView'), { visibleFrom: new Date() }))
  })

  it('protects immutable finance entries and validates amount', async () => {
    const adminUid = 'QGdmCNKAahg6uWiUhEBt5dcGNFD3'
    const adminDb = testEnv.authenticatedContext(adminUid).firestore()
    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()
    const entryRef = doc(adminDb, 'financeEntries', 'entry_1')
    const entry = {
      type: 'firebase_expense',
      amount: 250,
      description: 'Haziran Firebase faturası',
      occurredAt: new Date(),
      createdAt: new Date(),
    }

    await assertSucceeds(setDoc(entryRef, entry))
    await assertSucceeds(getDocs(collection(adminDb, 'financeEntries')))
    await assertFails(updateDoc(entryRef, { amount: 1 }))
    await assertSucceeds(deleteDoc(entryRef))
    await assertFails(getDocs(collection(ownerDb, 'financeEntries')))
    await assertFails(setDoc(doc(adminDb, 'financeEntries', 'invalid'), { ...entry, amount: 0 }))
    await assertFails(setDoc(doc(ownerDb, 'financeEntries', 'forged'), entry))
  })

  it('prevents unauthenticated access to user documents', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user_1'), {
        displayName: 'Test',
        status: 'pending',
      })
    })

    const anonDb = testEnv.unauthenticatedContext().firestore()

    await assertFails(getDoc(doc(anonDb, 'users', 'user_1')))
    await assertFails(updateDoc(doc(anonDb, 'users', 'user_1'), { status: 'approved' }))
  })

  it('admin closes account atomically; closed owner cannot access private data or reopen it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'closed_owner'), { status: 'approved', merchantId: 'closed_shop' })
      await setDoc(doc(db, 'merchants', 'closed_shop'), { ownerId: 'closed_owner', status: 'active' })
      await setDoc(doc(db, 'merchants', 'closed_shop', 'customers', 'customer'), { fullName: 'Test' })
    })
    const adminUid = 'QGdmCNKAahg6uWiUhEBt5dcGNFD3'
    const adminDb = testEnv.authenticatedContext(adminUid).firestore()
    const batch = writeBatch(adminDb)
    batch.update(doc(adminDb, 'users', 'closed_owner'), { status: 'deletion_requested' })
    batch.update(doc(adminDb, 'merchants', 'closed_shop'), { status: 'passive' })
    batch.set(doc(adminDb, 'adminAuditLogs', 'closed'), {
      action: 'user.deletion_requested', targetType: 'user', targetId: 'closed_owner',
      summary: 'Closed', actorUid: adminUid, createdAt: new Date(),
    })
    await assertSucceeds(batch.commit())
    const ownerDb = testEnv.authenticatedContext('closed_owner').firestore()
    await assertSucceeds(getDoc(doc(ownerDb, 'users', 'closed_owner')))
    await assertFails(getDoc(doc(ownerDb, 'merchants', 'closed_shop', 'customers', 'customer')))
    await assertFails(updateDoc(doc(ownerDb, 'users', 'closed_owner'), { status: 'approved' }))
    await assertFails(updateDoc(doc(ownerDb, 'merchants', 'closed_shop'), { status: 'active' }))
    await assertFails(setDoc(doc(ownerDb, 'merchants', 'new_shop'), { ownerId: 'closed_owner' }))
    await assertFails(deleteDoc(doc(ownerDb, 'users', 'closed_owner')))
  })

  it('documents that rules tests require the Firestore emulator', () => {
    expect(emulatorHost).toBeTruthy()
  })

  it('owner archives their merchant atomically, cannot reopen it, and can attach a new merchant', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', 'owner_archive'), { status: 'approved', merchantId: 'archive_shop' })
      await setDoc(doc(db, 'merchants', 'archive_shop'), { ownerId: 'owner_archive', status: 'active', slug: 'archive' })
      await setDoc(doc(db, 'publicSlugs', 'archive'), { merchantId: 'archive_shop', isActive: true })
      await setDoc(doc(db, 'merchants', 'archive_shop', 'customers', 'c'), { fullName: 'Test' })
      await setDoc(doc(db, 'merchants', 'archive_shop', 'transactions', 't'), { amount: 1 })
    })
    const db = testEnv.authenticatedContext('owner_archive').firestore()
    const userRef = doc(db, 'users', 'owner_archive')
    const merchantRef = doc(db, 'merchants', 'archive_shop')
    await assertFails(updateDoc(userRef, { merchantId: null }))
    await assertFails(updateDoc(merchantRef, { archived: true, status: 'passive' }))
    const batch = writeBatch(db)
    batch.update(userRef, { merchantId: null })
    batch.update(merchantRef, { archived: true, status: 'passive', deletedAt: new Date() })
    batch.update(doc(db, 'publicSlugs', 'archive'), { isActive: false })
    await assertSucceeds(batch.commit())
    await assertFails(updateDoc(merchantRef, { archived: false, status: 'active' }))
    await assertFails(updateDoc(userRef, { merchantId: 'archive_shop' }))
    await assertFails(getDoc(doc(db, 'merchants', 'archive_shop', 'customers', 'c')))
    await assertFails(deleteDoc(doc(db, 'merchants', 'archive_shop', 'transactions', 't')))
    await assertSucceeds(setDoc(doc(db, 'merchants', 'new_shop'), { ownerId: 'owner_archive', status: 'active' }))
    await assertSucceeds(updateDoc(userRef, { merchantId: 'new_shop' }))
    const adminDb = testEnv.authenticatedContext('QGdmCNKAahg6uWiUhEBt5dcGNFD3').firestore()
    expect((await getDoc(doc(adminDb, 'merchants', 'archive_shop', 'transactions', 't'))).exists()).toBe(true)
  })

  it('another owner cannot archive a merchant or detach its owner', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'victim'), { status: 'approved', merchantId: 'victim_shop' })
      await setDoc(doc(ctx.firestore(), 'users', 'other'), { status: 'approved', merchantId: null })
      await setDoc(doc(ctx.firestore(), 'merchants', 'victim_shop'), { ownerId: 'victim', status: 'active' })
    })
    const db = testEnv.authenticatedContext('other').firestore()
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', 'victim'), { merchantId: null })
    batch.update(doc(db, 'merchants', 'victim_shop'), { archived: true, status: 'passive' })
    await assertFails(batch.commit())
    expect((await getDoc(doc(db, 'merchants', 'victim_shop'))).data()?.status).toBe('active')
  })
})
