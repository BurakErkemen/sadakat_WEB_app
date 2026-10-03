import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import AccountUnavailable from '@/features/auth/AccountUnavailable'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin && (!profile || profile.status === 'deletion_requested')) return <AccountUnavailable user={user} deletionRequested={profile?.status === 'deletion_requested'} />
  if (!isAdmin && !user.emailVerified) return <Navigate to="/verify-email" replace />
  // Pending veya reddedilmiş kullanıcılar uygulamaya giremez.
  // AuthContext onSnapshot ile status değişikliğini anlık alır;
  // admin onaylayınca/reddedince bu guard otomatik tetiklenir.
  if (!isAdmin && (profile?.status === 'pending' || profile?.status === 'rejected')) {
    return <Navigate to="/pending" replace />
  }
  return <>{children}</>
}

// Admin-only: erişim /yonetim altına kısıtlı
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/app" replace />
  return <>{children}</>
}
