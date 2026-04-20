/**
 * Giá trị gửi API khớp backend (List<string> / string), tham chiếu DomainEnums.cs + seed SQL.
 * — VehicleType: chữ thường (CreateAsync fallback "walking").
 * — TimeOfDay / WeatherType / SeasonType / VibeType: tên enum PascalCase như seed.
 * — CrowdLevel: chữ thường (service lưu ToLowerInvariant).
 */

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'walking', label: 'Đi bộ' },
  { value: 'bicycle', label: 'Xe đạp' },
  { value: 'motorbike', label: 'Xe máy' },
  { value: 'car', label: 'Ô tô' },
] as const

export const TIME_OF_DAY_OPTIONS = [
  { value: 'Morning', label: 'Buổi sáng' },
  { value: 'Afternoon', label: 'Buổi chiều' },
  { value: 'Evening', label: 'Buổi tối' },
  { value: 'Night', label: 'Ban đêm' },
] as const

export const WEATHER_TYPE_OPTIONS = [
  { value: 'Sunny', label: 'Nắng' },
  { value: 'Cloudy', label: 'Nhiều mây' },
  { value: 'Rainy', label: 'Mưa' },
] as const

export const SEASON_TYPE_OPTIONS = [
  { value: 'YearRound', label: 'Quanh năm' },
  { value: 'Summer', label: 'Mùa hè' },
  { value: 'Autumn', label: 'Mùa thu' },
  { value: 'Winter', label: 'Mùa đông' },
  { value: 'Spring', label: 'Mùa xuân' },
] as const

/** VibeType — field tags */
export const VIBE_TYPE_OPTIONS = [
  { value: 'Chill', label: 'Thư giãn' },
  { value: 'Relax', label: 'Thư thái' },
  { value: 'Explorer', label: 'Khám phá' },
  { value: 'Foodie', label: 'Ẩm thực' },
  { value: 'LocalVibes', label: 'Bản địa' },
  { value: 'Adventure', label: 'Mạo hiểm' },
  { value: 'Photographer', label: 'Chụp ảnh' },
] as const

export const CROWD_LEVEL_OPTIONS = [
  { value: 'all', label: 'Không xác định' },
  { value: 'quiet', label: 'Yên tĩnh' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'busy', label: 'Đông' },
] as const

export function parseAmenityInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinAmenityForInput(tags: string[] | null | undefined): string {
  if (!tags?.length) return ''
  return tags.join('\n')
}
