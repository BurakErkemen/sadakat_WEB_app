import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import ProtectedRoute, { AdminRoute } from './ProtectedRoute'

// Auth gerektiren rota ağacının TAMAMI bu dosyada yaşar. AuthShell lazy yüklendiği
// için AuthProvider, guard'lar ve Firebase (auth + firestore) yalnızca bu ağaçtaki
// bir rota açılınca iner; public sayfalar (landing, KVKK, /c/:token...) Firebase yükü taşımaz.

// Login/Register statik: /login ve /register'da ikinci bir lazy-chunk beklenmez
// (AuthShell chunk'ıyla birlikte iner — mobil LCP için şelale kısaltması)
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'

const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'))
const PendingPage = lazy(() => import('@/pages/PendingPage'))

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
function AppGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth()

  if (loading) return <RouteSpinner />
  if (isAdmin) return <Navigate to="/yonetim" replace />
  if (profile?.status === 'pending' || profile?.status === 'rejected') return <Navigate to="/pending" replace />
  if (profile && !profile.merchantId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function AuthShell() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="pending" element={<PendingPage />} />

        {/* Onboarding (sadece merchant değil, henüz işletme kurmamış kullanıcılar) */}
        <Route
          path="onboarding"
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
          path="app"
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

        {/* Yönetim paneli — sadece admin */}
        <Route
          path="yonetim"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminPage />} />
        </Route>

        {/* Bilinmeyen path — ana sayfaya dön */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
