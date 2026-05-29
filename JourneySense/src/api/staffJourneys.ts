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

export async function listStaffJourneyAnomalies(params?: {
  page?: number
  pageSize?: number
}): Promise<PortalPagedResult<StaffJourneyAnomalyListItemDto>> {
  const { data } = await api.get<PortalPagedResult<StaffJourneyAnomalyListItemDto>>('/api/staff/journeys/anomalies', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    },
  })
  return data
}
// Helper to fetch all pages and merge items. Use with caution for large result sets.
export async function fetchAllStaffJourneyAnomalies(pageSize = 10) {
  const first = await listStaffJourneyAnomalies({ page: 1, pageSize })
  const total = first.totalCount ?? first.items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (totalPages <= 1) return first

  const promises: Promise<PortalPagedResult<StaffJourneyAnomalyListItemDto>>[] = []
  for (let p = 2; p <= totalPages; p++) promises.push(listStaffJourneyAnomalies({ page: p, pageSize }))

  const rest = await Promise.all(promises)
  const items = [ ...(first.items ?? []), ...rest.flatMap((r) => r.items ?? []) ]

  return { items, page: 1, pageSize: items.length, totalCount: items.length }
}

export async function cancelStaffJourney(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/cancel-by-staff`)
}

export async function clearStaffJourneyAnomaly(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/anomaly/clear`)
}
