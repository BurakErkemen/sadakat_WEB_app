import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import ProtectedRoute, { AdminRoute } from './ProtectedRoute'

// Eager — kritik yol: landing + auth (her zaman anında görünmeli)
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import VerifyEmailPage from '@/features/auth/VerifyEmailPage'
import KvkkPage from '@/pages/KvkkPage'
import TermsPage from '@/pages/TermsPage'
import GizlilikPage from '@/pages/GizlilikPage'
import PendingPage from '@/pages/PendingPage'

// Lazy — yalnızca route'a girildiğinde yüklenir (bundle splitting)
const AppLayout = lazy(() => import('@/components/AppLayout'))
const AdminLayout = lazy(() => import('@/components/AdminLayout'))
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'))
const DashboardPage = lazy(() => import('@/features/merchants/DashboardPage'))
const CampaignsPage = lazy(() => import('@/features/campaigns/CampaignsPage'))
const NewCampaignPage = lazy(() => import('@/features/campaigns/NewCampaignPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const NewCustomerPage = lazy(() => import('@/features/customers/NewCustomerPage'))
const CustomerDetailPage = lazy(() => import('@/features/customers/CustomerDetailPage'))
const SupportPage = lazy(() => import('@/features/support/SupportPage'))
const StampPage = lazy(() => import('@/features/loyalty/StampPage'))
const RedeemPage = lazy(() => import('@/features/loyalty/RedeemPage'))
const TransactionsPage = lazy(() => import('@/features/transactions/TransactionsPage'))
const QRPage = lazy(() => import('@/features/loyalty/QRPage'))
const SubscriptionPage = lazy(() => import('@/features/subscription/SubscriptionPage'))
const SettingsPage = lazy(() => import('@/features/merchants/SettingsPage'))
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'))
const AdminPage = lazy(() => import('@/features/admin/AdminPage'))
const PublicCardPage = lazy(() => import('@/features/public-card/PublicCardPage'))
const PublicMerchantPage = lazy(() => import('@/features/public-merchant/PublicMerchantPage'))

function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-violet-600" />
    </div>
  )
}

// Onboarding: merchant'ı olanlar /app'e, adminler /yonetim'e gider
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth()
  if (loading) return <RouteSpinner />
  if (isAdmin) return <Navigate to="/yonetim" replace />
  if (profile?.status === 'pending' || profile?.status === 'rejected') return <Navigate to="/pending" replace />
  if (profile?.merchantId) return <Navigate to="/app" replace />
  return <>{children}</>
}

// Merchant app: admin giremez, pending kullanıcı bekleyişe gider
// minWait: giriş→panel geçişini en az 900ms gösterir (flash önleme)
function AppGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth()
  const [minWait, setMinWait] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setMinWait(false), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading || minWait) return <RouteSpinner />
  if (isAdmin) return <Navigate to="/yonetim" replace />
  if (profile?.status === 'pending' || profile?.status === 'rejected') return <Navigate to="/pending" replace />
  if (profile && !profile.merchantId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteSpinner />}>
          <Routes>
            {/* Public — auth gerektirmez */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/kvkk" element={<KvkkPage />} />
            <Route path="/kullanim-kosullari" element={<TermsPage />} />
            <Route path="/gizlilik" element={<GizlilikPage />} />
            <Route path="/pending" element={<PendingPage />} />
            <Route path="/c/:cardToken" element={<PublicCardPage />} />
            <Route path="/m/:slug" element={<PublicMerchantPage />} />

            {/* Onboarding (sadece merchant değil, henüz işletme kurmamış kullanıcılar) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <OnboardingPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            {/* İşletmeci paneli — admin giremez */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppGuard>
                    <AppLayout />
                  </AppGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="campaigns/new" element={<NewCampaignPage />} />
              <Route path="campaigns/:id/edit" element={<NewCampaignPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/new" element={<NewCustomerPage />} />
              <Route path="customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="stamp" element={<StampPage />} />
              <Route path="redeem" element={<RedeemPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="qr" element={<QRPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>

            {/* Yönetim paneli — sadece admin, /admin artık yok */}
            <Route
              path="/yonetim"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminPage />} />
            </Route>

            {/* Eski /admin linklerini yönlendir */}
            <Route path="/admin" element={<Navigate to="/yonetim" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
