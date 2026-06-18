export const PLAN_LIMITS = {
  trial: {
    label: 'Deneme',
    maxCustomers: 50,
    maxMonthlyTransactions: 200,
    maxCampaigns: 1,
    maxActiveCampaigns: 1,
    features: {
      qrLookup: false,
      phoneLookup: true,
      prioritySupport: false,
      advancedAnalytics: false,
    },
  },
  mini: {
    label: 'Mini',
    maxCustomers: 200,
    maxMonthlyTransactions: 500,
    maxCampaigns: 2,
    maxActiveCampaigns: 1,
    features: {
      qrLookup: false,
      phoneLookup: true,
      prioritySupport: false,
      advancedAnalytics: false,
    },
  },
  standard: {
    label: 'Standart',
    maxCustomers: 1000,
    maxMonthlyTransactions: 3000,
    maxCampaigns: 5,
    maxActiveCampaigns: Infinity,
    features: {
      qrLookup: false,
      phoneLookup: true,
      prioritySupport: true,
      advancedAnalytics: false,
    },
  },
  pro: {
    label: 'Pro',
    maxCustomers: Infinity,
    maxMonthlyTransactions: Infinity,
    maxCampaigns: Infinity,
    maxActiveCampaigns: Infinity,
    features: {
      qrLookup: false,
      phoneLookup: true,
      prioritySupport: true,
      advancedAnalytics: true,
    },
  },
} satisfies Record<string, {
  label: string
  maxCustomers: number
  maxMonthlyTransactions: number
  maxCampaigns: number
  maxActiveCampaigns: number
  features: Record<string, boolean>
}>

export type PlanKey = keyof typeof PLAN_LIMITS

export const ADMIN_UIDS: string[] = (import.meta.env.VITE_ADMIN_UIDS ?? '').split(',').filter(Boolean)

/** Firestore'da -1 → sınırsız (Infinity) anlamına gelir. */
export function resolveLimit(val: number | undefined, fallback: number): number {
  if (val === undefined || val === null) return fallback
  return val === -1 ? Infinity : val
}
