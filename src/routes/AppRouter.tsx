import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Eager — Firebase gerektirmeyen kritik public sayfa (landing anında görünür).
// DİKKAT: Bu dosyaya AuthContext/ProtectedRoute/firebase importu EKLEME —
// public rotaların Firebase bundle'ı yüklememesi bu ayrıma dayanır (Lighthouse mobil LCP).
import LandingPage from '@/pages/LandingPage'

// Lazy public sayfalar
const KvkkPage = lazy(() => import('@/pages/KvkkPage'))
const TermsPage = lazy(() => import('@/pages/TermsPage'))
const GizlilikPage = lazy(() => import('@/pages/GizlilikPage'))
const PublicCardPage = lazy(() => import('@/features/public-card/PublicCardPage'))
const PublicMerchantPage = lazy(() => import('@/features/public-merchant/PublicMerchantPage'))

// Auth gerektiren TÜM rotalar (login/register dahil) lazy AuthShell chunk'ında yaşar
const AuthShell = lazy(() => import('./AuthShell'))

function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-violet-600" />
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteSpinner />}>
        <Routes>
          {/* Public — auth gerektirmez, Firebase bundle'ı yüklemez */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/kvkk" element={<KvkkPage />} />
          <Route path="/kullanim-kosullari" element={<TermsPage />} />
          <Route path="/gizlilik" element={<GizlilikPage />} />
          <Route path="/c/:cardToken" element={<PublicCardPage />} />
          <Route path="/m/:slug" element={<PublicMerchantPage />} />

          {/* Eski /admin linklerini yönlendir */}
          <Route path="/admin" element={<Navigate to="/yonetim" replace />} />

          {/* Geri kalan her şey (login, register, /app, /yonetim...) AuthShell'de;
              bilinmeyen path'lerin fallback'i de AuthShell içinde ana sayfaya döner */}
          <Route path="*" element={<AuthShell />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
