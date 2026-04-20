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

      const [topVisitedRes] = await Promise.allSettled([fetchTopVisitedPlaces(30, 10)])
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

  const topVisitedCities = useMemo(() => {
    const rows = topVisited ?? []
    const map = new Map<string, { city: string; visitedCount: number; places: number }>()
    for (const x of rows) {
      const city = (x.city ?? '').trim() || '—'
      const prev = map.get(city)
      if (!prev) map.set(city, { city, visitedCount: x.visitedCount, places: 1 })
      else {
        prev.visitedCount += x.visitedCount
        prev.places += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => b.visitedCount - a.visitedCount)
  }, [topVisited])

  const hasMonetization = Boolean(
    summary &&
      (summary.revenueTotalVnd != null ||
        summary.revenue30dVnd != null ||
        (summary.packagesByType?.length ?? 0) > 0),
  )

  const chartCard = 'rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'


  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">Bảng điều khiển</h1>

        {!summary && (
          <div className={`${chartCard} py-16 text-center text-stone-500`}>Đang tải dữ liệu…</div>
        )}

        {summary && (
          <>
            {/* Card: Doanh thu */}
            <div className={chartCard}>
              <h2 className="mb-1 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Doanh thu</h2>
              <p className="text-sm text-stone-600">Tổng hợp giao dịch (PayOS).</p>
              {!hasMonetization ? (
                <div className="mt-5 rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-5 text-sm text-stone-600">
                  Chưa có dữ liệu doanh thu.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-3">
                  <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-stone-50/80 to-white px-4 py-3 ring-1 ring-stone-100/80">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tổng doanh thu</p>
                    <p className="mt-1 font-['Cormorant_Garamond',serif] text-xl font-semibold text-stone-900">
                      {formatMoneyVnd(summary?.revenueTotalVnd ?? null)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-stone-50/80 to-white px-4 py-3 ring-1 ring-stone-100/80">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">30 ngày gần nhất</p>
                    <p className="mt-1 font-['Cormorant_Garamond',serif] text-xl font-semibold text-stone-900">
                      {formatMoneyVnd(summary?.revenue30dVnd ?? null)}
                    </p>
                    {summary?.completedTransactions != null ? (
                      <p className="mt-1 text-xs text-stone-600">
                        {formatVi(Number(summary.completedTransactions))} giao dịch hoàn thành
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Card: Gói mua theo loại (bar chart) */}
            {summary?.packagesByType?.length ? (
              <div className={chartCard}>
                <h2 className="mb-1 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Gói mua theo loại</h2>
                <div className="h-[300px] w-full min-w-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.packagesByType.slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))}
                      margin={{ top: 8, right: 8, left: 8, bottom: 64 }}
                    >
                      <CartesianGrid strokeDasharray="4 6" stroke="#e7e5e4" vertical={false} />
                      <XAxis
                        dataKey="type"
                        tick={{ fill: '#57534e', fontSize: 13 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={72}
                      />
                      <YAxis tick={{ fill: '#57534e', fontSize: 13 }} tickFormatter={(v) => formatVi(Number(v))} width={56} />
                      <Tooltip
                        formatter={formatChartTooltipValue}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e7e5e4',
                          fontSize: '14px',
                        }}
                      />
                      <Bar dataKey="count" radius={[10, 10, 0, 0]} maxBarSize={56}>
                        {summary.packagesByType.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}

            {/* Card: Người dùng theo vai trò */}
            <div className={chartCard}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Người dùng theo vai trò</h2>
              <div className="h-[300px] w-full min-h-[260px]">
                {roleChart.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-stone-500">Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={2}
                      >
                        {roleChart.map((_, i) => (
                          <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={formatChartTooltipValue}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e7e5e4',
                          fontSize: '14px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {roleChart.length > 0 && (
                <ul className="mt-2 flex flex-wrap justify-center gap-x-8 gap-y-3 border-t border-stone-100 pt-4 text-[15px] text-stone-700">
                  {roleChart.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                      <span className="font-medium">{d.name}</span>
                      <span className="text-stone-600">{formatVi(d.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Card: Trạng thái tài khoản */}
            <div className={chartCard}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Trạng thái tài khoản</h2>
              <div className="h-[300px] w-full min-h-[260px]">
                {activeChart.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-stone-500">Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={2}
                      >
                        {activeChart.map((_, i) => (
                          <Cell key={i} fill={ACTIVE_COLORS[i % ACTIVE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={formatChartTooltipValue}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e7e5e4',
                          fontSize: '14px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {activeChart.length > 0 && (
                <ul className="mt-2 flex flex-wrap justify-center gap-x-8 gap-y-3 border-t border-stone-100 pt-4 text-[15px] text-stone-700">
                  {activeChart.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: ACTIVE_COLORS[i % ACTIVE_COLORS.length] }} />
                      <span className="font-medium">{d.name}</span>
                      <span className="text-stone-600">{formatVi(d.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Card: Địa điểm được ghé nhiều (bar chart) */}
            <div className={chartCard}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Địa điểm được ghé nhiều</h2>
              <p className="text-sm text-stone-600">
                {topVisitedSampleCount > 0
                  ? `Trong ${formatVi(topVisitedRangeDays)} ngày · ${formatVi(topVisitedSampleCount)} hành trình.`
                  : 'Chưa có dữ liệu.'}
              </p>
              <div className="h-[300px] w-full min-h-[260px]">
                {!topVisitedChart.length ? (
                  <p className="flex h-full items-center justify-center text-stone-500">Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVisitedChart} margin={{ top: 8, right: 8, left: 8, bottom: 64 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#e7e5e4" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#57534e', fontSize: 13 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={72}
                      />
                      <YAxis tick={{ fill: '#57534e', fontSize: 13 }} tickFormatter={(v) => formatVi(Number(v))} width={56} />
                      <Tooltip
                        formatter={formatChartTooltipValue}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e7e5e4',
                          fontSize: '14px',
                        }}
                      />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={56}>
                        {topVisitedChart.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Card: Bảng địa điểm */}
            <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white mt-8">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Địa điểm</th>
                    <th className="px-4 py-3">Thành phố</th>
                    <th className="px-4 py-3 text-right">Lượt ghé</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {!topVisited?.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    topVisited.slice(0, 8).map((row) => (
                      <tr key={row.experienceId} className="hover:bg-stone-50/70">
                        <td className="max-w-[260px] truncate px-4 py-3 font-medium text-stone-900" title={row.name}>
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{row.city || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-stone-900">{formatVi(row.visitedCount)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/places/${row.experienceId}`}
                            className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200/80 hover:bg-stone-50"
                          >
                            Xem
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Card: Hoạt động hệ thống */}
            <div className={chartCard}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Hoạt động hệ thống</h2>
              <div className="h-[340px] w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={systemBar} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="4 6" stroke="#e7e5e4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#57534e', fontSize: 13 }}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis tick={{ fill: '#57534e', fontSize: 13 }} tickFormatter={(v) => formatVi(Number(v))} width={56} />
                    <Tooltip
                      formatter={formatChartTooltipValue}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e7e5e4',
                        fontSize: '14px',
                      }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={56}>
                      {systemBar.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
