import { describe, expect, it } from 'vitest'
import { buildAnalyticsSnapshot, percentChange } from './analyticsModel'

const now = new Date('2026-06-23T12:00:00.000Z')

describe('buildAnalyticsSnapshot', () => {
  it('keeps stamp and point program metrics separate', () => {
    const snapshot = buildAnalyticsSnapshot({
      now,
      periodWeeks: 4,
      transactions: [
        { id: '1', customerId: 'c1', campaignId: 'stamp-1', type: 'stamp_add', amount: 2, purchaseAmount: 100, createdAt: new Date('2026-06-22') },
        { id: '2', customerId: 'c1', campaignId: 'points-1', type: 'stamp_add', amount: 150, purchaseAmount: 50, createdAt: new Date('2026-06-20') },
        { id: '3', customerId: 'c2', campaignId: 'points-1', type: 'reward_redeem', amount: -100, createdAt: new Date('2026-06-18') },
        { id: '4', customerId: 'c3', campaignId: 'stamp-1', type: 'stamp_add', amount: 1, createdAt: new Date('2026-05-20') },
      ],
      customers: [{ id: 'c1', createdAt: new Date('2026-06-21') }],
      campaigns: [
        { id: 'stamp-1', name: 'Kahve', type: 'stamp', requiredStamps: 5, status: 'active' },
        { id: 'points-1', name: 'Puan', type: 'points', requiredStamps: 500, status: 'active' },
      ],
      memberships: [],
    })

    expect(snapshot.current).toMatchObject({
      loyaltyEvents: 2,
      redemptions: 1,
      newCustomers: 1,
      activeCustomers: 2,
      repeatCustomers: 1,
      repeatRate: 50,
    })
    expect(snapshot.programs.stamp.current).toMatchObject({
      transactionEvents: 1,
      earnedUnits: 2,
      redemptions: 0,
      purchaseRevenue: 0,
    })
    expect(snapshot.programs.points.current).toMatchObject({
      transactionEvents: 1,
      earnedUnits: 150,
      redemptions: 1,
      purchaseRevenue: 50,
      averagePurchase: 50,
    })
    expect(snapshot.programs.stamp.previous.earnedUnits).toBe(1)
  })

  it('builds campaign engagement and reward readiness', () => {
    const snapshot = buildAnalyticsSnapshot({
      now,
      periodWeeks: 4,
      transactions: [
        { id: '1', customerId: 'c1', campaignId: 'p1', type: 'stamp_add', amount: 3, createdAt: new Date('2026-06-22') },
        { id: '2', customerId: 'c1', campaignId: 'p1', type: 'reward_redeem', amount: -5, createdAt: new Date('2026-06-21') },
      ],
      customers: [],
      campaigns: [{ id: 'p1', name: 'Kahve', type: 'stamp', requiredStamps: 5, status: 'active' }],
      memberships: [
        { campaignId: 'p1', customerId: 'c1', currentStamps: 5, status: 'active' },
        { campaignId: 'p1', customerId: 'c2', currentStamps: 2, status: 'active' },
      ],
    })

    expect(snapshot.campaigns[0]).toMatchObject({
      activeMembers: 2,
      activeCustomers: 1,
      engagementRate: 50,
      rewardReady: 1,
      averageProgress: 70,
      earnedUnits: 3,
      transactionEvents: 1,
      redemptions: 1,
    })
    expect(snapshot.programs.stamp.current.rewardReady).toBe(1)
  })

  it('creates separate weekly buckets for both program types', () => {
    const snapshot = buildAnalyticsSnapshot({
      now,
      periodWeeks: 12,
      transactions: [
        { id: '1', customerId: 'c1', campaignId: 's1', type: 'stamp_add', amount: 1, createdAt: new Date('2026-06-22') },
        { id: '2', customerId: 'c2', campaignId: 'p1', type: 'reward_redeem', amount: -50, createdAt: new Date('2026-06-22') },
      ],
      customers: [],
      campaigns: [
        { id: 's1', name: 'Damga', type: 'stamp', requiredStamps: 5, status: 'active' },
        { id: 'p1', name: 'Puan', type: 'points', requiredStamps: 500, status: 'active' },
      ],
      memberships: [],
    })

    expect(snapshot.weeks).toHaveLength(12)
    expect(snapshot.weeks[snapshot.weeks.length - 1]).toMatchObject({
      stampEvents: 1,
      stampRedemptions: 0,
      pointEvents: 0,
      pointRedemptions: 1,
    })
  })
})

describe('percentChange', () => {
  it('handles growth, decline and a zero baseline', () => {
    expect(percentChange(15, 10)).toBe(50)
    expect(percentChange(5, 10)).toBe(-50)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(5, 0)).toBeNull()
  })
})
