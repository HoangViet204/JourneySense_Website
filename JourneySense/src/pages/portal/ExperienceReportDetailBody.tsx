import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ExperienceReportDetailDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'
import { displayExperienceReportReasonVi, hasOtherReason } from '../../utils/experienceReportReasons'
import { dismissExperienceReport, getExperienceReport } from '../../api/experienceReports'
import { useConfirmDialog } from '../../components/ConfirmDialog'

function DlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-stone-100 last:border-0">
      <dt className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-stone-900 break-words">{children}</dd>
    </div>
  )
}

function reporterLine(d?: ExperienceReportDetailDto | null) {
  const name = (d?.reporterFullName ?? '').trim()
  const email = (d?.reporterEmail ?? '').trim()
  if (name && email) return `${name} · ${email}`
  if (name) return name
  if (email) return email
  return 'Ẩn danh'
}

export default function ExperienceReportDetailBody(props: {
  reportId: string
  backTo: string
  experienceLink: (experienceId: string) => string
  userLink?: (userId: string) => string
  canDismiss?: boolean
}) {
  const { reportId, backTo, experienceLink, userLink, canDismiss = true } = props
  const [detail, setDetail] = useState<ExperienceReportDetailDto | null>(null)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    try {
      const data = await getExperienceReport(reportId)
      setDetail(data)
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không tải được chi tiết report.')
      toast.error(msg)
      setDetail(null)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  const reasons = detail?.reasons ?? null
  const otherVisible = hasOtherReason(reasons)

  const dismiss = async () => {
    const ok = await confirm({
      title: 'Bỏ qua báo cáo',
      message: 'Bạn có chắc muốn bỏ qua báo cáo này không?',
      confirmText: 'Bỏ qua',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

      const t = toast.loading('Đang bỏ qua…')
    try {
      await dismissExperienceReport(reportId)
      toast.success('Đã bỏ qua báo cáo', { id: t })
      navigate(backTo)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không thể bỏ qua báo cáo.'), { id: t })
    }
  }

  const experienceId = detail?.experienceId
  const reporterUserId = detail?.reporterUserId

  return (
    <>
      {dialog}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-stone-900 font-['Cormorant_Garamond',serif] truncate">
            Chi tiết báo cáo địa điểm
          </h1>
          <p className="text-xs text-stone-500 truncate">{detail?.experienceName || '—'}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Link
            to={backTo}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold shadow-sm hover:bg-stone-50"
          >
            Quay lại
          </Link>
          {experienceId ? (
            <Link
              to={experienceLink(experienceId)}
              className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold shadow-sm hover:bg-stone-50"
            >
              Mở địa điểm
            </Link>
          ) : null}
          {userLink && reporterUserId ? (
            <Link
              to={userLink(reporterUserId)}
              className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold shadow-sm hover:bg-stone-50"
            >
              Mở người dùng
            </Link>
          ) : null}
          {canDismiss ? (
            <button
              type="button"
              onClick={() => void dismiss()}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold shadow-sm hover:bg-rose-100"
            >
              Bỏ qua
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100 bg-white">
        </div>
        <dl className="px-4 sm:px-6 py-2">
          <DlRow label="Địa điểm">{detail?.experienceName || '—'}</DlRow>
          <DlRow label="Trạng thái">{detail?.experienceStatus || '—'}</DlRow>
          <DlRow label="Người báo cáo">{reporterLine(detail)}</DlRow>
          <DlRow label="Lý do">
            {Array.isArray(reasons) && reasons.length ? (
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200"
                  >
                    {displayExperienceReportReasonVi(r)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-stone-400">—</span>
            )}
          </DlRow>
          {otherVisible ? <DlRow label="Nội dung khác">{detail?.otherText?.trim() ? detail.otherText : '—'}</DlRow> : null}
          <DlRow label="Ngày tạo">{detail?.createdAt ? formatDate(detail.createdAt) : '—'}</DlRow>
        </dl>
      </section>
    </>
  )
}
