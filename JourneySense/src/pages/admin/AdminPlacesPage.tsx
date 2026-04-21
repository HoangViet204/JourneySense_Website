import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import type {
  AdminEmbeddingGenerateResponse,
  CategoryResponseDto,
  MicroExperienceListItemResponse,
} from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { loadListUiState, patchListUiState } from '../../utils/listUiState'

const PAGE_SIZE = 10

const card =
  'rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'

function formatVi(n: number) {
  return n.toLocaleString('vi-VN')
}

const initialApplied = {
  keyword: '',
  categoryId: '',
  status: '',
}

export default function AdminPlacesPage() {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const location = useLocation()
  const listKey = location.pathname
  const scrollRef = useRef<HTMLElement | null>(null)
  const didRestoreScroll = useRef(false)
  const sawLoading = useRef(false)
  const didInit = useRef(false)

  const [allItems, setAllItems] = useState<MicroExperienceListItemResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [applied, setApplied] = useState(initialApplied)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [embedLoading, setEmbedLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (loading) sawLoading.current = true
  }, [loading])

  const { confirm, dialog } = useConfirmDialog()

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
        },
      })
      setAllItems(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách địa điểm'))
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    if (!hydrated) return
    void load()
  }, [hydrated, load])

  useEffect(() => {
    if (!hydrated) return
    if (!didInit.current) return
    setPage(1)
  }, [applied, hydrated])

  useEffect(() => {
    if (!hydrated) return
    didInit.current = true
  }, [hydrated])

  useEffect(() => {
    const saved = loadListUiState<{
      page?: number
      keyword?: string
      filterCategoryId?: string
      filterStatus?: string
      applied?: typeof initialApplied
      scrollTop?: number
    }>(listKey)

    if (typeof saved?.keyword === 'string') setKeyword(saved.keyword)
    if (typeof saved?.filterCategoryId === 'string') setFilterCategoryId(saved.filterCategoryId)
    if (typeof saved?.filterStatus === 'string') setFilterStatus(saved.filterStatus)

    if (saved?.applied && typeof saved.applied === 'object') {
      const a = saved.applied as Partial<typeof initialApplied>
      setApplied({
        keyword: typeof a.keyword === 'string' ? a.keyword : '',
        categoryId: typeof a.categoryId === 'string' ? a.categoryId : '',
        status: typeof a.status === 'string' ? a.status : '',
      })
    }

    if (typeof saved?.page === 'number' && Number.isFinite(saved.page) && saved.page >= 1) setPage(saved.page)
    setHydrated(true)
  }, [listKey])

  useEffect(() => {
    if (!hydrated) return
    patchListUiState(listKey, { page, keyword, filterCategoryId, filterStatus, applied })
  }, [applied, filterCategoryId, filterStatus, hydrated, keyword, listKey, page])

  useEffect(() => {
    return () => {
      const el = scrollRef.current
      patchListUiState(listKey, { page, keyword, filterCategoryId, filterStatus, applied, scrollTop: el?.scrollTop ?? 0 })
    }
  }, [applied, filterCategoryId, filterStatus, keyword, listKey, page])

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

  const totalCount = allItems.length
  const totalPagesComputed = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (!hydrated) return
    if (loading) return
    if (!sawLoading.current) return
    if (page > totalPagesComputed) setPage(totalPagesComputed)
  }, [hydrated, loading, page, totalPagesComputed])

  const totalPages = totalPagesComputed
  const displayedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return allItems.slice(start, start + PAGE_SIZE)
  }, [allItems, page])

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
      const { data } = await api.post<AdminEmbeddingGenerateResponse>('/api/admin/embeddings/generate')
      toast.success(`Tạo embedding xong: ${formatVi(data.success)} thành công, ${formatVi(data.failed)} thất bại`, {
        id: t,
      })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setEmbedLoading(false)
    }
  }

  const applyFilters = () => {
    setApplied({
      keyword: keyword.trim(),
      categoryId: filterCategoryId,
      status: filterStatus,
    })
    setPage(1)
  }

  return (
    <>
      <main
        ref={(n) => {
          scrollRef.current = n
        }}
        className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8"
      >
        <div className="mx-auto w-full max-w-6xl space-y-8">
        <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">Địa điểm</h1>

        <section className={card}>
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

        <section className={`${card} space-y-4`}>
          <h2 className="font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Lọc</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Từ khóa"
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={applyFilters}
              className="shrink-0 rounded-xl bg-[#c5a070] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b08f5f]"
            >
              Áp dụng
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-500">Danh mục</label>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
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
              <label className="mb-1 block text-xs font-semibold text-stone-500">Trạng thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Tất cả</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Không hoạt động</option>
              </select>
            </div>
          </div>
        </section>

        <section className={`${card} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full table-fixed text-sm">
              <colgroup>
                <col className="min-w-0" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f0e8] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Thành phố</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
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
                        <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-800">
                          {row.status === 'active' ? 'Hoạt động' : row.status === 'inactive' ? 'Không hoạt động' : (row.status ?? '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/places/${row.id}`}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-amber-800 transition-colors hover:bg-amber-50"
                          title="Chi tiết"
                          aria-label="Chi tiết"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.75}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.75}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && totalCount > 0 && (
            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-4 py-3 sm:flex-row sm:items-center">
              <span className="text-sm text-stone-600">
                Trang {page} / {totalPages} · {totalCount} địa điểm
              </span>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
          {!loading && totalCount === 0 && (
            <p className="py-10 text-center text-sm text-stone-500">Không có địa điểm phù hợp.</p>
          )}
        </section>
        </div>
      </main>
      {dialog}
    </>
  )
}
