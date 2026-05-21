import ExperienceReportsListBody from '../portal/ExperienceReportsListBody'

export default function AdminExperienceReportsPage() {
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <div>
          <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">Báo cáo địa điểm</h1>
          <p className="mt-1 text-sm text-stone-600">Danh sách report chưa dismiss (soft delete).</p>
        </div>
        <ExperienceReportsListBody basePath="/admin/experience-reports" />
      </div>
    </main>
  )
}
