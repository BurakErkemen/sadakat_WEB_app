import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import type { Subscription } from '@/types'

export function useSubscription(merchantId?: string) {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!merchantId) { setLoading(false); return }
    getDoc(doc(db, 'merchants', merchantId, 'subscription', 'current'))
      .then((snap) => { if (snap.exists()) setSub(snap.data() as Subscription) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [merchantId])

  return { sub, loading }
}
