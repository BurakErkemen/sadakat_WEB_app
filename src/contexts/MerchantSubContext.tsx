import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import { PLAN_LIMITS, resolveLimit, type PlanKey } from '@/lib/constants'
import type { Merchant, Subscription } from '@/types'

type PlanFeatures = typeof PLAN_LIMITS[PlanKey]['features']
type PlanLimits = { maxCustomers: number; maxMonthlyTransactions: number; maxCampaigns: number; maxActiveCampaigns: number }

interface MerchantSubContextValue {
  merchant: Merchant | null
  sub: Subscription | null
  plan: PlanKey
  features: PlanFeatures
  limits: PlanLimits
  loading: boolean
}

const MerchantSubContext = createContext<MerchantSubContextValue | null>(null)

export function MerchantSubProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mid = profile?.merchantId
    if (!mid) { setMerchant(null); setSub(null); setLoading(false); return }

    setLoading(true)
    let firstSnap = true

    const unsub = onSnapshot(
      doc(db, 'merchants', mid),
      (s) => {
        setMerchant(s.exists() ? ({ id: s.id, ...s.data() } as Merchant) : null)
        if (firstSnap) {
          firstSnap = false
          getDoc(doc(db, 'merchants', mid, 'subscription', 'current'))
            .then((ss) => { if (ss.exists()) setSub(ss.data() as Subscription) })
            .catch(console.error)
            .finally(() => setLoading(false))
        }
      },
      (err) => { console.error(err); setLoading(false) },
    )

    return unsub
  }, [profile?.merchantId])

  const plan = ((sub?.plan ?? 'trial') as PlanKey) in PLAN_LIMITS
    ? (sub?.plan ?? 'trial') as PlanKey
    : 'trial'

  const base = PLAN_LIMITS[plan]

  // Firestore'daki admin override'larını async olarak uygula (yalnızca sayısal limitler)
  const [limits, setLimits] = useState<PlanLimits>({
    maxCustomers: base.maxCustomers,
    maxMonthlyTransactions: base.maxMonthlyTransactions,
    maxCampaigns: base.maxCampaigns,
    maxActiveCampaigns: base.maxActiveCampaigns,
  })

  useEffect(() => {
    if (loading) return
    const def = PLAN_LIMITS[plan]
    setLimits({
      maxCustomers: def.maxCustomers,
      maxMonthlyTransactions: def.maxMonthlyTransactions,
      maxCampaigns: def.maxCampaigns,
      maxActiveCampaigns: def.maxActiveCampaigns,
    })
    getDoc(doc(db, 'config', 'pricing')).then((snap) => {
      if (!snap.exists()) return
      const d = snap.data()[plan] as Partial<PlanLimits> | undefined
      if (!d) return
      setLimits({
        maxCustomers: resolveLimit(d.maxCustomers, def.maxCustomers),
        maxMonthlyTransactions: resolveLimit(d.maxMonthlyTransactions, def.maxMonthlyTransactions),
        maxCampaigns: resolveLimit(d.maxCampaigns, def.maxCampaigns),
        maxActiveCampaigns: resolveLimit(d.maxActiveCampaigns, def.maxActiveCampaigns),
      })
    }).catch(console.error)
  }, [plan, loading])

  return (
    <MerchantSubContext.Provider value={{
      merchant,
      sub,
      plan,
      features: PLAN_LIMITS[plan].features,
      limits,
      loading,
    }}>
      {children}
    </MerchantSubContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMerchantSub() {
  const ctx = useContext(MerchantSubContext)
  if (!ctx) throw new Error('useMerchantSub must be used within MerchantSubProvider')
  return ctx
}
