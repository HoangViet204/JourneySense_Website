import api from './axios'
import type { JourneyDetailResponse, PortalPagedResult, StaffJourneyAnomalyListItemDto, StaffJourneyListItemDto } from '../types/portal'

function pick<T extends Record<string, unknown>>(obj: T, ...keys: string[]): unknown {
  const lowerKeyMap = new Map<string, string>()
  for (const key of Object.keys(obj)) {
    lowerKeyMap.set(key.toLowerCase(), key)
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
    const actualKey = lowerKeyMap.get(key.toLowerCase())
    if (actualKey) return obj[actualKey]
  }
  return undefined
}

function normalizeJourneyDetailResponse(raw: unknown): JourneyDetailResponse {
  const data = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(pick(data, 'id', 'Id') ?? ''),
    travelerId: (pick(data, 'travelerId', 'TravelerId') as string | null | undefined) ?? null,
    name: (pick(data, 'name', 'Name', 'journeyName', 'JourneyName') as string | null | undefined) ?? null,
    journeyName: (pick(data, 'journeyName', 'JourneyName', 'name', 'Name') as string | null | undefined) ?? null,
    ownerFullName: (pick(data, 'ownerFullName', 'OwnerFullName') as string | null | undefined) ?? null,
    ownerEmail: (pick(data, 'ownerEmail', 'OwnerEmail') as string | null | undefined) ?? null,
    ownerPhone: (pick(data, 'ownerPhone', 'OwnerPhone') as string | null | undefined) ?? null,
    originAddress: (pick(data, 'originAddress', 'OriginAddress') as string | null | undefined) ?? null,
    destinationAddress: (pick(data, 'destinationAddress', 'DestinationAddress') as string | null | undefined) ?? null,
    vehicleType: (pick(data, 'vehicleType', 'VehicleType') as string | null | undefined) ?? null,
    totalDistanceMeters: (pick(data, 'totalDistanceMeters', 'TotalDistanceMeters') as number | null | undefined) ?? null,
    estimatedDurationMinutes: (pick(data, 'estimatedDurationMinutes', 'EstimatedDurationMinutes') as number | null | undefined) ?? null,
    timeBudgetMinutes: (pick(data, 'timeBudgetMinutes', 'TimeBudgetMinutes') as number | null | undefined) ?? null,
    maxDetourDistanceMeters: (pick(data, 'maxDetourDistanceMeters', 'MaxDetourDistanceMeters') as number | null | undefined) ?? null,
    currentMood: (pick(data, 'currentMood', 'CurrentMood') as string | null | undefined) ?? null,
    status: (pick(data, 'status', 'Status') as string | null | undefined) ?? null,
    startedAt: (pick(data, 'startedAt', 'StartedAt') as string | null | undefined) ?? null,
    completedAt: (pick(data, 'completedAt', 'CompletedAt') as string | null | undefined) ?? null,
    createdAt: (pick(data, 'createdAt', 'CreatedAt') as string | null | undefined) ?? null,
    journeyFeedback: (pick(data, 'journeyFeedback', 'JourneyFeedback') as string | null | undefined) ?? null,
    journeyFeedbackModerationStatus:
      (pick(data, 'journeyFeedbackModerationStatus', 'JourneyFeedbackModerationStatus') as string | null | undefined) ?? null,
    routePoints: (pick(data, 'routePoints', 'RoutePoints') as JourneyDetailResponse['routePoints']) ?? null,
    setupPrimaryRoutePoints: (pick(data, 'setupPrimaryRoutePoints', 'SetupPrimaryRoutePoints') as JourneyDetailResponse['setupPrimaryRoutePoints']) ?? null,
    segments: (pick(data, 'segments', 'Segments') as JourneyDetailResponse['segments']) ?? null,
    waypoints: (pick(data, 'waypoints', 'Waypoints') as JourneyDetailResponse['waypoints']) ?? null,
    selectedSegmentId: (pick(data, 'selectedSegmentId', 'SelectedSegmentId') as string | null | undefined) ?? null,
    isAnomalous: (pick(data, 'isAnomalous', 'IsAnomalous') as boolean | null | undefined) ?? null,
    anomalyReason: (pick(data, 'anomalyReason', 'AnomalyReason') as string | null | undefined) ?? null,
    anomalyDetectedAt: (pick(data, 'anomalyDetectedAt', 'AnomalyDetectedAt') as string | null | undefined) ?? null,
    allowLocationTracking: (pick(data, 'allowLocationTracking', 'AllowLocationTracking') as boolean | null | undefined) ?? null,
  }
}

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
  const { data } = await api.get<unknown>(`/api/staff/journeys/${encodeURIComponent(journeyId)}`)
  return normalizeJourneyDetailResponse(data)
}

export async function cancelStaffJourney(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/cancel-by-staff`)
}

export async function clearStaffJourneyAnomaly(journeyId: string): Promise<void> {
  await api.post(`/api/staff/journeys/${encodeURIComponent(journeyId)}/anomaly/clear`)
}
