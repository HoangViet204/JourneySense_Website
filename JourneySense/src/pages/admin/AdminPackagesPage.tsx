import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import type { PackageResponseDto, PackageUpsertRequest } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatVnd(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

const TYPE_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'ultra', label: 'Ultra' },
]

function typeBadge(type: string) {
  if (type === 'ultra') return 'bg-violet-100 text-violet-700 ring-violet-200'
  if (type === 'pro') return 'bg-sky-100 text-sky-700 ring-sky-200'
  return 'bg-stone-100 text-stone-600 ring-stone-200'
}

const EMPTY_FORM: PackageUpsertRequest = {
  title: '',
  price: 0,
  salePrice: null,
  type: 'basic',
  distanceLimitKm: 0,
  durationInDays: 30,
  benefit: '',
  isPopular: false,
  isActive: true,
  pointsRequired: null,
}

// ── sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 ${className ?? ''}`} />
}

interface FormModalProps {
  initial: PackageUpsertRequest
  editId: string | null
  onClose: () => void
  onSaved: () => void
}

function PackageFormModal({ initial, editId, onClose, onSaved }: FormModalProps) {
  const [form, setForm] = useState<PackageUpsertRequest>(initial)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof PackageUpsertRequest>(k: K, v: PackageUpsertRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) { toast.warning('Nhập tên gói.'); return }
    if (form.price === 0 && !form.pointsRequired) {
      toast.warning('Giá tiền và điểm không được đồng thời bằng 0.')
      return
    }
    if (form.distanceLimitKm === 0 && form.durationInDays === 0) {
      toast.warning('Giới hạn km và số ngày không được đồng thời bằng 0.')
      return
    }

    setBusy(true)
    const t = toast.loading(editId ? 'Đang lưu…' : 'Đang tạo…')
    try {
      const body: PackageUpsertRequest = {
        ...form,
        title: form.title.trim(),
        benefit: form.benefit?.trim() || undefined,
        salePrice: form.salePrice || null,
        pointsRequired: form.pointsRequired || null,
      }
      if (editId) {
        await api.put(`/api/packages/${editId}`, body)
        toast.success('Đã cập nhật gói', { id: t })
      } else {
        await api.post('/api/packages', body)
        toast.success('Đã tạo gói mới', { id: t })
      }
      onSaved()
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40'
  const labelCls = 'block text-xs font-semibold text-stone-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-amber-50/60 to-white">
          <h2 className="font-['Cormorant_Garamond',serif] text-lg font-bold text-stone-900">
            {editId ? 'Chỉnh sửa gói' : 'Tạo gói mới'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Tên gói *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="Gói Basic" />
            </div>

            <div>
              <label className={labelCls}>Loại *</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Giá (VNĐ)</label>
              <input type="number" min={0} value={form.price} onChange={(e) => set('price', Number(e.target.value))} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Giá khuyến mãi (VNĐ)</label>
              <input type="number" min={0} value={form.salePrice ?? ''} onChange={(e) => set('salePrice', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="Để trống nếu không có" />
            </div>

            <div>
              <label className={labelCls}>Điểm yêu cầu</label>
              <input type="number" min={0} value={form.pointsRequired ?? ''} onChange={(e) => set('pointsRequired', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="Để trống nếu dùng tiền" />
            </div>

            <div>
              <label className={labelCls}>Giới hạn km</label>
              <input type="number" min={0} value={form.distanceLimitKm} onChange={(e) => set('distanceLimitKm', Number(e.target.value))} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Số ngày hiệu lực</label>
              <input type="number" min={0} value={form.durationInDays} onChange={(e) => set('durationInDays', Number(e.target.value))} className={inputCls} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Quyền lợi</label>
              <textarea value={form.benefit ?? ''} onChange={(e) => set('benefit', e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="Mô tả quyền lợi gói…" />
            </div>

            <div className="col-span-2 flex flex-wrap gap-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                <input type="checkbox" checked={form.isPopular} onChange={(e) => set('isPopular', e.target.checked)} className="w-4 h-4 accent-amber-600" />
                <span className="font-medium">Gói nổi bật</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                <span className="font-medium">Đang hoạt động</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/60">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors">
            Hủy
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-xl bg-[#c5a070] hover:bg-[#b08f5f] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 shadow-sm transition-colors">
            {busy ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Tạo gói'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AdminPackagesPage() {
  const [items, setItems] = useState<PackageResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<PackageResponseDto | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterActive === 'active') params.isActive = 'true'
      if (filterActive === 'inactive') params.isActive = 'false'
      const { data } = await api.get<PackageResponseDto[]>('/api/packages', { params })
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách gói'))
    } finally {
      setLoading(false)
    }
  }, [filterActive])

  useEffect(() => { void load() }, [load])

  const openCreate = () => { setEditTarget(null); setShowModal(true) }
  const openEdit = (pkg: PackageResponseDto) => { setEditTarget(pkg); setShowModal(true) }
  const closeModal = () => setShowModal(false)
  const onSaved = () => { setShowModal(false); void load() }

  const deactivate = async (pkg: PackageResponseDto) => {
    const ok = await confirm({
      title: 'Vô hiệu hóa gói',
      message: `Vô hiệu hóa gói «${pkg.title}»? Gói sẽ bị ẩn khỏi danh sách công khai.`,
      confirmText: 'Vô hiệu hóa',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return
    const t = toast.loading('Đang vô hiệu hóa…')
    try {
      await api.delete(`/api/packages/${pkg.id}`)
      toast.success('Đã vô hiệu hóa gói', { id: t })
      void load()
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    }
  }

  const activeCount = items.filter((x) => x.isActive).length

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-bold text-stone-900">Quản lý gói dịch vụ</h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {loading ? 'Đang tải…' : `${activeCount} gói đang hoạt động · ${items.length} tổng`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter tabs */}
            <div className="flex rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm text-xs font-semibold">
              {(['all', 'active', 'inactive'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilterActive(v)}
                  className={`px-3 py-2 transition-colors ${filterActive === v ? 'bg-amber-50 text-amber-800' : 'text-stone-500 hover:bg-stone-50'}`}
                >
                  {v === 'all' ? 'Tất cả' : v === 'active' ? 'Đang hoạt động' : 'Đã ẩn'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 shadow-sm transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Làm mới
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#c5a070] hover:bg-[#b08f5f] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tạo gói mới
            </button>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm py-16 text-center">
            <p className="text-stone-500 font-semibold text-sm">Chưa có gói nào.</p>
            <button type="button" onClick={openCreate} className="mt-3 text-xs font-semibold text-[#9a7b4f] hover:underline">
              + Tạo gói đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((pkg) => (
              <div
                key={pkg.id}
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md ${
                  pkg.isActive ? 'border-stone-200/70' : 'border-stone-200/40 opacity-60'
                }`}
              >
                {/* Card header */}
                <div className={`px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-2 ${
                  pkg.type === 'ultra' ? 'bg-gradient-to-r from-violet-50/70 to-white' :
                  pkg.type === 'pro'   ? 'bg-gradient-to-r from-sky-50/70 to-white' :
                                         'bg-gradient-to-r from-amber-50/50 to-white'
                }`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-['Cormorant_Garamond',serif] text-base font-bold text-stone-900 truncate">{pkg.title}</h3>
                      {pkg.isPopular && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 shrink-0">
                          ⭐ Nổi bật
                        </span>
                      )}
                    </div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 uppercase tracking-wide ${typeBadge(pkg.type)}`}>
                      {pkg.type}
                    </span>
                  </div>
                  <span className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
                    pkg.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-stone-100 text-stone-500 ring-stone-200'
                  }`}>
                    {pkg.isActive ? 'Hoạt động' : 'Đã ẩn'}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-5 py-4 flex-1 space-y-3">
                  {/* Price */}
                  <div className="flex items-baseline gap-2">
                    {pkg.salePrice ? (
                      <>
                        <span className="text-xl font-bold text-[#9a7b4f] font-['Cormorant_Garamond',serif]">{formatVnd(pkg.salePrice)}</span>
                        <span className="text-sm text-stone-400 line-through">{formatVnd(pkg.price)}</span>
                      </>
                    ) : pkg.price > 0 ? (
                      <span className="text-xl font-bold text-stone-900 font-['Cormorant_Garamond',serif]">{formatVnd(pkg.price)}</span>
                    ) : pkg.pointsRequired ? (
                      <span className="text-xl font-bold text-violet-700 font-['Cormorant_Garamond',serif]">{pkg.pointsRequired.toLocaleString('vi-VN')} điểm</span>
                    ) : (
                      <span className="text-sm text-stone-400">Miễn phí</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Giới hạn km</p>
                      <p className="text-sm font-bold text-stone-800 mt-0.5">
                        {pkg.distanceLimitKm > 0 ? `${pkg.distanceLimitKm.toLocaleString('vi-VN')} km` : 'Không giới hạn'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Hiệu lực</p>
                      <p className="text-sm font-bold text-stone-800 mt-0.5">
                        {pkg.durationInDays > 0 ? `${pkg.durationInDays} ngày` : 'Vĩnh viễn'}
                      </p>
                    </div>
                  </div>

                  {pkg.benefit && (
                    <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{pkg.benefit}</p>
                  )}

                  <p className="text-[10px] text-stone-400">Tạo lúc {formatDate(pkg.createdAt)}</p>
                </div>

                {/* Card footer */}
                <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(pkg)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.172l8.586-8.586z" />
                    </svg>
                    Sửa
                  </button>
                  {pkg.isActive && (
                    <button
                      type="button"
                      onClick={() => void deactivate(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Vô hiệu hóa
                    </button>
                  )}
                  {!pkg.isActive && (
                    <button
                      type="button"
                      onClick={() => openEdit(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Kích hoạt lại
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PackageFormModal
          initial={editTarget ? {
            title: editTarget.title,
            price: editTarget.price,
            salePrice: editTarget.salePrice ?? null,
            type: editTarget.type,
            distanceLimitKm: editTarget.distanceLimitKm,
            durationInDays: editTarget.durationInDays,
            benefit: editTarget.benefit ?? '',
            isPopular: editTarget.isPopular,
            isActive: editTarget.isActive,
            pointsRequired: editTarget.pointsRequired ?? null,
          } : EMPTY_FORM}
          editId={editTarget?.id ?? null}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}

      {dialog}
    </main>
  )
}
