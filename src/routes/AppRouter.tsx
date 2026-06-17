import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import ProtectedRoute, { AdminRoute } from './ProtectedRoute'
import AppLayout from '@/components/AppLayout'
import AdminLayout from '@/components/AdminLayout'

import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import OnboardingPage from '@/features/onboarding/OnboardingPage'
import DashboardPage from '@/features/merchants/DashboardPage'
import CampaignsPage from '@/features/campaigns/CampaignsPage'
import NewCampaignPage from '@/features/campaigns/NewCampaignPage'
import CustomersPage from '@/features/customers/CustomersPage'
import NewCustomerPage from '@/features/customers/NewCustomerPage'
import StampPage from '@/features/loyalty/StampPage'
import RedeemPage from '@/features/loyalty/RedeemPage'
import TransactionsPage from '@/features/transactions/TransactionsPage'
import QRPage from '@/features/loyalty/QRPage'
import SubscriptionPage from '@/features/subscription/SubscriptionPage'
import SettingsPage from '@/features/merchants/SettingsPage'
import AdminPage from '@/features/admin/AdminPage'
import PublicCardPage from '@/features/public-card/PublicCardPage'
import PublicMerchantPage from '@/features/public-merchant/PublicMerchantPage'
import CustomerDetailPage from '@/features/customers/CustomerDetailPage'
import SupportPage from '@/features/support/SupportPage'

// Onboarding: merchant'ı olanlar /app'e, adminler /yonetim'e gider
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth()
  if (loading) return null
  if (isAdmin) return <Navigate to="/yonetim" replace />
  if (profile?.merchantId) return <Navigate to="/app" replace />
  return <>{children}</>
}

// Merchant app: admin erişemez, merchant'sız kullanıcı onboarding'e gider
function AppGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth()
  if (loading) return null
  if (isAdmin) return <Navigate to="/yonetim" replace />
  if (profile && !profile.merchantId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — auth gerektirmez */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
