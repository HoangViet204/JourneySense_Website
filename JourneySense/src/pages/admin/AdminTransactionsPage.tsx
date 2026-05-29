import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryPage } from '../../hooks/useQueryPage'
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../api/axios';
import type { PortalPagedResult, TransactionHistoryItemDto } from '../../types/portal';
import { getApiErrorMessage } from '../../utils/apiMessage';
import { formatDate } from '../../utils/format';

const PAGE_SIZE = 10;
const shell = 'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]';

type SourceFilter = '' | 'payos' | 'points';

function displaySourceVi(source: string) {
  const s = source?.toLowerCase();
  if (s === 'payos') return 'PayOS';
  if (s === 'points') return 'Đổi bằng điểm';
  return source || '—';
}

function displayActionVi(action: string, source: string) {
  const a = action?.toLowerCase();
  const s = source?.toLowerCase();
  if (s === 'points') {
    if (a === 'redeem') return 'Đổi gói';
    return action || '—';
  }
  if (a === 'purchase') return 'Mua';
  if (a === 'renewal') return 'Gia hạn';
  if (a === 'upgrade') return 'Nâng cấp';
  return action || '—';
}

function displayStatusVi(status: string, source: string) {
  const st = status?.toLowerCase();
  const s = source?.toLowerCase();
  if (s === 'points') {
    if (st === 'completed') return 'Hoàn thành';
    return status || '—';
  }
  if (st === 'pending') return 'Đang xử lý';
  if (st === 'completed') return 'Hoàn thành';
  if (st === 'failed') return 'Thất bại';
  if (st === 'refunded') return 'Hoàn tiền';
  return status || '—';
}

function formatMoneyVnd(amount?: number | null) {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  } catch {
    return `${amount}₫`;
  }
}

export default function AdminTransactionsPage() {
  const [page, setPage] = useQueryPage(1, 'page');
  const [source, setSource] = useState<SourceFilter>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortalPagedResult<TransactionHistoryItemDto> | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PortalPagedResult<TransactionHistoryItemDto>>(
        '/api/admin/transactions',
        {
          params: {
            source: source || undefined,
            page,
            pageSize: PAGE_SIZE,
          },
        },
      );
      setResult(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [page, source]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [source]);

  const items = result?.items ?? [];
  const total = result?.totalCount ?? 0;
  const pageSize = result?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const emptyText = useMemo(() => {
    if (loading) return 'Đang tải…';
    if (source) return 'Không có giao dịch phù hợp.';
    return 'Chưa có giao dịch.';
  }, [loading, source]);

  return (
    <main className={shell}>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9a7b4f]">Giao dịch</p>
            <h1 className="mt-1 font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">
              Lịch sử giao dịch
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Xem tất cả giao dịch PayOS và giao dịch đổi gói bằng điểm của toàn hệ thống.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <section className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-stone-100 bg-white px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bộ lọc</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-stone-700">
                  Nguồn
                  <select
                    className="ml-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm outline-none focus:ring-2 focus:ring-[#c5a070]/40"
                    value={source}
                    onChange={(e) => setSource(e.target.value as SourceFilter)}
                  >
                    <option value="">Tất cả</option>
                    <option value="payos">PayOS</option>
                    <option value="points">Đổi bằng điểm</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-200/80 hover:bg-stone-50 disabled:opacity-60"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <span className="text-sm text-stone-600">
                Trang <span className="font-semibold text-stone-800">{page}</span> / {totalPages}
              </span>
              <button
                type="button"
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-200/80 hover:bg-stone-50 disabled:opacity-60"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau →
              </button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Thời gian</th>
                  <th className="whitespace-nowrap px-4 py-3">Nguồn</th>
                  <th className="whitespace-nowrap px-4 py-3">Hành động</th>
                  <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3">Gói</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Số tiền</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Điểm</th>
                  <th className="whitespace-nowrap px-4 py-3">Mã đơn</th>
                  <th className="whitespace-nowrap px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {!items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-stone-500">
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  items.map((x) => {
                    const src = (x.source ?? '').toLowerCase();
                    const detailTo = `/admin/accounts/${x.userId}/transactions/${src}/${x.id}`;
                    const money = src === 'payos' ? formatMoneyVnd(x.amountMoney ?? null) : '—';
                    const pts = src === 'points' ? (x.points ?? 0).toLocaleString('vi-VN') : '—';

                    return (
                      <tr key={x.id} className="bg-white hover:bg-stone-50/70">
                        <td className="whitespace-nowrap px-4 py-3 text-stone-800">{formatDate(x.occurredAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-stone-800">{displaySourceVi(x.source)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-stone-800">{displayActionVi(x.action, x.source)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-stone-800">{displayStatusVi(x.status, x.source)}</td>
                        <td className="max-w-[320px] truncate px-4 py-3 text-stone-800" title={x.packageTitle ?? undefined}>
                          {x.packageTitle?.trim() || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">{money}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">{pts}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-stone-700">
                          {x.orderCode?.trim() || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            to={detailTo}
                            className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#9a7b4f] shadow-sm ring-1 ring-stone-200/80 hover:bg-stone-50"
                          >
                            Xem
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
