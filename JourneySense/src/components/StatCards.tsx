import type { ReactNode } from 'react'

export type StatCardTone = 'amber' | 'emerald' | 'rose' | 'sky' | 'violet' | 'stone'

export type StatCardItem = {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: StatCardTone
}

const TONE_CLASS: Record<StatCardTone, string> = {
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80',
  rose: 'bg-rose-50 text-rose-900 ring-rose-200/80',
  sky: 'bg-sky-50 text-sky-900 ring-sky-200/80',
  violet: 'bg-violet-50 text-violet-900 ring-violet-200/80',
  stone: 'bg-stone-50 text-stone-900 ring-stone-200/80',
}

export default function StatCards({ items, className = '' }: { items: StatCardItem[]; className?: string }) {
  return (
    <div className={`grid gap-3 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-stone-900 tabular-nums">{item.value}</div>
              {item.sub ? <div className="mt-1 text-xs text-stone-500">{item.sub}</div> : null}
            </div>
            <div className={`mt-0.5 inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-xs font-semibold ring-1 ${TONE_CLASS[item.tone ?? 'stone']}`}>
              {item.label.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
