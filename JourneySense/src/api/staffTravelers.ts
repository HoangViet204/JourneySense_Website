import api from './axios'
import type { PortalPagedResult, StaffTravelerDetailDto, StaffTravelerListItemDto } from '../types/portal'

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

function normalizeStaffTravelerDetailResponse(raw: unknown): StaffTravelerDetailDto {
  const data = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(pick(data, 'id', 'Id') ?? ''),
    email: (pick(data, 'email', 'Email') as string | null | undefined) ?? null,
    phone: (pick(data, 'phone', 'Phone') as string | null | undefined) ?? null,
    fullName: (pick(data, 'fullName', 'FullName') as string | null | undefined) ?? null,
    avatarUrl: (pick(data, 'avatarUrl', 'AvatarUrl') as string | null | undefined) ?? null,
    status: (pick(data, 'status', 'Status') as string | null | undefined) ?? null,
  }
}

export async function getStaffTraveler(travelerId: string): Promise<StaffTravelerDetailDto> {
  const { data } = await api.get<unknown>(`/api/staff/travelers/${encodeURIComponent(travelerId)}`)
  return normalizeStaffTravelerDetailResponse(data)
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
