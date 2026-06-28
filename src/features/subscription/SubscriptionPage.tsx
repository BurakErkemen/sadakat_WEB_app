import { useEffect, useState } from 'react'
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { db } from '@/firebase/firestore'
import { useMerchant } from '@/hooks/useMerchant'
import { useAuth } from '@/features/auth/AuthContext'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import { PLAN_LIMITS, resolveLimit } from '@/lib/constants'
import { formatDate } from '@/lib/dates'
import type { Subscription } from '@/types'

const PLAN_META = [
  {
    id: 'mini', label: 'Mini', emoji: '🌱',
    defaultMonthly: 99, defaultYearly: 79,
    features: ['200 müşteri', '500 işlem/ay', '2 kampanya', 'E-posta destek'],
  },
  {
    id: 'standard', label: 'Standart', emoji: '🚀',
    defaultMonthly: 199, defaultYearly: 159, isPopular: true,
    features: ['1.000 müşteri', '3.000 işlem/ay', '5 kampanya', 'Öncelikli destek'],
  },
  {
    id: 'pro', label: 'Pro', emoji: '💎',
    defaultMonthly: 399, defaultYearly: 319,
    features: ['Sınırsız müşteri', 'Sınırsız işlem', 'Sınırsız kampanya', '7/24 destek'],
  },
]

type PlanConfig = { monthlyPrice?: number; yearlyPrice?: number; shopierMonthlyUrl?: string; shopierYearlyUrl?: string; features?: string[]; maxCustomers?: number; maxMonthlyTransactions?: number; maxCampaigns?: number }

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif', trialing: 'Deneme', past_due: 'Ödeme Gecikmiş', canceled: 'İptal Edildi',
}

export default function SubscriptionPage() {
  const { merchant } = useMerchant()
  const { user } = useAuth()
  const { limits } = useMerchantSub()
  const navigate = useNavigate()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [pricing, setPricing] = useState<Record<string, PlanConfig>>({})
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(true)
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [contactModal, setContactModal] = useState<{ planId: string; planLabel: string; price: number } | null>(null)
  const [sendingContact, setSendingContact] = useState(false)

  useEffect(() => {
    if (!merchant) return
    Promise.all([
      getDoc(doc(db, 'merchants', merchant.id, 'subscription', 'current')),
      getDoc(doc(db, 'config', 'pricing')),
    ]).then(([subSnap, pricingSnap]) => {
      if (subSnap.exists()) setSub(subSnap.data() as Subscription)
      if (pricingSnap.exists()) setPricing(pricingSnap.data() as Record<string, PlanConfig>)
    }).catch(console.error).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id])

  const currentPlanId = sub?.plan ?? 'trial'

  const subEndDate = sub?.currentPeriodEnd?.toDate() ?? null
  const isSubExpired = subEndDate ? subEndDate < new Date() : false
  const subDaysRemaining = subEndDate ? Math.ceil((subEndDate.getTime() - Date.now()) / 86_400_000) : null

  function getPrice(planId: string): number {
    const meta = PLAN_META.find((p) => p.id === planId)!
    const cfg = pricing[planId]
    const monthly = cfg?.monthlyPrice ?? meta.defaultMonthly
    if (billingCycle === 'monthly') return monthly
    // Firestore'da yearlyPrice yapılandırıldıysa kullan; yoksa planın doğal indirim oranını
    // aylık fiyata uygula (admin monthlyPrice'ı değiştiğinde yıllık da dinamik güncellenir)
    if (cfg?.yearlyPrice != null) return cfg.yearlyPrice
    const discountRate = 1 - meta.defaultYearly / meta.defaultMonthly
    return Math.round(monthly * (1 - discountRate))
  }

  // Tüm planların aylık→yıllık tasarruf oranlarının ortalaması (tam sayıya yuvarlanmış)
  const yearlyDiscountPct = Math.round(
    PLAN_META.reduce((sum, p) => {
      const cfg = pricing[p.id]
      const monthly = cfg?.monthlyPrice ?? p.defaultMonthly
      const yearly = cfg?.yearlyPrice ?? p.defaultYearly
      return sum + (1 - yearly / monthly) * 100
    }, 0) / PLAN_META.length
  )

  function buildContactMessage(planLabel: string, price: number): string {
    return `Merhaba Sadex Ekibi,

${merchant?.name ?? 'İşletmemiz'} olarak ${planLabel} planına geçmek istiyoruz.

Ödeme tercihi: ${billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}
Görüntülenen fiyat: ₺${price}/ay${billingCycle === 'yearly' ? ' (yıllık faturalama)' : ''}

Geçiş süreci ve faturalama hakkında bilgi almak istiyoruz. En kısa sürede geri dönmenizi rica ederiz.

Teşekkürler,
${merchant?.name ?? ''}`
  }

  // Shopier ödeme: onay kaydı oluşturulduktan sonra link açılır.
  async function handleSelectPlan(planId: string, planLabel: string, price: number, shopierUrl: string) {
    if (!merchant || !user) return
    setRequestingPlan(planId)
    try {
      await addDoc(collection(db, 'merchants', merchant.id, 'paymentConsents'), {
        userId: user.uid,
        merchantId: merchant.id,
        planId,
        planLabel,
        billingCycle,
        displayedPrice: price,
        shopierUrl,
        actionType: 'shopier',
        acceptedTermsVersion: 'Haziran 2026 / Madde 4A',
        acceptedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Onay kaydedilemedi:', err)
      toast.error('Onay kaydedilemedi. Lütfen tekrar deneyin.')
      setRequestingPlan(null)
      return
    }
    window.open(shopierUrl, '_blank', 'noopener,noreferrer')
    setRequestingPlan(null)
  }

  // İletişim talebi: onay kaydı + destek bileti oluşturulur.
  async function handleSendContact() {
    if (!contactModal || !merchant || !user) return
    const { planId, planLabel, price } = contactModal
    setSendingContact(true)
    try {
      await addDoc(collection(db, 'merchants', merchant.id, 'paymentConsents'), {
        userId: user.uid,
        merchantId: merchant.id,
        planId,
        planLabel,
        billingCycle,
        displayedPrice: price,
        shopierUrl: null,
        actionType: 'admin_contact',
        acceptedTermsVersion: 'Haziran 2026 / Madde 4A',
        acceptedAt: serverTimestamp(),
      })
      await addDoc(collection(db, 'supportTickets'), {
        merchantId: merchant.id,
        merchantName: merchant.name,
        subject: `Plan Yükseltme Talebi: ${planLabel}`,
        message: buildContactMessage(planLabel, price),
        status: 'open',
        adminReply: null,
        repliedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Talebiniz iletildi, en kısa sürede geri dönülecek.')
      setContactModal(null)
      setConsentChecked(false)
    } catch (err) {
      console.error(err)
      toast.error('Talep gönderilemedi. Tekrar deneyin.')
    } finally {
      setSendingContact(false)
    }
  }

  function getShopierUrl(planId: string): string | null {
    const cfg = pricing[planId]
    if (!cfg) return null
    const url = billingCycle === 'monthly' ? cfg.shopierMonthlyUrl : cfg.shopierYearlyUrl
    return url && url.trim().length > 0 ? url : null
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-lg w-32" />
      <div className="h-36 bg-gray-200 rounded-2xl" />
      <div className="h-8 bg-gray-200 rounded-lg w-40" />
      {[1,2,3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
          ← Geri
        </button>
        <h1 className="text-xl font-bold text-gray-900">Abonelik</h1>
      </div>

      {/* Abonelik durum uyarısı */}
      {sub && (
        sub.status === 'canceled' ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-xl shrink-0">❌</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">Abonelik İptal Edildi</p>
              <p className="text-xs text-red-600 mt-0.5">
                {subEndDate ? formatDate(sub.currentPeriodEnd) + ' tarihinde sona erdi.' : ''}{' '}
                Panel erişiminiz devam ediyor; yeniden abone olmak için aşağıdan plan seçin.
              </p>
            </div>
          </div>
        ) : sub.status === 'past_due' ? (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-orange-700 text-sm">Ödeme Gecikmiş</p>
              <p className="text-xs text-orange-600 mt-0.5">
                Ödemeniz alınamadı. Lütfen aşağıdan aboneliğinizi yenileyin veya destek oluşturun.
              </p>
            </div>
          </div>
        ) : isSubExpired ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-xl shrink-0">⏰</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">
                {sub.status === 'trialing' ? 'Deneme Süreniz Doldu' : 'Aboneliğiniz Sona Erdi'}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {subEndDate ? formatDate(sub.currentPeriodEnd) + ' tarihinde sona erdi.' : ''}{' '}
                Panel erişiminiz devam ediyor ancak sürdürmek için aşağıdan bir plan seçin.
              </p>
            </div>
          </div>
        ) : subDaysRemaining !== null && subDaysRemaining <= 7 ? (
          <div className={`rounded-2xl p-4 flex gap-3 items-start ${subDaysRemaining <= 2 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <span className="text-xl shrink-0">⏳</span>
            <div>
              <p className={`font-semibold text-sm ${subDaysRemaining <= 2 ? 'text-red-700' : 'text-amber-700'}`}>
                {sub.status === 'trialing' ? 'Deneme Süresi Bitiyor' : 'Abonelik Yenileme Yaklaşıyor'}
              </p>
              <p className={`text-xs mt-0.5 ${subDaysRemaining <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                <strong>{subDaysRemaining} gün</strong> kaldı ({subEndDate ? formatDate(sub.currentPeriodEnd) : ''}).{' '}
                {sub.status === 'trialing' ? 'Bir plan seçerek hizmetinizi sürdürün.' : 'Aboneliğinizin yenilenmesi için destek ekibiyle iletişime geçin.'}
              </p>
            </div>
          </div>
        ) : null
      )}

      {/* Mevcut plan özeti */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-violet-200 text-xs font-medium mb-0.5">Mevcut Plan</p>
            <p className="text-2xl font-extrabold">
              {currentPlanId === 'trial' ? 'Deneme' : PLAN_META.find(p => p.id === currentPlanId)?.label ?? currentPlanId}
            </p>
            {sub && (
              <p className="text-violet-200 text-xs mt-1">
                {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
              isSubExpired || sub?.status === 'canceled' || sub?.status === 'past_due'
                ? 'bg-red-400/30 text-red-100'
                : sub?.status === 'active' ? 'bg-green-400/20 text-green-200'
                : 'bg-white/20 text-white'
            }`}>
              {isSubExpired && sub?.status === 'trialing' ? 'Deneme Bitti'
                : isSubExpired ? 'Sona Erdi'
                : STATUS_LABELS[sub?.status ?? 'trialing']}
            </span>
            {sub && !isSubExpired && subDaysRemaining !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${subDaysRemaining <= 3 ? 'bg-red-400/30 text-red-100' : 'bg-white/10 text-violet-100'}`}>
                {subDaysRemaining > 0 ? `${subDaysRemaining} gün kaldı` : 'Bugün sona eriyor'}
              </span>
            )}
            {sub?.billingCycle && (
              <span className="text-xs bg-white/10 text-violet-100 px-2 py-0.5 rounded-full">
                {sub.billingCycle === 'yearly' ? 'Yıllık ödeme' : 'Aylık ödeme'}
              </span>
            )}
          </div>
        </div>

        {/* Limit grid */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Müşteri', value: limits.maxCustomers === Infinity ? '∞' : limits.maxCustomers },
            { label: 'İşlem/ay', value: limits.maxMonthlyTransactions === Infinity ? '∞' : limits.maxMonthlyTransactions },
            { label: 'Kampanya', value: limits.maxCampaigns === Infinity ? '∞' : limits.maxCampaigns },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-white">{item.value}</p>
              <p className="text-violet-200 text-xs mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan seçimi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Planlar</p>
          {/* Toggle */}
          <div className="inline-flex bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Aylık
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${billingCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Yıllık
              <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-bold">%{yearlyDiscountPct}</span>
            </button>
          </div>
        </div>

        {PLAN_META.map((p) => {
          const isCurrent = currentPlanId === p.id
          const price = getPrice(p.id)
          const shopierUrl = getShopierUrl(p.id)
          const planLimits = PLAN_LIMITS[p.id as keyof typeof PLAN_LIMITS]
          const pCfg = pricing[p.id]
          const resolvedMaxCust = pCfg?.maxCustomers != null ? resolveLimit(pCfg.maxCustomers, planLimits.maxCustomers) : planLimits.maxCustomers
          const resolvedMaxTx = pCfg?.maxMonthlyTransactions != null ? resolveLimit(pCfg.maxMonthlyTransactions, planLimits.maxMonthlyTransactions) : planLimits.maxMonthlyTransactions

          return p.isPopular ? (
            /* Popüler → gradient kart */
            <div key={p.id} className={`rounded-xl overflow-hidden ${isCurrent ? 'ring-2 ring-violet-400 ring-offset-2' : ''}`}>
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white">{p.label}</p>
                        <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">Popüler</span>
                        {isCurrent && <span className="text-xs bg-green-400/30 text-green-200 px-2 py-0.5 rounded-full">Mevcut</span>}
                      </div>
                      <p className="text-violet-200 text-xs mt-0.5">
                        {resolvedMaxCust === Infinity ? 'Sınırsız' : resolvedMaxCust} müşteri · {resolvedMaxTx === Infinity ? 'Sınırsız' : resolvedMaxTx} işlem/ay
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-white text-xl">₺{price}<span className="text-violet-200 font-normal text-xs">/ay</span></p>
                    {billingCycle === 'yearly' && <p className="text-xs text-violet-200">₺{price * 12}/yıl</p>}
                  </div>
                </div>

                <ul className="mt-3 grid grid-cols-2 gap-1">
                  {(pricing[p.id]?.features ?? p.features).map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-violet-100">
                      <span className="text-green-300">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {!isCurrent && (
                <div className="flex gap-2">
                  {shopierUrl && (
                    <button
                      onClick={() => void handleSelectPlan(p.id, p.label, price, shopierUrl)}
                      disabled={!consentChecked || requestingPlan !== null}
                      className="flex-1 text-center bg-violet-700 text-white py-3 text-sm font-bold hover:bg-violet-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {requestingPlan === p.id ? 'İşleniyor…' : 'Planı Seç →'}
                    </button>
                  )}
                  <button
                    onClick={() => setContactModal({ planId: p.id, planLabel: p.label, price })}
                    disabled={!consentChecked}
                    className="flex-1 text-center bg-white/20 text-white py-3 text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    İletişime Geç
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Normal kart */
            <div key={p.id} className={`rounded-xl border p-4 space-y-3 bg-white transition-all ${isCurrent ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 hover:border-violet-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{p.label}</p>
                      {isCurrent && <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full font-medium">Mevcut</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {resolvedMaxCust === Infinity ? 'Sınırsız' : resolvedMaxCust} müşteri · {resolvedMaxTx === Infinity ? 'Sınırsız' : resolvedMaxTx} işlem/ay
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">₺{price}<span className="text-gray-400 font-normal text-xs">/ay</span></p>
                  {billingCycle === 'yearly' && <p className="text-xs text-green-600">₺{price * 12}/yıl</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                {(pricing[p.id]?.features ?? p.features).map((f) => (
                  <p key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="text-violet-500">✓</span> {f}
                  </p>
                ))}
              </div>

              {!isCurrent && (
                <div className="flex gap-2">
                  {shopierUrl && (
                    <button
                      onClick={() => void handleSelectPlan(p.id, p.label, price, shopierUrl)}
                      disabled={!consentChecked || requestingPlan !== null}
                      className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {requestingPlan === p.id ? 'İşleniyor…' : 'Planı Seç →'}
                    </button>
                  )}
                  <button
                    onClick={() => setContactModal({ planId: p.id, planLabel: p.label, price })}
                    disabled={!consentChecked}
                    className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:border-violet-300 hover:text-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    İletişime Geç
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        Ödeme sonrası aboneliğiniz platform yöneticisi tarafından aktif edilir (genellikle 1 iş günü içinde).
        Sorularınız için: <a href="mailto:info@cyandanismanlik.com" className="underline font-medium">info@cyandanismanlik.com</a>
      </div>

      {/* Satın alma onayı — checkbox işaretlenmeden plan seçilemez */}
      <div className={`rounded-xl border p-4 text-xs space-y-3 transition-colors ${
        consentChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <div>
          <p className="font-semibold text-gray-800 mb-1.5">⚠️ Satın Alma Koşulları</p>
          <ul className="space-y-1 list-disc list-inside text-gray-600">
            <li>Abonelik dönemi başladıktan sonra <strong>iade yapılmaz</strong>.</li>
            <li>Yıllık paketlerde kalan aylara orantılı kısmi iade uygulanmaz.</li>
            <li>Plan değişikliği halinde kullanılmış dönem ücretleri mahsup edilmez.</li>
            <li>
              <Link to="/kullanim-kosullari" target="_blank" className="text-violet-600 hover:underline font-medium">
                Kullanım Koşulları
              </Link> Madde 4A'yı okudum; iade ve cayma politikasını anladım.
            </li>
          </ul>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-400 text-violet-600 focus:ring-violet-500 shrink-0"
          />
          <span className={`leading-relaxed font-medium ${consentChecked ? 'text-green-800' : 'text-gray-700'}`}>
            Okudum, yukarıdaki satın alma koşullarını kabul ediyorum.
            {consentChecked && <span className="ml-1 text-green-600">✓</span>}
          </span>
        </label>
        {!consentChecked && (
          <p className="text-gray-400 text-[11px]">Plan seçmek için önce koşulları onaylayın.</p>
        )}
      </div>

      {/* İletişime Geç — taslak modal */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Yükseltme Talebi</h2>
                <p className="text-xs text-gray-500 mt-0.5">{contactModal.planLabel} planı · {billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'} · ₺{contactModal.price}/ay</p>
              </div>
              <button onClick={() => setContactModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gönderilecek Mesaj</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {buildContactMessage(contactModal.planLabel, contactModal.price)}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => void handleSendContact()}
                disabled={sendingContact || !consentChecked}
                className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {sendingContact ? 'Gönderiliyor…' : 'Gönder'}
              </button>
              <button
                onClick={() => setContactModal(null)}
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
