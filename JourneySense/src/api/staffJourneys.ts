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
 * GET `/api/staff/journeys/anomalies` (paginated).
 * Be defensive: accept older response shapes and normalize.
 */
export async function listStaffJourneyAnomalies(params?: {
  page?: number
  pageSize?: number
}): Promise<PortalPagedResult<StaffJourneyAnomalyListItemDto>> {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10

  const { data } = await api.get<
    | PortalPagedResult<StaffJourneyAnomalyListItemDto>
    | StaffJourneyAnomalyListItemDto[]
    | { items?: StaffJourneyAnomalyListItemDto[] }
  >('/api/staff/journeys/anomalies', {
    params: {
      page,
      pageSize,
    },
  })

  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown }).items)) {
    const d = data as Partial<PortalPagedResult<StaffJourneyAnomalyListItemDto>>
    const items = (d.items ?? []) as StaffJourneyAnomalyListItemDto[]
    return {
      items,
      page: typeof d.page === 'number' ? d.page : page,
      pageSize: typeof d.pageSize === 'number' ? d.pageSize : pageSize,
      totalCount: typeof d.totalCount === 'number' ? d.totalCount : items.length,
    }
  }

  if (Array.isArray(data)) {
    return { items: data, page, pageSize, totalCount: data.length }
  }

  return { items: [], page, pageSize, totalCount: 0 }
}

export async function cancelStaffJourney(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/cancel-by-staff`)
}

export async function clearStaffJourneyAnomaly(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/anomaly/clear`)
}
