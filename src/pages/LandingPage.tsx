import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const PLAN_META = [
  {
    id: 'mini', label: 'Mini',
    defaultMonthly: 99, defaultYearly: 79, isPopular: false,
    features: ['200 müşteri', '500 işlem/ay', '2 kampanya', 'QR + telefon arama', 'E-posta destek'],
  },
  {
    id: 'standard', label: 'Standart',
    defaultMonthly: 199, defaultYearly: 159, isPopular: true,
    features: ['1.000 müşteri', '3.000 işlem/ay', '5 kampanya', 'QR + telefon arama', 'Öncelikli destek'],
  },
  {
    id: 'pro', label: 'Pro',
    defaultMonthly: 399, defaultYearly: 319, isPopular: false,
    features: ['Sınırsız müşteri', 'Sınırsız işlem', 'Sınırsız kampanya', 'QR + telefon arama', '7/24 destek'],
  },
]

type PlanConfig = { monthlyPrice?: number; yearlyPrice?: number; shopierMonthlyUrl?: string; shopierYearlyUrl?: string; label?: string; features?: string[] }
type RemoteConfig = Record<string, PlanConfig>

const FEATURES = [
  { icon: '📱', title: 'Uygulama gerektirmez', desc: 'Müşteri kartını tarayıcıdan görür. App Store indirme yok.', color: 'bg-blue-100' },
  { icon: '✅', title: 'Damga sistemi', desc: 'Her ziyarette bir damga. Belirli sayıya ulaşınca ödül kazanılır.', color: 'bg-green-100' },
  { icon: '🏆', title: 'Puan sistemi', desc: 'Harcamaya göre puan. 100 TL = 10 puan gibi özelleştirin.', color: 'bg-yellow-100' },
  { icon: '📷', title: 'QR kod okuma', desc: 'QR kodunu okutun, müşteri kartı anında ekrana gelsin.', color: 'bg-purple-100' },
  { icon: '👥', title: 'Müşteri yönetimi', desc: 'Müşteri geçmişi, işlem listesi, kart durumu tek ekranda.', color: 'bg-pink-100' },
  { icon: '📊', title: 'Anlık istatistik', desc: 'Toplam müşteri, aylık işlem, ödüle yaklaşan kartlar.', color: 'bg-orange-100' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>({})
  const [configLoading, setConfigLoading] = useState(true)

  useEffect(() => {
    // Firebase ilk boyamayı bloklamasın diye dinamik import edilir:
    // landing'in initial bundle'ı Firebase içermez (mobil LCP için kritik).
    let cancelled = false
    let unsub: (() => void) | undefined

    void (async () => {
      try {
        const [{ onAuthStateChanged }, { getDoc, doc }, { auth }, { db }] = await Promise.all([
          import('firebase/auth'),
          import('firebase/firestore'),
          import('@/firebase/auth'),
          import('@/firebase/firestore'),
        ])
        if (cancelled) return

        // Oturum açık kullanıcıyı panele yönlendir, çıkış yaptırma
        unsub = onAuthStateChanged(auth, (user) => {
          if (user) navigate('/app', { replace: true })
        })

        const snap = await getDoc(doc(db, 'config', 'pricing'))
        if (!cancelled && snap.exists()) setRemoteConfig(snap.data() as RemoteConfig)
      } catch {
        // Fiyat config'i inmezse varsayılan PLAN_META fiyatları gösterilir
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    })()

    return () => { cancelled = true; unsub?.() }
  }, [navigate])

  function getPrice(planId: string, cycle: 'monthly' | 'yearly'): number {
    const meta = PLAN_META.find((p) => p.id === planId)!
    const remote = remoteConfig[planId]
    if (cycle === 'monthly') return remote?.monthlyPrice ?? meta.defaultMonthly
    return remote?.yearlyPrice ?? meta.defaultYearly
  }

  const yearlyDiscountPct = configLoading
    ? 20
    : Math.round(
        PLAN_META.reduce((sum, p) => {
          const remote = remoteConfig[p.id]
          const monthly = remote?.monthlyPrice ?? p.defaultMonthly
          const yearly = remote?.yearlyPrice ?? p.defaultYearly
          return monthly > 0 ? sum + (1 - yearly / monthly) * 100 : sum
        }, 0) / PLAN_META.length,
      )

  function getShopierUrl(planId: string, cycle: 'monthly' | 'yearly'): string | null {
    const remote = remoteConfig[planId]
    if (!remote) return null
    const url = cycle === 'monthly' ? remote.shopierMonthlyUrl : remote.shopierYearlyUrl
    return url && url.trim().length > 0 ? url : null
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.png" alt="Puaniva" className="h-12 w-auto"
              style={{ objectFit: 'contain', maxWidth: '180px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="inline-flex items-center min-h-[44px] text-sm text-gray-500 hover:text-gray-900 transition-colors px-3">
              Giriş Yap
            </Link>
            <Link to="/register"
              className="inline-flex items-center min-h-[44px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm px-4 rounded-xl font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm shadow-violet-200">
              Başlayın
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Arka plan gradyanı */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-indigo-50 -z-10" />
        {/* Mobilde küçük blur alanı — paint maliyeti düşük kalsın */}
        <div className="absolute top-0 right-0 w-56 h-56 sm:w-96 sm:h-96 bg-gradient-to-bl from-violet-100/60 to-transparent rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-tr from-indigo-100/50 to-transparent rounded-full blur-3xl -z-10" />

        <div className="max-w-5xl mx-auto px-5 pt-24 pb-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-violet-200 shadow-sm shadow-violet-100">
            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
            Dijital Sadakat Programı
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Müşteriniz bir kez gelsin,<br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              defalarca geri dönsün
            </span>
          </h1>

          <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Kağıt kart yok, uygulama indirme yok. İşletmenize özel dijital sadakat sistemi
            kurun — müşterileriniz telefon numarasıyla anında kart sahibi olsun.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-9 py-4 rounded-2xl font-bold text-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-xl shadow-violet-200">
              Hemen Başlayın
            </Link>
            <Link to="/login"
              className="w-full sm:w-auto border border-gray-200 text-gray-700 px-9 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              Giriş Yap
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            {['Kurulum 5 dakika', 'Uygulama gerekmez', 'Damga ve puan sistemi', 'QR ve telefon desteği'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckIcon className="text-violet-500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nasıl Çalışır ──────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3 block">Nasıl Çalışır</span>
            <h2 className="text-3xl font-bold text-gray-900">3 adımda sadakat programı</h2>
            <p className="text-gray-500 mt-3">Hesap açın, kampanyanızı oluşturun, müşteri ekleyin.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', icon: '🏪', title: 'İşletmenizi kurun', desc: 'Birkaç dakikada işletme bilgilerinizi girin. Damga veya puan sistemi seçin.', color: 'from-violet-500 to-purple-600' },
              { step: '2', icon: '👥', title: 'Müşteri ekleyin', desc: 'Müşterinin telefon numarasını girin, dijital kartı otomatik oluşsun.', color: 'from-indigo-500 to-blue-600' },
              { step: '3', icon: '🎁', title: 'Ödülleri dağıtın', desc: 'Limit dolduğunda sistem uyarır. Tek tıkla ödülü kullandırın.', color: 'from-pink-500 to-rose-600' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-2xl mb-4 shadow-md`}>
                  {s.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>Adım {s.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Özellikler ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3 block">Özellikler</span>
            <h2 className="text-3xl font-bold text-gray-900">İşletmenize özel her şey</h2>
            <p className="text-gray-500 mt-3">Kafe'den kuaföre, oto yıkamadan restorana — her sektöre uygun.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl bg-white border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all group">
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                  <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fiyatlandırma ──────────────────────────────────────────────────── */}
      <section className="py-20" id="fiyatlar">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3 block">Fiyatlandırma</span>
            <h2 className="text-3xl font-bold text-gray-900">Şeffaf fiyatlandırma</h2>
            <p className="text-gray-500 mt-3">Gizli ücret yok. İstediğiniz zaman iptal.</p>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 min-h-[44px] rounded-lg text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Aylık
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 min-h-[44px] rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Yıllık
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">%{yearlyDiscountPct}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {configLoading ? (
              [1,2,3].map((i) => <div key={i} className="h-80 bg-gray-100 rounded-2xl animate-pulse" />)
            ) : (
              PLAN_META.map((plan) => {
                const price = getPrice(plan.id, billingCycle)
                const shopierUrl = getShopierUrl(plan.id, billingCycle)
                const label = remoteConfig[plan.id]?.label ?? plan.label
                const features = remoteConfig[plan.id]?.features ?? plan.features

                return plan.isPopular ? (
                  /* ── Popüler plan: gradient kart ── */
                  <div key={plan.id} className="relative rounded-2xl p-0.5 bg-gradient-to-b from-violet-500 to-indigo-600 shadow-2xl shadow-violet-200">
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-lg">
                      ⭐ En Popüler
                    </div>
                    <div className="bg-gradient-to-b from-violet-600 to-indigo-700 rounded-[14px] p-6 flex flex-col h-full">
                      <p className="font-bold text-white text-lg">{label}</p>
                      <div className="mt-3 mb-1">
                        <span className="text-4xl font-extrabold text-white">₺{price}</span>
                        <span className="text-violet-200 text-sm ml-1">/ay</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-violet-200 font-medium mb-4">Yıllık ödeme · ₺{price * 12}/yıl</p>
                      )}
                      {billingCycle === 'monthly' && <div className="mb-4" />}
                      <ul className="space-y-2.5 flex-1 mb-6">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-violet-100">
                            <CheckIcon className="text-white mt-0.5 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {shopierUrl ? (
                        <a href={shopierUrl} target="_blank" rel="noopener noreferrer"
                          className="text-center py-3 rounded-xl font-bold text-sm bg-white text-violet-700 hover:bg-violet-50 transition-colors shadow-md">
                          Satın Al
                        </a>
                      ) : (
                        <Link to="/register"
                          className="text-center py-3 rounded-xl font-bold text-sm bg-white text-violet-700 hover:bg-violet-50 transition-colors shadow-md">
                          Başlayın
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Normal plan ── */
                  <div key={plan.id} className="rounded-2xl border border-gray-200 p-6 flex flex-col bg-white hover:border-violet-200 hover:shadow-md transition-all">
                    <p className="font-bold text-gray-900 text-lg">{label}</p>
                    <div className="mt-3 mb-1">
                      <span className="text-4xl font-extrabold text-gray-900">₺{price}</span>
                      <span className="text-gray-400 text-sm ml-1">/ay</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-xs text-green-600 font-medium mb-4">Yıllık ödeme · ₺{price * 12}/yıl</p>
                    )}
                    {billingCycle === 'monthly' && <div className="mb-4" />}
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckIcon className="text-violet-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {shopierUrl ? (
                      <a href={shopierUrl} target="_blank" rel="noopener noreferrer"
                        className="text-center py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 border border-transparent transition-colors">
                        Satın Al
                      </a>
                    ) : (
                      <Link to="/register"
                        className="text-center py-3 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-violet-50 hover:text-violet-700 border border-transparent hover:border-violet-200 transition-colors">
                        Başlayın
                      </Link>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            Sorularınız için{' '}
            <a href="mailto:info@cyandanismanlik.com" className="text-violet-500 hover:underline">info@cyandanismanlik.com</a>
          </p>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Müşteri sadakatini bugün dijitale taşıyın
          </h2>
          <p className="text-violet-200 mt-4 text-lg">
            Hesabınızı açın, kampanyanızı oluşturun. İlk müşterinizi 5 dakikada ekleyin.
          </p>
          <Link to="/register"
            className="inline-block mt-8 bg-white text-violet-700 px-10 py-4 rounded-2xl font-bold text-lg hover:bg-violet-50 transition-colors shadow-2xl">
            Ücretsiz Başlayın
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-10 bg-white">
        <div className="max-w-5xl mx-auto px-5 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-10 w-auto"
                style={{ objectFit: 'contain', maxWidth: '150px' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-400">&copy; {new Date().getFullYear()}</span>
            </div>
            {/* 320px'te tek satıra sığmaz → mobilde dikey stack, sm+ yatay */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 text-sm text-gray-400 text-center">
              <a href="mailto:info@cyandanismanlik.com" className="inline-flex items-center min-h-[44px] max-w-full break-all hover:text-violet-600 transition-colors">
                info@cyandanismanlik.com
              </a>
              <span className="text-gray-200 hidden sm:inline">|</span>
              <span className="inline-flex items-center min-h-[44px] flex-wrap justify-center">
                Tasarım:{' '}
                <a href="https://cyandanismanlik.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] px-1 text-violet-500 hover:text-violet-700 transition-colors font-medium">
                  Cyan Danışmanlık
                </a>
              </span>
            </div>
          </div>
          {/* Yasal linkler */}
          <div className="border-t border-gray-100 pt-2 flex flex-wrap items-center justify-center gap-x-4 text-xs text-gray-400">
            <Link to="/kvkk" className="inline-flex items-center min-h-[44px] px-1 hover:text-violet-600 transition-colors">KVKK Aydınlatma Metni</Link>
            <span className="text-gray-200">·</span>
            <Link to="/kullanim-kosullari" className="inline-flex items-center min-h-[44px] px-1 hover:text-violet-600 transition-colors">Kullanım Koşulları</Link>
            <span className="text-gray-200">·</span>
            <Link to="/gizlilik" className="inline-flex items-center min-h-[44px] px-1 hover:text-violet-600 transition-colors">Gizlilik Politikası</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CheckIcon({ className = 'text-violet-500' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}
