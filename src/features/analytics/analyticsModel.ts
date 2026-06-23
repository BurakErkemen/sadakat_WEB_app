export type AnalyticsPeriodWeeks = 4 | 12 | 26
export type CampaignType = 'stamp' | 'points'

export interface AnalyticsTransactionInput {
  id: string
  customerId: string
  campaignId: string
  type: 'stamp_add' | 'reward_redeem' | 'manual_adjustment'
  amount: number
  purchaseAmount?: number | null
  createdAt: Date
}

export interface AnalyticsCustomerInput {
  id: string
  createdAt: Date
}

export interface AnalyticsCampaignInput {
  id: string
  name: string
  type: CampaignType
  requiredStamps: number
  status: 'active' | 'passive'
}

export interface AnalyticsMembershipInput {
  campaignId: string
  customerId: string
  currentStamps: number
  status: 'active' | 'passive'
}

export interface PeriodSummary {
  loyaltyEvents: number
  redemptions: number
  newCustomers: number
  activeCustomers: number
  repeatCustomers: number
  repeatRate: number
}

export interface ProgramSummary {
  campaignCount: number
  activeCampaigns: number
  activeMembers: number
  activeCustomers: number
  transactionEvents: number
  earnedUnits: number
  redemptions: number
  rewardReady: number
  purchaseRevenue: number
  averagePurchase: number
}

export interface WeekData {
  key: string
  label: string
  stampEvents: number
  stampRedemptions: number
  pointEvents: number
  pointRedemptions: number
}

export interface CampaignAnalytics {
  id: string
  name: string
  type: CampaignType
  status: 'active' | 'passive'
  activeMembers: number
  activeCustomers: number
  engagementRate: number
  rewardReady: number
  averageProgress: number
  earnedUnits: number
  transactionEvents: number
  redemptions: number
  purchaseRevenue: number
  averagePurchase: number
}

export interface AnalyticsSnapshot {
  periodStart: Date
  previousPeriodStart: Date
  current: PeriodSummary
  previous: PeriodSummary
  programs: Record<CampaignType, { current: ProgramSummary; previous: ProgramSummary }>
  weeks: WeekData[]
  campaigns: CampaignAnalytics[]
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const value = date.getTime()
  return value >= start.getTime() && value < end.getTime()
}

function campaignTypeMap(campaigns: AnalyticsCampaignInput[]): Map<string, CampaignType> {
  return new Map(campaigns.map((campaign) => [campaign.id, campaign.type]))
}

function summarizePeriod(
  transactions: AnalyticsTransactionInput[],
  customers: AnalyticsCustomerInput[],
  start: Date,
  end: Date,
): PeriodSummary {
  const periodTransactions = transactions.filter((tx) => inRange(tx.createdAt, start, end))
  const customerFrequency = new Map<string, number>()

  periodTransactions.forEach((tx) => {
    if (!tx.customerId) return
    customerFrequency.set(tx.customerId, (customerFrequency.get(tx.customerId) ?? 0) + 1)
  })

  const activeCustomers = customerFrequency.size
  const repeatCustomers = [...customerFrequency.values()].filter((count) => count >= 2).length

  return {
    loyaltyEvents: periodTransactions.filter((tx) => tx.type === 'stamp_add').length,
    redemptions: periodTransactions.filter((tx) => tx.type === 'reward_redeem').length,
    newCustomers: customers.filter((customer) => inRange(customer.createdAt, start, end)).length,
    activeCustomers,
    repeatCustomers,
    repeatRate: activeCustomers > 0 ? Math.round((repeatCustomers / activeCustomers) * 100) : 0,
  }
}

function summarizeProgram(
  type: CampaignType,
  campaigns: AnalyticsCampaignInput[],
  memberships: AnalyticsMembershipInput[],
  transactions: AnalyticsTransactionInput[],
  start: Date,
  end: Date,
): ProgramSummary {
  const typedCampaigns = campaigns.filter((campaign) => campaign.type === type)
  const campaignIds = new Set(typedCampaigns.map((campaign) => campaign.id))
  const typedMemberships = memberships.filter(
    (membership) => campaignIds.has(membership.campaignId) && membership.status === 'active',
  )
  const periodTransactions = transactions.filter(
    (tx) => campaignIds.has(tx.campaignId) && inRange(tx.createdAt, start, end),
  )
  const earningTransactions = periodTransactions.filter((tx) => tx.type === 'stamp_add')
  const purchases = type === 'points'
    ? earningTransactions
        .map((tx) => tx.purchaseAmount ?? 0)
        .filter((amount) => Number.isFinite(amount) && amount > 0)
    : []
  const purchaseRevenue = purchases.reduce((sum, amount) => sum + amount, 0)
  const requirements = new Map(
    typedCampaigns.map((campaign) => [campaign.id, Math.max(1, campaign.requiredStamps || 1)]),
  )

  return {
    campaignCount: typedCampaigns.length,
    activeCampaigns: typedCampaigns.filter((campaign) => campaign.status === 'active').length,
    activeMembers: typedMemberships.length,
    activeCustomers: new Set(periodTransactions.map((tx) => tx.customerId).filter(Boolean)).size,
    transactionEvents: earningTransactions.length,
    earnedUnits: earningTransactions.reduce((sum, tx) => sum + Math.max(0, tx.amount || 0), 0),
    redemptions: periodTransactions.filter((tx) => tx.type === 'reward_redeem').length,
    rewardReady: typedMemberships.filter(
      (membership) => membership.currentStamps >= (requirements.get(membership.campaignId) ?? 1),
    ).length,
    purchaseRevenue,
    averagePurchase: purchases.length > 0 ? purchaseRevenue / purchases.length : 0,
  }
}

function buildWeeks(
  transactions: AnalyticsTransactionInput[],
  campaigns: AnalyticsCampaignInput[],
  periodStart: Date,
  periodWeeks: AnalyticsPeriodWeeks,
  end: Date,
): WeekData[] {
  const types = campaignTypeMap(campaigns)

  return Array.from({ length: periodWeeks }, (_, index) => {
    const weekStart = new Date(periodStart.getTime() + index * 7 * DAY_MS)
    const weekEnd = new Date(Math.min(weekStart.getTime() + 7 * DAY_MS, end.getTime()))
    const weekTransactions = transactions.filter((tx) => inRange(tx.createdAt, weekStart, weekEnd))
    const stampTransactions = weekTransactions.filter((tx) => types.get(tx.campaignId) === 'stamp')
    const pointTransactions = weekTransactions.filter((tx) => types.get(tx.campaignId) === 'points')

    return {
      key: weekStart.toISOString(),
      label: weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      stampEvents: stampTransactions.filter((tx) => tx.type === 'stamp_add').length,
      stampRedemptions: stampTransactions.filter((tx) => tx.type === 'reward_redeem').length,
      pointEvents: pointTransactions.filter((tx) => tx.type === 'stamp_add').length,
      pointRedemptions: pointTransactions.filter((tx) => tx.type === 'reward_redeem').length,
    }
  })
}

function buildCampaigns(
  campaigns: AnalyticsCampaignInput[],
  memberships: AnalyticsMembershipInput[],
  transactions: AnalyticsTransactionInput[],
  periodStart: Date,
  end: Date,
): CampaignAnalytics[] {
  const periodTransactions = transactions.filter((tx) => inRange(tx.createdAt, periodStart, end))

  return campaigns.map((campaign) => {
    const activeMemberships = memberships.filter(
      (membership) => membership.campaignId === campaign.id && membership.status === 'active',
    )
    const campaignTransactions = periodTransactions.filter((tx) => tx.campaignId === campaign.id)
    const earningTransactions = campaignTransactions.filter((tx) => tx.type === 'stamp_add')
    const activeCustomers = new Set(campaignTransactions.map((tx) => tx.customerId).filter(Boolean)).size
    const required = Math.max(1, campaign.requiredStamps || 1)
    const purchases = campaign.type === 'points'
      ? earningTransactions
          .map((tx) => tx.purchaseAmount ?? 0)
          .filter((amount) => Number.isFinite(amount) && amount > 0)
      : []
    const purchaseRevenue = purchases.reduce((sum, amount) => sum + amount, 0)

    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      activeMembers: activeMemberships.length,
      activeCustomers,
      engagementRate: activeMemberships.length > 0
        ? Math.min(100, Math.round((activeCustomers / activeMemberships.length) * 100))
        : 0,
      rewardReady: activeMemberships.filter((membership) => membership.currentStamps >= required).length,
      averageProgress: activeMemberships.length > 0
        ? Math.round(activeMemberships.reduce(
            (sum, membership) => sum + Math.min(100, (membership.currentStamps / required) * 100),
            0,
          ) / activeMemberships.length)
        : 0,
      earnedUnits: earningTransactions.reduce((sum, tx) => sum + Math.max(0, tx.amount || 0), 0),
      transactionEvents: earningTransactions.length,
      redemptions: campaignTransactions.filter((tx) => tx.type === 'reward_redeem').length,
      purchaseRevenue,
      averagePurchase: purchases.length > 0 ? purchaseRevenue / purchases.length : 0,
    }
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    if (a.activeCustomers !== b.activeCustomers) return b.activeCustomers - a.activeCustomers
    return b.activeMembers - a.activeMembers
  })
}

export function buildAnalyticsSnapshot(input: {
  now: Date
  periodWeeks: AnalyticsPeriodWeeks
  transactions: AnalyticsTransactionInput[]
  customers: AnalyticsCustomerInput[]
  campaigns: AnalyticsCampaignInput[]
  memberships: AnalyticsMembershipInput[]
}): AnalyticsSnapshot {
  const end = new Date(input.now.getTime() + 1)
  const periodStart = startOfDay(new Date(input.now.getTime() - input.periodWeeks * 7 * DAY_MS))
  const previousPeriodStart = startOfDay(new Date(periodStart.getTime() - input.periodWeeks * 7 * DAY_MS))
  const program = (type: CampaignType) => ({
    current: summarizeProgram(type, input.campaigns, input.memberships, input.transactions, periodStart, end),
    previous: summarizeProgram(
      type,
      input.campaigns,
      input.memberships,
      input.transactions,
      previousPeriodStart,
      periodStart,
    ),
  })

  return {
    periodStart,
    previousPeriodStart,
    current: summarizePeriod(input.transactions, input.customers, periodStart, end),
    previous: summarizePeriod(input.transactions, input.customers, previousPeriodStart, periodStart),
    programs: { stamp: program('stamp'), points: program('points') },
    weeks: buildWeeks(input.transactions, input.campaigns, periodStart, input.periodWeeks, end),
    campaigns: buildCampaigns(input.campaigns, input.memberships, input.transactions, periodStart, end),
  }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}
