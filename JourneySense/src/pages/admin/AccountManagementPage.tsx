import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import { fetchAdminUsers } from '../../actions/adminUserActions'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayRole, displayStatus, formatDate } from '../../utils/format'
import { loadListUiState, patchListUiState } from '../../utils/listUiState'

function roleBadgeClass(role: string) {
  const r = role?.toLowerCase()
  if (r === 'traveler') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/70'
  if (r === 'staff') return 'bg-violet-50 text-violet-800 ring-1 ring-violet-200/70'
  if (r === 'admin') return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/70'
  return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200/70'
}

function statusBadgeClass(status: string) {
  return status?.toLowerCase() === 'active'
    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70'
    : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/70'
}

const PAGE_SIZE = 10

const shell =
  'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8'

const card =
  'rounded-2xl border border-stone-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]'

export default function AccountManagementPage() {
  const location = useLocation()
  const listKey = location.pathname
  const scrollRef = useRef<HTMLElement | null>(null)
  const didRestoreScroll = useRef(false)
  const sawLoading = useRef(false)

  const dispatch = useAppDispatch()
  const { items, loading, totalCount } = useAppSelector((s) => s.adminUsers)

  const [activeTab, setActiveTab] = useState<'users' | 'staff'>('users')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [listPage, setListPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState<'all' | 'traveler' | 'staff' | 'admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (loading) sawLoading.current = true
  }, [loading])

  useEffect(() => {
    const saved = loadListUiState<{
      activeTab?: 'users' | 'staff'
      searchInput?: string
      appliedSearch?: string
      listPage?: number
      roleFilter?: 'all' | 'traveler' | 'staff' | 'admin'
      statusFilter?: 'all' | 'active' | 'suspended'
      scrollTop?: number
    }>(listKey)

    if (saved?.activeTab === 'users' || saved?.activeTab === 'staff') setActiveTab(saved.activeTab)
    if (typeof saved?.searchInput === 'string') setSearchInput(saved.searchInput)
    if (typeof saved?.appliedSearch === 'string') setAppliedSearch(saved.appliedSearch)
    if (typeof saved?.roleFilter === 'string') setRoleFilter(saved.roleFilter)
    if (typeof saved?.statusFilter === 'string') setStatusFilter(saved.statusFilter)
    if (typeof saved?.listPage === 'number' && Number.isFinite(saved.listPage) && saved.listPage >= 1) setListPage(saved.listPage)

    setHydrated(true)
  }, [listKey])

  const [staffEmail, setStaffEmail] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffBusy, setStaffBusy] = useState(false)

  const { confirm, dialog } = useConfirmDialog()

  const apiRole = roleFilter === 'all' ? undefined : roleFilter
  const apiStatus = statusFilter === 'all' ? undefined : statusFilter

  useEffect(() => {
    if (!hydrated) return
    if (activeTab !== 'users') return
    void dispatch(
      fetchAdminUsers({
        page: listPage,
        pageSize: PAGE_SIZE,
        search: appliedSearch || undefined,
        role: apiRole,
        status: apiStatus,
      }),
    )
  }, [dispatch, activeTab, hydrated, listPage, appliedSearch, apiRole, apiStatus])

  useEffect(() => {
    if (!hydrated) return
    patchListUiState(listKey, { activeTab, searchInput, appliedSearch, listPage, roleFilter, statusFilter })
  }, [activeTab, appliedSearch, hydrated, listKey, listPage, roleFilter, searchInput, statusFilter])

  useEffect(() => {
    return () => {
      const el = scrollRef.current
      patchListUiState(listKey, { activeTab, searchInput, appliedSearch, listPage, roleFilter, statusFilter, scrollTop: el?.scrollTop ?? 0 })
    }
  }, [activeTab, appliedSearch, listKey, listPage, roleFilter, searchInput, statusFilter])

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))


  const createStaff = async () => {
    const email = staffEmail.trim()
    if (!email) return
    if (!email.endsWith('@journeysense.com')) {
      toast.error('Email nhân viên phải có định dạng @journeysense.com')
      return
    }

    const ok = await confirm({
      title: 'Tạo tài khoản nhân viên',
      message: `Tạo tài khoản nhân viên cho «${email}»?`,
      confirmText: 'Tạo',
      cancelText: 'Hủy',
    })
    if (!ok) return

    setStaffBusy(true)
    try {
      await api.post('/api/admin/staff-accounts', { email, password: staffPassword })
      toast.success('Đã tạo tài khoản nhân viên')
      setStaffEmail('')
      setStaffPassword('')
      void dispatch(fetchAdminUsers({ page: 1, pageSize: PAGE_SIZE, role: 'staff' }))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Lỗi'))
    } finally {
      setStaffBusy(false)
    }
  }

  return (
    <>
      <main
        ref={(n) => {
          scrollRef.current = n
        }}
        className={shell}
      >
        <div className="mx-auto w-full max-w-6xl space-y-8">
        <header>
          <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
            Tài khoản
          </h1>
        </header>

        <div className={`inline-flex rounded-2xl border border-stone-200/80 bg-stone-100/80 p-1.5 shadow-inner`}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Danh sách
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === 'staff'
                ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Tạo nhân viên
          </button>
        </div>

        {activeTab === 'staff' ? (
          <div className="mx-auto max-w-lg">
            <div className={`${card} overflow-hidden`}>
              <div className="h-1.5 bg-gradient-to-r from-[#c5a070] via-[#b08f5f] to-[#8f7349]" />
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c5a070] to-[#8f7349] text-white shadow-lg shadow-amber-900/15">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-['Cormorant_Garamond',serif] text-xl font-semibold text-stone-900">
                      Tài khoản nhân viên mới
                    </h2>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="staff-email" className="mb-1.5 block text-xs font-semibold text-stone-600">
                      Email đăng nhập
                    </label>
                    <input
                      id="staff-email"
                      type="email"
                      autoComplete="off"
                      placeholder="ten@congty.com"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-pass" className="mb-1.5 block text-xs font-semibold text-stone-600">
                      Mật khẩu
                    </label>
                    <input
                      id="staff-pass"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={staffBusy || !staffEmail || staffPassword.length < 8}
                    onClick={() => void createStaff()}
                    className="w-full rounded-xl bg-[#c5a070] py-3.5 text-sm font-semibold text-white shadow-md shadow-amber-900/10 transition-colors hover:bg-[#b08f5f] disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-10"
                  >
                    {staffBusy ? 'Đang tạo…' : 'Tạo tài khoản'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className={`${card} p-4 sm:p-6`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="acc-search" className="sr-only">
                    Tìm kiếm
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </span>
                    <input
                      id="acc-search"
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setListPage(1)
                          setAppliedSearch(searchInput.trim())
                        }
                      }}
                      placeholder="Email hoặc số điện thoại"
                      className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm focus:border-[#c5a070] focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,11rem)_minmax(0,11rem)_auto] xl:shrink-0">
                  <div>
                    <label htmlFor="acc-role" className="mb-1 block text-[11px] font-semibold text-stone-500">
                      Vai trò
                    </label>
                    <select
                      id="acc-role"
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value as typeof roleFilter)
                        setListPage(1)
                      }}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm focus:border-[#c5a070] focus:outline-none focus:ring-2 focus:ring-[#c5a070]/20"
                    >
                      <option value="all">Tất cả</option>
                      <option value="traveler">Du khách</option>
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản trị</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="acc-status" className="mb-1 block text-[11px] font-semibold text-stone-500">
                      Trạng thái
                    </label>
                    <select
                      id="acc-status"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as typeof statusFilter)
                        setListPage(1)
                      }}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm focus:border-[#c5a070] focus:outline-none focus:ring-2 focus:ring-[#c5a070]/20"
                    >
                      <option value="all">Tất cả</option>
                      <option value="active">Hoạt động</option>
                      <option value="suspended">Đã đình chỉ</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setListPage(1)
                        setAppliedSearch(searchInput.trim())
                      }}
                      className="w-full rounded-xl bg-stone-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-900 sm:w-auto"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${card} overflow-hidden p-0`}>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="bg-[#f5f0e8] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                      <th className="px-4 py-3.5">Email</th>
                      <th className="px-4 py-3.5">Điện thoại</th>
                      <th className="px-4 py-3.5">Vai trò</th>
                      <th className="px-4 py-3.5">Trạng thái</th>
                      <th className="px-4 py-3.5">Ngày tạo</th>
                      <th className="px-4 py-3.5 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-stone-500">
                          Đang tải…
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      items.map((row, i) => (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'
                          } hover:bg-amber-50/40`}
                        >
                          <td className="px-4 py-3.5 font-semibold text-stone-900">{row.email}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-stone-600">{row.phone ?? '—'}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(row.role)}`}
                            >
                              {displayRole(row.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                            >
                              {displayStatus(row.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-stone-600">{formatDate(row.createdAt)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <Link
                              to={`/admin/accounts/${row.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#9a7b4f] ring-1 ring-stone-200/80 transition-colors hover:bg-amber-50 hover:text-[#7d6540]"
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-4 py-3.5 sm:flex-row">
                <p className="text-sm text-stone-600">
                  Trang <span className="font-semibold text-stone-800">{listPage}</span> / {totalPages} ·{' '}
                  <span className="font-semibold text-stone-800">{totalCount}</span> tài khoản
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={listPage <= 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={listPage >= totalPages}
                    onClick={() => setListPage((p) => p + 1)}
                    className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
        </div>
      </main>
      {dialog}
    </>
  )
}
