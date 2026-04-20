import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { PortalPagedResult, StaffFeedbackDetailDto, StaffJourneyFeedbackListItemDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'
import { moderationStatusBadgeClass, moderationStatusVi } from '../../utils/staffFeedbackLabels'

const LIST_PAGE_SIZE = 10
const MAX_LIST_PAGES = 30

async function findTripListItem(journeyId: string): Promise<StaffJourneyFeedbackListItemDto | null> {
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const { data } = await api.get<PortalPagedResult<StaffJourneyFeedbackListItemDto>>('/api/staff/feedbacks/journeys', {
      params: { page, pageSize: LIST_PAGE_SIZE },
    })
    const hit = data.items?.find((x) => x.journeyId === journeyId)
    if (hit) return hit
    const total = data.totalCount ?? 0
    if (!data.items?.length || page * LIST_PAGE_SIZE >= total) break
  }
  return null
}

export default function StaffJourneyFeedbackDetailPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const location = useLocation() as {
    state?: { focusFeedbackId?: string; tripRow?: StaffJourneyFeedbackListItemDto }
  }
  const focusFeedbackId = location.state?.focusFeedbackId
  const initialTripRow = location.state?.tripRow

  const focusRef = useRef<HTMLLIElement | null>(null)

  const [tripRow, setTripRow] = useState<StaffJourneyFeedbackListItemDto | null>(initialTripRow ?? null)
  const [focusedWaypoint, setFocusedWaypoint] = useState<StaffFeedbackDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyTrip, setBusyTrip] = useState(false)
  const [busyWaypoint, setBusyWaypoint] = useState<string | null>(null)
  const [tripRejectReason, setTripRejectReason] = useState('')
  const [waypointReason, setWaypointReason] = useState<Record<string, string>>({})
  const [reportReason, setReportReason] = useState('')

  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!journeyId) return
      if (!opts?.silent) setLoading(true)
      try {
        // Nếu có dữ liệu từ trang danh sách thì hiển thị ngay, nhưng luôn cố gắng lấy bản mới nhất từ server.
        if (initialTripRow && initialTripRow.journeyId === journeyId) setTripRow(initialTripRow)

        const freshTrip = (await findTripListItem(journeyId)) ?? null
        if (freshTrip) setTripRow(freshTrip)
        else if (!(initialTripRow && initialTripRow.journeyId === journeyId)) setTripRow(null)

        if (focusFeedbackId) {
          try {
            const { data } = await api.get<StaffFeedbackDetailDto>(`/api/staff/feedbacks/${focusFeedbackId}`)
            const okJourney = data?.journeyId && data.journeyId.toLowerCase() === journeyId.toLowerCase()
            setFocusedWaypoint(okJourney ? data : null)
          } catch {
            setFocusedWaypoint(null)
          }
        } else {
          setFocusedWaypoint(null)
        }
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được dữ liệu phản hồi'))
        setTripRow(null)
        setFocusedWaypoint(null)
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [journeyId, initialTripRow, focusFeedbackId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!focusFeedbackId || loading) return
    const t = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => window.clearTimeout(t)
  }, [focusFeedbackId, loading, focusedWaypoint])

  const moderateTrip = async (decision: 'approve' | 'reject') => {
    if (!journeyId) return
    if (decision === 'reject' && !tripRejectReason.trim()) {
      toast.warning('Nhập lý do khi từ chối phản hồi cả chuyến.')
      return
    }

    const actionText = decision === 'approve' ? 'Duyệt' : 'Từ chối'
    const ok = await confirm({
      title: `${actionText} phản hồi chuyến đi`,
      message: `Bạn có chắc muốn ${decision === 'approve' ? 'duyệt' : 'từ chối'} phản hồi chuyến đi không?`,
      confirmText: actionText,
      cancelText: 'Hủy',
      danger: decision === 'reject',
    })
    if (!ok) return

    setBusyTrip(true)
    const t = toast.loading(decision === 'approve' ? 'Đang duyệt phản hồi chuyến…' : 'Đang từ chối…')
    try {
      await api.post(`/api/staff/feedbacks/journeys/${journeyId}/moderate`, {
        decision,
        reason: decision === 'reject' ? tripRejectReason.trim() : undefined,
      })

      // Cập nhật UI ngay sau khi duyệt/từ chối (không chờ reload).
      setTripRow((prev) =>
        prev
          ? {
              ...prev,
              moderationStatus: decision === 'approve' ? 'approved' : 'rejected',
              updatedAt: new Date().toISOString(),
            }
          : prev,
      )

      toast.success(decision === 'approve' ? 'Đã duyệt phản hồi chuyến' : 'Đã từ chối phản hồi chuyến', { id: t })
      if (decision === 'reject') setTripRejectReason('')
      void load({ silent: true })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusyTrip(false)
    }
  }

  const moderateWaypoint = async (feedbackId: string, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !(waypointReason[feedbackId] ?? '').trim()) {
      toast.warning('Nhập lý do khi từ chối phản hồi điểm dừng.')
      return
    }

    const actionText = decision === 'approve' ? 'Duyệt' : 'Từ chối'
    const ok = await confirm({
      title: `${actionText} phản hồi điểm dừng`,
      message: `Bạn có chắc muốn ${decision === 'approve' ? 'duyệt' : 'từ chối'} phản hồi điểm dừng này không?`,
      confirmText: actionText,
      cancelText: 'Hủy',
      danger: decision === 'reject',
    })
    if (!ok) return

    setBusyWaypoint(feedbackId)
    const t = toast.loading(decision === 'approve' ? 'Đang duyệt…' : 'Đang từ chối…')
    try {
      await api.post(`/api/staff/feedbacks/${feedbackId}/moderate`, {
        decision,
        reason: decision === 'reject' ? (waypointReason[feedbackId] ?? '').trim() : undefined,
      })

      // Cập nhật UI ngay sau khi duyệt/từ chối.
      setFocusedWaypoint((prev) =>
        prev && prev.id === feedbackId
          ? { ...prev, moderationStatus: decision === 'approve' ? 'approved' : 'rejected' }
          : prev,
      )

      toast.success(decision === 'approve' ? 'Đã duyệt phản hồi điểm dừng' : 'Đã từ chối phản hồi', { id: t })
      setWaypointReason((prev) => ({ ...prev, [feedbackId]: '' }))
      void load({ silent: true })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusyWaypoint(null)
    }
  }

  const reportUser = async () => {
    const tid = tripRow?.travelerId
    if (!tid) {
      toast.warning('Không có thông tin du khách trên bản ghi chuyến.')
      return
    }

    const ok = await confirm({
      title: 'Gửi báo cáo',
      message: 'Gửi báo cáo người dùng này?',
      confirmText: 'Gửi báo cáo',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

    setBusyTrip(true)
    const t = toast.loading('Đang gửi báo cáo…')
    try {
      await api.post(`/api/staff/reports/users/${tid}`, {
        reason: reportReason.trim() || 'Vi phạm / spam',
      })
      toast.success('Đã gửi báo cáo người dùng', { id: t })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusyTrip(false)
    }
  }

  if (!journeyId) return null

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
                Chi tiết &amp; duyệt theo chuyến
              </h1>
              <p className="text-[11px] text-stone-500 font-mono truncate" title={journeyId}>
                {journeyId}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6 pb-12">
        {loading && (
          <p className="text-stone-500 text-sm rounded-2xl bg-white/90 border border-stone-100 px-4 py-8 text-center shadow-sm">Đang tải…</p>
        )}

        {!loading && (
          <>
            <section className="rounded-2xl bg-white border border-amber-200/60 shadow-[0_2px_12px_rgba(197,160,112,0.12)] p-5 sm:p-6 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-amber-950 font-['Cormorant_Garamond',serif] tracking-wide">
                  Phản hồi cả chuyến
                </h2>
                {tripRow && (
                  <span className={moderationStatusBadgeClass(tripRow.moderationStatus)}>{moderationStatusVi(tripRow.moderationStatus)}</span>
                )}
              </div>
              {!tripRow && (
                <p className="text-xs text-amber-900/90 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 leading-relaxed">
                  Không thấy bản ghi trong danh sách chuyến (có thể do bộ lọc hoặc trang danh sách). Bạn vẫn có thể thử duyệt nếu máy chủ cho phép.
                </p>
              )}
              <div className="rounded-xl bg-gradient-to-b from-amber-50/80 to-[#fdfaf5] border border-amber-100/80 px-4 py-3.5">
                <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {tripRow?.journeyFeedback?.trim() ? tripRow.journeyFeedback : '—'}
                </p>
              </div>
              {tripRow && (
                <p className="text-xs text-stone-500">
                  Du khách:{' '}
                  <span className="font-medium text-stone-700">{tripRow.travelerEmail ?? tripRow.travelerId}</span>
                  {tripRow.updatedAt && (
                    <>
                      {' '}
                      · Cập nhật {formatDate(tripRow.updatedAt)}
                    </>
                  )}
                </p>
              )}
              <div className="space-y-2 pt-2 border-t border-amber-100/90">
                <label className="text-[11px] font-semibold text-stone-600">Lý do khi từ chối (cả chuyến)</label>
                <textarea
                  value={tripRejectReason}
                  onChange={(e) => setTripRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Bắt buộc khi từ chối phản hồi cả chuyến…"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/35"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyTrip}
                    onClick={() => void moderateTrip('approve')}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50 shadow-sm transition-colors"
                  >
                    Duyệt phản hồi chuyến
                  </button>
                  <button
                    type="button"
                    disabled={busyTrip}
                    onClick={() => void moderateTrip('reject')}
                    className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold px-4 py-2.5 disabled:opacity-50 hover:bg-red-50/80 transition-colors"
                  >
                    Từ chối phản hồi chuyến
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-base font-semibold text-stone-900 font-['Cormorant_Garamond',serif]">Phản hồi từng điểm dừng</h2>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Mỗi thẻ là một điểm trên chuyến. Duyệt hoặc từ chối độc lập với phản hồi cả chuyến phía trên.
                </p>
              </div>
              {!focusedWaypoint && (
                <p className="text-sm text-stone-500 rounded-xl bg-stone-50 px-3 py-3 border border-stone-100">
                  Phần điểm dừng chỉ hiển thị khi bạn mở từ phản hồi của một điểm dừng cụ thể.
                </p>
              )}

              {focusedWaypoint && (
                <ul className="space-y-4">
                  {(() => {
                    const fid = focusedWaypoint.id
                    const isFocus = Boolean(focusFeedbackId && focusFeedbackId === fid)
                    const stop = focusedWaypoint.waypointStopOrder
                    const name = focusedWaypoint.experienceName ?? focusedWaypoint.experienceId
                    return (
                      <li
                        key={fid}
                        ref={focusRef}
                        className={`rounded-xl border px-4 py-4 space-y-3 transition-shadow ${
                          isFocus
                            ? 'border-[#c5a070]/70 bg-[#fdfaf5] ring-2 ring-[#c5a070]/25 shadow-sm'
                            : 'border-stone-200 bg-stone-50/40 hover:border-stone-300/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-stone-900">
                            {stop ? `Điểm ${stop}` : 'Điểm dừng'}
                            {name ? ` · ${name}` : ''}
                          </span>
                          {isFocus && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#8b6914] bg-amber-100 px-2 py-0.5 rounded-md">
                              Đang xem
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={moderationStatusBadgeClass(focusedWaypoint.moderationStatus)}>
                            {moderationStatusVi(focusedWaypoint.moderationStatus)}
                          </span>
                          <span className="text-stone-400">·</span>
                          <span>{formatDate(focusedWaypoint.createdAt)}</span>
                        </p>
                        <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{focusedWaypoint.feedbackText}</p>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-stone-600">Lý do khi từ chối (điểm này)</label>
                          <textarea
                            value={waypointReason[fid] ?? ''}
                            onChange={(e) => setWaypointReason((prev) => ({ ...prev, [fid]: e.target.value }))}
                            rows={2}
                            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/35"
                            placeholder="Bắt buộc khi từ chối…"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyWaypoint === fid}
                              onClick={() => void moderateWaypoint(fid, 'approve')}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50 shadow-sm"
                            >
                              Duyệt điểm này
                            </button>
                            <button
                              type="button"
                              disabled={busyWaypoint === fid}
                              onClick={() => void moderateWaypoint(fid, 'reject')}
                              className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold px-3 py-2 disabled:opacity-50"
                            >
                              Từ chối điểm này
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })()}
                </ul>
              )}
            </section>

            {tripRow?.travelerId && (
              <section className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5 sm:p-6 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">Báo cáo du khách</h2>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={2}
                  placeholder="Mô tả lý do báo cáo (spam, vi phạm…) — có thể để trống để dùng lý do mặc định"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/35"
                />
                <button
                  type="button"
                  disabled={busyTrip}
                  onClick={() => void reportUser()}
                  className="rounded-xl bg-[#c5a070] hover:bg-[#b08f5f] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50 shadow-sm transition-colors"
                >
                  Gửi báo cáo
                </button>
              </section>
            )}

            <Link
              to="/staff/feedback"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#9a7b4f] hover:text-[#7d633c] transition-colors"
            >
              <span aria-hidden>←</span> Về danh sách phản hồi
            </Link>
          </>
        )}
      </main>
      {dialog}
    </div>
  )
}
