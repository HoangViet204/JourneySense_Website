import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import { listStaffJourneyAnomalies } from '../../api/staffJourneys'
import { getStaffTraveler } from '../../api/staffTravelers'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { StaffJourneyAnomalyListItemDto, StaffTravelerDetailDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayJourneyStatus, formatDate } from '../../utils/format'

function reasonLabelVi(reason: StaffJourneyAnomalyListItemDto['anomalyReason']): string {
  if (reason === 'stalled') return 'Treo / quá lâu'
  if (reason === 'offline') return 'Owner offline quá lâu'
  return reason
}

function reasonBadgeClass(reason: StaffJourneyAnomalyListItemDto['anomalyReason']): string {
  if (reason === 'stalled') return 'bg-red-50 text-red-700 ring-red-200'
  if (reason === 'offline') return 'bg-orange-50 text-orange-700 ring-orange-200'
  return 'bg-stone-100 text-stone-700 ring-stone-200'
}

function statusPillClass(status?: string | null): string {
  const s = status?.trim()?.toLowerCase() ?? ''
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (s === 'inprogress' || s === 'in_progress') return 'bg-amber-50 text-amber-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-rose-50 text-rose-700'
  if (s === 'planning') return 'bg-stone-100 text-stone-800'
  return 'bg-stone-100 text-stone-800'
}

export default function StaffJourneyAnomaliesPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StaffJourneyAnomalyListItemDto[]>([])

  const [contactByTravelerId, setContactByTravelerId] = useState<Record<string, StaffTravelerDetailDto | null>>({})
  const [contactLoading, setContactLoading] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listStaffJourneyAnomalies()
      setRows(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình bất thường'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const total = rows.length

  const sortedRows = useMemo(() => {
    // Prioritize stalled first, then offline, then newest startedAt
    const score = (r: StaffJourneyAnomalyListItemDto) => (r.anomalyReason === 'stalled' ? 2 : r.anomalyReason === 'offline' ? 1 : 0)
    return [...rows].sort((a, b) => {
      const ds = score(b) - score(a)
      if (ds !== 0) return ds
      const ta = a.startedAt ? Date.parse(a.startedAt) : 0
      const tb = b.startedAt ? Date.parse(b.startedAt) : 0
      return tb - ta
    })
  }, [rows])

  async function loadContact(travelerId: string) {
    if (!travelerId) return
    if (contactByTravelerId[travelerId] !== undefined) return

    setContactLoading((m) => ({ ...m, [travelerId]: true }))
    try {
      const detail = await getStaffTraveler(travelerId)
      setContactByTravelerId((m) => ({ ...m, [travelerId]: detail }))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được thông tin liên hệ du khách'))
      setContactByTravelerId((m) => ({ ...m, [travelerId]: null }))
    } finally {
      setContactLoading((m) => ({ ...m, [travelerId]: false }))
    }
  }

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
                Hành trình bất thường
              </h1>
              <p className="text-[11px] text-stone-500 truncate">Bất thường + lý do (không cần map/overview)</p>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] w-full mx-auto">
        <div className="rounded-2xl bg-white/95 border border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="text-sm text-stone-700">
            {loading ? 'Đang tải…' : total > 0 ? `Có ${total} hành trình cần ưu tiên` : 'Không có hành trình bất thường'}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>
        </div>

        <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f0e8]/90 text-left text-[11px] uppercase tracking-wider text-stone-600 font-semibold border-b border-stone-100">
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Điểm đi</th>
                  <th className="px-4 py-3">Điểm đến</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Bắt đầu</th>
                  <th className="px-4 py-3">Giải thích / Liên hệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                      Đang tải…
                    </td>
                  </tr>
                )}

                {!loading && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                      Không có bất thường
                    </td>
                  </tr>
                )}

                {!loading &&
                  sortedRows.map((row, i) => {
                    const tid = row.travelerId ?? ''
                    const contact = tid ? contactByTravelerId[tid] : undefined
                    const cLoading = tid ? (contactLoading[tid] ?? false) : false

                    return (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${reasonBadgeClass(
                              row.anomalyReason,
                            )}`}
                          >
                            {reasonLabelVi(row.anomalyReason)}
                          </span>
                          <div className="text-[11px] text-stone-500 font-mono mt-1 truncate" title={row.id}>
                            id: {row.id}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900 truncate" title={row.originAddress ?? ''}>
                          {row.originAddress ?? '—'}
                        </td>
                        <td className="px-4 py-3 truncate" title={row.destinationAddress ?? ''}>
                          {row.destinationAddress ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusPillClass(row.status)}`}>
                            {displayJourneyStatus(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          <div className="flex flex-col">
                            <span>{formatDate(row.startedAt ?? row.createdAt)}</span>
                            <span className="text-[11px] text-stone-500">Elapsed: {row.elapsedMinutes} phút</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.anomalyReason === 'stalled' ? (
                            <div className="text-[12px] text-stone-700 space-y-0.5">
                              <div>
                                Planned total: <span className="font-semibold">{row.plannedTotalMinutes ?? '—'}</span> phút
                              </div>
                              <div>
                                Est. travel: <span className="font-semibold">{row.estimatedTravelMinutes ?? '—'}</span> phút · Visit:
                                <span className="font-semibold"> {row.plannedVisitMinutes ?? '—'}</span> phút
                              </div>
                              <div>
                                Elapsed: <span className="font-semibold">{row.elapsedMinutes}</span> phút
                              </div>
                            </div>
                          ) : (
                            <div className="text-[12px] text-stone-700 space-y-0.5">
                              <div>
                                Last active (UTC):{' '}
                                <span className="font-semibold">{row.ownerLastActiveAtUtc ? formatDate(row.ownerLastActiveAtUtc) : '—'}</span>
                              </div>
                              <div className="text-[11px] text-stone-500">Offline = không có activity từ app lên server trong &gt; 3 giờ</div>
                            </div>
                          )}

                          <div className="mt-2 pt-2 border-t border-stone-100 flex items-start gap-2 justify-between">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Liên hệ</div>
                              {tid ? (
                                contact === undefined ? (
                                  <div className="text-xs text-stone-500">Chưa tải</div>
                                ) : contact === null ? (
                                  <div className="text-xs text-rose-600">Không tải được</div>
                                ) : (
                                  <div className="text-xs text-stone-700">
                                    <div className="truncate" title={contact.email ?? ''}>
                                      Email: <span className="font-semibold">{contact.email ?? '—'}</span>
                                    </div>
                                    <div className="truncate" title={contact.phone ?? ''}>
                                      Phone: <span className="font-semibold">{contact.phone ?? '—'}</span>
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="text-xs text-stone-500">Thiếu travelerId</div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={!tid || cLoading || contactByTravelerId[tid] !== undefined}
                              onClick={() => void loadContact(tid)}
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
                            >
                              {cLoading ? 'Đang tải…' : contactByTravelerId[tid] !== undefined ? 'Đã tải' : 'Tải liên hệ'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
