import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type { ExperiencePhotoResponse, MicroExperienceDetailResponse } from '../../types/portal'
import { displayMicroExperienceTagVi, formatDate, formatOpeningHoursVi } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'

const shell =
  'min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8]'
const sectionCard =
  'rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] sm:p-8'

function placeInitial(name: string | null | undefined) {
  const ch = name?.trim()[0]
  return ch ? ch.toUpperCase() : '?'
}

function ChipList({ items }: { items?: string[] | null }) {
  if (!items?.length) return <span className="text-sm text-stone-400">—</span>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className="rounded-full bg-stone-50 px-3 py-1 text-xs font-medium text-stone-800 ring-1 ring-stone-200/80"
        >
          {displayMicroExperienceTagVi(x)}
        </span>
      ))}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-stone-50/80 to-white px-4 py-3 ring-1 ring-stone-100/80">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 font-['Cormorant_Garamond',serif] text-xl font-semibold text-stone-900">{value}</p>
    </div>
  )
}

function PhotoCard({ photo }: { photo: ExperiencePhotoResponse }) {
  const src = resolveApiMediaUrl(photo.thumbnailUrl || photo.photoUrl)
  const full = resolveApiMediaUrl(photo.photoUrl)
  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-100 shadow-md transition-shadow hover:shadow-lg">
      {photo.isCover && (
        <span className="absolute left-3 top-3 z-10 rounded-lg bg-[#c5a070] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          Ảnh bìa
        </span>
      )}
      <a href={full} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
        <img
          src={src}
          alt={photo.caption || 'Ảnh địa điểm'}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </a>
      {(photo.caption || photo.uploadedAt) && (
        <figcaption className="border-t border-stone-100 bg-white/95 px-3 py-2 text-[11px] text-stone-600">
          {photo.caption ? <span className="line-clamp-2">{photo.caption}</span> : null}
          {photo.uploadedAt && (
            <span className="mt-0.5 block text-stone-400">{formatDate(photo.uploadedAt)}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

export default function AdminPlaceDetailPage() {
  const { placeId } = useParams<{ placeId: string }>()
  const [detail, setDetail] = useState<MicroExperienceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!placeId) return
    setLoading(true)
    try {
      const { data } = await api.get<MicroExperienceDetailResponse>(`/api/micro-experiences/${placeId}`)
      setDetail(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được chi tiết địa điểm'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [placeId])

  useEffect(() => {
    void load()
  }, [load])

  if (!placeId) return <Navigate to="/admin/places" replace />

  const photos = detail?.photos?.length ? detail.photos : []
  const coverPhoto = photos.find((p) => p.isCover) ?? photos[0]
  const coverUrl = coverPhoto ? resolveApiMediaUrl(coverPhoto.thumbnailUrl || coverPhoto.photoUrl) : null

  const statusLabel =
    detail?.status === 'active'
      ? 'Hoạt động'
      : detail?.status === 'inactive'
        ? 'Không hoạt động'
        : (detail?.status ?? null)

  const statusClass =
    detail?.status === 'active'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : detail?.status === 'inactive'
        ? 'bg-stone-100 text-stone-700 ring-stone-200/80'
        : 'bg-stone-50 text-stone-800 ring-stone-200/80'

  return (
    <main className={shell}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-10">
        <Link
          to="/admin/places"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#9a7b4f] transition-colors hover:text-[#7d6540]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-stone-600 shadow-sm ring-1 ring-stone-200/80">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
          Danh sách địa điểm
        </Link>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-pulse rounded-full bg-stone-200/80" />
            <p className="mt-6 text-sm text-stone-500">Đang tải…</p>
          </div>
        )}

        {!loading && !detail && (
          <div className="rounded-3xl border border-rose-100 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-stone-800">Không có dữ liệu hoặc không có quyền xem.</p>
            <Link
              to="/admin/places"
              className="mt-6 inline-flex rounded-xl bg-[#c5a070] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b08f5f]"
            >
              Quay lại danh sách
            </Link>
          </div>
        )}

        {!loading && detail && (
          <>
            <header className="relative mb-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
              <div className="relative flex flex-col sm:flex-row">
                <div className="relative h-44 shrink-0 sm:h-auto sm:w-[42%] sm:min-h-[220px]">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      className="h-full w-full object-cover sm:absolute sm:inset-0"
                    />
                  ) : (
                    <div className="flex h-full min-h-[11rem] w-full items-center justify-center bg-gradient-to-br from-[#c5a070] to-[#6b5438] sm:min-h-full">
                      <span className="text-5xl font-bold text-white/90">{placeInitial(detail.name)}</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent sm:bg-gradient-to-r sm:from-black/25 sm:to-transparent" />
                </div>
                <div className="relative flex flex-1 flex-col justify-center p-6 sm:p-8">
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#c5a070]/12 blur-2xl"
                    aria-hidden
                  />
                  <p className="font-['Cormorant_Garamond',serif] text-xs font-semibold uppercase tracking-widest text-[#9a7b4f]">
                    Địa điểm
                  </p>
                  <h1 className="mt-2 font-['Cormorant_Garamond',serif] text-2xl font-semibold leading-tight text-stone-900 sm:text-3xl">
                    {detail.name ?? '—'}
                  </h1>
                  {detail.categoryName && (
                    <p className="mt-2 text-sm text-stone-600">{detail.categoryName}</p>
                  )}
                  <p className="mt-3 max-w-full truncate rounded-lg bg-stone-50 px-2 py-1 font-mono text-[11px] text-stone-500 ring-1 ring-stone-100 sm:inline-block">
                    {placeId}
                  </p>
                  {statusLabel && (
                    <span
                      className={`mt-4 inline-flex w-fit rounded-full px-3.5 py-1 text-xs font-semibold ring-1 ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
              </div>
            </header>

            <section className={`${sectionCard} mb-8`}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Số liệu</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Đánh giá trung bình" value={Number(detail.avgRating ?? 0).toFixed(1)} />
                <StatTile label="Điểm chất lượng" value={Number(detail.qualityScore ?? 0).toFixed(2)} />
                <StatTile
                  label="Tọa độ"
                  value={
                    detail.latitude != null && detail.longitude != null ? (
                      <span className="font-mono text-base font-normal text-stone-800">
                        {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
            </section>

            <section className={`${sectionCard} mb-8`}>
              <h2 className="mb-5 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">
                Ảnh <span className="font-sans text-sm font-normal text-stone-500">({photos.length})</span>
              </h2>
              {photos.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 py-12 text-center text-sm text-stone-500">
                  Chưa có ảnh.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((p) => (
                    <PhotoCard key={p.id} photo={p} />
                  ))}
                </div>
              )}
            </section>

            <section className={`${sectionCard} mb-8`}>
              <h2 className="mb-4 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Mô tả</h2>
              <div className="rounded-2xl bg-stone-50/80 p-5 ring-1 ring-stone-100/80">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                  {detail.richDescription?.trim() || '—'}
                </p>
              </div>
            </section>

            <section className={`${sectionCard} mb-8`}>
              <h2 className="mb-5 font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">
                Địa chỉ và vận hành
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-4 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Địa chỉ</p>
                  <p className="mt-1 text-sm font-medium text-stone-900">{detail.address || '—'}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Thành phố / Quốc gia</p>
                  <p className="mt-1 text-sm text-stone-900">
                    {[detail.city, detail.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Khoảng giá</p>
                  <p className="mt-1 text-sm text-stone-900">{detail.priceRange || '—'}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Mức đông</p>
                  <p className="mt-1 text-sm text-stone-900">
                    {detail.crowdLevel ? displayMicroExperienceTagVi(detail.crowdLevel) : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 sm:col-span-2 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Giờ mở cửa</p>
                  {detail.openingHours ? (
                    <div className="mt-2 overflow-x-auto whitespace-pre-line break-words rounded-xl bg-stone-50 p-3 text-sm text-stone-800">
                      {formatOpeningHoursVi(detail.openingHours)}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-stone-900">—</p>
                  )}
                </div>
              </div>
            </section>

            <section className={`${sectionCard} mb-10 space-y-6`}>
              <h2 className="font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Thuộc tính</h2>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tiếp cận</p>
                <ChipList items={detail.accessibleBy} />
              </div>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Khung giờ phù hợp</p>
                <ChipList items={detail.preferredTimes} />
              </div>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  Thời tiết phù hợp
                </p>
                <ChipList items={detail.weatherSuitability} />
              </div>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Mùa</p>
                <ChipList items={detail.seasonality} />
              </div>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Thẻ</p>
                <ChipList items={detail.tags} />
              </div>
              <div className="space-y-1 rounded-2xl bg-stone-50/60 p-5 ring-1 ring-stone-100/80">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tiện ích</p>
                <ChipList items={detail.amenityTags} />
              </div>
            </section>

            <Link
              to="/admin/places"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#9a7b4f] hover:text-[#7d6540]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-stone-200/80">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </span>
              Danh sách địa điểm
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
