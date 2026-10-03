import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { ADMIN_UIDS } from '@/lib/constants'
import type { UserProfile } from '@/types'
import ErrorState from '@/components/ErrorState'
import AccountUnavailable from './AccountUnavailable'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let unsubAuth: (() => void) | null = null
    let unsubProfile: (() => void) | null = null
    let session = 0

    // Firebase dinamik yüklenir: auth sayfaları Firebase inmeden boyanır (mobil LCP),
    // oturum durumu SDK hazır olunca gelir; o ana kadar loading=true kalır.
    void (async () => {
      const [{ onAuthStateChanged }, { doc, onSnapshot }, { auth }, { db }] = await Promise.all([
        import('firebase/auth'),
        import('firebase/firestore'),
        import('@/firebase/auth'),
        import('@/firebase/firestore'),
      ])
      if (cancelled) return

      unsubAuth = onAuthStateChanged(auth, (u) => {
        const currentSession = ++session
        setUser(u)
        setProfile(null)
        setError(null)
        setLoading(!!u)

        if (unsubProfile) { unsubProfile(); unsubProfile = null }

        if (u) {
          // onSnapshot: profil her değiştiğinde (onboarding, admin onayı vb.) context güncellenir
          unsubProfile = onSnapshot(doc(db, 'users', u.uid), { includeMetadataChanges: true }, (snap) => {
            if (cancelled || currentSession !== session) return
            // Önbellekte eksik profil, sunucuda mağaza olmadığı anlamına gelmez.
            if (snap.metadata.fromCache && !snap.data()?.merchantId) return
            setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
            setError(null)
            setLoading(false)
          }, () => {
            if (cancelled || currentSession !== session) return
            setProfile(null)
            setError('Hesap bilgileriniz yüklenemedi. Lütfen tekrar deneyin.')
            setLoading(false)
          })
        } else {
          setProfile(null)
          setLoading(false)
        }
      })
    })().catch(() => {
      if (cancelled) return
      setError('Oturum bilgileri yüklenemedi. Lütfen tekrar deneyin.')
      setLoading(false)
    })

    return () => {
      cancelled = true
      if (unsubAuth) unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [attempt])

  const isAdmin = user ? ADMIN_UIDS.includes(user.uid) : false

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading }}>
      {error ? <ErrorState message={error} onRetry={() => {
        setError(null)
        setLoading(true)
        setAttempt((value) => value + 1)
      }} /> : !loading && user && !isAdmin && profile?.status === 'deletion_requested'
        ? <AccountUnavailable user={user} deletionRequested /> : children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
