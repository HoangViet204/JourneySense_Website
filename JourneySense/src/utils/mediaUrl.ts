/**
 * Nối URL ảnh API (vd. `/uploads/...`) với `VITE_API_BASE_URL`.
 * @see JourneySense_BackEnd/docs/MICRO_EXPERIENCE_FE.md
 */
export function resolveApiMediaUrl(url: string): string {
  const raw = url?.trim()
  if (!raw) return ''
  // Some API responses (or seeded data) may contain Swagger placeholder values like "string".
  // Returning empty prevents the browser from requesting `${base}/string`.
  if (raw.toLowerCase() === 'string') return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`
}
