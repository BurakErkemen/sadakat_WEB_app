import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firestore'
import { useAuth } from '@/features/auth/AuthContext'
import type { Merchant } from '@/types'

export function useMerchant() {
  const { profile } = useAuth()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.merchantId) {
      setLoading(false)
      return
    }
    getDoc(doc(db, 'merchants', profile.merchantId))
      .then((snap) => {
        if (snap.exists()) setMerchant({ id: snap.id, ...snap.data() } as Merchant)
        else setError('İşletme bulunamadı')
      })
      .catch(() => setError('İşletme yüklenemedi'))
      .finally(() => setLoading(false))
  }, [profile?.merchantId])

  return { merchant, loading, error }
}
