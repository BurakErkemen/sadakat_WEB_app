import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '@/firebase/firestore'
import { useMerchantSub } from '@/contexts/MerchantSubContext'
import type { Campaign, Customer, Membership, Transaction } from '@/types'
import {
  buildAnalyticsSnapshot,
  percentChange,
  type AnalyticsPeriodWeeks,
  type AnalyticsSnapshot,
  type CampaignType,
  type ProgramSummary,
  type WeekData,
} from './analyticsModel'

const PERIOD_OPTIONS: { value: AnalyticsPeriodWeeks; label: string }[] = [
  { value: 4, label: '4 hafta' },
  { value: 12, label: '12 hafta' },
  { value: 26, label: '6 ay' },
]

function ProLock() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Analiz</h1>
      <div className="border border-violet-200 bg-violet-50 rounded-xl p-8 text-center">
        <p className="font-bold text-gray-900 text-lg mb-2">Pro plan analizi</p>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          Müşteri tekrarı, kampanya verimi, ödül yükü ve dönem karşılaştırmaları Pro planda kullanılabilir.
        </p>
        <Link to="/app/subscription" className="inline-flex items-center bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm">
          Pro planı incele
        </Link>
      </div>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Analiz verileri yükleniyor">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="h-64 bg-gray-200 rounded-xl" />
      <div className="h-72 bg-gray-200 rounded-xl" />
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
  }).format(value)
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous)
  if (change === null) return <span className="text-xs font-medium text-blue-700">Yeni</span>
  if (change === 0) return <span className="text-xs text-gray-500">Değişmedi</span>
  return (
    <span className={`text-xs font-medium ${change > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
      {change > 0 ? '+' : ''}%{change}
    </span>
  )
}

function KpiCard(props: { label: string; value: string; helper: string; current: number; previous: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">{props.label}</p>
        <ChangeBadge current={props.current} previous={props.previous} />
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2 truncate">{props.value}</p>
      <p className="text-xs text-gray-500 mt-1">{props.helper}</p>
    </div>
  )
}

function ProgramSection(props: {
  type: CampaignType
  current: ProgramSummary
  previous: ProgramSummary
}) {
  const isPoints = props.type === 'points'
  const unit = isPoints ? 'puan' : 'damga'
  const title = isPoints ? 'Puan programları' : 'Damga programları'
  const accent = isPoints ? 'border-blue-500' : 'border-emerald-500'

  return (
    <section className={`border-t-4 ${accent} bg-white`} aria-labelledby={`${props.type}-summary-title`}>
      <div className="flex flex-wrap items-end justify-between gap-2 py-4">
        <div>
          <h2 id={`${props.type}-summary-title`} className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {props.current.activeCampaigns} aktif kampanya · {props.current.activeMembers} aktif üye
          </p>
        </div>
        <p className="text-xs text-gray-400">Önceki eş dönemle karşılaştırma</p>
      </div>
      <div className={`grid grid-cols-2 ${isPoints ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
        <KpiCard label={`${unit[0].toUpperCase()}${unit.slice(1)} işlemi`} value={formatNumber(props.current.transactionEvents)} helper={`${props.current.activeCustomers} aktif müşteri`} current={props.current.transactionEvents} previous={props.previous.transactionEvents} />
        <KpiCard label={`Kazanılan ${unit}`} value={formatNumber(props.current.earnedUnits)} helper="İşlem adedinden ayrı ölçülür" current={props.current.earnedUnits} previous={props.previous.earnedUnits} />
        <KpiCard label="Ödül kullanımı" value={formatNumber(props.current.redemptions)} helper={`${props.current.rewardReady} müşteri ödüle hazır`} current={props.current.redemptions} previous={props.previous.redemptions} />
        {isPoints && (
          <KpiCard label="Puan işlemi cirosu" value={formatCurrency(props.current.purchaseRevenue)} helper={`Ortalama sepet ${formatCurrency(props.current.averagePurchase)}`} current={props.current.purchaseRevenue} previous={props.previous.purchaseRevenue} />
        )}
      </div>
    </section>
  )
}

function WeeklyChart(props: { type: CampaignType; weeks: WeekData[] }) {
  const isPoints = props.type === 'points'
  const eventKey = isPoints ? 'pointEvents' : 'stampEvents'
  const redemptionKey = isPoints ? 'pointRedemptions' : 'stampRedemptions'
  const title = isPoints ? 'Puan işlemleri' : 'Damga işlemleri'
  const activityColor = isPoints ? 'bg-blue-500' : 'bg-emerald-500'
  const max = Math.max(1, ...props.weeks.map((week) => Math.max(week[eventKey], week[redemptionKey])))
  const empty = props.weeks.every((week) => week[eventKey] === 0 && week[redemptionKey] === 0)

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className={`w-2 h-2 ${activityColor}`} /> İşlem</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-violet-500" /> Ödül</span>
        </div>
      </div>
      {empty ? (
        <p className="h-44 flex items-center justify-center text-sm text-gray-400 border-b border-gray-200">Bu program türünde aktivite yok.</p>
      ) : (
        <div className="flex items-end gap-1 h-44 border-b border-gray-200" role="img" aria-label={`${title} haftalık grafiği`}>
          {props.weeks.map((week) => (
            <div key={week.key} className="flex-1 min-w-0 h-full flex flex-col justify-end">
              <div className="flex items-end justify-center gap-px h-32">
                <div title={`${week[eventKey]} işlem`} className={`w-2/5 max-w-4 ${activityColor} rounded-t-sm`} style={{ height: `${Math.max(week[eventKey] > 0 ? 3 : 0, (week[eventKey] / max) * 100)}%` }} />
                <div title={`${week[redemptionKey]} ödül`} className="w-2/5 max-w-4 bg-violet-500 rounded-t-sm" style={{ height: `${Math.max(week[redemptionKey] > 0 ? 3 : 0, (week[redemptionKey] / max) * 100)}%` }} />
              </div>
              <p className="text-[9px] text-gray-400 text-center mt-2 truncate">{week.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function escapeCsv(value: string | number): string {
  const text = String(value)
  return /[";,\n]/.test(text) ? `"${text.split('"').join('""')}"` : text
}

export default function AnalyticsPage() {
  const { merchant, features, loading: ctxLoading } = useMerchantSub()
  const merchantId = merchant?.id ?? null
  const [period, setPeriod] = useState<AnalyticsPeriodWeeks>(12)
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadAnalytics = useCallback(async (id: string, weeks: AnalyticsPeriodWeeks) => {
    const now = new Date()
    const previousCutoff = new Date(now.getTime() - weeks * 14 * 86_400_000)
    const [txSnap, customerSnap, campaignSnap, membershipSnap] = await Promise.all([
      getDocs(query(collection(db, 'merchants', id, 'transactions'), where('createdAt', '>=', Timestamp.fromDate(previousCutoff)))),
      getDocs(query(collection(db, 'merchants', id, 'customers'), where('createdAt', '>=', Timestamp.fromDate(previousCutoff)))),
      getDocs(collection(db, 'merchants', id, 'campaigns')),
      getDocs(collection(db, 'merchants', id, 'memberships')),
    ])

    return buildAnalyticsSnapshot({
      now,
      periodWeeks: weeks,
      transactions: txSnap.docs.map((item) => {
        const tx = { id: item.id, ...item.data() } as Transaction
        return { ...tx, purchaseAmount: tx.purchaseAmount ?? null, createdAt: tx.createdAt.toDate() }
      }),
      customers: customerSnap.docs.map((item) => {
        const customer = { id: item.id, ...item.data() } as Customer
        return { id: customer.id, createdAt: customer.createdAt.toDate() }
      }),
      campaigns: campaignSnap.docs.map((item) => {
        const campaign = { id: item.id, ...item.data() } as Campaign
        return { id: campaign.id, name: campaign.name, type: campaign.type, requiredStamps: campaign.requiredStamps, status: campaign.status }
      }),
      memberships: membershipSnap.docs.map((item) => {
        const membership = { id: item.id, ...item.data() } as Membership
        return { campaignId: membership.campaignId, customerId: membership.customerId, currentStamps: membership.currentStamps, status: membership.status }
      }),
    })
  }, [])

  useEffect(() => {
    if (ctxLoading || !merchantId || !features.advancedAnalytics) return
    let cancelled = false
    setDataLoading(true)
    setError(null)
    void loadAnalytics(merchantId, period)
      .then((result) => { if (!cancelled) setSnapshot(result) })
      .catch((loadError) => {
        console.error(loadError)
        if (!cancelled) setError('Analiz verileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
      })
      .finally(() => { if (!cancelled) setDataLoading(false) })
    return () => { cancelled = true }
  }, [ctxLoading, features.advancedAnalytics, loadAnalytics, merchantId, period, reloadKey])

  const insights = useMemo(() => {
    if (!snapshot) return []
    const messages: string[] = []
    const bestByType = (type: CampaignType) => snapshot.campaigns
      .filter((campaign) => campaign.type === type && campaign.status === 'active')
      .sort((a, b) => b.activeCustomers - a.activeCustomers)[0]
    const stampLeader = bestByType('stamp')
    const pointLeader = bestByType('points')

    if (stampLeader?.activeCustomers) messages.push(`${stampLeader.name}, ${stampLeader.activeCustomers} aktif müşteriyle en güçlü damga kampanyası.`)
    if (pointLeader?.activeCustomers) messages.push(`${pointLeader.name}, ${pointLeader.activeCustomers} aktif müşteriyle en güçlü puan kampanyası.`)
    if (snapshot.current.activeCustomers > 0 && snapshot.current.repeatRate < 25) messages.push(`Tekrar ziyaret oranı %${snapshot.current.repeatRate}; geri kazanım çalışması için alan var.`)
    if (snapshot.current.activeCustomers === 0) messages.push('Seçili dönemde sadakat işlemi yok; aktif kampanyaları ve ekip kullanımını kontrol edin.')
    return messages.slice(0, 3)
  }, [snapshot])

  function exportCsv() {
    if (!snapshot || !merchant) return
    const rows = [
      ['Kampanya', 'Program türü', 'Durum', 'Aktif üye', 'Aktif müşteri', 'Etkileşim %', 'Ödül bekleyen', 'Ortalama ilerleme %', 'Kazanılan birim', 'İşlem adedi', 'Ödül kullanımı', 'Puan işlemi cirosu'],
      ...snapshot.campaigns.map((campaign) => [
        campaign.name, campaign.type === 'points' ? 'Puan' : 'Damga', campaign.status === 'active' ? 'Aktif' : 'Pasif',
        campaign.activeMembers, campaign.activeCustomers, campaign.engagementRate, campaign.rewardReady,
        campaign.averageProgress, campaign.earnedUnits, campaign.transactionEvents, campaign.redemptions,
        campaign.type === 'points' ? campaign.purchaseRevenue : '',
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(';')).join('\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${merchant.slug || 'puaniva'}-analiz-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (ctxLoading) return <SkeletonLoader />
  if (!features.advancedAnalytics) return <ProLock />

  const current = snapshot?.current
  const previous = snapshot?.previous

  return (
    <div className="space-y-7">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analiz</h1>
          <p className="text-sm text-gray-500 mt-1">Müşteri davranışı ile damga ve puan performansı ayrı izlenir</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden" aria-label="Analiz dönemi">
            {PERIOD_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={`px-3 py-2 text-xs font-medium transition-colors ${period === option.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">Yenile</button>
          <button type="button" onClick={exportCsv} disabled={!snapshot} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">CSV indir</button>
        </div>
      </div>

      {error && <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-semibold underline">Tekrar dene</button></div>}

      {dataLoading && !snapshot ? <SkeletonLoader /> : snapshot && current && previous ? (
        <>
          <section aria-labelledby="customer-summary-title">
            <div className="flex items-center justify-between mb-3">
              <h2 id="customer-summary-title" className="text-sm font-semibold text-gray-900">Müşteri özeti</h2>
              <p className="text-xs text-gray-400">Tüm programlardaki tekil müşteriler</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard label="Aktif müşteri" value={formatNumber(current.activeCustomers)} helper="Tekil sadakat müşterisi" current={current.activeCustomers} previous={previous.activeCustomers} />
              <KpiCard label="Yeni müşteri" value={formatNumber(current.newCustomers)} helper="Seçili dönemde kaydolan" current={current.newCustomers} previous={previous.newCustomers} />
              <KpiCard label="Tekrar eden müşteri" value={formatNumber(current.repeatCustomers)} helper={`Tekrar oranı %${current.repeatRate}`} current={current.repeatCustomers} previous={previous.repeatCustomers} />
              <KpiCard label="Toplam ödül kullanımı" value={formatNumber(current.redemptions)} helper="Damga ve puan ödülleri" current={current.redemptions} previous={previous.redemptions} />
            </div>
          </section>

          <ProgramSection type="stamp" current={snapshot.programs.stamp.current} previous={snapshot.programs.stamp.previous} />
          <ProgramSection type="points" current={snapshot.programs.points.current} previous={snapshot.programs.points.previous} />

          {insights.length > 0 && (
            <section className="border-l-4 border-violet-500 bg-violet-50 px-4 py-3" aria-labelledby="insight-title">
              <h2 id="insight-title" className="text-sm font-semibold text-violet-950">Dikkat gerektiren noktalar</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-violet-900">{insights.map((insight) => <li key={insight}>• {insight}</li>)}</ul>
            </section>
          )}

          <section aria-labelledby="trend-title" className="border-t border-gray-200 pt-5">
            <div className="mb-5">
              <h2 id="trend-title" className="text-sm font-semibold text-gray-900">Haftalık aktivite</h2>
              <p className="text-xs text-gray-500 mt-1">İşlem adetleri karşılaştırılır; puan ve damga miktarları birbirine karıştırılmaz</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8"><WeeklyChart type="stamp" weeks={snapshot.weeks} /><WeeklyChart type="points" weeks={snapshot.weeks} /></div>
          </section>

          <section aria-labelledby="campaign-title" className="border-t border-gray-200 pt-5">
            <div className="mb-4">
              <h2 id="campaign-title" className="text-sm font-semibold text-gray-900">Kampanya performansı</h2>
              <p className="text-xs text-gray-500 mt-1">Her kampanya kendi program türünün birimiyle değerlendirilir</p>
            </div>
            {snapshot.campaigns.length === 0 ? <p className="text-gray-400 text-sm py-10 text-center">Henüz kampanya yok.</p> : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500"><tr>
                    <th className="text-left font-medium px-4 py-3">Kampanya</th><th className="text-right font-medium px-3 py-3">Aktif üye</th><th className="text-right font-medium px-3 py-3">Etkileşim</th><th className="text-right font-medium px-3 py-3">Kazanım</th><th className="text-right font-medium px-3 py-3">İlerleme</th><th className="text-right font-medium px-3 py-3">Ödüle hazır</th><th className="text-right font-medium px-4 py-3">Ödül kullanımı</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">{snapshot.campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${campaign.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} /><div><p className="font-medium text-gray-900">{campaign.name}</p><p className="text-xs text-gray-400">{campaign.type === 'points' ? 'Puan programı' : 'Damga programı'}</p></div></div></td>
                      <td className="text-right px-3 py-3 text-gray-700">{campaign.activeMembers}</td>
                      <td className="text-right px-3 py-3"><span className="font-medium text-gray-900">%{campaign.engagementRate}</span><span className="block text-xs text-gray-400">{campaign.activeCustomers} müşteri</span></td>
                      <td className="text-right px-3 py-3"><span className="font-medium text-gray-900">{formatNumber(campaign.earnedUnits)} {campaign.type === 'points' ? 'puan' : 'damga'}</span><span className="block text-xs text-gray-400">{campaign.transactionEvents} işlem</span></td>
                      <td className="text-right px-3 py-3 font-medium text-gray-900">%{campaign.averageProgress}</td>
                      <td className={`text-right px-3 py-3 ${campaign.rewardReady > 0 ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>{campaign.rewardReady}</td>
                      <td className="text-right px-4 py-3 text-gray-700">{campaign.redemptions}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
