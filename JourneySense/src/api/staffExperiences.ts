import api from './axios'
import type {
  StaffExperienceInProgressJourneysResponse,
  StaffExperienceStatus,
  StaffUpdateExperienceLocationResponse,
  StaffUpdateExperienceStatusResponse,
} from '../types/portal'

export async function listInProgressJourneysUsingExperience(
  experienceId: string,
  params?: { page?: number; pageSize?: number },
): Promise<StaffExperienceInProgressJourneysResponse> {
  const { data } = await api.get<StaffExperienceInProgressJourneysResponse>(
    `/api/staff/experiences/${encodeURIComponent(experienceId)}/in-progress-journeys`,
    {
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    },
  )
  return data
}

export async function updateExperienceLocation(
  experienceId: string,
  body: { latitude: number; longitude: number },
): Promise<StaffUpdateExperienceLocationResponse> {
  const { data } = await api.patch<StaffUpdateExperienceLocationResponse>(
    `/api/staff/experiences/${encodeURIComponent(experienceId)}/location`,
    body,
  )
  return data
}

export async function updateExperienceStatus(
  experienceId: string,
  body: { status: StaffExperienceStatus },
): Promise<StaffUpdateExperienceStatusResponse> {
  const { data } = await api.patch<StaffUpdateExperienceStatusResponse>(
    `/api/staff/experiences/${encodeURIComponent(experienceId)}/status`,
    body,
  )
  return data
}
