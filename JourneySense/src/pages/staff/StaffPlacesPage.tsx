import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import { TIME_OF_DAY_OPTIONS } from '../../constants/microExperienceEnums'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { CategoryResponseDto, MicroExperienceListItemResponse } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'

interface StaffEmbeddingGenerateResponse {
  success: number
  failed: number
  errors: string[]
}

const PAGE_SIZE = 10

const initialApplied = {
  keyword: '',
  categoryId: '',
  status: '',
  mood: '',
  timeOfDay: '',
}

export default function StaffPlacesPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const [allItems, setAllItems] = useState<MicroExperienceListItemResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMood, setFilterMood] = useState('')
  const [filterTimeOfDay, setFilterTimeOfDay] = useState('')
  const [applied, setApplied] = useState(initialApplied)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [embedLoading, setEmbedLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const { confirm, dialog } = useConfirmDialog()

  const exportExcel = async () => {
    if (exportLoading) return
    setExportLoading(true)
    const t = toast.loading('Đang xuất Excel…')
    try {
      const res = await api.get('/api/staff/experiences/export', { responseType: 'blob' })
      const blob = new Blob([res.data as BlobPart], {
        type: res.headers['content-type'] ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Try to get filename from Content-Disposition header
      const disposition = res.headers['content-disposition'] as string | undefined
      const match = disposition?.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i)
      a.download = match?.[1] ? decodeURIComponent(match[1]) : `dia-diem-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Xuất Excel thành công', { id: t })
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không xuất được file Excel'), { id: t })
    } finally {
      setExportLoading(false)
    }
  }

  const runEmbeddings = async () => {
    if (embedLoading) return
    const ok = await confirm({
      title: 'Tạo embedding',
      message: 'Tạo embedding cho toàn bộ địa điểm?\n\nThao tác này có thể mất vài phút.',
      confirmText: 'Tạo',
      cancelText: 'Hủy',
    })
    if (!ok) return

    setEmbedLoading(true)
    const t = toast.loading('Đang tạo embedding…')
    try {
      const { data } = await api.post<StaffEmbeddingGenerateResponse>('/api/staff/embeddings/generate')
      toast.success(
        `Tạo embedding xong: ${data.success.toLocaleString('vi-VN')} thành công, ${data.failed.toLocaleString('vi-VN')} thất bại`,
        { id: t },
      )
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setEmbedLoading(false)
    }
  }

  useEffect(() => {
    void axios.get<CategoryResponseDto[]>(`${base}/api/categories`).then(({ data }) => {
      setCategories(Array.isArray(data) ? data : [])
    })
  }, [base])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<MicroExperienceListItemResponse[] | unknown>('/api/micro-experiences', {
        params: {
          keyword: applied.keyword || undefined,
          categoryId: applied.categoryId || undefined,
          status: applied.status || undefined,
          mood: applied.mood || undefined,
          timeOfDay: applied.timeOfDay || undefined,
        },
      })
      setAllItems(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Lỗi tải danh sách'))
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [applied])

  const totalCount = allItems.length
  const totalPagesComputed = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPagesComputed) setPage(totalPagesComputed)
  }, [page, totalPagesComputed])

  const totalPages = totalPagesComputed
  const displayedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return allItems.slice(start, start + PAGE_SIZE)
  }, [allItems, page])

  const deleteRow = async (id: string, name: string | null | undefined) => {
    const label = name?.trim() || id
    const ok = await confirm({
      title: 'Xóa trải nghiệm',
      message: `Xóa trải nghiệm «${label}»? Thao tác không hoàn tác.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

    setDeletingId(id)
    try {
      await api.delete(`/api/micro-experiences/${id}`)
      toast.success('Đã xóa trải nghiệm')
      setAllItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không xóa được'))
    } finally {
      setDeletingId(null)
    }
  }

  const iconBtn =
    'inline-flex items-center justify-center rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/80 backdrop-blur border-b border-stone-200/80">
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
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#c5a070] flex items-center justify-center text-white text-xs font-bold shrink-0">J</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate font-['Cormorant_Garamond',serif]">Journey Sense</p>
              <p className="text-xs text-stone-500 truncate">Nhân viên — Địa điểm</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={exportLoading}
            onClick={() => void exportExcel()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors shadow-sm"
          >
            <svg className={`w-4 h-4 shrink-0 ${exportLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {exportLoading ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
                </>
              )}
            </svg>
            {exportLoading ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
          <Link
            to="/staff/journeys/new"
            className="shrink-0 rounded-xl bg-[#c5a070] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b08f5f]"
          >
            + Tạo mới
          </Link>
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* Embedding */}
        <section className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Embedding</h2>
          <button
            type="button"
            disabled={embedLoading}
            onClick={() => void runEmbeddings()}
            className="rounded-xl bg-[#c5a070] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
          >
            {embedLoading ? 'Đang chạy…' : 'Tạo embedding'}
          </button>
        </section>

        {/* Filter */}
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Từ khóa (tên, địa điểm)…"
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setApplied({
                  keyword: keyword.trim(),
                  categoryId: filterCategoryId,
                  status: filterStatus,
                  mood: filterMood.trim(),
                  timeOfDay: filterTimeOfDay,
                })
                setPage(1)
              }}
              className="rounded-xl bg-[#c5a070] hover:bg-[#b08f5f] text-white text-sm font-semibold px-5 py-2.5 shrink-0"
            >
              Áp dụng lọc
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Danh mục</label>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Tất cả</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Tất cả</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Mood</label>
              <input
                value={filterMood}
                onChange={(e) => setFilterMood(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                placeholder="Tuỳ chọn"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">Khung giờ (timeOfDay)</label>
              <select
                value={filterTimeOfDay}
                onChange={(e) => setFilterTimeOfDay(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Tất cả</option>
                {TIME_OF_DAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px] table-fixed">
              <colgroup>
                <col className="min-w-0" />
                <col className="min-w-0 w-[28%]" />
                <col className="w-[20%]" />
                <col className="w-[148px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f0e8] text-left text-xs uppercase tracking-wide text-stone-600 font-semibold">
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Thành phố</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap align-middle">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                      Đang tải…
                    </td>
                  </tr>
                )}
                {!loading &&
                  displayedRows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                      <td className="px-4 py-3 font-semibold text-stone-900">{row.name ?? '—'}</td>
                      <td className="px-4 py-3 text-stone-600">{row.city ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">
                          {row.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap align-middle text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Link
                            to={`/staff/journeys/${row.id}`}
                            className={`${iconBtn} text-amber-800 hover:bg-amber-50`}
                            title="Chi tiết"
                            aria-label="Chi tiết"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            to={`/staff/journeys/${row.id}/edit`}
                            className={`${iconBtn} text-sky-700 hover:bg-sky-50`}
                            title="Sửa"
                            aria-label="Sửa"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.172l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => void deleteRow(row.id, row.name)}
                            className={`${iconBtn} text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none`}
                            title="Xóa"
                            aria-label="Xóa"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 border-t border-stone-100 bg-stone-50/50">
              <span className="text-sm text-stone-600">
                Trang {page} / {totalPages} · {totalCount} trải nghiệm
              </span>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white disabled:opacity-40 hover:bg-stone-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white disabled:opacity-40 hover:bg-stone-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
          {!loading && totalCount === 0 && (
            <p className="text-center text-stone-500 text-sm py-8">Chưa có dữ liệu hoặc chưa khớp bộ lọc.</p>
          )}
        </div>
      </main>
      {dialog}
    </div>
  )
}
