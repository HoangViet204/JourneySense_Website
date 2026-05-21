import api from './axios'
import type { PortalPagedResult, ExperienceReportDetailDto, ExperienceReportListItemDto } from '../types/portal'

export async function listExperienceReports(params?: {
  page?: number
  pageSize?: number
}): Promise<PortalPagedResult<ExperienceReportListItemDto>> {
  const { data } = await api.get<PortalPagedResult<ExperienceReportListItemDto>>('/api/staff/experience-reports', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    },
  })
  return data
}

export async function getExperienceReport(reportId: string): Promise<ExperienceReportDetailDto> {
  const { data } = await api.get<ExperienceReportDetailDto>(
    `/api/staff/experience-reports/${encodeURIComponent(reportId)}`,
  )
  return data
}

export async function dismissExperienceReport(reportId: string): Promise<void> {
  await api.delete(`/api/staff/experience-reports/${encodeURIComponent(reportId)}`)
}
