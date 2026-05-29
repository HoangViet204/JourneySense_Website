import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import { cancelStaffJourney, clearStaffJourneyAnomaly, listStaffJourneyAnomalies } from '../../api/staffJourneys'
import { getStaffTraveler } from '../../api/staffTravelers'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { PortalPagedResult, StaffJourneyAnomalyListItemDto, StaffTravelerDetailDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayJourneyStatus, formatDate } from '../../utils/format'

const PAGE_SIZE = 10
const ANOMALIES_TTL_MS = 30_000

type AnomaliesCacheItem = {
  at: number
  data: PortalPagedResult<StaffJourneyAnomalyListItemDto>
}

const anomaliesCacheByKey = new Map<string, AnomaliesCacheItem>()
const anomaliesInFlightByKey = new Map<string, Promise<PortalPagedResult<StaffJourneyAnomalyListItemDto>>>()

function anomaliesKey(page: number, pageSize: number) {
  return `${page}|${pageSize}`
}

async function getJourneyAnomaliesCached(opts: {
  page: number
  pageSize: number
  force?: boolean
  ttlMs?: number
}): Promise<PortalPagedResult<StaffJourneyAnomalyListItemDto>> {
  const page = opts.page
  const pageSize = opts.pageSize
  const force = opts.force ?? false
  const ttlMs = opts.ttlMs ?? ANOMALIES_TTL_MS

  const key = anomaliesKey(page, pageSize)
  const cached = anomaliesCacheByKey.get(key)

  if (!force && cached && Date.now() - cached.at <= ttlMs) return cached.data
  if (!force) {
    const inFlight = anomaliesInFlightByKey.get(key)
    if (inFlight) return inFlight
  }

  const promise = listStaffJourneyAnomalies({ page, pageSize })
    .then((data) => {
      anomaliesCacheByKey.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => {
      anomaliesInFlightByKey.delete(key)
    })

  anomaliesInFlightByKey.set(key, promise)
  return promise
}

function reasonLabelVi(reason: StaffJourneyAnomalyListItemDto['anomalyReason']): string {
  if (reason === 'stalled') return 'Treo / quá lâu'
  if (reason === 'offline') return 'Chủ hành trình ngoại tuyến quá lâu'
  return 'Khác'
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

type JourneyAnomalyDetailsDialogProps = {
  open: boolean
  row: StaffJourneyAnomalyListItemDto | null
  onClose: () => void
  contact: StaffTravelerDetailDto | null | undefined
  contactLoading: boolean
  onLoadContact: (journeyId: string, travelerId: string) => void
  actionLoading: boolean
  onRunJourneyAction: (kind: 'cancel' | 'clear', row: StaffJourneyAnomalyListItemDto) => void
}

function JourneyAnomalyDetailsDialog({
  open,
  row,
  onClose,
  contact,
  contactLoading,
  onLoadContact,
  actionLoading,
  onRunJourneyAction,
}: JourneyAnomalyDetailsDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !row) return null

  const tid = row.travelerId ?? ''
  const jid = row.id

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/40 [backdrop-filter:blur(3px)]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết hành trình bất thường"
        className="relative w-full max-w-2xl rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/15 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-stone-100 bg-[#f5f0e8]/60">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Chi tiết</div>
            <div className="text-base font-semibold text-stone-900 truncate">Hành trình {row.id}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${reasonBadgeClass(row.anomalyReason)}`}
              >
                {reasonLabelVi(row.anomalyReason)}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusPillClass(row.status)}`}>
                {displayJourneyStatus(row.status)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-stone-700 shadow-sm hover:bg-stone-50"
            aria-label="Đóng"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-4 space-y-5">
          <section className="rounded-2xl border border-stone-100 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Bắt đầu</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 text-sm">
              <div className="text-stone-500">Thời điểm bắt đầu</div>
              <div className="text-stone-800 font-semibold">{formatDate(row.startedAt ?? row.createdAt)}</div>
              <div className="text-stone-500">Đã trôi qua</div>
              <div className="text-stone-800 font-semibold">{row.elapsedMinutes} phút</div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-100 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Giải thích</div>
            {row.anomalyReason === 'stalled' ? (
              <div className="mt-2 space-y-1 text-sm text-stone-700">
                <div>
                  Tổng dự kiến: <span className="font-semibold">{row.plannedTotalMinutes ?? '—'}</span> phút
                </div>
                <div>
                  Ước tính di chuyển: <span className="font-semibold">{row.estimatedTravelMinutes ?? '—'}</span> phút · Tham quan:
                  <span className="font-semibold"> {row.plannedVisitMinutes ?? '—'}</span> phút
                </div>
                <div>
                  Đã trôi qua: <span className="font-semibold">{row.elapsedMinutes}</span> phút
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-stone-700">
                <div>
                  Hoạt động gần nhất (giờ chuẩn quốc tế):{' '}
                  <span className="font-semibold">{row.ownerLastActiveAtUtc ? formatDate(row.ownerLastActiveAtUtc) : '—'}</span>
                </div>
                <div className="text-[11px] text-stone-500">Ngoại tuyến = không có hoạt động từ ứng dụng gửi lên máy chủ trong &gt; 3 giờ</div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Liên hệ</div>
                {tid ? (
                  contact === undefined ? (
                    <div className="mt-1 text-sm text-stone-500">Chưa tải</div>
                  ) : contact === null ? (
                    <div className="mt-1 text-sm text-rose-600">Không tải được</div>
                  ) : (
                    <div className="mt-2 text-sm text-stone-700 space-y-1">
                      <div className="truncate" title={contact.email ?? ''}>
                        Thư điện tử: <span className="font-semibold">{contact.email ?? '—'}</span>
                      </div>
                      <div className="truncate" title={contact.phone ?? ''}>
                        Số điện thoại: <span className="font-semibold">{contact.phone ?? '—'}</span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-1 text-sm text-stone-500">Thiếu mã du khách</div>
                )}
              </div>

              <button
                type="button"
                disabled={!tid || contactLoading || contact !== undefined}
                onClick={() => onLoadContact(jid, tid)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                {contactLoading ? 'Đang tải…' : contact !== undefined ? 'Đã tải' : 'Tải liên hệ'}
              </button>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-stone-100 flex justify-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void onRunJourneyAction('cancel', row)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 transition-colors"
            >
              Dừng chuyến đi
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
export default function StaffJourneyAnomaliesPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()

  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(() => {
    const cached = anomaliesCacheByKey.get(anomaliesKey(1, PAGE_SIZE))
    return !(cached && Date.now() - cached.at <= ANOMALIES_TTL_MS)
  })
  const [data, setData] = useState<PortalPagedResult<StaffJourneyAnomalyListItemDto> | null>(() => {
    const cached = anomaliesCacheByKey.get(anomaliesKey(1, PAGE_SIZE))
    return cached && Date.now() - cached.at <= ANOMALIES_TTL_MS ? cached.data : null
  })

  const [contactByJourneyId, setContactByJourneyId] = useState<Record<string, StaffTravelerDetailDto | null>>({})
  const [contactLoadingByJourneyId, setContactLoadingByJourneyId] = useState<Record<string, boolean>>({})

  const [detailsRow, setDetailsRow] = useState<StaffJourneyAnomalyListItemDto | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean; page?: number }) => {
    const p = opts?.page ?? page
    const key = anomaliesKey(p, PAGE_SIZE)
    const cached = anomaliesCacheByKey.get(key)
    const isFresh = Boolean(cached && Date.now() - cached.at <= ANOMALIES_TTL_MS)

    if (!opts?.silent) setLoading(true)
    try {
      const res = await getJourneyAnomaliesCached({ page: p, pageSize: PAGE_SIZE, force: opts?.force })
      setData(res)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình bất thường'))
      if (!isFresh) setData(null)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [page])

  useEffect(() => {
    const key = anomaliesKey(page, PAGE_SIZE)
    const cached = anomaliesCacheByKey.get(key)
    const isFresh = Boolean(cached && Date.now() - cached.at <= ANOMALIES_TTL_MS)

    if (cached && isFresh) setData(cached.data)
    setLoading(!isFresh)

    const t = window.setTimeout(() => {
      void load({ page, silent: isFresh })
    }, 0)
    return () => window.clearTimeout(t)
  }, [load, page])

  const items = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (!data) return
    if (page > totalPages) setPage(totalPages)
  }, [data, page, totalPages])

  const openDetails = useCallback((row: StaffJourneyAnomalyListItemDto) => {
    setDetailsRow(row)
    setDetailsOpen(true)
  }, [])

  const closeDetails = useCallback(() => {
    setDetailsOpen(false)
    setDetailsRow(null)
  }, [])

  const runJourneyAction = useCallback(
    async (kind: 'cancel' | 'clear', row: StaffJourneyAnomalyListItemDto) => {
      const key = `${row.id}:${kind}`
      if (actionLoading) return
      // Initial confirm for cancel/clear
      if (kind === 'cancel') {
        const ok = await confirm({
          title: 'Dừng chuyến đi',
          message: 'Bạn có chắc muốn dừng chuyến đi này không?',
          confirmText: 'Dừng chuyến đi',
          cancelText: 'Hủy',
          danger: true,
        })
        if (!ok) return

        setActionLoading(key)
        const toastId = toast.loading('Đang dừng chuyến…')
        try {
          await cancelStaffJourney(row.id)
          toast.success('Đã dừng chuyến đi', { id: toastId })

          // close details and refresh
          closeDetails()
          void load({ force: true, page })

          // After successful cancel, ask if user wants to clear the anomaly
          const clearOk = await confirm({
            title: 'Chuyến đã dừng',
            message: 'Chuyến đã được dừng rồi. Bạn có muốn loại bỏ khỏi danh sách bất thường không?',
            confirmText: 'Loại bỏ',
            cancelText: 'Không',
            danger: false,
          })

          if (clearOk) {
            const t2 = toast.loading('Đang loại bỏ bất thường…')
            try {
              await clearStaffJourneyAnomaly(row.id)
              toast.success('Đã loại bỏ bất thường', { id: t2 })
              void load({ force: true, page })
            } catch (e) {
              toast.error(getApiErrorMessage(e, 'Không loại bỏ được bất thường.'), { id: t2 })
            }
          }
        } catch (e) {
          toast.error(getApiErrorMessage(e, 'Không dừng được chuyến đi.'), { id: toastId })
        } finally {
          setActionLoading(null)
        }
      } else {
        // direct clear (shouldn't appear in details dialog anymore)
        const ok = await confirm({
          title: 'Loại bỏ bất thường',
          message: 'Bạn có chắc muốn loại bỏ cờ bất thường cho chuyến này không?',
          confirmText: 'Loại bỏ',
          cancelText: 'Hủy',
          danger: false,
        })
        if (!ok) return

        setActionLoading(key)
        const toastId = toast.loading('Đang loại bỏ bất thường…')
        try {
          await clearStaffJourneyAnomaly(row.id)
          toast.success('Đã loại bỏ bất thường', { id: toastId })
          closeDetails()
          void load({ force: true, page })
        } catch (e) {
          toast.error(getApiErrorMessage(e, 'Không loại bỏ được bất thường.'), { id: toastId })
        } finally {
          setActionLoading(null)
        }
      }
    },
    [actionLoading, closeDetails, load, page],
  )

  async function loadContact(journeyId: string, travelerId: string) {
    if (!journeyId || !travelerId) return
    if (contactByJourneyId[journeyId] !== undefined) return

    setContactLoadingByJourneyId((m) => ({ ...m, [journeyId]: true }))
    try {
      const detail = await getStaffTraveler(travelerId)
      setContactByJourneyId((m) => ({ ...m, [journeyId]: detail }))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được thông tin liên hệ du khách'))
      setContactByJourneyId((m) => ({ ...m, [journeyId]: null }))
    } finally {
      setContactLoadingByJourneyId((m) => ({ ...m, [journeyId]: false }))
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
              <p className="text-[11px] text-stone-500 truncate">Bất thường + lý do (không cần bản đồ / tổng quan)</p>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] w-full mx-auto">
        <JourneyAnomalyDetailsDialog
          open={detailsOpen}
          row={detailsRow}
          onClose={closeDetails}
          contact={detailsRow ? contactByJourneyId[detailsRow.id] : undefined}
          contactLoading={detailsRow ? (contactLoadingByJourneyId[detailsRow.id] ?? false) : false}
          onLoadContact={(journeyId, travelerId) => void loadContact(journeyId, travelerId)}
          actionLoading={actionLoading !== null}
          onRunJourneyAction={(kind, row) => void runJourneyAction(kind, row)}
        />
        {confirmDialog}

        <div className="rounded-2xl bg-white/95 border border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="text-sm text-stone-700">
            {loading ? 'Đang tải…' : totalCount > 0 ? `Có ${totalCount} hành trình cần ưu tiên` : 'Không có hành trình bất thường'}
          </div>
          <button
            type="button"
            onClick={() => void load({ force: true, page })}
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
            <table className="w-full min-w-[920px] table-fixed text-sm">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f0e8]/90 text-left text-[11px] uppercase tracking-wider text-stone-600 font-semibold border-b border-stone-100">
                  <th className="px-4 py-3">Hành trình</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Điểm đi</th>
                  <th className="px-4 py-3">Điểm đến</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Chi tiết</th>
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

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                      Không có bất thường
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((row, i) => {
                    return (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                        <td className="px-4 py-3">
                          <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Mã</div>
                          <div className="text-[12px] text-stone-700 font-mono truncate" title={row.id}>
                            {row.id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${reasonBadgeClass(
                              row.anomalyReason,
                            )}`}
                          >
                            {reasonLabelVi(row.anomalyReason)}
                          </span>
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
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition-colors"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-stone-100 bg-white">
            <div className="text-xs text-stone-500">PageSize: {PAGE_SIZE}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                onClick={() => setPage(1)}
                disabled={loading || page <= 1}
              >
                « Đầu
              </button>
              <button
                type="button"
                className="px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                ‹ Trước
              </button>
              <div className="text-sm text-stone-600 px-2">
                <span className="font-semibold text-stone-900">{page}</span> / {totalPages}
              </div>
              <button
                type="button"
                className="px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Sau ›
              </button>
              <button
                type="button"
                className="px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                onClick={() => setPage(totalPages)}
                disabled={loading || page >= totalPages}
              >
                Cuối »
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
