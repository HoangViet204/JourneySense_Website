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
