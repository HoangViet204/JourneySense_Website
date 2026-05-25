import api from './axios'
import type { PortalPagedResult, StaffTravelerDetailDto, StaffTravelerListItemDto } from '../types/portal'

export async function getStaffTraveler(travelerId: string): Promise<StaffTravelerDetailDto> {
  const { data } = await api.get<StaffTravelerDetailDto>(`/api/staff/travelers/${encodeURIComponent(travelerId)}`)
  return data
}

export async function listStaffTravelers(params?: {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<PortalPagedResult<StaffTravelerListItemDto>> {
  const { data } = await api.get<PortalPagedResult<StaffTravelerListItemDto>>('/api/staff/travelers', {
    params: {
      status: params?.status || undefined,
      search: params?.search || undefined,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    },
  })
  return data
}
