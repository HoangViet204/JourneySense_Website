import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type { AdminAnomalousJourneyDto } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayJourneyStatus, formatDate } from '../../utils/format'

function anomalyLabel(reason?: string | null): { text: string; cls: string } {
  if (reason === 'stalled')
    return { text: 'Kéo dài bất thường', cls: 'bg-red-100 text-red-700 ring-red-200' }
  if (reason === 'off_route')
    return { text: 'Lệch tuyến', cls: 'bg-orange-100 text-orange-700 ring-orange-200' }
  return { text: 'Bất thường', cls: 'bg-red-100 text-red-700 ring-red-200' }
}

function statusPillClass(status?: string | null): string {
  const s = status?.trim()?.toLowerCase() ?? ''
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (s === 'inprogress' || s === 'in_progress') return 'bg-amber-50 text-amber-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-rose-50 text-rose-700'
  return 'bg-stone-100 text-stone-800'
}

export default function AdminAnomalousJourneysPage() {
  const [items, setItems] = useState<AdminAnomalousJourneyDto[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<AdminAnomalousJourneyDto[]>('/api/admin/journeys/anomalous')
      setItems(Array.isArray(data) ? data : [])
      setLastRefresh(new Date())
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình bất thường'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Auto-refresh every 5 minutes (matching backend scan interval)
  useEffect(() => {
    const id = window.setInterval(() => void load(), 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load])

  const stalledCount = items.filter((x) => x.anomalyReason === 'stalled').length
  const offRouteCount = items.filter((x) => x.anomalyReason === 'off_route').length

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-bold text-stone-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Hành trình cần chú ý
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Hệ thống quét mỗi 5 phút · Dữ liệu có thể trễ tối đa 5 phút
              {lastRefresh && <span className="ml-2">· Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN')}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/journeys"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 shadow-sm transition-colors"
            >
              ← Tất cả hành trình
            </Link>
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
          </div>
        </div>

        {/* Summary cards */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50 to-rose-50 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Tổng bất thường</p>
                <p className="text-2xl font-bold text-red-800 font-['Cormorant_Garamond',serif]">{items.length}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50 to-rose-50 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Kéo dài bất thường</p>
                <p className="text-2xl font-bold text-red-800 font-['Cormorant_Garamond',serif]">{stalledCount}</p>
                <p className="text-[11px] text-stone-400">Chạy &gt; 8 tiếng chưa xong</p>
              </div>
            </div>
            <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50 to-amber-50 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Lệch tuyến</p>
                <p className="text-2xl font-bold text-orange-800 font-['Cormorant_Garamond',serif]">{offRouteCount}</p>
                <p className="text-[11px] text-stone-400">GPS lệch &gt; 5km</p>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-stone-200/70 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-stone-400 text-sm">Đang tải…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-stone-600 font-semibold text-sm">Không có hành trình bất thường</p>
              <p className="text-stone-400 text-xs mt-1">Tất cả hành trình đang diễn ra bình thường.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-red-50/80 to-[#faf7f2] text-left text-[11px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-100">
                    <th className="px-5 py-3.5">Điểm đi → Điểm đến</th>
                    <th className="px-5 py-3.5">Loại bất thường</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5">Bắt đầu lúc</th>
                    <th className="px-5 py-3.5">Phát hiện lúc</th>
                    <th className="px-5 py-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((row, i) => {
                    const badge = anomalyLabel(row.anomalyReason)
                    return (
                      <tr key={row.id} className={`hover:bg-[#faf8f4] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/30'}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-stone-900 truncate max-w-[220px]" title={row.originAddress ?? ''}>
                            {row.originAddress ?? '—'}
                          </p>
                          <p className="text-xs text-stone-500 truncate max-w-[220px]" title={row.destinationAddress ?? ''}>
                            → {row.destinationAddress ?? '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${badge.cls}`}>
                            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {badge.text}
                          </span>
                          {row.anomalyReason === 'stalled' && (
                            <p className="text-[10px] text-stone-400 mt-1">Chạy &gt; 8 tiếng chưa hoàn thành</p>
                          )}
                          {row.anomalyReason === 'off_route' && (
                            <p className="text-[10px] text-stone-400 mt-1">GPS lệch &gt; 5km khỏi tuyến</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPillClass(row.status)}`}>
                            {displayJourneyStatus(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-stone-500 tabular-nums whitespace-nowrap">
                          {row.startedAt ? new Date(row.startedAt).toLocaleString('vi-VN') : formatDate(row.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-xs tabular-nums whitespace-nowrap">
                          {row.anomalyDetectedAt ? (
                            <span className={row.anomalyReason === 'off_route' ? 'text-orange-600 font-medium' : 'text-red-600 font-medium'}>
                              {new Date(row.anomalyDetectedAt).toLocaleString('vi-VN')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <Link
                            to={`/admin/journeys/${row.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#c5a070] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b08f5f] transition-colors shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Xem chi tiết
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
