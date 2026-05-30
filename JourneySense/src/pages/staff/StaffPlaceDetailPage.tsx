import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import { listInProgressJourneysUsingExperience, updateExperienceLocation, updateExperienceStatus } from '../../api/staffExperiences'
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

export default function StaffPlaceDetailPage() {
  const { placeId } = useParams<{ placeId: string }>()
  const [detail, setDetail] = useState<MicroExperienceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const [previewPage] = useState(1)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<any | null>(null)
  const previewTotal = previewResult?.totalCount ?? 0

  const [latDraft, setLatDraft] = useState('')
  const [lngDraft, setLngDraft] = useState('')
  const [locationSaving, setLocationSaving] = useState(false)

  const [statusDraft, setStatusDraft] = useState<'active' | 'inactive'>('active')
  const [statusSaving, setStatusSaving] = useState(false)

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

  useEffect(() => {
    // initialize drafts after loading detail
    if (!detail) return
    setLatDraft(detail.latitude == null ? '' : String(detail.latitude))
    setLngDraft(detail.longitude == null ? '' : String(detail.longitude))
    const s = (detail.status ?? '').toLowerCase()
    setStatusDraft(s === 'inactive' ? 'inactive' : 'active')
  }, [detail])

  const loadPreview = useCallback(async () => {
    if (!placeId) return
    setPreviewLoading(true)
    try {
      const data = await listInProgressJourneysUsingExperience(placeId, { page: previewPage, pageSize: 5 })
      setPreviewResult(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình đang diễn ra.'))
      setPreviewResult(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [placeId, previewPage])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  if (!placeId) return <Navigate to="/staff/places" replace />

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
          to="/staff/places"
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
              to="/staff/places"
              className="mt-6 inline-flex rounded-xl bg-[#c5a070] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b08f5f]"
            >
              Quay lại danh sách
            </Link>
          </div>
        )}

        {!loading && detail && (
          <>
            {confirmDialog}
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
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">Đang được dùng trong hành trình</h3>
                  <p className="text-sm text-stone-600">{previewTotal ? `${previewTotal.toLocaleString('vi-VN')} hành trình đang diễn ra` : 'Chưa có dữ liệu'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPreview()}
                    className="inline-flex items-center justify-center rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-200 disabled:opacity-60"
                    disabled={previewLoading}
                  >
                    Tải lại
                  </button>
                </div>
              </div>
            </section>

            <section className={`${sectionCard} mb-8`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">Cập nhật vị trí</h3>
                  <p className="text-sm text-stone-600">Cập nhật tọa độ sẽ thông báo cho các hành trình đang diễn ra.</p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                    <span className="shrink-0">Vĩ độ</span>
                    <input
                      className="h-10 w-36 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                      value={latDraft}
                      onChange={(e) => setLatDraft(e.target.value)}
                      disabled={locationSaving}
                      placeholder="(trống)"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                    <span className="shrink-0">Kinh độ</span>
                    <input
                      className="h-10 w-36 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                      value={lngDraft}
                      onChange={(e) => setLngDraft(e.target.value)}
                      disabled={locationSaving}
                      placeholder="(trống)"
                    />
                  </label>

                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#c5a070] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                    disabled={locationSaving}
                    onClick={() => {
                      if (!placeId) return
                      if (locationSaving) return

                      const rawLat = latDraft.trim()
                      const rawLng = lngDraft.trim()
                      const lat = rawLat === '' ? NaN : Number(rawLat)
                      const lng = rawLng === '' ? NaN : Number(rawLng)

                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                        toast.warning('Vĩ độ/Kinh độ không hợp lệ.')
                        return
                      }
                      if (lat < -90 || lat > 90) {
                        toast.warning('Vĩ độ phải nằm trong [-90, 90].')
                        return
                      }
                      if (lng < -180 || lng > 180) {
                        toast.warning('Kinh độ phải nằm trong [-180, 180].')
                        return
                      }

                      void (async () => {
                        if (previewTotal > 0) {
                          const ok = await confirm({
                            title: 'Xác nhận cập nhật vị trí',
                            message: `Vị trí mới sẽ ảnh hưởng ${previewTotal.toLocaleString('vi-VN')} hành trình đang diễn ra (ứng dụng sẽ tự cập nhật).\nBạn vẫn muốn cập nhật?`,
                            confirmText: 'Cập nhật',
                            cancelText: 'Hủy',
                          })
                          if (!ok) return
                        }

                        setLocationSaving(true)
                        const t = toast.loading('Đang cập nhật vị trí…')
                        try {
                          const res = await updateExperienceLocation(placeId, { latitude: lat, longitude: lng })
                          setDetail((prev) => (prev ? { ...prev, latitude: res.latitude, longitude: res.longitude } : prev))
                          toast.success(`Đã cập nhật vị trí. Đã thông báo ${res.notifiedJourneyIds?.length ?? 0} hành trình.`, { id: t })
                          void loadPreview()
                        } catch (e) {
                          toast.error(getApiErrorMessage(e, 'Không cập nhật được vị trí.'), { id: t })
                        } finally {
                          setLocationSaving(false)
                        }
                      })()
                    }}
                  >
                    Cập nhật
                  </button>
                </div>
              </div>
            </section>

            <section className={`${sectionCard} mb-8`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 mb-1 font-['Cormorant_Garamond',serif]">Trạng thái hoạt động</h3>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                    <span className="shrink-0">Trạng thái</span>
                    <select
                      className="h-10 w-44 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value === 'inactive' ? 'inactive' : 'active')}
                      disabled={statusSaving}
                    >
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Không hoạt động</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#c5a070] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                    disabled={statusSaving}
                    onClick={() => {
                      if (!placeId) return
                      if (statusSaving) return

                      void (async () => {
                        if (previewTotal > 0) {
                          const ok = await confirm({
                            title: 'Xác nhận cập nhật trạng thái',
                            message: `Địa điểm này đang ảnh hưởng ${previewTotal.toLocaleString('vi-VN')} hành trình đang diễn ra.\nBạn vẫn muốn cập nhật trạng thái?`,
                            confirmText: 'Cập nhật',
                            cancelText: 'Hủy',
                            danger: statusDraft === 'inactive',
                          })
                          if (!ok) return
                        }

                        setStatusSaving(true)
                        const t = toast.loading('Đang cập nhật trạng thái…')
                        try {
                          const res = await updateExperienceStatus(placeId, { status: statusDraft })
                          setDetail((prev) => (prev ? { ...prev, status: res.status } : prev))
                          toast.success(`Đã cập nhật trạng thái. Đã thông báo ${res.notifiedJourneyIds?.length ?? 0} hành trình.`, { id: t })
                          void loadPreview()
                        } catch (e) {
                          toast.error(getApiErrorMessage(e, 'Không cập nhật được trạng thái.'), { id: t })
                        } finally {
                          setStatusSaving(false)
                        }
                      })()
                    }}
                  >
                    Cập nhật
                  </button>
                </div>
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Giờ mở cửa</p>
                  <p className="mt-1 text-sm text-stone-900">{formatOpeningHoursVi(detail.openingHours) || '—'}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Thời lượng gợi ý</p>
                  <p className="mt-1 text-sm text-stone-900">{detail.avgVisitDurationMinutes ?? '—'} phút</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Chủ đề</p>
                  <ChipList items={detail.tags} />
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-4 ring-1 ring-stone-100/80 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tiện ích</p>
                  <ChipList items={detail.amenityTags ?? detail.tags} />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
