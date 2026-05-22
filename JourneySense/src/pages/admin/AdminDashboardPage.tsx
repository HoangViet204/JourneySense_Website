import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../../api/axios'
import type {
  AdminAnalyticsSummaryResponse,
  TopVisitedPlacesResponse,
} from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'

const ROLE_COLORS = ['#c5a070', '#5c8f7a', '#7c6f9e']
const ACTIVE_COLORS = ['#2f9e6a', '#d4cfc4']
const BAR_COLORS = ['#c5a070', '#b08f5f', '#9a7b4f', '#7d6a54']

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 ${className ?? ''}`} />
}

interface MiniStatProps {
  label: string
  value: string | number
  sub?: string
  accent: 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
  icon: React.ReactNode
}
const MINI_ACCENT = {
  amber:   { wrap: 'from-amber-50 to-[#fdf6ec] border-amber-200/60',   icon: 'bg-amber-100 text-amber-700',   val: 'text-amber-900' },
  emerald: { wrap: 'from-emerald-50 to-teal-50 border-emerald-200/60', icon: 'bg-emerald-100 text-emerald-700', val: 'text-emerald-900' },
  violet:  { wrap: 'from-violet-50 to-purple-50 border-violet-200/60', icon: 'bg-violet-100 text-violet-700',  val: 'text-violet-900' },
  sky:     { wrap: 'from-sky-50 to-blue-50 border-sky-200/60',         icon: 'bg-sky-100 text-sky-700',        val: 'text-sky-900' },
  rose:    { wrap: 'from-rose-50 to-pink-50 border-rose-200/60',       icon: 'bg-rose-100 text-rose-600',      val: 'text-rose-800' },
}
function MiniStat({ label, value, sub, accent, icon }: MiniStatProps) {
  const a = MINI_ACCENT[accent]
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${a.wrap} p-4 flex items-center gap-3 shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 truncate">{label}</p>
        <p className={`text-xl font-bold font-['Cormorant_Garamond',serif] leading-tight ${a.val}`}>{value}</p>
        {sub && <p className="text-[11px] text-stone-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}

type TopVisitedPlaceRow = {
  experienceId: string
  name: string
  city: string
  visitedCount: number
}

function formatMoneyVnd(amount?: number | null) {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
  } catch {
    return `${amount}₫`
  }
}

function formatKm(km?: number | null) {
  if (km == null) return '—'
  const n = Number(km)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

async function fetchTopVisitedPlaces(days = 30, limit = 10): Promise<{ rows: TopVisitedPlaceRow[]; rangeDays: number; sampleJourneys: number }> {
  const { data } = await api.get<TopVisitedPlacesResponse>('/api/admin/analytics/top-visited-places', {
    params: { days, limit },
  })

  const items = Array.isArray(data.items) ? data.items : []
  const rows: TopVisitedPlaceRow[] = items
    .filter((x) => x && x.experienceId)
    .map((x) => ({
      experienceId: x.experienceId,
      name: (x.name ?? '').trim() || '—',
      city: (x.city ?? '').trim() || '',
      visitedCount: Math.max(0, Number(x.visitedCount ?? 0)),
    }))

  return {
    rows,
    rangeDays: Math.max(1, Number(data.rangeDays ?? days)),
    sampleJourneys: Math.max(0, Number(data.sampleJourneys ?? 0)),
  }
}

function formatVi(n: number) {
  return n.toLocaleString('vi-VN')
}

function formatChartTooltipValue(value: number | string | ReadonlyArray<number | string> | undefined) {
  if (value == null) return ''
  if (Array.isArray(value)) {
    const n = Number(value[0])
    return Number.isFinite(n) ? formatVi(n) : ''
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? formatVi(n) : ''
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminAnalyticsSummaryResponse | null>(null)
  const [topVisited, setTopVisited] = useState<TopVisitedPlaceRow[] | null>(null)
  const [topVisitedSampleCount, setTopVisitedSampleCount] = useState(0)
  const [topVisitedRangeDays, setTopVisitedRangeDays] = useState(30)

  const load = useCallback(async () => {
    try {
      const { data: sum } = await api.get<AdminAnalyticsSummaryResponse>('/api/admin/analytics/summary')
      setSummary(sum)

      const [topVisitedRes] = await Promise.allSettled([
        fetchTopVisitedPlaces(30, 10),
      ])
      if (topVisitedRes.status === 'fulfilled') {
        setTopVisited(topVisitedRes.value.rows)
        setTopVisitedSampleCount(topVisitedRes.value.sampleJourneys)
        setTopVisitedRangeDays(topVisitedRes.value.rangeDays)
      } else {
        setTopVisited(null)
        setTopVisitedSampleCount(0)
        setTopVisitedRangeDays(30)
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được dữ liệu thống kê'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const roleChart = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Du khách', value: summary.usersTraveler },
      { name: 'Nhân viên', value: summary.usersStaff },
      { name: 'Quản trị', value: summary.usersAdmin },
    ].filter((d) => d.value > 0)
  }, [summary])

  const activeChart = useMemo(() => {
    if (!summary) return []
    const inactive = Math.max(0, summary.usersTotal - summary.usersActive)
    const rows = [
      { name: 'Đang hoạt động', value: summary.usersActive },
      { name: 'Không hoạt động', value: inactive },
    ]
    return rows.filter((d) => d.value > 0)
  }, [summary])

  const systemBar = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Trải nghiệm đang mở', value: summary.experiencesActive },
      { name: 'Chuyến', value: summary.journeysTotal },
      { name: 'Phản hồi chờ duyệt', value: summary.feedbacksPendingModeration },
      { name: 'Tổng người dùng', value: summary.usersTotal },
    ]
  }, [summary])

  const topVisitedChart = useMemo(() => {
    if (!topVisited?.length) return []
    return topVisited.slice(0, 8).map((x) => ({ name: x.name, value: x.visitedCount }))
  }, [topVisited])

  const hasMonetization = Boolean(
    summary &&
      (summary.revenueTotalVnd != null ||
        summary.revenue30dVnd != null ||
        (summary.packagesByType?.length ?? 0) > 0),
  )

  const loading = !summary

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-bold text-stone-900">Bảng điều khiển</h1>
            <p className="text-xs text-stone-400 mt-0.5">Tổng quan hệ thống Journey Sense</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 shadow-sm transition-colors">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
        </div>

        {/* Row 1: mini stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {loading ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
            <>
              <MiniStat label="Tổng người dùng" value={formatVi(summary.usersTotal)} sub={`Active: ${formatVi(summary.usersActive)}`} accent="sky"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
              <MiniStat label="Địa điểm đang mở" value={formatVi(summary.experiencesActive)} accent="amber"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
              <MiniStat label="Tổng hành trình" value={formatVi(summary.journeysTotal)} accent="emerald"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" /></svg>} />
              <MiniStat label="Tổng km hành trình" value={`${formatKm(summary.totalJourneyKm)} km`} accent="violet"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" /></svg>} />
              <MiniStat label="Feedback chờ duyệt" value={formatVi(summary.feedbacksPendingModeration)} accent={summary.feedbacksPendingModeration > 0 ? 'rose' : 'violet'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} />
            </>
          )}
        </div>
        {/* Row 2: Revenue + System bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue */}
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-r from-amber-50/60 to-white">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Doanh thu</h2>
                <p className="text-[11px] text-stone-400">Tổng hợp giao dịch PayOS</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="p-5">
              {loading ? <div className="space-y-3"><Skeleton className="h-12 w-40" /><Skeleton className="h-10 w-32" /></div>
              : !hasMonetization ? (
                <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-5 text-sm text-stone-500 text-center">Chưa có dữ liệu doanh thu.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-[#fdf6ec] border border-amber-100 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Tổng doanh thu</p>
                      <p className="mt-1 font-['Cormorant_Garamond',serif] text-lg font-bold text-amber-900">{formatMoneyVnd(summary?.revenueTotalVnd)}</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">30 ngày gần nhất</p>
                      <p className="mt-1 font-['Cormorant_Garamond',serif] text-lg font-bold text-emerald-900">{formatMoneyVnd(summary?.revenue30dVnd)}</p>
                      {summary?.completedTransactions != null && <p className="text-[11px] text-stone-400 mt-0.5">{formatVi(Number(summary.completedTransactions))} giao dịch</p>}
                    </div>
                  </div>
                  {summary?.packagesByType?.length ? (
                    <div className="h-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.packagesByType.slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))} margin={{ top: 4, right: 4, left: -16, bottom: 24 }}>
                          <CartesianGrid strokeDasharray="3 4" stroke="#f0ece4" vertical={false} />
                          <XAxis dataKey="type" tick={{ fill: '#a8a29e', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={36} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#a8a29e', fontSize: 10 }} tickFormatter={(v) => formatVi(Number(v))} axisLine={false} tickLine={false} />
                          <Tooltip formatter={formatChartTooltipValue} contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                            {summary.packagesByType.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* System activity bar */}
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-r from-violet-50/60 to-white">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Hoạt động hệ thống</h2>
                <p className="text-[11px] text-stone-400">Tổng quan các chỉ số chính</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <div className="p-5">
              {loading ? <Skeleton className="h-[200px] w-full" /> : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={systemBar} margin={{ top: 4, right: 4, left: -16, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 4" stroke="#f0ece4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#a8a29e', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={44} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 10 }} tickFormatter={(v) => formatVi(Number(v))} axisLine={false} tickLine={false} />
                      <Tooltip formatter={formatChartTooltipValue} contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {systemBar.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Two pie charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-r from-sky-50/60 to-white">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Người dùng theo vai trò</h2>
                <p className="text-[11px] text-stone-400">Phân bổ tài khoản</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              </div>
            </div>
            <div className="p-4 flex flex-col items-center">
              {loading ? <Skeleton className="w-36 h-36 rounded-full my-4" />
              : roleChart.length === 0 ? <p className="text-stone-400 text-sm py-8">Chưa có dữ liệu</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={roleChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} strokeWidth={0}>
                        {roleChart.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={formatChartTooltipValue} contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-1">
                    {roleChart.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                        <span className="text-xs text-stone-600">{d.name} <strong className="text-stone-900">{formatVi(d.value)}</strong></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-r from-emerald-50/60 to-white">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Trạng thái tài khoản</h2>
                <p className="text-[11px] text-stone-400">Active / Không hoạt động</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="p-4 flex flex-col items-center">
              {loading ? <Skeleton className="w-36 h-36 rounded-full my-4" />
              : activeChart.length === 0 ? <p className="text-stone-400 text-sm py-8">Chưa có dữ liệu</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={activeChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} strokeWidth={0}>
                        {activeChart.map((_, i) => <Cell key={i} fill={ACTIVE_COLORS[i % ACTIVE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={formatChartTooltipValue} contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-1">
                    {activeChart.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ACTIVE_COLORS[i % ACTIVE_COLORS.length] }} />
                        <span className="text-xs text-stone-600">{d.name} <strong className="text-stone-900">{formatVi(d.value)}</strong></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Top visited bar + table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-gradient-to-r from-amber-50/60 to-white">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Địa điểm được ghé nhiều</h2>
                <p className="text-[11px] text-stone-400">
                  {topVisitedSampleCount > 0 ? `${formatVi(topVisitedRangeDays)} ngày · ${formatVi(topVisitedSampleCount)} hành trình` : '30 ngày gần nhất'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <div className="p-4">
              {loading ? <Skeleton className="h-[200px] w-full" />
              : !topVisitedChart.length ? <p className="text-stone-400 text-sm py-10 text-center">Chưa có dữ liệu</p>
              : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVisitedChart.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 4" stroke="#f0ece4" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatVi(Number(v))} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                      <Tooltip formatter={formatChartTooltipValue} contentStyle={{ borderRadius: '10px', border: '1px solid #e7e5e4', fontSize: '12px' }} cursor={{ fill: '#fdf6ec' }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {topVisitedChart.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#c5a070' : i === 1 ? '#d4b48a' : i === 2 ? '#e0c9a6' : '#ead9bc'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
              <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">Chi tiết top địa điểm</h2>
              <Link to="/admin/places" className="text-xs font-semibold text-[#9a7b4f] hover:text-[#7d633c] transition-colors">Xem tất cả →</Link>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-[#f5f0e8] to-[#faf7f2] text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                    <th className="px-4 py-2.5 text-left w-7">#</th>
                    <th className="px-4 py-2.5 text-left">Địa điểm</th>
                    <th className="px-4 py-2.5 text-left">Thành phố</th>
                    <th className="px-4 py-2.5 text-right">Lượt ghé</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading && [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td></tr>
                  ))}
                  {!loading && !topVisited?.length && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400 text-sm">Chưa có dữ liệu</td></tr>
                  )}
                  {!loading && topVisited?.slice(0, 8).map((row, i) => (
                    <tr key={row.experienceId} className="hover:bg-[#faf8f4] transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-stone-100 text-stone-600' : 'bg-stone-50 text-stone-400'}`}>{i + 1}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-stone-900 max-w-[160px] truncate" title={row.name}>{row.name}</td>
                      <td className="px-4 py-2.5 text-stone-500 text-xs">{row.city || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#9a7b4f]">{formatVi(row.visitedCount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link to={`/admin/places/${row.experienceId}`} className="inline-flex items-center justify-center rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors">Xem</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
