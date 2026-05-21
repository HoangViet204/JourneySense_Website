export type ExperienceReportReasonCode = 'place_closed' | 'wrong_location' | 'other' | (string & {})

const REASON_LABEL_VI: Record<string, string> = {
  place_closed: 'Địa điểm đã đóng cửa',
  wrong_location: 'Sai vị trí',
  other: 'Khác',
}

export function displayExperienceReportReasonVi(code: string): string {
  const key = (code ?? '').trim()
  if (!key) return '—'
  return REASON_LABEL_VI[key] ?? key
}

export function hasOtherReason(reasons?: string[] | null): boolean {
  return Array.isArray(reasons) && reasons.includes('other')
}
