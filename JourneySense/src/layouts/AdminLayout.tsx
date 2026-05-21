import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import PortalUserMenu from '../components/portal/PortalUserMenu'
import api from '../api/axios'
import { PORTAL_PROFILE_CHANGED_EVENT } from '../constants/portalEvents'
import { useAppSelector } from '../store/hooks'
import type { PortalProfileResponse } from '../types/portal'

const nav: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/admin/dashboard',
    label: 'Bảng điều khiển',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    to: '/admin/journeys',
    label: 'Hành trình',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 19a2 2 0 100-4 2 2 0 000 4zm12-10a2 2 0 100-4 2 2 0 000 4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 17h5a5 5 0 005-5V7" />
      </svg>
    ),
  },
  {
    to: '/admin/places',
    label: 'Địa điểm',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/experience-reports',
    label: 'Báo cáo địa điểm',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
  },
  {
    to: '/admin/accounts',
    label: 'Tài khoản',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/audit',
    label: 'Nhật ký hệ thống',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/admin/transactions',
    label: 'Lịch sử giao dịch',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a5 5 0 00-10 0v2" />
        <rect width="20" height="14" x="2" y="9" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 13h.01M8 13h.01" />
      </svg>
    ),
  },
  {
    to: '/admin/packages',
    label: 'Gói dịch vụ',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
]

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { email, role } = useAppSelector((s) => s.auth)

  const [fullNameHint, setFullNameHint] = useState<string | null>(null)

  const loadProfileBrief = useCallback(async () => {
    if (!email) return
    try {
      const { data } = await api.get<PortalProfileResponse>('/api/profile')
      setFullNameHint(data.fullName?.trim() ? data.fullName : null)
    } catch {
      setFullNameHint(null)
    }
  }, [email])

  useEffect(() => {
    void loadProfileBrief()
  }, [loadProfileBrief])

  useEffect(() => {
    const onChanged = () => {
      void loadProfileBrief()
    }
    window.addEventListener(PORTAL_PROFILE_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PORTAL_PROFILE_CHANGED_EVENT, onChanged)
  }, [loadProfileBrief])

  const displayName = fullNameHint?.trim() || email?.trim() || ''

  const roleLabelVi =
    role === 'admin' ? 'Quản trị viên' : role === 'staff' ? 'Nhân viên' : role === 'traveler' ? 'Du khách' : role

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-['Lato',system-ui,sans-serif] text-stone-800">
      <aside
        className={`shrink-0 border-r border-stone-200/80 bg-white/80 backdrop-blur-sm flex flex-col transition-[width] duration-300 ease-out ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'
        }`}
      >
        <div className={`flex items-center gap-2 px-3 py-4 border-b border-stone-100 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center shadow-sm shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-wide text-stone-700 truncate">Journey Sense</span>
          )}
        </div>

        <p className={`px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 ${sidebarCollapsed ? 'sr-only' : ''}`}>
          Quản trị
        </p>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                } ${sidebarCollapsed ? 'justify-center px-2' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-amber-600' : 'text-stone-500'}>{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-stone-100 space-y-1">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Mở sidebar' : 'Thu sidebar'}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19v-14" />
              )}
            </svg>
            {!sidebarCollapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-white/70 backdrop-blur-sm border-b border-stone-200/80">
          <div className="min-w-0 text-sm text-stone-600">
            <span className="font-medium text-stone-800">{displayName}</span>
            {role ? <span className="ml-2 text-stone-600">({roleLabelVi})</span> : null}
          </div>
          <PortalUserMenu profilePath="/admin/profile" />
        </header>
        <Outlet />
      </div>
    </div>
  )
}
