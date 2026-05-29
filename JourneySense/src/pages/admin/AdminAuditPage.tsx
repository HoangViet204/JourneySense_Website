import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryPage } from '../../hooks/useQueryPage'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type { AuditLogListItemDto, PortalPagedResult } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { normalizeAdminUserDetailPayload } from '../../utils/adminUserDetail'
import { loadListUiState, patchListUiState } from '../../utils/listUiState'

const PAGE_SIZE = 10

type ActionFilter =
  | ''
  | 'AdminEmbeddingBatchRun'
  | 'AdminStaffCreated'
  | 'AdminUserStatusChanged'
  | 'FeedbackModerated'
  | 'JourneyFeedbackModerated'

const ACTION_FILTER_OPTIONS: Array<{ value: ActionFilter; label: string }> = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'AdminEmbeddingBatchRun', label: 'Chạy nhúng hàng loạt' },
  { value: 'AdminStaffCreated', label: 'Tạo tài khoản nhân viên' },
  { value: 'AdminUserStatusChanged', label: 'Đổi trạng thái người dùng' },
  { value: 'FeedbackModerated', label: 'Duyệt phản hồi' },
  { value: 'JourneyFeedbackModerated', label: 'Duyệt phản hồi chuyến đi' },
]

function toActionTypeParam(filter: ActionFilter): string | undefined {
  if (!filter) return undefined
  if (filter === 'FeedbackModerated') return 'StaffFeedbackModerated'
  // Journey-only moderation cannot be reliably filtered by backend using actionType alone.
  // Fetch unfiltered and filter client-side.
  if (filter === 'JourneyFeedbackModerated') return undefined
  return filter
}

function displayActionFilterLabel(filter: ActionFilter): string {
  const opt = ACTION_FILTER_OPTIONS.find((x) => x.value === filter)
  return opt?.label ?? '—'
}

function stripJsonPunctuation(s: string) {
  // UI yêu cầu không hiển thị ký tự kiểu JSON như { } [ ]
  return s.replace(/[\[\]{}]/g, '').trim()
}

function humanizeTokenString(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function toVietnameseTerms(input: string) {
  let s = humanizeTokenString(stripJsonPunctuation(input))

  // cụm từ đặc biệt (đặt trước từ đơn)
  s = s.replace(/\bExperience\s*Embedding\b/gi, 'Nhúng trải nghiệm')
  s = s.replace(/\bMicro\s*Experience\b/gi, 'Trải nghiệm nhỏ')

  // số nhiều
  s = s.replace(/\bJourneys\b/gi, 'Hành trình')
  s = s.replace(/\bExperiences\b/gi, 'Trải nghiệm')
  s = s.replace(/\bFeedbacks\b/gi, 'Phản hồi')
  s = s.replace(/\bUsers\b/gi, 'Người dùng')
  s = s.replace(/\bPlaces\b/gi, 'Địa điểm')

  // từ đơn
  s = s.replace(/\bEmbedding\b/gi, 'Nhúng')
  s = s.replace(/\bJourney\b/gi, 'Hành trình')
  s = s.replace(/\bExperience\b/gi, 'Trải nghiệm')
  s = s.replace(/\bFeedback\b/gi, 'Phản hồi')
  s = s.replace(/\bUser\b/gi, 'Người dùng')
  s = s.replace(/\bStaff\b/gi, 'Nhân viên')
  s = s.replace(/\bAdmin\b/gi, 'Quản trị viên')
  s = s.replace(/\bPlace\b/gi, 'Địa điểm')

  return s.trim() || '—'
}

function displayEntityTypeVi(entityType: string | null | undefined, actionType: string) {
  if (actionType === 'AdminStaffCreated') return 'Nhân viên'
  if (!entityType?.trim()) return '—'
  return toVietnameseTerms(entityType)
}

function displayActionTypeVi(actionType: string, entityType?: string | null) {
  switch (actionType) {
    case 'Create':
      return 'Tạo mới'
    case 'Update':
      return 'Cập nhật'
    case 'Delete':
      return 'Xóa'
    case 'Verify':
      return 'Xác thực'
    case 'Feature':
      return 'Gắn nổi bật'
    case 'Reject':
      return 'Từ chối'
    case 'Login':
      return 'Đăng nhập'
    case 'Logout':
      return 'Đăng xuất'
    case 'AdminUserStatusChanged':
      return 'Đổi trạng thái người dùng'
    case 'AdminStaffCreated':
      return 'Tạo tài khoản nhân viên'
    case 'StaffFeedbackModerated': {
      const et = (entityType ?? '').toLowerCase()
      if (et.includes('journey')) return 'Duyệt phản hồi chuyến đi'
      if (et.includes('place') || et.includes('experience')) return 'Duyệt phản hồi địa điểm'
      return 'Duyệt phản hồi'
    }
    case 'StaffUserReported':
      return 'Ghi nhận báo cáo'
    case 'AdminEmbeddingBatchRun':
      return 'Chạy nhúng hàng loạt'
    default: {
      const at = actionType.toLowerCase()
      if (at.includes('moderated') && at.includes('feedback')) {
        if (at.includes('journey')) return 'Duyệt phản hồi chuyến đi'
        if (at.includes('place') || at.includes('experience')) return 'Duyệt phản hồi địa điểm'
        return 'Duyệt phản hồi'
      }
      return toVietnameseTerms(actionType)
    }
  }
}

export default function AdminAuditPage() {
  const location = useLocation()
  const listKey = location.pathname
  const scrollRef = useRef<HTMLElement | null>(null)
  const didRestoreScroll = useRef(false)
  const sawLoading = useRef(false)

  const [page, setPage] = useQueryPage(1, 'page')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PortalPagedResult<AuditLogListItemDto> | null>(null)
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionFilter>('')
  const [actorBriefById, setActorBriefById] = useState<Record<string, { fullName: string | null; email: string | null }>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (loading) sawLoading.current = true
  }, [loading])

  useEffect(() => {
    const saved = loadListUiState<{ page?: number; actionTypeFilter?: ActionFilter; scrollTop?: number }>(listKey)
    if (typeof saved?.actionTypeFilter === 'string') setActionTypeFilter(saved.actionTypeFilter)
    if (typeof saved?.page === 'number' && Number.isFinite(saved.page) && saved.page >= 1) setPage(saved.page)
    setHydrated(true)
  }, [listKey])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<PortalPagedResult<AuditLogListItemDto>>('/api/admin/audit-logs', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          actionType: toActionTypeParam(actionTypeFilter),
        },
      })
      setResult(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [page, actionTypeFilter])

  useEffect(() => {
    if (!hydrated) return
    void load()
  }, [hydrated, load])

  useEffect(() => {
    if (!hydrated) return
    patchListUiState(listKey, { page, actionTypeFilter })
  }, [actionTypeFilter, hydrated, listKey, page])

  useEffect(() => {
    return () => {
      const el = scrollRef.current
      patchListUiState(listKey, { page, actionTypeFilter, scrollTop: el?.scrollTop ?? 0 })
    }
  }, [actionTypeFilter, listKey, page])

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

  const items = result?.items ?? []

  const displayedItems = useMemo(() => {
    if (actionTypeFilter !== 'JourneyFeedbackModerated') return items

    const HINTS = [
      'journey',
      'journeyid',
      'trip',
      'tripid',
      'itinerary',
      'itineraryid',
      'chuyến',
      'chuyen',
      'chuyến đi',
      'chuyen di',
      'hành trình',
      'hanh trinh',
    ]

    return items.filter((x) => {
      if (displayActionTypeVi(String(x.actionType), x.entityType) === 'Duyệt phản hồi chuyến đi') return true

      const blob = `${x.actionType ?? ''} ${x.entityType ?? ''} ${x.entityId ?? ''} ${x.oldValues ?? ''} ${x.newValues ?? ''}`.toLowerCase()
      return HINTS.some((k) => blob.includes(k))
    })
  }, [items, actionTypeFilter])

  useEffect(() => {
    const ids = Array.from(
      new Set(
        displayedItems
          .map((x) => x.actorUserId?.trim())
          .filter((x): x is string => Boolean(x)),
      ),
    ).filter((id) => !actorBriefById[id])

    if (!ids.length) return

    let cancelled = false

    const run = async () => {
      const updates: Record<string, { fullName: string | null; email: string | null }> = {}

      await Promise.all(
        ids.map(async (id) => {
          try {
            const { data: raw } = await api.get<unknown>(`/api/admin/users/${id}`)
            const u = normalizeAdminUserDetailPayload(raw)
            updates[id] = {
              fullName: u.fullName?.trim() ? u.fullName : null,
              email: u.email?.trim() ? u.email : null,
            }
          } catch {
            // ignore
          }
        }),
      )

      if (cancelled) return
      if (Object.keys(updates).length) {
        setActorBriefById((prev) => ({ ...prev, ...updates }))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [displayedItems, actorBriefById])
  const total = result?.totalCount ?? 0
  const pageSize = result?.pageSize ?? PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const isClientFiltered = actionTypeFilter === 'JourneyFeedbackModerated'
  const visibleCount = displayedItems.length

  const emptyText = useMemo(() => {
    if (loading) return 'Đang tải…'
    if (actionTypeFilter) return 'Không có nhật ký phù hợp.'
    return 'Chưa có nhật ký.'
  }, [loading, actionTypeFilter])

  return (
    <main
      ref={(n) => {
        scrollRef.current = n
      }}
      className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
              Nhật ký hệ thống
            </h1>
            <p className="mt-1 text-sm text-stone-600">Theo dõi các thao tác quản trị và thay đổi quan trọng.</p>
          </div>
          <Link to="/admin/dashboard" className="text-sm font-semibold text-amber-800 hover:underline">
            ← Bảng điều khiển
          </Link>
        </header>

        <section className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-stone-100 bg-white px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-sm text-stone-600">
              {loading
                ? 'Đang tải…'
                : isClientFiltered
                  ? visibleCount > 0
                    ? `Hiển thị ${visibleCount} bản ghi`
                    : 'Không có bản ghi phù hợp'
                  : total > 0
                    ? `Tìm thấy ${total} bản ghi`
                    : 'Chưa có nhật ký'}
              {actionTypeFilter ? <span className="ml-2 text-stone-400">·</span> : null}
              {actionTypeFilter ? (
                <span className="ml-2 font-semibold text-stone-700">Hành động: {displayActionFilterLabel(actionTypeFilter)}</span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-600">Lọc hành động</label>
              <select
                value={actionTypeFilter}
                onChange={(e) => {
                  setPage(1)
                  setActionTypeFilter(e.target.value as ActionFilter)
                }}
                className="h-10 w-full min-w-[240px] rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                {ACTION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-[#f5f0e8] text-left text-xs uppercase text-stone-600 font-semibold">
                  <th className="px-4 py-3">Người thực hiện</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3 text-right">Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(loading || displayedItems.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
                      {emptyText}
                    </td>
                  </tr>
                )}

                {!loading &&
                  displayedItems.map((row) => {
                    const actorId = row.actorUserId?.trim() || ''
                    const actorBrief = actorId ? actorBriefById[actorId] : undefined
                    const actorEmail = row.actorEmail?.trim() || actorBrief?.email?.trim() || ''
                    const actorName = actorBrief?.fullName?.trim() || actorEmail || '—'

                    const entityType = displayEntityTypeVi(row.entityType, String(row.actionType))

                    return (
                      <tr key={row.id} className="bg-white">
                        <td className="px-4 py-3 text-stone-800">
                          <div className="font-medium text-stone-900 truncate max-w-[260px]" title={actorName}>
                            {actorName}
                          </div>
                          {actorEmail ? (
                            <div className="mt-0.5 text-xs text-stone-500 truncate max-w-[260px]" title={actorEmail}>
                              {actorEmail}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200/70">
                            {displayActionTypeVi(String(row.actionType), row.entityType)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-900">{entityType}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/audit/${row.id}`}
                            state={row}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:bg-amber-50/60 hover:text-amber-800 hover:border-amber-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                            aria-label="Xem chi tiết"
                            title="Xem chi tiết"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
            <span className="text-sm text-stone-600">
              {isClientFiltered ? (
                <>Trang {page} / {totalPages} · Hiển thị {visibleCount} bản ghi</>
              ) : (
                <>
                  Trang {page} / {totalPages} · {total} bản ghi
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
