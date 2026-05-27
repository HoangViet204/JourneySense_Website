import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import { listStaffJourneys } from '../../api/staffJourneys'
import StatCards from '../../components/StatCards'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { PortalPagedResult, StaffJourneyListItemDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayJourneyStatus, formatDate } from '../../utils/format'
import { loadListUiState, patchListUiState } from '../../utils/listUiState'

const PAGE_SIZE = 10

type JourneyStatusFilter = '' | 'Planning' | 'InProgress' | 'Completed' | 'Cancelled'

const STATUS_OPTIONS: Array<{ value: JourneyStatusFilter; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Planning', label: 'Lên kế hoạch' },
  { value: 'InProgress', label: 'Đang diễn ra' },
  { value: 'Completed', label: 'Hoàn thành' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

function statusPillClass(status?: string | null): string {
  const s = status?.trim()?.toLowerCase() ?? ''
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (s === 'inprogress' || s === 'in_progress') return 'bg-amber-50 text-amber-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-rose-50 text-rose-700'
  if (s === 'planning') return 'bg-stone-100 text-stone-800'
  return 'bg-stone-100 text-stone-800'
}

function isInProgressStatus(status?: string | null): boolean {
  const s = status?.trim()?.toLowerCase() ?? ''
  return s === 'inprogress' || s === 'in_progress'
}

export default function StaffJourneysPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const location = useLocation()
  const listKey = location.pathname

  const scrollRef = useRef<HTMLElement | null>(null)
  const didRestoreScroll = useRef(false)
  const sawLoading = useRef(false)
  const didInit = useRef(false)

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<JourneyStatusFilter>('')
  const [data, setData] = useState<PortalPagedResult<StaffJourneyListItemDto> | null>(null)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [summary, setSummary] = useState<{ total: number; planning: number; inProgress: number; completed: number; cancelled: number } | null>(null)

  useEffect(() => {
    if (loading) sawLoading.current = true
  }, [loading])

  useEffect(() => {
    const saved = loadListUiState<{ page?: number; status?: JourneyStatusFilter; scrollTop?: number }>(listKey)
    if (typeof saved?.status === 'string') setStatus(saved.status)
    if (typeof saved?.page === 'number' && Number.isFinite(saved.page) && saved.page >= 1) setPage(saved.page)
    setHydrated(true)
  }, [listKey])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listStaffJourneys({ page, pageSize: PAGE_SIZE, status: status || undefined })
      setData(res)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  const loadSummary = useCallback(async () => {
    try {
      const [allRes, planningRes, inProgressRes, completedRes, cancelledRes] = await Promise.all([
        listStaffJourneys({ page: 1, pageSize: 1 }),
        listStaffJourneys({ page: 1, pageSize: 1, status: 'Planning' }),
        listStaffJourneys({ page: 1, pageSize: 1, status: 'InProgress' }),
        listStaffJourneys({ page: 1, pageSize: 1, status: 'Completed' }),
        listStaffJourneys({ page: 1, pageSize: 1, status: 'Cancelled' }),
      ])

      setSummary({
        total: allRes.totalCount ?? 0,
        planning: planningRes.totalCount ?? 0,
        inProgress: inProgressRes.totalCount ?? 0,
        completed: completedRes.totalCount ?? 0,
        cancelled: cancelledRes.totalCount ?? 0,
      })
    } catch {
      setSummary(null)
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
    setPage(1)
  }, [hydrated, status])

  useEffect(() => {
    if (!hydrated) return
    didInit.current = true
  }, [hydrated])

  const items = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (!hydrated) return
    if (!data) return
    if (page > totalPages) setPage(totalPages)
  }, [data, hydrated, page, totalPages])

  useEffect(() => {
    if (!hydrated) return
    patchListUiState(listKey, { page, status })
  }, [hydrated, listKey, page, status])

  useEffect(() => {
    return () => {
      const el = scrollRef.current
      patchListUiState(listKey, { page, status, scrollTop: el?.scrollTop ?? 0 })
    }
  }, [listKey, page, status])

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
                Hành trình
              </h1>
              <p className="text-[11px] text-stone-500 truncate">Danh sách mọi hành trình (phân trang)</p>
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
        className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] w-full mx-auto"
      >
        <section>
          <StatCards
            items={[
              { label: 'Tổng chuyến', value: (summary?.total ?? 0).toLocaleString('vi-VN'), sub: 'Toàn bộ hành trình', tone: 'amber' },
              { label: 'Lên kế hoạch', value: (summary?.planning ?? 0).toLocaleString('vi-VN'), tone: 'stone' },
              { label: 'Đang diễn ra', value: (summary?.inProgress ?? 0).toLocaleString('vi-VN'), tone: 'sky' },
              { label: 'Hoàn thành', value: (summary?.completed ?? 0).toLocaleString('vi-VN'), tone: 'emerald' },
              { label: 'Đã hủy', value: (summary?.cancelled ?? 0).toLocaleString('vi-VN'), tone: 'rose' },
            ]}
            className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
          />
        </section>

        <div className="rounded-2xl bg-white/95 border border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-[220px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JourneyStatusFilter)}
                className="w-full sm:w-auto min-w-[220px] text-sm rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/40 focus:border-[#c5a070]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-stone-600">
              {loading ? 'Đang tải…' : totalCount > 0 ? `Tìm thấy ${totalCount} hành trình` : 'Chưa có hành trình'}
              {!loading && totalCount > 0 && (
                <span className="ml-2 text-stone-500">
                  · Trang <span className="font-semibold text-stone-900">{page}</span> / {totalPages}
                </span>
              )}
            </div>
          </div>
        </div>

        <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f0e8]/90 text-left text-[11px] uppercase tracking-wider text-stone-600 font-semibold border-b border-stone-100">
                  <th className="px-4 py-3">Điểm đi</th>
                  <th className="px-4 py-3">Điểm đến</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Bắt đầu</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      Đang tải…
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      Chưa có hành trình
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                      <td className="px-4 py-3 font-semibold text-stone-900 truncate" title={row.originAddress ?? ''}>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{row.originAddress ?? '—'}</span>
                          <span className="text-[11px] text-stone-500 font-mono truncate">id: {row.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate" title={row.destinationAddress ?? ''}>
                        {row.destinationAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusPillClass(
                              row.status,
                            )}`}
                          >
                            {displayJourneyStatus(row.status)}
                          </span>

                          {isInProgressStatus(row.status) && (
                            <div
                              className={`text-[11px] font-semibold ${
                                row.isOwnerOfflineTooLong ? 'text-rose-700' : 'text-stone-600'
                              }`}
                            >
                              Owner: {row.isOwnerOfflineTooLong ? 'Offline quá lâu' : 'Active'}
                              <span className="font-normal text-stone-500">
                                {' '}
                                · Last: {row.ownerLastActiveAtUtc ? formatDate(row.ownerLastActiveAtUtc) : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{formatDate(row.startedAt ?? row.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/staff/journeys/${row.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 hover:border-stone-300 transition-colors"
                        >
                          Xem
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-stone-100 bg-white">
            <div className="text-xs text-stone-500">PageSize: {PAGE_SIZE}</div>
            <div className="flex items-center gap-2">
              <button type="button" className={pagerBtn} onClick={() => setPage(1)} disabled={loading || page <= 1}>
                « Đầu
              </button>
              <button type="button" className={pagerBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
                ‹ Trước
              </button>
              <div className="text-sm text-stone-600 px-2">
                <span className="font-semibold text-stone-900">{page}</span> / {totalPages}
              </div>
              <button
                type="button"
                className={pagerBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Sau ›
              </button>
              <button
                type="button"
                className={pagerBtn}
                onClick={() => setPage(totalPages)}
                disabled={loading || page >= totalPages}
              >
                Cuối »
              </button>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="self-start inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </main>
    </div>
  )
}
