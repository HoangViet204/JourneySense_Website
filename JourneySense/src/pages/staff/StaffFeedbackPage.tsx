import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryPage } from '../../hooks/useQueryPage'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import StatCards from '../../components/StatCards'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { PortalPagedResult, StaffFeedbackListItemDto, StaffJourneyFeedbackListItemDto } from '../../types/portal'
import api from '../../api/axios'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'
import { moderationStatusBadgeClass, moderationStatusVi } from '../../utils/staffFeedbackLabels'
import { loadListUiState, patchListUiState } from '../../utils/listUiState'

const PAGE_SIZE = 10

export default function StaffFeedbackPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const location = useLocation()
  const listKey = location.pathname
  const scrollRef = useRef<HTMLElement | null>(null)
  const didRestoreScroll = useRef(false)
  const sawLoading = useRef(false)
  const didInit = useRef(false)

  const [modFilter, setModFilter] = useState('')

  const [tripPage, setTripPage] = useQueryPage(1, 'tripPage')
  const [tripItems, setTripItems] = useState<StaffJourneyFeedbackListItemDto[]>([])
  const [tripTotal, setTripTotal] = useState(0)

  const [wpPage, setWpPage] = useQueryPage(1, 'wpPage')
  const [wpItems, setWpItems] = useState<StaffFeedbackListItemDto[]>([])
  const [wpTotal, setWpTotal] = useState(0)

  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summary, setSummary] = useState<{ total: number; journeyTotal: number; waypointTotal: number; pending: number; approved: number; rejected: number } | null>(null)

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (loading) sawLoading.current = true
  }, [loading])

  useEffect(() => {
    const saved = loadListUiState<{
      modFilter?: string
      tripPage?: number
      wpPage?: number
      scrollTop?: number
    }>(listKey)

    if (typeof saved?.modFilter === 'string') setModFilter(saved.modFilter)
    if (typeof saved?.tripPage === 'number' && Number.isFinite(saved.tripPage) && saved.tripPage >= 1) setTripPage(saved.tripPage)
    if (typeof saved?.wpPage === 'number' && Number.isFinite(saved.wpPage) && saved.wpPage >= 1) setWpPage(saved.wpPage)
    setHydrated(true)
  }, [listKey])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mod = modFilter || undefined
      const [tripRes, wpRes] = await Promise.all([
        api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', {
          params: { page: tripPage, pageSize: PAGE_SIZE, moderationStatus: mod },
        }),
        api.get<PortalPagedResult<StaffFeedbackListItemDto>>('/api/staff/feedbacks', {
          params: { page: wpPage, pageSize: PAGE_SIZE, moderationStatus: mod },
        }),
      ])
      setTripItems(tripRes.data.items ?? [])
      setTripTotal(tripRes.data.totalCount ?? 0)
      setWpItems(wpRes.data.items ?? [])
      setWpTotal(wpRes.data.totalCount ?? 0)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [tripPage, wpPage, modFilter])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const [tripAll, wpAll, tripPending, wpPending, tripApproved, wpApproved, tripRejected, wpRejected] = await Promise.all([
        api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', { params: { page: 1, pageSize: 1 } }),
        api.get<PortalPagedResult<StaffFeedbackListItemDto>>('/api/staff/feedbacks', { params: { page: 1, pageSize: 1 } }),
        api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', {
          params: { page: 1, pageSize: 1, moderationStatus: 'pending' },
        }),
        api.get<PortalPagedResult<StaffFeedbackListItemDto>>('/api/staff/feedbacks', {
          params: { page: 1, pageSize: 1, moderationStatus: 'pending' },
        }),
        api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', {
          params: { page: 1, pageSize: 1, moderationStatus: 'approved' },
        }),
        api.get<PortalPagedResult<StaffFeedbackListItemDto>>('/api/staff/feedbacks', {
          params: { page: 1, pageSize: 1, moderationStatus: 'approved' },
        }),
        api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', {
          params: { page: 1, pageSize: 1, moderationStatus: 'rejected' },
        }),
        api.get<PortalPagedResult<StaffFeedbackListItemDto>>('/api/staff/feedbacks', {
          params: { page: 1, pageSize: 1, moderationStatus: 'rejected' },
        }),
      ])

      setSummary({
        total: (tripAll.data.totalCount ?? 0) + (wpAll.data.totalCount ?? 0),
        journeyTotal: tripAll.data.totalCount ?? 0,
        waypointTotal: wpAll.data.totalCount ?? 0,
        pending: (tripPending.data.totalCount ?? 0) + (wpPending.data.totalCount ?? 0),
        approved: (tripApproved.data.totalCount ?? 0) + (wpApproved.data.totalCount ?? 0),
        rejected: (tripRejected.data.totalCount ?? 0) + (wpRejected.data.totalCount ?? 0),
      })
    } catch {
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void load()
  }, [hydrated, load])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (!hydrated) return
    if (!didInit.current) return
    setTripPage(1)
    setWpPage(1)
  }, [hydrated, modFilter, setTripPage, setWpPage])

  useEffect(() => {
    if (!hydrated) return
    didInit.current = true
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    patchListUiState(listKey, { modFilter, tripPage, wpPage })
  }, [hydrated, listKey, modFilter, tripPage, wpPage])

  useEffect(() => {
    return () => {
      const el = scrollRef.current
      patchListUiState(listKey, { modFilter, tripPage, wpPage, scrollTop: el?.scrollTop ?? 0 })
    }
  }, [listKey, modFilter, tripPage, wpPage])

  useEffect(() => {
    if (!hydrated) return
    if (loading) return
    if (!sawLoading.current) return
    if (didRestoreScroll.current) return

    const saved = loadListUiState<{ scrollTop?: number }>(listKey)
    const el = scrollRef.current
    if (el && typeof saved?.scrollTop === 'number' && Number.isFinite(saved.scrollTop)) {
      el.scrollTo({ top: saved.scrollTop })
    }

    didRestoreScroll.current = true
  }, [hydrated, listKey, loading])

  const tripPages = Math.max(1, Math.ceil(tripTotal / PAGE_SIZE))
  const wpPages = Math.max(1, Math.ceil(wpTotal / PAGE_SIZE))

  const pagerBtn =
    'px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] font-['Lato',system-ui,sans-serif]">
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
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#c5a070] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm font-['Cormorant_Garamond',serif]">
              J
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-stone-800 truncate font-['Cormorant_Garamond',serif]">
                Đánh giá &amp; duyệt phản hồi
              </h1>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main
        ref={(n) => {
          scrollRef.current = n
        }}
        className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1400px] w-full mx-auto"
      >
        <section>
          <StatCards
            items={[
              { label: 'Tổng phản hồi', value: summaryLoading ? '…' : (summary?.total ?? 0).toLocaleString('vi-VN'), sub: 'Gộp cả 2 loại', tone: 'amber' },
              { label: 'Phản hồi cả chuyến', value: summaryLoading ? '…' : (summary?.journeyTotal ?? 0).toLocaleString('vi-VN'), tone: 'sky' },
              { label: 'Phản hồi điểm dừng', value: summaryLoading ? '…' : (summary?.waypointTotal ?? 0).toLocaleString('vi-VN'), tone: 'violet' },
              { label: 'Chờ duyệt', value: summaryLoading ? '…' : (summary?.pending ?? 0).toLocaleString('vi-VN'), tone: 'rose' },
              { label: 'Đã duyệt', value: summaryLoading ? '…' : (summary?.approved ?? 0).toLocaleString('vi-VN'), tone: 'emerald' },
              { label: 'Đã từ chối', value: summaryLoading ? '…' : (summary?.rejected ?? 0).toLocaleString('vi-VN'), tone: 'stone' },
            ]}
            className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          />
        </section>

        <div className="rounded-2xl bg-white/95 border border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="mod-filter" className="sr-only">
              Lọc theo trạng thái duyệt
            </label>
            <select
              id="mod-filter"
              value={modFilter}
              onChange={(e) => setModFilter(e.target.value)}
              className="w-full sm:w-auto min-w-[220px] text-sm rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/40 focus:border-[#c5a070]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>
        </div>

        <section className="space-y-4">
          <div className="border-b border-stone-200/80 pb-3">
            <h2 className="text-base font-semibold text-stone-900 font-['Cormorant_Garamond',serif]">Phản hồi cả chuyến</h2>
          </div>
          <div className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="min-w-0" />
                  <col className="w-[132px]" />
                  <col className="min-w-0" />
                  <col className="w-[220px]" />
                  <col className="w-[140px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#f5f0e8]/90 text-left text-[11px] uppercase tracking-wider text-stone-600 font-semibold border-b border-stone-100">
                    <th className="px-4 py-3.5">Mã chuyến</th>
                    <th className="px-4 py-3.5">Du khách</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5">Nội dung</th>
                    <th className="whitespace-nowrap px-4 py-3.5 pr-8">Cập nhật</th>
                    <th className="px-4 py-3.5 pl-8 text-center align-middle whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-stone-500 text-sm">
                        Đang tải dữ liệu…
                      </td>
                    </tr>
                  )}
                  {!loading && tripItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-stone-500 text-sm">
                        Không có phản hồi chuyến nào khớp bộ lọc.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    tripItems.map((row, i) => (
                      <tr
                        key={row.journeyId}
                        className={`transition-colors hover:bg-[#faf8f4] ${i % 2 === 1 ? 'bg-stone-50/40' : 'bg-white'}`}
                      >
                        <td className="px-4 py-3.5 font-mono text-xs text-stone-800 tabular-nums">
                          {row.journeyId.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3.5 text-stone-600 text-xs break-all max-w-[200px]">
                          {row.travelerEmail ?? row.travelerId}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={moderationStatusBadgeClass(row.moderationStatus)}>{moderationStatusVi(row.moderationStatus)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-stone-700 max-w-[280px]">
                          <p className="line-clamp-2 leading-relaxed" title={row.journeyFeedback}>
                            {row.journeyFeedback}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 pr-8 text-left text-xs tabular-nums text-stone-500">
                          {formatDate(row.updatedAt)}
                        </td>
                        <td className="px-4 py-3.5 pl-8 align-middle">
                          <div className="flex justify-center">
                            <Link
                              to={`/staff/feedback/journey/${row.journeyId}`}
                              state={{ tripRow: row }}
                              className="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl bg-[#c5a070] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f]"
                            >
                              Chi tiết
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {tripTotal > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5 border-t border-stone-100 bg-[#faf8f4]/80">
                <span className="text-sm text-stone-600">
                  Trang <strong className="text-stone-800">{tripPage}</strong> / {tripPages}
                  <span className="text-stone-400 mx-2">·</span>
                  {tripTotal} chuyến
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={tripPage <= 1} onClick={() => setTripPage((p) => p - 1)} className={pagerBtn}>
                    Trước
                  </button>
                  <button type="button" disabled={tripPage >= tripPages} onClick={() => setTripPage((p) => p + 1)} className={pagerBtn}>
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-stone-200/80 pb-3">
            <h2 className="text-base font-semibold text-stone-900 font-['Cormorant_Garamond',serif]">Phản hồi từng điểm dừng</h2>
          </div>
          <div className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] table-fixed text-sm">
                <colgroup>
                  <col className="min-w-0" />
                  <col className="min-w-0 w-[20%]" />
                  <col className="w-[132px]" />
                  <col className="min-w-0" />
                  <col className="w-[220px]" />
                  <col className="w-[140px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-stone-100 bg-[#f5f0e8]/90 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                    <th className="px-4 py-3.5">Trải nghiệm</th>
                    <th className="px-4 py-3.5">Du khách</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5">Nội dung</th>
                    <th className="whitespace-nowrap px-4 py-3.5 pr-8">Tạo lúc</th>
                    <th className="px-4 py-3.5 pl-8 text-center align-middle whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-stone-500 text-sm">
                        Đang tải dữ liệu…
                      </td>
                    </tr>
                  )}
                  {!loading && wpItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-stone-500 text-sm">
                        Không có phản hồi điểm dừng nào khớp bộ lọc.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    wpItems.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`transition-colors hover:bg-[#faf8f4] ${i % 2 === 1 ? 'bg-stone-50/40' : 'bg-white'}`}
                      >
                        <td className="px-4 py-3.5 font-medium text-stone-900">{row.experienceName ?? row.experienceId}</td>
                        <td className="px-4 py-3.5 text-stone-600 text-xs break-all max-w-[180px]">
                          {row.travelerEmail ?? row.travelerId}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={moderationStatusBadgeClass(row.moderationStatus)}>{moderationStatusVi(row.moderationStatus)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-stone-600 max-w-[240px] truncate" title={row.feedbackText}>
                          {row.feedbackText}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 pr-8 text-left text-xs tabular-nums text-stone-500">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 pl-8 align-middle">
                          <div className="flex justify-center">
                            <Link
                              to={`/staff/feedback/${row.id}`}
                              className="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl bg-[#c5a070] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f]"
                            >
                              Chi tiết
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {wpTotal > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5 border-t border-stone-100 bg-[#faf8f4]/80">
                <span className="text-sm text-stone-600">
                  Trang <strong className="text-stone-800">{wpPage}</strong> / {wpPages}
                  <span className="text-stone-400 mx-2">·</span>
                  {wpTotal} mục
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={wpPage <= 1} onClick={() => setWpPage((p) => p - 1)} className={pagerBtn}>
                    Trước
                  </button>
                  <button type="button" disabled={wpPage >= wpPages} onClick={() => setWpPage((p) => p + 1)} className={pagerBtn}>
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
