import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
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
import { toast } from 'sonner'
import api from '../../api/axios'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import { getApiErrorMessage } from '../../utils/apiMessage'

interface StaffDashboardStats {
  waypointFeedbackPending: number
  journeyFeedbackPending: number
  experiencesActive: number
  experiencesTotal: number
  waypointFeedbackTotal: number
  journeyFeedbackTotal: number
  topVisitedPlaces: Array<{
    experienceId: string
    name: string
    city: string
    visitedCount: number
  }>
}

// ── Skeleton pulse block ─────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 ${className ?? ''}`} />
}

// ── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  loading?: boolean
  accent?: 'amber' | 'red' | 'emerald' | 'sky'
  badge?: number
  linkTo?: string
  linkLabel?: string
  icon: React.ReactNode
}

const ACCENT = {
  amber: {
    bg: 'bg-gradient-to-br from-amber-50 to-[#fdf6ec]',
    border: 'border-amber-200/70',
    icon: 'bg-amber-100 text-amber-700',
    value: 'text-amber-900',
    link: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-50 to-rose-50',
    border: 'border-red-200/70',
    icon: 'bg-red-100 text-red-600',
    value: 'text-red-700',
    link: 'border-red-300 text-red-700 hover:bg-red-50',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    border: 'border-emerald-200/70',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-800',
    link: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
  sky: {
    bg: 'bg-gradient-to-br from-sky-50 to-blue-50',
    border: 'border-sky-200/70',
    icon: 'bg-sky-100 text-sky-700',
    value: 'text-sky-800',
    link: 'border-sky-300 text-sky-700 hover:bg-sky-50',
  },
}

function StatCard({ label, value, sub, loading, accent = 'amber', badge, linkTo, linkLabel, icon }: StatCardProps) {
  const a = ACCENT[accent]
  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} p-5 shadow-sm flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>
          {icon}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 shadow-sm">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className={`text-3xl font-bold font-['Cormorant_Garamond',serif] leading-none ${a.value}`}>{value}</p>
        )}
        {sub && !loading && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
        {loading && sub && <Skeleton className="h-3 w-20 mt-2" />}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className={`mt-auto self-start rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${a.link}`}
        >
          {linkLabel ?? 'Xem →'}
        </Link>
      )}
    </div>
  )
}

// ── Custom tooltip for bar chart ─────────────────────────────────────────────
function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-stone-800 mb-0.5 max-w-[180px] truncate">{payload[0].payload.name}</p>
      <p className="text-[#9a7b4f] font-bold">{payload[0].value.toLocaleString('vi-VN')} lượt ghé</p>
    </div>
  )
}

// ── Custom tooltip for pie chart ─────────────────────────────────────────────
function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-stone-700">{payload[0].name}</p>
      <p className="text-stone-900 font-bold">{payload[0].value}</p>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StaffDashboardPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const [stats, setStats] = useState<StaffDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const { data } = await api.get<StaffDashboardStats>('/api/staff/dashboard')
      setStats(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được thống kê dashboard'))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // Prepare chart data
  const barData =
    stats?.topVisitedPlaces?.slice(0, 5).map((p) => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
      fullName: p.name,
      visits: p.visitedCount,
    })) ?? []

  const pieData = stats
    ? [
        { name: 'Active', value: stats.experiencesActive },
        { name: 'Inactive', value: Math.max(0, stats.experiencesTotal - stats.experiencesActive) },
      ]
    : []

  const PIE_COLORS = ['#c5a070', '#e5ddd0']

  const waypointPending = stats?.waypointFeedbackPending ?? 0
  const journeyPending = stats?.journeyFeedbackPending ?? 0

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/85 [backdrop-filter:saturate(180%)_blur(8px)] border-b border-stone-200/80">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="lg:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100 shrink-0"
            aria-label="Bật hoặc tắt menu bên"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-stone-900 font-['Cormorant_Garamond',serif] leading-tight">
              Bảng điều khiển
            </h1>
            <p className="text-xs text-stone-400">Tổng quan hoạt động hệ thống</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={statsLoading}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors shadow-sm"
            title="Làm mới"
          >
            <svg className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-[1400px] w-full mx-auto">

        {/* ── Row 1: Stat cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Địa điểm active"
            value={stats ? `${stats.experiencesActive} / ${stats.experiencesTotal}` : '—'}
            sub="Đang hoạt động / Tổng số"
            loading={statsLoading}
            accent="amber"
            linkTo="/staff/places"
            linkLabel="Quản lý địa điểm →"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Feedback điểm dừng chờ duyệt"
            value={stats?.waypointFeedbackPending ?? '—'}
            sub={`Tổng: ${stats?.waypointFeedbackTotal ?? '—'}`}
            loading={statsLoading}
            accent={waypointPending > 0 ? 'red' : 'sky'}
            badge={waypointPending}
            linkTo="/staff/feedback"
            linkLabel="Xem danh sách →"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatCard
            label="Feedback chuyến chờ duyệt"
            value={stats?.journeyFeedbackPending ?? '—'}
            sub={`Tổng: ${stats?.journeyFeedbackTotal ?? '—'}`}
            loading={statsLoading}
            accent={journeyPending > 0 ? 'red' : 'emerald'}
            badge={journeyPending}
            linkTo="/staff/feedback"
            linkLabel="Xem danh sách →"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
              </svg>
            }
          />
        </div>

        {/* ── Row 2: Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Bar chart — top 5 places */}
          <div className="lg:col-span-2 rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">
                  Top địa điểm được ghé nhiều nhất
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">30 ngày gần nhất</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 flex-1" />
                    </div>
                  ))}
                </div>
              ) : barData.length === 0 ? (
                <p className="text-center text-stone-400 text-sm py-10">Chưa có dữ liệu.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ece4" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#a8a29e' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString('vi-VN')}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: '#fdf6ec' }} />
                    <Bar dataKey="visits" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {barData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0 ? '#c5a070' :
                            i === 1 ? '#d4b48a' :
                            i === 2 ? '#e0c9a6' :
                            i === 3 ? '#e8d5b8' :
                                      '#f0e4cc'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Donut chart — active vs inactive */}
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">
                  Tỉ lệ địa điểm
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Active / Inactive</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
            </div>
            <div className="p-5 flex flex-col items-center">
              {statsLoading ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Skeleton className="w-32 h-32 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : !stats ? (
                <p className="text-stone-400 text-sm py-10">Chưa có dữ liệu.</p>
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-stone-900 font-['Cormorant_Garamond',serif] leading-none">
                        {stats.experiencesTotal}
                      </span>
                      <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide mt-0.5">Tổng</span>
                    </div>
                  </div>
                  <div className="flex gap-5 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#c5a070] shrink-0" />
                      <span className="text-xs text-stone-600">Active <strong className="text-stone-900">{stats.experiencesActive}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#e5ddd0] shrink-0" />
                      <span className="text-xs text-stone-600">Inactive <strong className="text-stone-900">{Math.max(0, stats.experiencesTotal - stats.experiencesActive)}</strong></span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Top places table ── */}
        <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <h2 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900">
              Chi tiết top địa điểm
            </h2>
            <Link
              to="/staff/places"
              className="text-xs font-semibold text-[#9a7b4f] hover:text-[#7d633c] transition-colors"
            >
              Xem tất cả →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#f5f0e8] to-[#faf7f2] text-left text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                  <th className="px-5 py-3.5 w-10">#</th>
                  <th className="px-5 py-3.5">Tên địa điểm</th>
                  <th className="px-5 py-3.5">Thành phố</th>
                  <th className="px-5 py-3.5 text-right">Lượt ghé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {statsLoading &&
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-5 py-3.5 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    </tr>
                  ))}
                {!statsLoading && !stats?.topVisitedPlaces?.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-stone-400 text-sm">Chưa có dữ liệu.</td>
                  </tr>
                )}
                {!statsLoading &&
                  stats?.topVisitedPlaces?.slice(0, 5).map((place, i) => (
                    <tr key={place.experienceId} className="hover:bg-[#faf8f4] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-stone-100 text-stone-600' :
                          i === 2 ? 'bg-orange-50 text-orange-600' :
                                    'bg-stone-50 text-stone-400'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-stone-900">{place.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-stone-500 text-xs">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {place.city}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#9a7b4f]">
                          {place.visitedCount.toLocaleString('vi-VN')}
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
