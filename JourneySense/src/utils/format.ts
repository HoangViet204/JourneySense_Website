export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function displayRole(role: string): string {
  const r = role?.toLowerCase()
  if (r === 'traveler') return 'Du khách'
  if (r === 'staff') return 'Nhân viên'
  if (r === 'admin') return 'Quản trị'
  return role
}

export function displayStatus(status: string): string {
  const s = status?.toLowerCase()
  if (s === 'active') return 'Hoạt động'
  if (s === 'suspended') return 'Đã đình chỉ'
  return status
}

export function displayJourneyStatus(status?: string | null): string {
  const s = status?.trim()
  if (!s) return '—'
  const key = s.toLowerCase()
  if (key === 'planning') return 'Lên kế hoạch'
  if (key === 'inprogress' || key === 'in_progress') return 'Đang diễn ra'
  if (key === 'completed' || key === 'complete') return 'Hoàn thành'
  if (key === 'cancelled' || key === 'canceled') return 'Đã hủy'
  return s
}

export function isJourneyInProgressStatus(status?: string | null): boolean {
  const s = status?.trim()
  if (!s) return false
  const key = s.toLowerCase()
  return key === 'inprogress' || key === 'in_progress'
}

export function displayMicroExperienceTagVi(raw: string): string {
  const s = raw?.trim()
  if (!s) return '—'

  const key = s
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')

  // accessibleBy (vehicle type)
  if (key === 'walking') return 'Đi bộ'
  if (key === 'bicycle') return 'Xe đạp'
  if (key === 'motorbike') return 'Xe máy'
  if (key === 'car') return 'Ô tô'

  // preferredTimes (time of day)
  if (key === 'morning') return 'Buổi sáng'
  if (key === 'afternoon') return 'Buổi chiều'
  if (key === 'evening') return 'Buổi tối'
  if (key === 'night') return 'Ban đêm'

  // weatherSuitability (weather type)
  if (key === 'sunny') return 'Nắng'
  if (key === 'cloudy') return 'Nhiều mây'
  if (key === 'rainy') return 'Mưa'

  // seasonality (season type)
  if (key === 'yearround' || key === 'yearrounds') return 'Quanh năm'
  if (key === 'summer') return 'Mùa hè'
  if (key === 'autumn' || key === 'fall') return 'Mùa thu'
  if (key === 'winter') return 'Mùa đông'
  if (key === 'spring') return 'Mùa xuân'

  // tags (vibe type)
  if (key === 'chill') return 'Thư giãn'
  if (key === 'relax') return 'Thư thái'
  if (key === 'explorer') return 'Khám phá'
  if (key === 'foodie') return 'Ẩm thực'
  if (key === 'localvibes') return 'Bản địa'
  if (key === 'adventure') return 'Mạo hiểm'
  if (key === 'photographer') return 'Chụp ảnh'

  // crowdLevel
  if (key === 'all') return 'Không xác định'
  if (key === 'quiet') return 'Yên tĩnh'
  if (key === 'normal') return 'Bình thường'
  if (key === 'busy') return 'Đông'

  return s
}

type OpeningHoursKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const OPENING_HOURS_ORDER: OpeningHoursKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const OPENING_HOURS_LABEL_VI: Record<OpeningHoursKey, string> = {
  mon: 'Thứ hai',
  tue: 'Thứ ba',
  wed: 'Thứ tư',
  thu: 'Thứ năm',
  fri: 'Thứ sáu',
  sat: 'Thứ bảy',
  sun: 'Chủ nhật',
}

function normalizeHourRangeText(raw: string): string {
  const s = raw.trim()
  if (!s) return ''

  // Convert common separators (hyphen/en-dash/em-dash) to Vietnamese "đến".
  // Example: "8:00-22:00" -> "8:00 đến 22:00"
  const replaced = s.replace(/\s*[\-–—]\s*/g, ' đến ')
  return replaced.replace(/\s+/g, ' ').trim()
}

/**
 * Format `openingHours` returned by BE.
 * - If it's a JSON string like '{"mon":"8:00-22:00", ...}', it will be parsed and formatted.
 * - Otherwise it returns the trimmed input as-is.
 */
export function formatOpeningHoursVi(openingHours?: string | null): string {
  const raw = openingHours?.trim()
  if (!raw) return '—'

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw

  const map = parsed as Record<string, unknown>
  const perDay: Array<{ day: OpeningHoursKey; text: string }> = []

  for (const day of OPENING_HOURS_ORDER) {
    const v = map[day]
    if (typeof v !== 'string') continue
    const text = normalizeHourRangeText(v)
    if (!text) continue
    perDay.push({ day, text })
  }

  if (perDay.length === 0) return raw

  const allTexts = perDay.map((x) => x.text)
  const unique = Array.from(new Set(allTexts))

  // If all 7 days are present and share the same hours.
  if (perDay.length === 7 && unique.length === 1) {
    return `Mỗi ngày ${unique[0]}`
  }

  // Group consecutive days with the same hours.
  const lines: string[] = []
  let i = 0
  while (i < perDay.length) {
    const start = perDay[i]
    let end = start

    while (i + 1 < perDay.length) {
      const next = perDay[i + 1]
      const startIndex = OPENING_HOURS_ORDER.indexOf(end.day)
      const nextIndex = OPENING_HOURS_ORDER.indexOf(next.day)

      const isConsecutive = nextIndex === startIndex + 1
      const sameText = next.text === start.text
      if (!isConsecutive || !sameText) break

      end = next
      i++
    }

    const dayLabel =
      start.day === end.day
        ? OPENING_HOURS_LABEL_VI[start.day]
        : `${OPENING_HOURS_LABEL_VI[start.day]} đến ${OPENING_HOURS_LABEL_VI[end.day]}`

    lines.push(`${dayLabel} ${start.text}`)
    i++
  }

  return lines.join('\n')
}
