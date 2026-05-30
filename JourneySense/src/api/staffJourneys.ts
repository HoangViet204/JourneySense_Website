import api from './axios'
import type { JourneyDetailResponse, PortalPagedResult, StaffJourneyAnomalyListItemDto, StaffJourneyListItemDto } from '../types/portal'

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
}): Promise<StaffJourneyAnomalyListItemDto[]> {
  const { data } = await api.get<StaffJourneyAnomalyListItemDto[]>('/api/staff/journeys/anomalies', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    },
  })
  return data
}

export async function getStaffJourney(journeyId: string): Promise<JourneyDetailResponse> {
  const { data } = await api.get<JourneyDetailResponse>(`/api/staff/journeys/${encodeURIComponent(journeyId)}`)
  return data
}

export async function cancelStaffJourney(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/cancel-by-staff`)
}

export async function clearStaffJourneyAnomaly(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/anomaly/clear`)
}
