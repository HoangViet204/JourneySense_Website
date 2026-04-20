import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { normalizeAdminUserDetailPayload } from '../../utils/adminUserDetail'
import type { PayosTransactionHistoryDetailDto, PointsTransactionHistoryDetailDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { formatDate } from '../../utils/format'

const shell = 'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]'

type DetailSource = 'payos' | 'points'

function displaySourceVi(source: DetailSource) {
  return source === 'payos' ? 'PayOS' : 'Đổi bằng điểm'
}

function formatMoneyVnd(amount?: number | null) {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
  } catch {
    return `${amount}₫`
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-stone-200/70 bg-white/90 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <div className="text-sm font-medium text-stone-900">{value}</div>
    </div>
  )
}

export default function AdminUserTransactionDetailPage() {
  const { userId, source: rawSource, id } = useParams<{ userId: string; source: string; id: string }>()

  const source = (rawSource?.toLowerCase() as DetailSource | undefined) ?? undefined
  const isValidSource = source === 'payos' || source === 'points'

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payos, setPayos] = useState<PayosTransactionHistoryDetailDto | null>(null)
  const [points, setPoints] = useState<PointsTransactionHistoryDetailDto | null>(null)
  const [userLabel, setUserLabel] = useState<string>('')

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      try {
        const { data: raw } = await api.get<unknown>(`/api/admin/users/${userId}`)
        const u = normalizeAdminUserDetailPayload(raw)
        const label = (u.fullName?.trim() || u.email?.trim() || userId).trim()
        if (!cancelled) setUserLabel(label)
      } catch {
        if (!cancelled) setUserLabel(userId)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId])

  const load = useCallback(async () => {
    if (!userId || !id || !isValidSource || !source) return
    setLoading(true)
    setNotFound(false)
    setPayos(null)
    setPoints(null)

    try {
      if (source === 'payos') {
        const { data } = await api.get<PayosTransactionHistoryDetailDto>(
          `/api/admin/users/${userId}/transactions/payos/${id}`,
        )
        setPayos(data)
      } else {
        const { data } = await api.get<PointsTransactionHistoryDetailDto>(
          `/api/admin/users/${userId}/transactions/points/${id}`,
        )
        setPoints(data)
      }
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setNotFound(true)
      } else {
        toast.error(getApiErrorMessage(e))
      }
    } finally {
      setLoading(false)
    }
  }, [userId, id, isValidSource, source])

  useEffect(() => {
    void load()
  }, [load])

  if (!userId) return <Navigate to="/admin/accounts" replace />
  if (!id || !rawSource) return <Navigate to={`/admin/accounts/${userId}/transactions`} replace />
  if (!isValidSource) return <Navigate to={`/admin/accounts/${userId}/transactions`} replace />

  const title = source ? `Chi tiết giao dịch (${displaySourceVi(source)})` : 'Chi tiết giao dịch'

  return (
    <main className={shell}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-8 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9a7b4f]">Giao dịch</p>
            <h1 className="mt-1 font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
              {title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/admin/accounts/${userId}/transactions`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200/80 hover:bg-stone-50"
            >
              ← Danh sách giao dịch
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center rounded-xl bg-[#c5a070] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
              disabled={loading}
            >
              Tải lại
            </button>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-stone-200/80 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-stone-500">Đang tải chi tiết…</p>
          </section>
        ) : notFound ? (
          <section className="rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-stone-800">Không tìm thấy giao dịch.</p>
          </section>
        ) : source === 'payos' ? (
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow label="Mã giao dịch" value={<span className="font-mono text-[12px]">{payos?.id ?? '—'}</span>} />
              <InfoRow label="Người dùng" value={userLabel || payos?.userId || '—'} />
              <InfoRow label="Gói" value={payos?.packageTitle?.trim() || '—'} />
              <InfoRow label="PackageId" value={<span className="font-mono text-[12px]">{payos?.packageId ?? '—'}</span>} />
              <InfoRow label="Số tiền" value={formatMoneyVnd(payos?.amount ?? null)} />
              <InfoRow label="Loại" value={payos?.type ?? '—'} />
              <InfoRow label="Trạng thái" value={payos?.status ?? '—'} />
              <InfoRow label="Phương thức" value={payos?.paymentMethod?.trim() || '—'} />
              <InfoRow label="Mã đơn" value={payos?.orderCode?.trim() || '—'} />
              <InfoRow label="Thời gian" value={formatDate(payos?.createdAt ?? null)} />
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow label="Mã giao dịch" value={<span className="font-mono text-[12px]">{points?.id ?? '—'}</span>} />
              <InfoRow label="Người dùng" value={userLabel || points?.userId || '—'} />
              <InfoRow label="Loại" value={points?.type ?? '—'} />
              <InfoRow label="Số điểm" value={(points?.points ?? 0).toLocaleString('vi-VN')} />
              <InfoRow label="Mô tả" value={points?.description?.trim() || '—'} />
              <InfoRow label="RefType" value={points?.refType?.trim() || '—'} />
              <InfoRow label="RefId" value={<span className="font-mono text-[12px]">{points?.refId ?? '—'}</span>} />
              <InfoRow label="Gói" value={points?.packageTitle?.trim() || '—'} />
              <InfoRow label="PackageId" value={<span className="font-mono text-[12px]">{points?.packageId ?? '—'}</span>} />
              <InfoRow label="Thời gian" value={formatDate(points?.createdAt ?? null)} />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
