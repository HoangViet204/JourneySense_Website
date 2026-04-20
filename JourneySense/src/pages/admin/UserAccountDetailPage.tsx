import axios from 'axios'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import type { AdminUserDetailDto, PortalProfileResponse } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { normalizeAdminUserDetailPayload } from '../../utils/adminUserDetail'
import { displayRole, displayStatus, formatDate } from '../../utils/format'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'
import { useAppSelector } from '../../store/hooks'

const shell = 'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]'

function displayInitials(fullName: string | null | undefined, email: string) {
  const n = fullName?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    return n[0]!.toUpperCase()
  }
  const ch = email.trim()[0]
  return ch ? ch.toUpperCase() : '?'
}

function rolePill(role: string) {
  const r = role?.toLowerCase()
  if (r === 'traveler') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80'
  if (r === 'staff') return 'bg-violet-50 text-violet-800 ring-1 ring-violet-200/80'
  return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
}

function statusPill(status: string) {
  return status?.toLowerCase() === 'active'
    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
    : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80'
}

function yesNo(v: boolean | null | undefined) {
  if (v == null) return '—'
  return v ? 'Có' : 'Chưa'
}

function InfoTile({
  label,
  children,
  accent = 'amber',
}: {
  label: string
  children: ReactNode
  accent?: 'amber' | 'stone' | 'sky'
}) {
  const bar =
    accent === 'sky'
      ? 'bg-sky-400'
      : accent === 'stone'
        ? 'bg-stone-400'
        : 'bg-[#c5a070]'
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white/90 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar} opacity-90`} aria-hidden />
      <p className="pl-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <div className="mt-1.5 pl-2 text-sm font-medium text-stone-900">{children}</div>
    </div>
  )
}

export default function UserAccountDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const authUserId = useAppSelector((s) => s.auth.userId)
  const [account, setAccount] = useState<AdminUserDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const { data: raw } = await api.get<unknown>(`/api/admin/users/${userId}`)
      let next = normalizeAdminUserDetailPayload(raw)

      if (authUserId && userId.toLowerCase() === authUserId.toLowerCase()) {
        try {
          const { data: prof } = await api.get<PortalProfileResponse>('/api/profile')
          next = {
            ...next,
            fullName: prof.fullName?.trim() || next.fullName,
            avatarUrl: prof.avatarUrl?.trim() || next.avatarUrl,
            bio: prof.bio?.trim() || next.bio,
          }
        } catch {
          /* chỉ dùng admin user */
        }
      }

      setAccount(next)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setAccount(null)
      } else {
        const msg = getApiErrorMessage(e)
        setError(msg)
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [userId, authUserId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAvatarBroken(false)
  }, [account?.id, account?.avatarUrl])

  if (!userId) return <Navigate to="/admin/accounts" replace />

  const patchStatus = async (status: 'active' | 'suspended') => {
    if (!userId) return

    const label = account?.fullName?.trim() || account?.email?.trim() || userId
    const actionText = status === 'suspended' ? 'Đình chỉ' : 'Kích hoạt lại'
    const note = status === 'suspended' ? 'Tài khoản sẽ không thể đăng nhập cho đến khi được kích hoạt lại.' : ''

    const ok = await confirm({
      title: `${actionText} tài khoản`,
      message: `Bạn có chắc muốn ${status === 'suspended' ? 'đình chỉ' : 'kích hoạt lại'} tài khoản «${label}» không?${note ? `\n\n${note}` : ''}`,
      confirmText: actionText,
      cancelText: 'Hủy',
      danger: status === 'suspended',
    })
    if (!ok) return

    setBusy(true)
    try {
      await api.patch(`/api/admin/users/${userId}/status`, {
        status,
        reason: status === 'suspended' ? 'Cập nhật từ portal admin' : undefined,
      })
      toast.success(status === 'suspended' ? 'Đã đình chỉ tài khoản' : 'Đã kích hoạt lại tài khoản')
      await load()
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className={shell}>
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 sm:px-8">
          <div className="h-12 w-12 animate-pulse rounded-full bg-stone-200/80" />
          <p className="mt-6 text-sm text-stone-500">Đang tải hồ sơ…</p>
        </div>
      </main>
    )
  }

  if (error || !account) {
    return (
      <main className={shell}>
        <div className="mx-auto max-w-lg px-4 py-16 sm:px-8">
          <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-stone-800">{error ?? 'Không tìm thấy tài khoản.'}</p>
            <Link
              to="/admin/accounts"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#c5a070] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f]"
            >
              Quay lại danh sách
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const displayName = account.fullName?.trim() || null
  const avatarSrc = account.avatarUrl?.trim() ? resolveApiMediaUrl(account.avatarUrl) : ''
  const showAvatar = Boolean(avatarSrc && !avatarBroken)

  return (
    <main className={shell}>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 lg:py-10">
        <Link
          to="/admin/accounts"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#9a7b4f] transition-colors hover:text-[#7d6540]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-stone-600 shadow-sm ring-1 ring-stone-200/80">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
          Danh sách tài khoản
        </Link>

        <header className="relative mb-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c5a070]/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#c5a070] to-[#8f7349] text-2xl font-bold text-white shadow-lg shadow-amber-900/20 sm:h-28 sm:w-28">
              {showAvatar ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                displayInitials(account.fullName, account.email)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-['Cormorant_Garamond',serif] text-xs font-semibold uppercase tracking-widest text-[#9a7b4f]">
                Hồ sơ người dùng
              </p>
              <h1 className="mt-1 break-words font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
                {displayName || account.email}
              </h1>
              {displayName && (
                <p className="mt-1 break-all text-sm text-stone-600">{account.email}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full px-3.5 py-1 text-xs font-semibold ${rolePill(account.role)}`}>
                  {displayRole(account.role)}
                </span>
                <span className={`inline-flex rounded-full px-3.5 py-1 text-xs font-semibold ${statusPill(account.status)}`}>
                  {displayStatus(account.status)}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={`/admin/accounts/${userId}/transactions`}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#9a7b4f] shadow-sm ring-1 ring-stone-200/80 transition-colors hover:bg-stone-50"
                >
                  Lịch sử giao dịch
                </Link>
              </div>
            </div>
          </div>
        </header>

        {account.bio?.trim() && (
          <section className="mb-8 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] sm:p-8">
            <h2 className="mb-3 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Giới thiệu</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{account.bio.trim()}</p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">
            Thông tin liên hệ
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile label="Email">{account.email}</InfoTile>
            <InfoTile label="Điện thoại" accent="sky">
              {account.phone?.trim() ? account.phone : '—'}
            </InfoTile>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">
            Xác minh và lịch sử
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile label="Email đã xác minh" accent="stone">
              {yesNo(account.emailVerified)}
            </InfoTile>
            <InfoTile label="Số điện thoại đã xác minh" accent="stone">
              {yesNo(account.phoneVerified)}
            </InfoTile>
            <InfoTile label="Ngày tạo">{formatDate(account.createdAt)}</InfoTile>
            <InfoTile label="Đăng nhập gần nhất" accent="sky">
              {formatDate(account.lastLoginAt)}
            </InfoTile>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] sm:p-8">
          <h2 className="mb-5 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Thao tác</h2>
          <div className="flex flex-wrap gap-3">
            {account.status?.toLowerCase() === 'active' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void patchStatus('suspended')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800 shadow-sm transition-colors hover:bg-rose-100 disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Đình chỉ tài khoản
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void patchStatus('active')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Kích hoạt lại
              </button>
            )}
          </div>
        </section>
      </div>
      {dialog}
    </main>
  )
}
