import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryPage } from '../../hooks/useQueryPage'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { ExperienceReportListItemDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayStatus } from '../../utils/format'
import { dismissExperienceReport, listExperienceReports } from '../../api/experienceReports'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import { displayExperienceReportReasonVi } from '../../utils/experienceReportReasons'

const PAGE_SIZE = 5

function statusBadgeClass(status?: string | null) {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'active') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (s === 'suspended' || s === 'inactive') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
  return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200'
}

function reporterText(row: ExperienceReportListItemDto): string {
  const name = (row.reporterFullName ?? '').trim()
  if (name) return name
  const email = (row.reporterEmail ?? '').trim()
  if (email) return email
  return 'Ẩn danh'
}

export default function ExperienceReportsListBody(props: { basePath: string; canDismiss?: boolean }) {
  const { basePath, canDismiss = true } = props
  const [page, setPage] = useQueryPage(1, 'page')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ totalCount: number; items: ExperienceReportListItemDto[] } | null>(null)

  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listExperienceReports({ page, pageSize: PAGE_SIZE })
      setResult({ totalCount: data.totalCount ?? 0, items: data.items ?? [] })
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách report.'))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const items = result?.items ?? []
  const totalCount = result?.totalCount ?? 0
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages, setPage])

  const dismiss = async (row: ExperienceReportListItemDto) => {
    const ok = await confirm({
      title: 'Bỏ qua báo cáo',
      message: `Bạn có chắc muốn bỏ qua báo cáo này không?\n\nĐịa điểm: ${row.experienceName}`,
      confirmText: 'Bỏ qua',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return
    const t = toast.loading('Đang bỏ qua…')
    try {
      await dismissExperienceReport(row.reportId)
      toast.success('Đã bỏ qua báo cáo', { id: t })
      setResult((prev) => {
        if (!prev) return prev
        const nextItems = prev.items.filter((x) => x.reportId !== row.reportId)
        return { ...prev, totalCount: Math.max(0, prev.totalCount - 1), items: nextItems }
      })
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không thể bỏ qua báo cáo.'), { id: t })
    }
  }

  const pagerBtn =
    'px-3.5 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 font-medium shadow-sm hover:bg-stone-50 hover:border-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors'

  return (
    <>
      {dialog}

      <section className="rounded-2xl bg-white border border-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-stone-100 bg-white px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-stone-600">
            {loading
              ? 'Đang tải…'
              : totalCount > 0
                ? `Tìm thấy ${totalCount} report chưa xử lý`
                : 'Chưa có report nào'}
          </div>
          {!loading && totalCount > 0 && (
            <div className="text-sm text-stone-600">
              Trang <span className="font-semibold text-stone-900">{page}</span> / {totalPages}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <colgroup>
              <col className="min-w-0" />
              <col className="w-[150px]" />
              <col className="min-w-0" />
              <col className="w-[280px]" />
              <col className="w-[210px]" />
            </colgroup>
            <thead>
              <tr className="bg-[#f5f0e8]/90 text-[11px] uppercase tracking-wider text-stone-600 font-semibold border-b border-stone-100">
                <th className="px-4 py-3.5 text-left align-middle whitespace-nowrap">Địa điểm</th>
                <th className="px-4 py-3.5 text-left align-middle whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3.5 text-left align-middle whitespace-nowrap">Lý do</th>
                <th className="px-4 py-3.5 text-left align-middle whitespace-nowrap">Người báo cáo</th>
                <th className="px-4 py-3.5 text-center align-middle whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-stone-500 text-sm">
                    Đang tải dữ liệu…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-stone-500 text-sm">
                    Không có report nào.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row) => (
                  <tr key={row.reportId} className="hover:bg-stone-50/70">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="font-semibold text-stone-900 truncate">{row.experienceName || '—'}</div>
                      {row.experienceSlug ? (
                        <div className="text-xs text-stone-400 truncate">{row.experienceSlug.replace(/^\/+/, '')}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(row.experienceStatus)}`}>
                        {displayStatus(row.experienceStatus ?? '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {Array.isArray(row.reasons) && row.reasons.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {row.reasons.map((r) => (
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
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="text-sm text-stone-800 truncate">{reporterText(row)}</div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`${basePath}/${row.reportId}`}
                          className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold shadow-sm hover:bg-stone-50"
                        >
                          Xem
                        </Link>
                        {canDismiss ? (
                          <button
                            type="button"
                            onClick={() => void dismiss(row)}
                            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold shadow-sm hover:bg-rose-100"
                          >
                            Bỏ qua
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-stone-100 bg-white">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(1)} disabled={page <= 1} className={pagerBtn}>
                «
              </button>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={pagerBtn}>
                Trước
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={pagerBtn}
              >
                Sau
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className={pagerBtn}
              >
                »
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
