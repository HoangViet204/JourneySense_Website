import { useState } from 'react'

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type OpeningHoursValue = Partial<Record<DayKey, string | null>>

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Thứ 2',
  tue: 'Thứ 3',
  wed: 'Thứ 4',
  thu: 'Thứ 5',
  fri: 'Thứ 6',
  sat: 'Thứ 7',
  sun: 'Chủ nhật',
}

const DEFAULT_OPEN = '08:00'
const DEFAULT_CLOSE = '22:00'
const DEFAULT_RANGE = `${DEFAULT_OPEN}-${DEFAULT_CLOSE}`

function parseRange(v: string): { open: string; close: string } {
  const m = v.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
  if (m) return { open: m[1], close: m[2] }
  return { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
}

function toRange(open: string, close: string): string {
  return `${open}-${close}`
}

/** Parse raw openingHours JSON string from API → structured value */
export function parseOpeningHoursString(raw: string | null | undefined): OpeningHoursValue {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: OpeningHoursValue = {}
    for (const key of DAY_KEYS) {
      const v = parsed[key]
      if (typeof v === 'string' && v.trim()) {
        result[key] = v.trim().replace(/\s*[–—]\s*/g, '-')
      } else {
        result[key] = null
      }
    }
    return result
  } catch {
    return {}
  }
}

/** Serialize structured value → API object. Returns null if nothing set. */
export function serializeOpeningHours(value: OpeningHoursValue): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const key of DAY_KEYS) {
    const v = value[key]
    if (v && v.trim()) out[key] = v.trim()
  }
  return Object.keys(out).length ? out : null
}

interface Props {
  value: OpeningHoursValue
  onChange: (v: OpeningHoursValue) => void
}

export default function OpeningHoursPicker({ value, onChange }: Props) {
  const [bulkOpen, setBulkOpen] = useState(DEFAULT_OPEN)
  const [bulkClose, setBulkClose] = useState(DEFAULT_CLOSE)

  const applyAll = () => {
    const range = toRange(bulkOpen, bulkClose)
    const next: OpeningHoursValue = {}
    for (const key of DAY_KEYS) next[key] = range
    onChange(next)
  }

  const toggleDay = (key: DayKey, checked: boolean) => {
    onChange({ ...value, [key]: checked ? DEFAULT_RANGE : null })
  }

  const setDayTime = (key: DayKey, field: 'open' | 'close', time: string) => {
    const current = value[key]
    const { open, close } = current ? parseRange(current) : { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
    onChange({
      ...value,
      [key]: toRange(field === 'open' ? time : open, field === 'close' ? time : close),
    })
  }

  return (
    <div className="space-y-3">
      {/* Apply-all bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5">
        <span className="text-xs font-semibold text-stone-500 shrink-0">Áp dụng tất cả:</span>
        <input
          type="time"
          value={bulkOpen}
          onChange={(e) => setBulkOpen(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
        <span className="text-stone-400 text-xs shrink-0">–</span>
        <input
          type="time"
          value={bulkClose}
          onChange={(e) => setBulkClose(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
        <button
          type="button"
          onClick={applyAll}
          className="rounded-lg bg-[#c5a070] px-3 py-1 text-xs font-semibold text-white hover:bg-[#b08f5f] transition-colors"
        >
          Áp dụng
        </button>
      </div>

      {/* Per-day rows */}
      <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
        {DAY_KEYS.map((key) => {
          const isOpen = Boolean(value[key])
          const { open, close } = isOpen
            ? parseRange(value[key]!)
            : { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }

          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                isOpen ? 'bg-white' : 'bg-stone-50/60'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer shrink-0 w-[76px]">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => toggleDay(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600"
                />
                <span className={`text-xs font-semibold ${isOpen ? 'text-stone-800' : 'text-stone-400'}`}>
                  {DAY_LABEL[key]}
                </span>
              </label>

              {isOpen ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="time"
                    value={open}
                    onChange={(e) => setDayTime(key, 'open', e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-[108px]"
                  />
                  <span className="text-stone-400 text-xs shrink-0">–</span>
                  <input
                    type="time"
                    value={close}
                    onChange={(e) => setDayTime(key, 'close', e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-[108px]"
                  />
                </div>
              ) : (
                <span className="text-xs text-stone-400 italic">Đóng cửa</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
