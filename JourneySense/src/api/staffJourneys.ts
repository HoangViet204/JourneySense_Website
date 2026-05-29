import api from './axios'
import type { PortalPagedResult, StaffJourneyAnomalyListItemDto, StaffJourneyListItemDto } from '../types/portal'

export type StaffJourneyStatusFilter = '' | string

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

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
      // Backward-compatible aliases for endpoints using different paging names.
      pageNumber: page,
      pageIndex: page,
      size: pageSize,
      limit: pageSize,
    },
  })

  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items?: unknown }).items)) {
    const d = data as Partial<PortalPagedResult<StaffJourneyAnomalyListItemDto>> & {
      total?: number
      count?: number
      totalItems?: number
      totalRecords?: number
      totalElements?: number
      pageNumber?: number
      currentPage?: number
      pageIndex?: number
      size?: number
      limit?: number
      perPage?: number
      hasNextPage?: boolean
      hasNext?: boolean
    }
    const items = (d.items ?? []) as StaffJourneyAnomalyListItemDto[]

    const resolvedPage = pickNumber(d.page, d.pageNumber, d.currentPage, d.pageIndex, page) ?? page
    const resolvedPageSize = pickNumber(d.pageSize, d.size, d.limit, d.perPage, pageSize) ?? pageSize
    const explicitTotal = pickNumber(d.totalCount, d.total, d.count, d.totalItems, d.totalRecords, d.totalElements)
    const hasNext = typeof d.hasNextPage === 'boolean' ? d.hasNextPage : typeof d.hasNext === 'boolean' ? d.hasNext : undefined

    const inferredTotal =
      explicitTotal ??
      (hasNext === true
        ? resolvedPage * resolvedPageSize + 1
        : (resolvedPage - 1) * resolvedPageSize + items.length)

    return {
      items,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      totalCount: inferredTotal,
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
