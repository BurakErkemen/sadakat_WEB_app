import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { ADMIN_UIDS } from '@/lib/constants'
import type { UserProfile } from '@/types'

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

  useEffect(() => {
    let cancelled = false
    let unsubAuth: (() => void) | null = null
    let unsubProfile: (() => void) | null = null

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
        setUser(u)

        if (unsubProfile) { unsubProfile(); unsubProfile = null }

        if (u) {
          // onSnapshot: profil her değiştiğinde (onboarding, admin onayı vb.) context güncellenir
          unsubProfile = onSnapshot(doc(db, 'users', u.uid), (snap) => {
            setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
            setLoading(false)
          }, () => {
            setProfile(null)
            setLoading(false)
          })
        } else {
          setProfile(null)
          setLoading(false)
        }
      })
    })()

    return () => {
      cancelled = true
      if (unsubAuth) unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  const isAdmin = user ? ADMIN_UIDS.includes(user.uid) : false

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
