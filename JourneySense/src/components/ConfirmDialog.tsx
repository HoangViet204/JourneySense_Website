import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ConfirmDialogOptions = {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmDialogProps = {
  open: boolean
  options: ConfirmDialogOptions
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ open, options, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelBtnRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const confirmText = options.confirmText ?? 'Xác nhận'
  const cancelText = options.cancelText ?? 'Hủy'

  const confirmClass = options.danger
    ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-200'
    : 'bg-[#c5a070] hover:bg-[#b08f5f] focus-visible:ring-[#c5a070]/30'

  const titleId = 'confirm-dialog-title'

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/40 [backdrop-filter:blur(3px)]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onCancel()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xl shadow-stone-900/15"
      >
        <div className="flex items-start gap-3">
          <div
            className={
              options.danger
                ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700'
                : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#8f7349]'
            }
            aria-hidden
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-stone-900">
              {options.title}
            </h2>
            {options.message && <p className="mt-1 text-sm text-stone-600 whitespace-pre-line">{options.message}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-200"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmDialogOptions>({ title: '' })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const close = (value: boolean) => {
    setOpen(false)
    const resolver = resolverRef.current
    resolverRef.current = null
    resolver?.(value)
  }

  const confirm = (opts: ConfirmDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }

    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }

  const dialog = <ConfirmDialog open={open} options={options} onCancel={() => close(false)} onConfirm={() => close(true)} />

  return { confirm, dialog }
}
