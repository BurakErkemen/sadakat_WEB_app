import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { PLAN_LIMITS, resolveLimit, type PlanKey } from '@/lib/constants'

export type DynamicLimits = {
  maxCustomers: number
  maxMonthlyTransactions: number
  maxCampaigns: number
  features: typeof PLAN_LIMITS[PlanKey]['features']
}

// Firestore config/pricing'den admin tarafından güncellenen limitleri okur.
// Eksik alanlar için constants.ts default değerleri kullanılır.
export function usePlanLimits(plan: PlanKey | null): DynamicLimits {
  const defaults = PLAN_LIMITS[plan ?? 'trial']
  const [limits, setLimits] = useState<DynamicLimits>({
    maxCustomers: defaults.maxCustomers,
    maxMonthlyTransactions: defaults.maxMonthlyTransactions,
    maxCampaigns: defaults.maxCampaigns,
    features: defaults.features,
  })

  useEffect(() => {
    if (!plan) return
    getDoc(doc(db, 'config', 'pricing')).then((snap) => {
      if (!snap.exists()) return
      const d = snap.data()[plan] as {
        maxCustomers?: number
        maxMonthlyTransactions?: number
        maxCampaigns?: number
      } | undefined
      if (!d) return
      const def = PLAN_LIMITS[plan]
      setLimits({
        maxCustomers: resolveLimit(d.maxCustomers, def.maxCustomers),
        maxMonthlyTransactions: resolveLimit(d.maxMonthlyTransactions, def.maxMonthlyTransactions),
        maxCampaigns: resolveLimit(d.maxCampaigns, def.maxCampaigns),
        features: def.features,
      })
    }).catch(console.error)
  }, [plan])

  return limits
}
