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

  it('prevents owners from updating subscription documents', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
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
      await setDoc(doc(ctx.firestore(), 'merchants', 'merchant_1'), {
        ownerId: 'owner_1',
        name: 'Demo',
        status: 'active',
      })
    })

    const ownerDb = testEnv.authenticatedContext('owner_1').firestore()

    await assertSucceeds(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'current'), {
      plan: 'trial',
      status: 'trialing',
    }))

    await assertFails(setDoc(doc(ownerDb, 'merchants', 'merchant_1', 'subscription', 'other'), {
      plan: 'pro',
      status: 'active',
    }))
  })

  it('isolates support tickets by user merchant id', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'owner_1'), { merchantId: 'merchant_1' })
      await setDoc(doc(ctx.firestore(), 'users', 'owner_2'), { merchantId: 'merchant_2' })
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

  it('documents that rules tests require the Firestore emulator', () => {
    expect(emulatorHost).toBeTruthy()
  })
})
