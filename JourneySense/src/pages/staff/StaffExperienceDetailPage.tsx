import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import goongjs from '@goongmaps/goong-js'
import '@goongmaps/goong-js/dist/goong-js.css'
import { listInProgressJourneysUsingExperience, updateExperienceLocation, updateExperienceStatus } from '../../api/staffExperiences'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type {
  ExperiencePhotoResponse,
  MicroExperienceDetailResponse,
  StaffExperienceInProgressJourneysResponse,
  StaffExperienceStatus,
  StaffExperienceVisitDurationLogResponse,
} from '../../types/portal'
import { displayMicroExperienceTagVi, formatDate, formatOpeningHoursVi } from '../../utils/format'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'

function getExperienceStatusUi(raw?: string | null): { label: string; className: string } {
  const v = raw?.trim().toLowerCase()
  if (v === 'active') {
    return {
      label: 'Hoạt động',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    }
  }
  if (v === 'inactive') {
    return {
      label: 'Không hoạt động',
      className: 'bg-stone-100 text-stone-700 ring-stone-200/80',
    }
  }
  return {
    label: raw?.trim() || '—',
    className: 'bg-stone-50 text-stone-800 ring-stone-200/80',
  }
}

function ChipList({ items }: { items?: string[] | null }) {
  if (!items?.length) return <span className="text-stone-400 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <span
          key={x}
          className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200/80"
        >
          {displayMicroExperienceTagVi(x)}
        </span>
      ))}
    </div>
  )
}

function DlBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-stone-100 last:border-0">
      <dt className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd className="text-sm text-stone-900 break-words">{children}</dd>
    </div>
  )
}

function PhotoCard({ photo }: { photo: ExperiencePhotoResponse }) {
  const src = resolveApiMediaUrl(photo.thumbnailUrl || photo.photoUrl)
  const full = resolveApiMediaUrl(photo.photoUrl)
  return (
    <figure className="group relative rounded-xl overflow-hidden border border-stone-200/80 bg-stone-100 shadow-sm">
      {photo.isCover && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500 text-white shadow">
          Ảnh bìa
        </span>
      )}
      <a href={full} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
        <img
          src={src}
          alt={photo.caption || 'Ảnh trải nghiệm'}
          className="w-full h-full object-cover transition group-hover:opacity-95"
          loading="lazy"
        />
      </a>
      {(photo.caption || photo.uploadedAt) && (
        <figcaption className="px-2 py-1.5 text-[11px] text-stone-600 bg-white/95 border-t border-stone-100">
          {photo.caption ? <span className="line-clamp-2">{photo.caption}</span> : null}
          {photo.uploadedAt && (
            <span className="block text-stone-400 mt-0.5">{formatDate(photo.uploadedAt)}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

function toUtcIsoFromDatetimeLocal(input: string): string | undefined {
  const s = input.trim()
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export default function StaffExperienceDetailPage() {
  const { placeId, journeyId } = useParams<{ placeId: string; journeyId: string }>()
  const experienceId = placeId ?? journeyId
  const navigate = useNavigate()
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const [detail, setDetail] = useState<MicroExperienceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [avgDraft, setAvgDraft] = useState('')
  const [avgSaving, setAvgSaving] = useState(false)

  const previewPageSize = 5
  const [previewPage, setPreviewPage] = useState(1)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<StaffExperienceInProgressJourneysResponse | null>(null)

  const previewItems = previewResult?.items ?? []
  const previewTotal = previewResult?.totalCount ?? 0
  const previewTotalPages = Math.max(1, Math.ceil(previewTotal / previewPageSize))

  const [latDraft, setLatDraft] = useState('')
  const [lngDraft, setLngDraft] = useState('')
  const [locationSaving, setLocationSaving] = useState(false)

  type CoordinateMode = 'manual' | 'goong'
  type PlaceSuggestion = { description: string; placeId: string; mainText?: string | null; secondaryText?: string | null }
  type PlaceDetail = { name?: string | null; formattedAddress?: string | null; latitude?: number | null; longitude?: number | null }

  const goongMapKey = import.meta.env.VITE_GOONG_MAP_KEY
  const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>('manual')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([])
  const [placeLoading, setPlaceLoading] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const goongMapRef = useRef<any | null>(null)
  const goongMarkerRef = useRef<any | null>(null)

  const [statusDraft, setStatusDraft] = useState<StaffExperienceStatus>('active')
  const [statusSaving, setStatusSaving] = useState(false)

  const [logPage, setLogPage] = useState(1)
  const [logLoading, setLogLoading] = useState(false)
  const [logResult, setLogResult] = useState<StaffExperienceVisitDurationLogResponse | null>(null)

  const [logFromInput, setLogFromInput] = useState('')
  const [logToInput, setLogToInput] = useState('')
  const [logFromUtc, setLogFromUtc] = useState<string | undefined>(undefined)
  const [logToUtc, setLogToUtc] = useState<string | undefined>(undefined)

  const logItems = logResult?.items ?? []
  const logTotal = logResult?.totalCount ?? 0
  const logPageSize = logResult?.pageSize ?? 5
  const logTotalPages = Math.max(1, Math.ceil(logTotal / logPageSize))

  const actualAvgMinutesOverall = useMemo(() => {
    const v = logResult?.summary?.averageActualDurationMinutes
    if (v == null) return null
    return Number.isFinite(v) ? v : null
  }, [logResult?.summary?.averageActualDurationMinutes])

  const actualAvgLabelOverall = useMemo(() => {
    if (actualAvgMinutesOverall == null) return '—'
    const rounded = Math.round(actualAvgMinutesOverall)
    return rounded <= 0 ? '—' : `~${rounded}`
  }, [actualAvgMinutesOverall])

  const actualAvgMinutesThisPage = useMemo(() => {
    const values = logItems
      .map((x) => x.actualDurationMinutes)
      .filter((v): v is number => v != null && Number.isFinite(v))
    if (values.length === 0) return null
    const sum = values.reduce((acc, v) => acc + v, 0)
    return sum / values.length
  }, [logItems])

  const actualAvgLabelThisPage = useMemo(() => {
    if (actualAvgMinutesThisPage == null) return '—'
    const rounded = Math.round(actualAvgMinutesThisPage)
    return rounded <= 0 ? '—' : `~${rounded}`
  }, [actualAvgMinutesThisPage])

  const avgHint = useMemo(() => {
    const v = detail?.avgVisitDurationMinutes
    if (v == null) return null
    if (!Number.isFinite(v)) return null
    const rounded = Math.round(v)
    return rounded > 0 ? `Thường ở lại ~${rounded} phút.` : null
  }, [detail?.avgVisitDurationMinutes])

  const loadPreview = useCallback(async () => {
    if (!experienceId) return
    setPreviewLoading(true)
    try {
      const data = await listInProgressJourneysUsingExperience(experienceId, { page: previewPage, pageSize: previewPageSize })
      setPreviewResult(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được danh sách hành trình đang diễn ra.'))
      setPreviewResult(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [experienceId, previewPage])

  useEffect(() => {
    if (coordinateMode !== 'goong') return
    const q = placeQuery.trim()
    if (q.length < 2) {
      setPlaceSuggestions([])
      return
    }

    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      void (async () => {
        setPlaceLoading(true)
        try {
          const { data } = await api.get<PlaceSuggestion[] | unknown>('/api/goong/place-suggestions', {
            params: { input: q, limit: 8 },
            signal: ctrl.signal,
          })
          setPlaceSuggestions(Array.isArray(data) ? (data as PlaceSuggestion[]) : [])
        } catch (e) {
          setPlaceSuggestions([])
        } finally {
          setPlaceLoading(false)
        }
      })()
    }, 350)

    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [coordinateMode, placeQuery])

  const selectPlace = async (s: PlaceSuggestion) => {
    setPlaceQuery(s.description)
    setPlaceSuggestions([])
    setPlaceLoading(true)
    try {
      const { data } = await api.get<PlaceDetail>('/api/goong/place-detail', {
        params: { placeId: s.placeId },
      })
      setSelectedPlace(data)
      const lat = data.latitude
      const lng = data.longitude
      if (lat != null && lng != null) {
        setLatDraft(String(lat))
        setLngDraft(String(lng))
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không lấy được chi tiết địa điểm từ Goong.'))
    } finally {
      setPlaceLoading(false)
    }
  }

  useEffect(() => {
    if (coordinateMode !== 'goong') return
    if (!goongMapKey) return
    if (!mapContainerRef.current) return

    const lat = Number(latDraft)
    const lng = Number(lngDraft)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const sdk = goongjs as any
    try {
      if (!goongMapRef.current) {
        sdk.accessToken = goongMapKey
        goongMapRef.current = new sdk.Map({
          container: mapContainerRef.current,
          style: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(goongMapKey)}`,
          center: [lng, lat],
          zoom: 15,
        })
        goongMarkerRef.current = new sdk.Marker().setLngLat([lng, lat]).addTo(goongMapRef.current)
        return
      }

      goongMapRef.current.setCenter([lng, lat])
      if (goongMarkerRef.current) goongMarkerRef.current.setLngLat([lng, lat])
    } catch {
      // ignore map errors
    }
  }, [coordinateMode, goongMapKey, latDraft, lngDraft])

  useEffect(() => {
    return () => {
      try {
        if (goongMapRef.current) {
          goongMapRef.current.remove()
          goongMapRef.current = null
          goongMarkerRef.current = null
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const load = useCallback(async () => {
    if (!experienceId) return
    setLoading(true)
    try {
      const { data } = await api.get<MicroExperienceDetailResponse>(`/api/micro-experiences/${experienceId}`)
      setDetail(data)
      setAvgDraft(data?.avgVisitDurationMinutes == null ? '' : String(data.avgVisitDurationMinutes))

      const lat = data?.latitude
      const lng = data?.longitude
      setLatDraft(lat == null ? '' : String(lat))
      setLngDraft(lng == null ? '' : String(lng))

      const s = (data?.status ?? '').toLowerCase()
      setStatusDraft(s === 'inactive' ? 'inactive' : 'active')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được chi tiết.'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [experienceId])

  useEffect(() => {
    setLogPage(1)
    setLogResult(null)
    setLogFromInput('')
    setLogToInput('')
    setLogFromUtc(undefined)
    setLogToUtc(undefined)

    setPreviewPage(1)
    setPreviewResult(null)
  }, [experienceId])

  useEffect(() => {
    if (!experienceId) return
    if (previewPage > previewTotalPages) setPreviewPage(previewTotalPages)
  }, [experienceId, previewPage, previewTotalPages])

  const loadLogs = useCallback(async () => {
    if (!experienceId) return
    setLogLoading(true)
    try {
      const { data } = await api.get<StaffExperienceVisitDurationLogResponse>(
        `/api/staff/experiences/${experienceId}/visit-durations`,
        {
          params: {
              page: logPage,
              pageSize: 5,
              includeSummary: true,
              fromUtc: logFromUtc,
              toUtc: logToUtc,
            },
        },
      )
      setLogResult(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được log thời gian dừng chân.'))
      setLogResult(null)
    } finally {
      setLogLoading(false)
    }
  }, [experienceId, logFromUtc, logPage, logToUtc])

  useEffect(() => {
    if (!experienceId) return
    void loadLogs()
  }, [experienceId, loadLogs])

  useEffect(() => {
    if (!experienceId) return
    void loadPreview()
  }, [experienceId, loadPreview])

  useEffect(() => {
    if (logPage > logTotalPages) setLogPage(logTotalPages)
  }, [logPage, logTotalPages])

  useEffect(() => {
    void load()
  }, [load])

  if (!experienceId) return null

  const photos = detail?.photos?.length ? detail.photos : []

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#fdfbf7] to-[#f5f0e8]">
      {confirmDialog}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 py-4 bg-white/90 backdrop-blur border-b border-stone-200/80 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="lg:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100"
            aria-label="Bật hoặc tắt menu bên"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-stone-900 font-['Cormorant_Garamond',serif] truncate">
              Chi tiết trải nghiệm
            </h1>
            <p className="text-[11px] text-stone-500 font-mono truncate">{experienceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/staff/journeys/${experienceId}/edit`}
            className="inline-flex items-center justify-center rounded-xl p-2.5 text-white bg-[#c5a070] hover:bg-[#b08f5f] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            title="Sửa"
            aria-label="Sửa"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.172l8.586-8.586z"
              />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/staff/places')}
            className="hidden text-sm font-medium text-stone-600 hover:text-amber-800 sm:inline"
          >
            Đóng
          </button>
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
          {loading && <p className="text-stone-500 text-sm text-center py-16">Đang tải…</p>}

          {!loading && !detail && (
            <div className="rounded-2xl bg-white border border-stone-200 p-8 text-center space-y-4">
              <p className="text-stone-600 text-sm">Không có dữ liệu hoặc bạn không có quyền xem.</p>
              <Link to="/staff/places" className="text-amber-700 text-sm font-semibold hover:underline">
                ← Về danh sách địa điểm
              </Link>
            </div>
          )}

          {!loading && detail && (
            <>
              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 font-['Cormorant_Garamond',serif]">
                      {detail.name ?? '—'}
                    </h2>
                    {detail.categoryName && (
                      <p className="text-sm text-stone-500 mt-1">Danh mục: {detail.categoryName}</p>
                    )}
                    {avgHint && <p className="text-sm text-stone-600 mt-1">{avgHint}</p>}
                  </div>
                    {(() => {
                      const ui = getExperienceStatusUi(detail.status)
                      return (
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ring-1 ${ui.className}`}>
                          {ui.label}
                        </span>
                      )
                    })()}
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-stone-600">
                  <span>
                    Đánh giá TB:{' '}
                    <strong className="text-stone-900">{Number(detail.avgRating ?? 0).toFixed(1)}</strong>
                  </span>
                  <span>
                    Chất lượng:{' '}
                    <strong className="text-stone-900">{Number(detail.qualityScore ?? 0).toFixed(2)}</strong>
                  </span>
                  {detail.latitude != null && detail.longitude != null && (
                    <span className="font-mono text-xs text-stone-500">
                      {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                    </span>
                  )}
                </div>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">
                      Đang được dùng trong hành trình
                    </h3>
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

                <div className="overflow-x-auto rounded-xl border border-stone-200/80">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-stone-600">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Du khách</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Bắt đầu</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Tuyến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {previewLoading && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                            Đang tải…
                          </td>
                        </tr>
                      )}

                      {!previewLoading && previewItems.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                            Không có hành trình đang diễn ra nào đang dùng địa điểm này.
                          </td>
                        </tr>
                      )}

                      {!previewLoading &&
                        previewItems.map((row) => (
                          <tr key={row.journeyId} className="hover:bg-stone-50/70">
                            <td className="px-4 py-3">
                              <div className="font-medium text-stone-900 truncate max-w-[18rem]">
                                {row.travelerFullName?.trim() || row.travelerId}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                              {row.startedAt ? formatDate(row.startedAt) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-stone-800 line-clamp-2">
                                {(row.originAddress ?? '—') + ' → ' + (row.destinationAddress ?? '—')}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-stone-500">
                    Tổng: <span className="font-semibold text-stone-700">{previewTotal.toLocaleString('vi-VN')}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60"
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={previewLoading || previewPage <= 1}
                    >
                      ← Trước
                    </button>
                    <span className="text-sm text-stone-600">
                      Trang <strong className="text-stone-900">{previewPage}</strong> / {previewTotalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60"
                      onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                      disabled={previewLoading || previewPage >= previewTotalPages}
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 mb-1 font-['Cormorant_Garamond',serif]">
                      Cập nhật vị trí (lat/lng)
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCoordinateMode('manual')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          coordinateMode === 'manual'
                            ? 'bg-white border-amber-300 text-amber-900 ring-2 ring-amber-400/20'
                            : 'bg-white/70 border-stone-200 text-stone-600 hover:bg-white'
                        }`}
                      >
                        Nhập tay
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoordinateMode('goong')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          coordinateMode === 'goong'
                            ? 'bg-white border-amber-300 text-amber-900 ring-2 ring-amber-400/20'
                            : 'bg-white/70 border-stone-200 text-stone-600 hover:bg-white'
                        }`}
                      >
                        Tìm trên Goong
                      </button>
                    </div>

                    {coordinateMode === 'manual' ? (
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                          <span className="shrink-0">Vĩ độ</span>
                          <input
                            type="number"
                            step="0.000001"
                            inputMode="decimal"
                            className="h-10 w-44 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                            placeholder="10.123456"
                            value={latDraft}
                            onChange={(e) => setLatDraft(e.target.value)}
                            disabled={locationSaving}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                          <span className="shrink-0">Kinh độ</span>
                          <input
                            type="number"
                            step="0.000001"
                            inputMode="decimal"
                            className="h-10 w-44 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                            placeholder="106.123456"
                            value={lngDraft}
                            onChange={(e) => setLngDraft(e.target.value)}
                            disabled={locationSaving}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="w-full max-w-md">
                        <div className="relative">
                          <input
                            value={placeQuery}
                            onChange={(e) => {
                              setPlaceQuery(e.target.value)
                              setSelectedPlace(null)
                            }}
                            className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none"
                            placeholder="Nhập tên quán, địa chỉ…"
                          />
                          {placeLoading && (
                            <div className="absolute right-3 top-2 text-[11px] font-semibold text-stone-500">Đang tìm…</div>
                          )}
                          {placeSuggestions.length > 0 && (
                            <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
                              {placeSuggestions.map((sug) => (
                                <button
                                  key={sug.placeId}
                                  type="button"
                                  onClick={() => void selectPlace(sug)}
                                  className="w-full text-left px-4 py-3 hover:bg-stone-50"
                                >
                                  <p className="text-sm font-semibold text-stone-900 truncate">{sug.mainText || sug.description}</p>
                                  <p className="mt-0.5 text-xs text-stone-600 truncate">{sug.secondaryText || sug.description}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <input value={latDraft} readOnly className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 shadow-sm" placeholder="Vĩ độ" />
                          <input value={lngDraft} readOnly className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 shadow-sm" placeholder="Kinh độ" />
                        </div>

                        <div className="mt-3 rounded-2xl border border-stone-200/80 bg-white p-3">
                          {!goongMapKey && (
                            <p className="text-xs text-stone-600">Chưa cấu hình VITE_GOONG_MAP_KEY nên chưa hiển thị bản đồ.</p>
                          )}
                          {goongMapKey && (
                            <div ref={mapContainerRef} className="h-[160px] w-full overflow-hidden rounded-2xl bg-stone-100" aria-label="Bản đồ Goong" />
                          )}
                          {selectedPlace?.name && (
                            <p className="mt-2 text-[11px] font-semibold text-stone-600 truncate">Đã chọn: <span className="text-stone-900">{selectedPlace.name}</span></p>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#c5a070] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                        disabled={locationSaving}
                        onClick={() => {
                          if (!experienceId) return
                          if (locationSaving) return

                          const lat = Number(latDraft)
                          const lng = Number(lngDraft)
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
                              const res = await updateExperienceLocation(experienceId, { latitude: lat, longitude: lng })
                              setDetail((prev) => (prev ? { ...prev, latitude: res.latitude, longitude: res.longitude } : prev))
                              toast.success(`Đã cập nhật vị trí. Đã thông báo ${res.notifiedJourneyIds?.length ?? 0} hành trình.`, {
                                id: t,
                              })
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
                </div>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 mb-1 font-['Cormorant_Garamond',serif]">
                      Trạng thái hoạt động
                    </h3>
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

                    {(() => {
                      const ui = getExperienceStatusUi(statusDraft)
                      return (
                        <span
                          className={`inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ring-1 ${ui.className}`}
                        >
                          {ui.label}
                        </span>
                      )
                    })()}

                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#c5a070] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                      disabled={statusSaving}
                      onClick={() => {
                        if (!experienceId) return
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
                            const res = await updateExperienceStatus(experienceId, { status: statusDraft })
                            setDetail((prev) => (prev ? { ...prev, status: res.status } : prev))
                            toast.success(`Đã cập nhật trạng thái. Đã thông báo ${res.notifiedJourneyIds?.length ?? 0} hành trình.`, {
                              id: t,
                            })
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

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <h3 className="text-sm font-bold text-stone-900 mb-3 font-['Cormorant_Garamond',serif]">
                  Ảnh trải nghiệm
                  <span className="font-sans font-normal text-stone-500 text-xs ml-2">({photos.length})</span>
                </h3>
                {photos.length === 0 ? (
                  <p className="text-sm text-stone-500 py-6 text-center rounded-xl bg-stone-50 border border-dashed border-stone-200">
                    Chưa có ảnh trong bảng experience_photos.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {photos.map((p) => (
                      <PhotoCard key={p.id} photo={p} />
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <h3 className="text-sm font-bold text-stone-900 mb-3 font-['Cormorant_Garamond',serif]">Mô tả</h3>
                <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {detail.richDescription?.trim() || '—'}
                </p>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <h3 className="text-sm font-bold text-stone-900 mb-3 font-['Cormorant_Garamond',serif]">
                  Địa chỉ &amp; vận hành
                </h3>
                <dl>
                  <DlBlock label="Địa chỉ">{detail.address || '—'}</DlBlock>
                  <DlBlock label="Thành phố / Quốc gia">
                    {[detail.city, detail.country].filter(Boolean).join(', ') || '—'}
                  </DlBlock>
                  <DlBlock label="Giờ mở cửa">
                    {detail.openingHours ? (
                      <div className="text-sm text-stone-800 bg-stone-50 rounded-lg p-3 overflow-x-auto whitespace-pre-line break-words">
                        {formatOpeningHoursVi(detail.openingHours)}
                      </div>
                    ) : (
                      '—'
                    )}
                  </DlBlock>
                  <DlBlock label="Khoảng giá">{detail.priceRange || '—'}</DlBlock>
                  <DlBlock label="Mức đông">
                    {detail.crowdLevel ? displayMicroExperienceTagVi(detail.crowdLevel) : '—'}
                  </DlBlock>
                </dl>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 mb-1 font-['Cormorant_Garamond',serif]">
                      Thời gian tham quan trung bình
                    </h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                      <span>Phút</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className="h-10 w-28 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                        placeholder="(trống)"
                        value={avgDraft}
                        onChange={(e) => setAvgDraft(e.target.value)}
                        disabled={avgSaving}
                      />
                    </label>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-xl bg-[#c5a070] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                      disabled={avgSaving}
                      onClick={() => {
                        if (!experienceId) return
                        if (avgSaving) return

                        const raw = avgDraft.trim()
                        let payload: number | null = null
                        if (raw) {
                          const n = Number(raw)
                          if (!Number.isFinite(n) || n <= 0) {
                            toast.warning('Thời gian tham quan trung bình phải là số > 0, hoặc để trống để xoá.')
                            return
                          }
                          payload = n
                        }

                        setAvgSaving(true)
                        const t = toast.loading('Đang lưu…')
                        void (async () => {
                          try {
                            await api.patch(`/api/staff/experiences/${experienceId}/avg-visit-duration`, {
                              avgVisitDurationMinutes: payload,
                            })
                            setDetail((prev) => (prev ? { ...prev, avgVisitDurationMinutes: payload } : prev))
                            toast.success('Đã lưu', { id: t })
                          } catch (e) {
                            toast.error(getApiErrorMessage(e, 'Không lưu được.'), { id: t })
                          } finally {
                            setAvgSaving(false)
                          }
                        })()
                      }}
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">
                      Lượt ghé thăm & thời gian dừng chân
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {actualAvgMinutesOverall == null ? (
                        <>
                          Thời gian dừng chân trung bình (trang này):{' '}
                          <span className="font-semibold text-stone-700">{actualAvgLabelThisPage}</span> phút
                        </>
                      ) : (
                        <>
                          Thời gian dừng chân trung bình (tất cả):{' '}
                          <span className="font-semibold text-stone-700">{actualAvgLabelOverall}</span> phút
                          {actualAvgMinutesThisPage != null && (
                            <span className="text-stone-400"> • (trang này: {actualAvgLabelThisPage} phút)</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                      <span className="shrink-0">Từ</span>
                      <input
                        type="datetime-local"
                        className="h-10 w-44 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                        value={logFromInput}
                        onChange={(e) => setLogFromInput(e.target.value)}
                        disabled={logLoading}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                      <span className="shrink-0">Đến</span>
                      <input
                        type="datetime-local"
                        className="h-10 w-44 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                        value={logToInput}
                        onChange={(e) => setLogToInput(e.target.value)}
                        disabled={logLoading}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const fromIso = toUtcIsoFromDatetimeLocal(logFromInput)
                        const toIso = toUtcIsoFromDatetimeLocal(logToInput)

                        if (logFromInput.trim() && !fromIso) {
                          toast.warning('Giá trị “Từ” không hợp lệ.')
                          return
                        }
                        if (logToInput.trim() && !toIso) {
                          toast.warning('Giá trị “Đến” không hợp lệ.')
                          return
                        }
                        if (fromIso && toIso && fromIso > toIso) {
                          toast.warning('Khoảng thời gian không hợp lệ: “Từ” phải trước “Đến”.')
                          return
                        }

                        setLogFromUtc(fromIso)
                        setLogToUtc(toIso)
                        setLogPage(1)
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-[#c5a070] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f] disabled:opacity-60"
                      disabled={logLoading}
                      title="Áp dụng bộ lọc"
                    >
                      Áp dụng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLogFromInput('')
                        setLogToInput('')
                        setLogFromUtc(undefined)
                        setLogToUtc(undefined)
                        setLogPage(1)
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-200 disabled:opacity-60"
                      disabled={logLoading || (!logFromUtc && !logToUtc && !logFromInput.trim() && !logToInput.trim())}
                      title="Xoá lọc"
                    >
                      Xoá
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadLogs()}
                      className="inline-flex items-center justify-center rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-200 disabled:opacity-60"
                      disabled={logLoading}
                    >
                      Tải lại
                    </button>
                  </div>
                </div>

                {(logFromUtc || logToUtc) && (
                  <p className="text-[11px] text-stone-500 mb-3">
                    Đang lọc theo khoảng thời gian (UTC). Từ: <span className="font-mono">{logFromUtc ?? '—'}</span> • Đến:{' '}
                    <span className="font-mono">{logToUtc ?? '—'}</span>
                  </p>
                )}

                <div className="overflow-x-auto rounded-xl border border-stone-200/80">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-stone-600">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Du khách</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Ghé lúc</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                          Số phút
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {logLoading && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                            Đang tải…
                          </td>
                        </tr>
                      )}

                      {!logLoading && logItems.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                            {logFromUtc || logToUtc || logFromInput.trim() || logToInput.trim()
                              ? 'Không có dữ liệu trong khoảng thời gian đã chọn.'
                              : 'Chưa có dữ liệu lượt ghé thăm.'}
                          </td>
                        </tr>
                      )}

                      {!logLoading &&
                        logItems.map((row) => (
                          <tr key={row.visitId} className="hover:bg-stone-50/70">
                            <td className="px-4 py-3">
                              <div className="font-medium text-stone-900 truncate max-w-[18rem]">
                                {row.travelerFullName?.trim() || row.travelerEmail || row.travelerId}
                              </div>
                              {row.travelerFullName?.trim() && row.travelerEmail?.trim() && (
                                <div className="text-[11px] text-stone-500 truncate max-w-[18rem]">{row.travelerEmail}</div>
                              )}
                              </td>
                              <td className="px-4 py-3 text-stone-700">{row.visitedAt ? formatDate(row.visitedAt) : '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">
                              {row.actualDurationMinutes == null ? '—' : Math.round(row.actualDurationMinutes)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-stone-500">
                    Tổng: <span className="font-semibold text-stone-700">{logTotal.toLocaleString('vi-VN')}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60"
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      disabled={logLoading || logPage <= 1}
                    >
                      ← Trước
                    </button>
                    <span className="text-sm text-stone-600">
                      Trang <strong className="text-stone-900">{logPage}</strong> / {logTotalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60"
                      onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                      disabled={logLoading || logPage >= logTotalPages}
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white border border-stone-200/80 shadow-md p-6 sm:p-7 space-y-5">
                <h3 className="text-sm font-bold text-stone-900 font-['Cormorant_Garamond',serif]">
                  Thuộc tính &amp; tag
                </h3>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Tiếp cận</p>
                  <ChipList items={detail.accessibleBy} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Khung giờ phù hợp
                  </p>
                  <ChipList items={detail.preferredTimes} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Thời tiết phù hợp
                  </p>
                  <ChipList items={detail.weatherSuitability} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Mùa</p>
                  <ChipList items={detail.seasonality} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Thẻ phong cách</p>
                  <ChipList items={detail.tags} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Tiện ích</p>
                  <ChipList items={detail.amenityTags} />
                </div>
              </section>

              <Link
                to="/staff/places"
                className="inline-flex text-sm font-medium text-[#c5a070] hover:underline mb-8"
              >
                ← Danh sách địa điểm
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
