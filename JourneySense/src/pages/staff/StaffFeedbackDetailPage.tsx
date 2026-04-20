import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { StaffFeedbackDetailDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'
import { moderationStatusBadgeClass, moderationStatusVi } from '../../utils/staffFeedbackLabels'

/**
 * Chỉ còn dùng khi phản hồi **không** gắn chuyến (`journeyId` null).
 * Có `journeyId` → chuyển sang `/staff/feedback/journey/:journeyId` (duyệt gom một chỗ).
 */
export default function StaffFeedbackDetailPage() {
  const { feedbackId } = useParams<{ feedbackId: string }>()
  const navigate = useNavigate()
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const [row, setRow] = useState<StaffFeedbackDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [busy, setBusy] = useState(false)

  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    if (!feedbackId) return
    setLoading(true)
    setError(null)
    let redirected = false
    try {
      const { data } = await api.get<StaffFeedbackDetailDto>(`/api/staff/feedbacks/${feedbackId}`)
      if (data.journeyId) {
        redirected = true
        navigate(`/staff/feedback/journey/${data.journeyId}`, {
          replace: true,
          state: { focusFeedbackId: feedbackId },
        })
        return
      }
      setRow(data)
    } catch (e) {
      const msg = getApiErrorMessage(e)
      setError(msg)
      toast.error(msg)
      setRow(null)
    } finally {
      if (!redirected) setLoading(false)
    }
  }, [feedbackId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const moderate = async (decision: 'approve' | 'reject') => {
    if (!feedbackId) return

    const actionText = decision === 'approve' ? 'Duyệt' : 'Từ chối'
    const ok = await confirm({
      title: `${actionText} phản hồi`,
      message: `Bạn có chắc muốn ${decision === 'approve' ? 'duyệt' : 'từ chối'} phản hồi này không?`,
      confirmText: actionText,
      cancelText: 'Hủy',
      danger: decision === 'reject',
    })
    if (!ok) return

    setBusy(true)
    const t = toast.loading(decision === 'approve' ? 'Đang duyệt…' : 'Đang từ chối…')
    try {
      await api.post(`/api/staff/feedbacks/${feedbackId}/moderate`, {
        decision,
        reason: reason.trim() || undefined,
      })
      toast.success(decision === 'approve' ? 'Đã duyệt phản hồi' : 'Đã từ chối phản hồi', { id: t })
      await load()
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusy(false)
    }
  }

  const reportUser = async () => {
    if (!row?.travelerId) return

    const ok = await confirm({
      title: 'Gửi báo cáo',
      message: 'Gửi báo cáo người dùng này?',
      confirmText: 'Gửi báo cáo',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

    setBusy(true)
    const t = toast.loading('Đang gửi báo cáo…')
    try {
      await api.post(`/api/staff/reports/users/${row.travelerId}`, {
        reason: reportReason.trim() || 'Vi phạm / spam',
        relatedFeedbackId: row.id,
      })
      toast.success('Đã gửi báo cáo người dùng', { id: t })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusy(false)
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
            <h1 className="text-sm sm:text-base font-semibold text-stone-800 truncate font-['Cormorant_Garamond',serif]">
              Chi tiết phản hồi (không gắn chuyến)
            </h1>
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
        {error && !loading && (
          <p className="text-red-700 text-sm rounded-xl bg-red-50 border border-red-100 px-4 py-3">{error}</p>
        )}
        {row && (
          <>
            <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-1">
                <p>
                  <span className="text-stone-500 text-xs font-semibold uppercase tracking-wide">Trải nghiệm</span>
                  <br />
                  <span className="font-semibold text-stone-900 text-base">{row.experienceName ?? row.experienceId}</span>
                </p>
                <p>
                  <span className="text-stone-500 text-xs font-semibold uppercase tracking-wide">Du khách</span>
                  <br />
                  <span className="font-medium text-stone-800">{row.travelerEmail ?? row.travelerId}</span>
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-stone-500 text-xs font-semibold uppercase tracking-wide">Trạng thái duyệt</span>
                  <span className={moderationStatusBadgeClass(row.moderationStatus)}>{moderationStatusVi(row.moderationStatus)}</span>
                </p>
                <p className="text-xs text-stone-500">
                  <span className="font-semibold text-stone-600">Tạo lúc:</span> {formatDate(row.createdAt)}
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100">
                <p className="text-stone-500 text-[11px] uppercase font-bold tracking-wide mb-2">Nội dung</p>
                <p className="text-stone-800 leading-relaxed whitespace-pre-wrap">{row.feedbackText}</p>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5 sm:p-6 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">Duyệt phản hồi</h2>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Ghi chú hoặc lý do (tuỳ chọn; nên điền khi từ chối)"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/35"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void moderate('approve')}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50 shadow-sm"
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void moderate('reject')}
                  className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5 sm:p-6 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">Báo cáo du khách</h2>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={2}
                placeholder="Lý do báo cáo (spam, vi phạm…) — có thể để trống để dùng lý do mặc định"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c5a070]/35"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void reportUser()}
                className="rounded-xl bg-[#c5a070] hover:bg-[#b08f5f] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50 shadow-sm transition-colors"
              >
                Gửi báo cáo
              </button>
            </section>

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
