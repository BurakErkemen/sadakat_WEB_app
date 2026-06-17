export const PLAN_LIMITS = {
  trial: {
    label: 'Deneme',
    maxCustomers: 50,
    maxMonthlyTransactions: 200,
    maxCampaigns: 1,
  },
  mini: {
    label: 'Mini',
    maxCustomers: 200,
    maxMonthlyTransactions: 500,
    maxCampaigns: 2,
  },
  standard: {
    label: 'Standart',
    maxCustomers: 1000,
    maxMonthlyTransactions: 3000,
    maxCampaigns: 5,
  },
  pro: {
    label: 'Pro',
    maxCustomers: Infinity,
    maxMonthlyTransactions: Infinity,
    maxCampaigns: Infinity,
  },
} as const

export type PlanKey = keyof typeof PLAN_LIMITS

export const ADMIN_UIDS: string[] = (import.meta.env.VITE_ADMIN_UIDS ?? '').split(',').filter(Boolean)
