import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
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

export default function StaffDashboardPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const [stats, setStats] = useState<StaffDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/80 backdrop-blur border-b border-stone-200/80">
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
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#c5a070] flex items-center justify-center text-white text-xs font-bold shrink-0">J</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate font-['Cormorant_Garamond',serif]">Journey Sense</p>
              <p className="text-xs text-stone-500 truncate">Nhân viên — Bảng điều khiển</p>
            </div>
          </div>
        </div>
        <PortalUserMenu profilePath="/staff/profile" />
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* Hàng 1 — 3 stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Địa điểm active */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Địa điểm active</p>
            {statsLoading ? (
              <p className="text-2xl font-bold text-stone-300 animate-pulse">—</p>
            ) : (
              <p className="text-2xl font-bold text-stone-900 font-['Cormorant_Garamond',serif]">
                {stats ? `${stats.experiencesActive} / ${stats.experiencesTotal}` : '—'}
              </p>
            )}
            <p className="text-xs text-stone-400">Đang hoạt động / Tổng số</p>
            <Link
              to="/staff/places"
              className="mt-2 self-start rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Quản lý địa điểm →
            </Link>
          </div>

          {/* Feedback waypoint chờ duyệt */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Feedback điểm dừng chờ duyệt</p>
              {stats && stats.waypointFeedbackPending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {stats.waypointFeedbackPending}
                </span>
              )}
            </div>
            {statsLoading ? (
              <p className="text-2xl font-bold text-stone-300 animate-pulse">—</p>
            ) : (
              <p className={`text-2xl font-bold font-['Cormorant_Garamond',serif] ${stats && stats.waypointFeedbackPending > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                {stats?.waypointFeedbackPending ?? '—'}
              </p>
            )}
            <p className="text-xs text-stone-400">Tổng: {stats?.waypointFeedbackTotal ?? '—'}</p>
            <Link
              to="/staff/feedback"
              className="mt-2 self-start rounded-lg border border-[#c5a070] px-3 py-1.5 text-xs font-semibold text-[#9a7b4f] hover:bg-[#fdf6ec] transition-colors"
            >
              Xem danh sách →
            </Link>
          </div>

          {/* Feedback chuyến chờ duyệt */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Feedback chuyến chờ duyệt</p>
              {stats && stats.journeyFeedbackPending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {stats.journeyFeedbackPending}
                </span>
              )}
            </div>
            {statsLoading ? (
              <p className="text-2xl font-bold text-stone-300 animate-pulse">—</p>
            ) : (
              <p className={`text-2xl font-bold font-['Cormorant_Garamond',serif] ${stats && stats.journeyFeedbackPending > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                {stats?.journeyFeedbackPending ?? '—'}
              </p>
            )}
            <p className="text-xs text-stone-400">Tổng: {stats?.journeyFeedbackTotal ?? '—'}</p>
            <Link
              to="/staff/feedback"
              className="mt-2 self-start rounded-lg border border-[#c5a070] px-3 py-1.5 text-xs font-semibold text-[#9a7b4f] hover:bg-[#fdf6ec] transition-colors"
            >
              Xem danh sách →
            </Link>
          </div>
        </div>

        {/* Hàng 2 — Top địa điểm được ghé nhiều nhất */}
        <div className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-['Cormorant_Garamond',serif] text-base font-semibold text-stone-900">
              Top địa điểm được ghé nhiều nhất
              <span className="ml-2 text-xs font-normal text-stone-400">(30 ngày gần nhất)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-[#f5f0e8] text-left text-[11px] uppercase tracking-wide text-stone-600 font-semibold">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Tên địa điểm</th>
                  <th className="px-5 py-3">Thành phố</th>
                  <th className="px-5 py-3 text-right">Lượt ghé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {statsLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-stone-400 text-sm">Đang tải…</td>
                  </tr>
                )}
                {!statsLoading && !stats?.topVisitedPlaces?.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-stone-400 text-sm">Chưa có dữ liệu.</td>
                  </tr>
                )}
                {!statsLoading &&
                  stats?.topVisitedPlaces?.slice(0, 5).map((place, i) => (
                    <tr key={place.experienceId} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                      <td className="px-5 py-3 text-stone-400 font-semibold tabular-nums">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-stone-900">{place.name}</td>
                      <td className="px-5 py-3 text-stone-600">{place.city}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#9a7b4f] tabular-nums">
                        {place.visitedCount.toLocaleString('vi-VN')}
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
