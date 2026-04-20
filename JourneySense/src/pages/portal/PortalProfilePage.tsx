import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { PORTAL_PROFILE_CHANGED_EVENT } from '../../constants/portalEvents'
import type { PortalProfileResponse, PortalProfileUpdateRequest } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'

const shell =
  'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]'

function roleLabelVi(role: string) {
  const r = role?.toLowerCase()
  if (r === 'admin') return 'Quản trị'
  if (r === 'staff') return 'Nhân viên'
  if (r === 'traveler') return 'Du khách'
  return role
}

function displayInitials(fullName: string | null | undefined, email: string) {
  const n = fullName?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    return n[0]!.toUpperCase()
  }
  return email.trim()[0]?.toUpperCase() ?? '?'
}

export default function PortalProfilePage() {
  const location = useLocation()
  const isAdminArea = location.pathname.startsWith('/admin/')

  const [profile, setProfile] = useState<PortalProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('')

  const listPath = isAdminArea ? '/admin/dashboard' : '/staff'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<PortalProfileResponse>('/api/profile')
      setProfile(data)
      setFullName(data.fullName ?? '')
      setPhone(data.phone ?? '')
      setAvatarUrl(data.avatarUrl ?? '')
      setBio(data.bio ?? '')
      setAccessibilityNeeds(data.accessibilityNeeds ?? '')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được hồ sơ'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const body: PortalProfileUpdateRequest = {
        fullName: fullName.trim() === '' ? null : fullName.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
        avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        accessibilityNeeds: accessibilityNeeds.trim() === '' ? null : accessibilityNeeds.trim(),
      }
      await api.put('/api/profile', body)
      toast.success('Đã lưu hồ sơ')
      await load()
      window.dispatchEvent(new Event(PORTAL_PROFILE_CHANGED_EVENT))
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không lưu được hồ sơ'))
    } finally {
      setSaving(false)
    }
  }

  const avatarResolved = profile?.avatarUrl ? resolveApiMediaUrl(profile.avatarUrl) : ''

  return (
    <main className={shell}>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 lg:py-10">
        <Link
          to={listPath}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#9a7b4f] transition-colors hover:text-[#7d6540]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-stone-600 shadow-sm ring-1 ring-stone-200/80">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
          Bảng điều khiển
        </Link>

        <h1 className="mb-8 font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
          Hồ sơ của tôi
        </h1>

        {loading && (
          <div className="flex flex-col items-center py-20">
            <div className="h-12 w-12 animate-pulse rounded-full bg-stone-200/80" />
            <p className="mt-4 text-sm text-stone-500">Đang tải…</p>
          </div>
        )}

        {!loading && !profile && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
            Không tải được dữ liệu hồ sơ.
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-8">
            <header className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
                <div className="flex shrink-0 justify-center sm:justify-start">
                  {avatarResolved ? (
                    <img
                      src={avatarResolved}
                      alt=""
                      className="h-24 w-24 rounded-2xl border-2 border-white object-cover shadow-md ring-2 ring-stone-100"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c5a070] to-[#6b5438] text-2xl font-bold text-white shadow-lg">
                      {displayInitials(profile.fullName, profile.email)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#9a7b4f]">
                    {roleLabelVi(profile.role)}
                  </p>
                  <p className="mt-1 font-['Cormorant_Garamond',serif] text-xl font-semibold text-stone-900 sm:text-2xl">
                    {profile.fullName?.trim() || '—'}
                  </p>
                  <p className="mt-1 break-all text-sm text-stone-600">{profile.email}</p>
                </div>
              </div>
            </header>

            <section className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-6 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">
                Chỉnh sửa
              </h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="pf-name" className="mb-1.5 block text-xs font-semibold text-stone-600">
                    Họ và tên
                  </label>
                  <input
                    id="pf-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label htmlFor="pf-phone" className="mb-1.5 block text-xs font-semibold text-stone-600">
                    Số điện thoại
                  </label>
                  <input
                    id="pf-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    placeholder="0xxx…"
                  />
                </div>
                <div>
                  <label htmlFor="pf-avatar" className="mb-1.5 block text-xs font-semibold text-stone-600">
                    URL ảnh đại diện
                  </label>
                  <input
                    id="pf-avatar"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 font-mono text-sm focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    placeholder="/uploads/… hoặc https://…"
                  />
                </div>
                <div>
                  <label htmlFor="pf-bio" className="mb-1.5 block text-xs font-semibold text-stone-600">
                    Giới thiệu
                  </label>
                  <textarea
                    id="pf-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    placeholder="Một vài dòng về bạn…"
                  />
                </div>
                <div>
                  <label htmlFor="pf-a11y" className="mb-1.5 block text-xs font-semibold text-stone-600">
                    Nhu cầu hỗ trợ tiếp cận
                  </label>
                  <textarea
                    id="pf-a11y"
                    value={accessibilityNeeds}
                    onChange={(e) => setAccessibilityNeeds(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm focus:border-[#c5a070] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a070]/25"
                    placeholder="Tuỳ chọn"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded-xl bg-[#c5a070] px-8 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#b08f5f] disabled:opacity-50"
                >
                  {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
