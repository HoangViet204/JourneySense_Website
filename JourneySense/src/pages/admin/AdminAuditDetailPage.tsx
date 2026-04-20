import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type { AuditLogListItemDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { normalizeAdminUserDetailPayload } from '../../utils/adminUserDetail'
import { formatDate } from '../../utils/format'

function stripJsonPunctuation(s: string) {
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

  s = s.replace(/\bExperience\s*Embedding\b/gi, 'Nhúng trải nghiệm')
  s = s.replace(/\bMicro\s*Experience\b/gi, 'Trải nghiệm nhỏ')

  s = s.replace(/\bJourneys\b/gi, 'Hành trình')
  s = s.replace(/\bExperiences\b/gi, 'Trải nghiệm')
  s = s.replace(/\bFeedbacks\b/gi, 'Phản hồi')
  s = s.replace(/\bUsers\b/gi, 'Người dùng')
  s = s.replace(/\bPlaces\b/gi, 'Địa điểm')

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

function displayKeyVi(key: string) {
  const k0 = stripJsonPunctuation(key || 'Giá trị')
  const k = k0.trim()

  if (/id$/i.test(k) && k.length > 2) {
    const base = k.slice(0, -2)
    const baseVi = toVietnameseTerms(base).toLowerCase()
    return baseVi ? `Mã ${baseVi}` : 'Mã'
  }

  // xử lý dạng camelCase / PascalCase / snake_case
  const human = humanizeTokenString(k)
  return toVietnameseTerms(human)
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

type FlatRow = { key: string; value: string }

function toFlatRows(raw: string | null | undefined): FlatRow[] {
  if (!raw?.trim()) return []

  const parsed = safeParseJson(raw)
  if (!parsed) {
    const text = stripJsonPunctuation(raw)
    return text ? [{ key: 'Nội dung', value: text }] : []
  }

  const out: FlatRow[] = []
  const LIMIT = 120

  const push = (key: string, value: unknown) => {
    if (out.length >= LIMIT) return
    const k = displayKeyVi(key || 'Giá trị')
    if (value === null || value === undefined) {
      out.push({ key: k, value: '—' })
      return
    }
    if (typeof value === 'string') {
      out.push({ key: k, value: stripJsonPunctuation(value) || '—' })
      return
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out.push({ key: k, value: String(value) })
      return
    }
    out.push({ key: k, value: stripJsonPunctuation(String(value)) || '—' })
  }

  const walk = (value: unknown, prefix: string) => {
    if (out.length >= LIMIT) return

    if (value === null || value === undefined) {
      push(prefix || 'Giá trị', value)
      return
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        push(prefix || 'Danh sách', '—')
        return
      }
      value.forEach((item, idx) => {
        walk(item, prefix ? `${prefix}.${idx + 1}` : String(idx + 1))
      })
      return
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        push(prefix || 'Đối tượng', '—')
        return
      }
      for (const [k, v] of entries) {
        walk(v, prefix ? `${prefix}.${k}` : k)
        if (out.length >= LIMIT) break
      }
      return
    }

    push(prefix || 'Giá trị', value)
  }

  walk(parsed, '')

  if (out.length >= LIMIT) out.push({ key: 'Ghi chú', value: 'Dữ liệu quá dài, đã rút gọn khi hiển thị.' })
  return out
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

export default function AdminAuditDetailPage() {
  const { auditId } = useParams<{ auditId: string }>()
  const location = useLocation()
  const stateRow = (location.state as AuditLogListItemDto | undefined) ?? undefined

  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [row, setRow] = useState<AuditLogListItemDto | null>(stateRow ?? null)
  const [actorBrief, setActorBrief] = useState<{ fullName: string | null; email: string | null } | null>(null)

  useEffect(() => {
    if (row || !auditId) return

    const load = async () => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const { data } = await api.get<AuditLogListItemDto>(`/api/admin/audit-logs/${auditId}`)
        setRow(data)
      } catch (e) {
        setLoadFailed(true)
        toast.error(getApiErrorMessage(e, 'Không tải được chi tiết nhật ký'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [auditId, row])

  useEffect(() => {
    const id = row?.actorUserId?.trim()
    if (!id) return

    let cancelled = false

    const run = async () => {
      try {
        const { data: raw } = await api.get<unknown>(`/api/admin/users/${id}`)
        const u = normalizeAdminUserDetailPayload(raw)
        if (cancelled) return
        setActorBrief({
          fullName: u.fullName?.trim() ? u.fullName : null,
          email: u.email?.trim() ? u.email : null,
        })
      } catch {
        if (!cancelled) setActorBrief(null)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [row?.actorUserId])

  const actorEmail = useMemo(() => row?.actorEmail?.trim() || actorBrief?.email?.trim() || '', [row?.actorEmail, actorBrief])
  const actorName = useMemo(() => actorBrief?.fullName?.trim() || actorEmail || '—', [actorBrief, actorEmail])

  const entityType = useMemo(() => displayEntityTypeVi(row?.entityType, String(row?.actionType ?? '')), [row?.entityType, row?.actionType])

  const newRows = useMemo(() => toFlatRows(row?.newValues), [row])
  const oldRows = useMemo(() => toFlatRows(row?.oldValues), [row])

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
              Chi tiết nhật ký
            </h1>
            <p className="mt-1 text-sm text-stone-600">Xem thông tin chi tiết của một bản ghi nhật ký hệ thống.</p>
          </div>
          <Link to="/admin/audit" className="text-sm font-semibold text-amber-800 hover:underline">
            ← Quay lại danh sách
          </Link>
        </header>

        <section className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#c5a070] via-[#b08f5f] to-[#8f7349]" />
          <div className="p-5 sm:p-6">
            {loading && !row ? (
              <div className="py-10 text-center text-stone-500">Đang tải…</div>
            ) : !row ? (
              <div className="py-10 text-center text-stone-500">
                {loadFailed ? 'Không tải được chi tiết. Vui lòng quay lại danh sách và mở lại bản ghi.' : 'Không tìm thấy bản ghi.'}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Thời gian</div>
                    <div className="mt-1 text-sm font-semibold text-stone-900">{formatDate(row.createdAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Người thực hiện</div>
                    <div className="mt-1 text-sm font-semibold text-stone-900 break-words">{actorName}</div>
                    {actorEmail ? <div className="mt-1 text-xs text-stone-500 break-words">{actorEmail}</div> : null}
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Hành động</div>
                    <div className="mt-1 text-sm font-semibold text-stone-900">
                      {displayActionTypeVi(String(row.actionType), row.entityType)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Đối tượng</div>
                    <div className="mt-1 text-sm font-semibold text-stone-900 break-words">{entityType}</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <h2 className="text-sm font-semibold text-stone-900">Giá trị mới</h2>
                    {newRows.length ? (
                      <dl className="mt-4 space-y-2">
                        {newRows.map((r, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-3">
                            <dt className="col-span-5 text-xs font-semibold text-stone-500 break-words">{r.key}</dt>
                            <dd className="col-span-7 text-sm text-stone-800 break-words">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <div className="mt-4 text-sm text-stone-500">Không có dữ liệu.</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <h2 className="text-sm font-semibold text-stone-900">Giá trị cũ</h2>
                    {oldRows.length ? (
                      <dl className="mt-4 space-y-2">
                        {oldRows.map((r, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-3">
                            <dt className="col-span-5 text-xs font-semibold text-stone-500 break-words">{r.key}</dt>
                            <dd className="col-span-7 text-sm text-stone-800 break-words">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <div className="mt-4 text-sm text-stone-500">Không có dữ liệu.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 text-sm text-stone-700">
                  <span className="font-semibold">Gợi ý:</span> Nếu dữ liệu quá dài, hệ thống sẽ tự rút gọn khi hiển thị.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
