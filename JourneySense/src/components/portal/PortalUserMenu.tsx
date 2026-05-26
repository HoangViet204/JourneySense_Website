import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { logout } from '../../actions/authActions'
import api from '../../api/axios'
import { PORTAL_PROFILE_CHANGED_EVENT } from '../../constants/portalEvents'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import type { PortalProfileResponse } from '../../types/portal'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'

function displayInitials(fullName: string | null | undefined, email: string | null | undefined) {
  const em = email?.trim() ?? ''
  const n = fullName?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    return n[0]!.toUpperCase()
  }
  const ch = em[0]
  return ch ? ch.toUpperCase() : '?'
}

type Props = {
  profilePath: '/admin/profile' | '/staff/profile'
}

export default function PortalUserMenu({ profilePath }: Props) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const email = useAppSelector((s) => s.auth.email)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [fullNameHint, setFullNameHint] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)

  const loadProfileBrief = useCallback(async () => {
    if (!email) return
    try {
      const { data } = await api.get<PortalProfileResponse>('/api/profile')
      setAvatarPath(data.avatarUrl?.trim() ? data.avatarUrl : null)
      setFullNameHint(data.fullName?.trim() ? data.fullName : null)
      setImgFailed(false)
    } catch {
      setAvatarPath(null)
      setFullNameHint(null)
    }
  }, [email])

  useEffect(() => {
    const onChanged = () => {
      void loadProfileBrief()
    }
    window.addEventListener(PORTAL_PROFILE_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PORTAL_PROFILE_CHANGED_EVENT, onChanged)
  }, [loadProfileBrief])

  const avatarSrc = avatarPath ? resolveApiMediaUrl(avatarPath) : ''

  const handleToggleOpen = () => {
    setOpen((v) => {
      const next = !v
      if (next) void loadProfileBrief()
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogout = () => {
    setOpen(false)
    dispatch(logout())
    toast.success('Đã đăng xuất')
    navigate('/login', { replace: true })
  }

  const showPhoto = Boolean(avatarSrc && !imgFailed)

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200/90 bg-white text-sm font-bold text-[#8f7349] shadow-sm ring-1 ring-stone-100 transition-colors hover:border-[#c5a070]/50 hover:bg-amber-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5a070]/40"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu tài khoản"
      >
        {showPhoto ? (
          <img
            src={avatarSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          displayInitials(fullNameHint, email)
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-[200] mt-2 w-52 overflow-hidden rounded-xl border border-stone-200/80 bg-white py-1 shadow-lg shadow-stone-900/10"
          role="menu"
        >
          <Link
            to={profilePath}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-800 transition-colors hover:bg-amber-50/80"
          >
            <svg className="h-4 w-4 shrink-0 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Hồ sơ
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
