import api from './axios'
import type { PortalPagedResult, StaffJourneyAnomalyListItemDto, StaffJourneyListItemDto } from '../types/portal'

export type StaffJourneyStatusFilter = '' | string

export async function listStaffJourneys(params?: {
  status?: StaffJourneyStatusFilter
  page?: number
  pageSize?: number
}): Promise<PortalPagedResult<StaffJourneyListItemDto>> {
  const { data } = await api.get<PortalPagedResult<StaffJourneyListItemDto>>('/api/staff/journeys', {
    params: {
      status: params?.status || undefined,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    },
  })
  return data
}

/**
 * Backend currently returns a non-paginated anomaly list.
 * Be defensive: accept either `T[]` or `{ items: T[] }`.
 */
export async function listStaffJourneyAnomalies(): Promise<StaffJourneyAnomalyListItemDto[]> {
  const { data } = await api.get<StaffJourneyAnomalyListItemDto[] | { items?: StaffJourneyAnomalyListItemDto[] }>(
    '/api/staff/journeys/anomalies',
  )

  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
}
