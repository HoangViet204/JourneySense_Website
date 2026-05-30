import { useOutletContext, useParams } from 'react-router-dom'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import ExperienceReportDetailBody from '../portal/ExperienceReportDetailBody'

export default function StaffExperienceReportDetailPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const { reportId } = useParams<{ reportId: string }>()

  if (!reportId) return null

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
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-stone-800 truncate font-['Cormorant_Garamond',serif]">
                Chi tiết báo cáo
              </h1>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-[1000px] w-full mx-auto space-y-4">
        <ExperienceReportDetailBody
          reportId={reportId}
          backTo="/staff/experience-reports"
          experienceLink={(experienceId) => `/staff/journeys/${experienceId}`}
          canDismiss={true}
        />
      </main>
    </div>
  )
}
