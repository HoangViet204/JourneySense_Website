import { useParams } from 'react-router-dom'
import ExperienceReportDetailBody from '../portal/ExperienceReportDetailBody'

export default function AdminExperienceReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>()
  if (!reportId) return null

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1000px] space-y-4">
        <ExperienceReportDetailBody
          reportId={reportId}
          backTo="/admin/experience-reports"
          experienceLink={(experienceId) => `/admin/places/${experienceId}`}
          userLink={(userId) => `/admin/accounts/${userId}`}
        />
      </div>
    </main>
  )
}
