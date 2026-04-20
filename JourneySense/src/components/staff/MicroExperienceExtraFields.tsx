import type { ReactNode } from 'react'
import {
  CROWD_LEVEL_OPTIONS,
  SEASON_TYPE_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  VIBE_TYPE_OPTIONS,
  WEATHER_TYPE_OPTIONS,
} from '../../constants/microExperienceEnums'

const chipBase =
  'px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] shadow-sm'

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function FieldGroup({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-2xl bg-gradient-to-b from-white to-stone-50/50 border border-stone-200/70 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}
    >
      <h3 className="mb-3.5 text-sm font-semibold tracking-tight text-stone-900 font-['Cormorant_Garamond',serif] shrink-0">
        {title}
      </h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function ChipRow({
  options,
  selected,
  onToggle,
  activeClass,
}: {
  options: readonly { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string[]) => void
  activeClass: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ value, label }) => {
        const on = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(toggleInList(selected, value))}
            className={`${chipBase} ${
              on ? `${activeClass} ring-2 ring-offset-1 ring-amber-400/30` : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50/80'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const fieldLabel = 'block text-xs font-semibold text-stone-600 mb-1.5 tracking-wide'
const inputCls =
  'w-full rounded-xl border border-stone-200/90 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/35 focus:border-amber-400/55'
const selectCls = `${inputCls} cursor-pointer`
/** Cùng chiều cao tối thiểu / tối đa để các ô nhập dài trông đồng đều */
const textareaBalanced = `${inputCls} resize-y min-h-[7.5rem] max-h-[16rem] overflow-y-auto`

interface Props {
  accessibleBy: string[]
  onAccessibleByChange: (v: string[]) => void
  preferredTimes: string[]
  onPreferredTimesChange: (v: string[]) => void
  weatherSuitability: string[]
  onWeatherSuitabilityChange: (v: string[]) => void
  seasonality: string[]
  onSeasonalityChange: (v: string[]) => void
  tags: string[]
  onTagsChange: (v: string[]) => void
  tagsExtraInput: string
  onTagsExtraInputChange: (v: string) => void
  amenityInput: string
  onAmenityInputChange: (v: string) => void
  openingHours: string
  onOpeningHoursChange: (v: string) => void
  priceRange: string
  onPriceRangeChange: (v: string) => void
  crowdLevel: string
  onCrowdLevelChange: (v: string) => void
  /** Ẩn dòng tiêu đề lớn khi đã có header ở card cha */
  hideOuterHeading?: boolean
}

export default function MicroExperienceExtraFields({
  accessibleBy,
  onAccessibleByChange,
  preferredTimes,
  onPreferredTimesChange,
  weatherSuitability,
  onWeatherSuitabilityChange,
  seasonality,
  onSeasonalityChange,
  tags,
  onTagsChange,
  tagsExtraInput,
  onTagsExtraInputChange,
  amenityInput,
  onAmenityInputChange,
  openingHours,
  onOpeningHoursChange,
  priceRange,
  onPriceRangeChange,
  crowdLevel,
  onCrowdLevelChange,
  hideOuterHeading = false,
}: Props) {
  return (
    <div className={`space-y-6 ${hideOuterHeading ? '' : 'pt-2'}`}>
      {!hideOuterHeading && (
        <p className="text-xs font-bold text-amber-800/80 uppercase tracking-wider">Thuộc tính chi tiết</p>
      )}

      {/* Lưới 2×2 chip; phía dưới: Tags | Vận hành hai cột cân nhau (từ lg) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <FieldGroup title="Phương tiện tiếp cận">
          <ChipRow
            options={VEHICLE_TYPE_OPTIONS}
            selected={accessibleBy}
            onToggle={onAccessibleByChange}
            activeClass="bg-amber-50 border-amber-300 text-amber-950"
          />
        </FieldGroup>

        <FieldGroup title="Khung giờ">
          <ChipRow
            options={TIME_OF_DAY_OPTIONS}
            selected={preferredTimes}
            onToggle={onPreferredTimesChange}
            activeClass="bg-sky-50 border-sky-300 text-sky-950"
          />
        </FieldGroup>

        <FieldGroup title="Thời tiết phù hợp">
          <ChipRow
            options={WEATHER_TYPE_OPTIONS}
            selected={weatherSuitability}
            onToggle={onWeatherSuitabilityChange}
            activeClass="bg-indigo-50 border-indigo-300 text-indigo-950"
          />
        </FieldGroup>

        <FieldGroup title="Mùa và giai đoạn">
          <ChipRow
            options={SEASON_TYPE_OPTIONS}
            selected={seasonality}
            onToggle={onSeasonalityChange}
            activeClass="bg-emerald-50 border-emerald-300 text-emerald-950"
          />
        </FieldGroup>

      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 lg:items-stretch">
        <FieldGroup title="Thẻ phong cách và tiện ích">
          <p className={fieldLabel}>Phong cách</p>
          <ChipRow
            options={VIBE_TYPE_OPTIONS}
            selected={tags}
            onToggle={onTagsChange}
            activeClass="bg-violet-50 border-violet-300 text-violet-950"
          />
          <label className={`${fieldLabel} mt-4`}>Thẻ bổ sung</label>
          <textarea
            value={tagsExtraInput}
            onChange={(e) => onTagsExtraInputChange(e.target.value)}
            rows={4}
            placeholder="cà phê, đồ ăn sinh viên…"
            className={textareaBalanced}
          />
          <label className={`${fieldLabel} mt-4`}>Tiện ích</label>
          <textarea
            value={amenityInput}
            onChange={(e) => onAmenityInputChange(e.target.value)}
            rows={4}
            placeholder={'bãi đỗ xe\nwifi'}
            className={`${textareaBalanced} font-mono text-[13px]`}
          />
        </FieldGroup>

        <FieldGroup title="Vận hành và giá">
          <label className={fieldLabel}>Giờ mở cửa</label>
          <textarea
            value={openingHours}
            onChange={(e) => onOpeningHoursChange(e.target.value)}
            rows={6}
            placeholder="Ví dụ: T2–T6 9:00–21:00; T7–CN 8:00–22:00"
            className={`${textareaBalanced} font-mono text-[13px]`}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>Khoảng giá</label>
              <input
                value={priceRange}
                onChange={(e) => onPriceRangeChange(e.target.value)}
                className={inputCls}
                placeholder="50.000–150.000…"
              />
            </div>
            <div>
              <label className={fieldLabel}>Mức đông</label>
              <select value={crowdLevel} onChange={(e) => onCrowdLevelChange(e.target.value)} className={selectCls}>
                {CROWD_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FieldGroup>
      </div>
    </div>
  )
}
