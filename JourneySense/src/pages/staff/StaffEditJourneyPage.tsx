import axios from 'axios'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirmDialog } from '../../components/ConfirmDialog'
import {
  ExperienceFormSectionHeader,
  experienceFieldLabel as labelCls,
  experienceInputClass as inputCls,
  experienceSelectClass as selectCls,
} from '../../components/staff/ExperienceFormSectionHeader'
import MicroExperienceExtraFields from '../../components/staff/MicroExperienceExtraFields'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import api from '../../api/axios'
import { joinAmenityForInput, parseAmenityInput, VIBE_TYPE_OPTIONS } from '../../constants/microExperienceEnums'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type {
  CategoryResponseDto,
  ExperiencePhotoInput,
  ExperiencePhotoResponse,
  MicroExperienceDetailResponse,
  CloudinaryUploadSignatureResponse,
} from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { resolveCoordinatePayload } from '../../utils/coordinates'
import { resolveApiMediaUrl } from '../../utils/mediaUrl'
import {
  type OpeningHoursValue,
  parseOpeningHoursString,
  serializeOpeningHours,
} from '../../components/staff/OpeningHoursPicker'

const VIBE_SET = new Set<string>(VIBE_TYPE_OPTIONS.map((o) => o.value))

const VEHICLE_SLUGS = new Set(['walking', 'bicycle', 'motorbike', 'car'])

/** Seed cũ dùng AllYear; enum là YearRound */
const SEASON_ALIASES: Record<string, string> = {
  allyear: 'YearRound',
  AllYear: 'YearRound',
  ALLYEAR: 'YearRound',
}

function buildTagsPayload(enumTags: string[], tagsExtraLine: string): string[] {
  const extra = parseAmenityInput(tagsExtraLine)
  return [...new Set([...enumTags, ...extra])]
}

export default function StaffEditJourneyPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const navigate = useNavigate()
  const base = import.meta.env.VITE_API_BASE_URL ?? ''

  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('active')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [latitudeStr, setLatitudeStr] = useState('')
  const [longitudeStr, setLongitudeStr] = useState('')
  const [richDescription, setRichDescription] = useState('')

  const [accessibleBy, setAccessibleBy] = useState<string[]>(['walking'])
  const [preferredTimes, setPreferredTimes] = useState<string[]>([])
  const [weatherSuitability, setWeatherSuitability] = useState<string[]>([])
  const [seasonality, setSeasonality] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagsExtraInput, setTagsExtraInput] = useState('')
  const [amenityInput, setAmenityInput] = useState('')
  const [openingHours, setOpeningHours] = useState<OpeningHoursValue>({})
  const [priceRange, setPriceRange] = useState('')
  const [crowdLevel, setCrowdLevel] = useState('normal')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [experiencePhotos, setExperiencePhotos] = useState<ExperiencePhotoResponse[]>([])
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadIsCover, setUploadIsCover] = useState(false)
  const [urlPhotoUrl, setUrlPhotoUrl] = useState('')
  const [urlThumb, setUrlThumb] = useState('')
  const [urlCaption, setUrlCaption] = useState('')
  const [urlIsCover, setUrlIsCover] = useState(false)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)

  const { confirm, dialog } = useConfirmDialog()

  useEffect(() => {
    void axios.get<CategoryResponseDto[]>(`${base}/api/categories`).then(({ data }) => {
      setCategories(Array.isArray(data) ? data : [])
    })
  }, [base])

  const load = useCallback(async () => {
    if (!journeyId) return
    setLoading(true)
    try {
      const { data } = await api.get<MicroExperienceDetailResponse>(`/api/micro-experiences/${journeyId}`)
      setName(data.name ?? '')
      setCategoryId(data.categoryId ?? '')
      setStatus(data.status ?? 'active')
      setAddress(data.address ?? '')
      setCity(data.city ?? '')
      setCountry(data.country ?? '')
      setRichDescription(data.richDescription ?? '')
      setAccessibleBy(
        data.accessibleBy?.length
          ? data.accessibleBy.map((v) => {
              const lo = v.toLowerCase()
              return VEHICLE_SLUGS.has(lo) ? lo : v
            })
          : ['walking'],
      )
      setPreferredTimes(data.preferredTimes ?? [])
      setWeatherSuitability(data.weatherSuitability ?? [])
      setSeasonality(
        (data.seasonality ?? []).map((s) => SEASON_ALIASES[s] ?? SEASON_ALIASES[s.toLowerCase()] ?? s),
      )

      const allTagsSafe = data.tags ?? []
      setTags(allTagsSafe.filter((t) => VIBE_SET.has(t)))
      setTagsExtraInput(allTagsSafe.filter((t) => !VIBE_SET.has(t)).join('\n'))

      setAmenityInput(joinAmenityForInput(data.amenityTags))
      setOpeningHours(parseOpeningHoursString(data.openingHours))
      setPriceRange(data.priceRange ?? '')
      const c = data.crowdLevel?.toLowerCase?.() ?? ''
      setCrowdLevel(['all', 'quiet', 'normal', 'busy'].includes(c) ? c : 'normal')
      setExperiencePhotos(data.photos ?? [])
      setLatitudeStr(data.latitude != null && Number.isFinite(data.latitude) ? String(data.latitude) : '')
      setLongitudeStr(data.longitude != null && Number.isFinite(data.longitude) ? String(data.longitude) : '')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được experience.'))
    } finally {
      setLoading(false)
    }
  }, [journeyId])

  useEffect(() => {
    void load()
  }, [load])

  const buildPutBody = (
    photosAppend?: ExperiencePhotoInput[],
    coordinates?: { latitude: number; longitude: number },
  ) => {
    const amenityTags = parseAmenityInput(amenityInput)
    const tagsPayload = buildTagsPayload(tags, tagsExtraInput)
    return {
      name: name.trim(),
      categoryId,
      status: status || 'active',
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
      accessibleBy: accessibleBy.length ? accessibleBy : undefined,
      preferredTimes: preferredTimes.length ? preferredTimes : undefined,
      weatherSuitability: weatherSuitability.length ? weatherSuitability : undefined,
      seasonality: seasonality.length ? seasonality : undefined,
      amenityTags: amenityTags.length ? amenityTags : undefined,
      tags: tagsPayload,
      richDescription: richDescription.trim() || undefined,
      openingHours: serializeOpeningHours(openingHours) ?? undefined,
      priceRange: priceRange.trim() || undefined,
      crowdLevel: crowdLevel || 'normal',
      ...(photosAppend?.length ? { photos: photosAppend } : {}),
    }
  }

  const save = async () => {
    if (!journeyId || !categoryId || !name.trim()) {
      toast.warning('Cần tên và danh mục.')
      return
    }
    const pendingUrlPhotos: ExperiencePhotoInput[] = []
    if (urlPhotoUrl.trim()) {
      pendingUrlPhotos.push({
        photoUrl: urlPhotoUrl.trim(),
        thumbnailUrl: urlThumb.trim() || undefined,
        caption: urlCaption.trim() || undefined,
        isCover: urlIsCover,
      })
    }
    const coord = resolveCoordinatePayload(latitudeStr, longitudeStr)
    if (coord.kind === 'invalid') {
      toast.warning(coord.message)
      return
    }
    const coordinatePair = coord.kind === 'fixed' ? { latitude: coord.latitude, longitude: coord.longitude } : undefined
    setBusy(true)
    const t = toast.loading('Đang lưu…')
    try {
      await api.put(
        `/api/micro-experiences/${journeyId}`,
        buildPutBody(pendingUrlPhotos.length ? pendingUrlPhotos : undefined, coordinatePair),
      )
      toast.dismiss(t)
      toast.success(pendingUrlPhotos.length ? 'Đã lưu và thêm ảnh (URL)' : 'Đã lưu thay đổi')
      if (pendingUrlPhotos.length) {
        setUrlPhotoUrl('')
        setUrlThumb('')
        setUrlCaption('')
        setUrlIsCover(false)
      }
      await load()
    } catch (e) {
      toast.dismiss(t)
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!journeyId) return

    const ok = await confirm({
      title: 'Xóa trải nghiệm',
      message: 'Xóa trải nghiệm này? Thao tác không hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

    setBusy(true)
    try {
      await api.delete(`/api/micro-experiences/${journeyId}`)
      toast.success('Đã xóa trải nghiệm')
      navigate('/staff', { replace: true })
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không xóa được.'))
    } finally {
      setBusy(false)
    }
  }

  const removeExperiencePhoto = async (photoId: string) => {
    if (!journeyId) return

    const ok = await confirm({
      title: 'Xóa ảnh',
      message: 'Xóa ảnh này khỏi trải nghiệm?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
    })
    if (!ok) return

    setBusy(true)
    try {
      await api.delete(`/api/micro-experiences/${journeyId}/photos/${photoId}`)
      toast.success('Đã xoá ảnh')
      await load()
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Upload ảnh trực tiếp lên Cloudinary bằng signed upload.
   * - Lấy signature từ BE
   * - POST FormData lên Cloudinary (chỉ gồm params đã ký: timestamp, public_id, overwrite + file + api_key + signature)
   */
  type CloudinaryUploadResponse = {
    public_id?: string
    url?: string
    secure_url?: string
  }

  const uploadPhotoToCloudinary = async (file: File, isCover: boolean): Promise<{ publicId: string; photoUrl: string }> => {
    if (!journeyId) throw new Error('journeyId not found')

    // Bước 1: Lấy signature từ BE
    const signatureRes = await api.post<CloudinaryUploadSignatureResponse>(
      `/api/micro-experiences/${journeyId}/photos/cloudinary-signature`,
      { isCover }
    )
    const sig = signatureRes.data

    // Bước 2: Tạo FormData với CHỈ các params đã ký: timestamp, public_id, overwrite
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', sig.apiKey)
    fd.append('timestamp', String(sig.timestamp))
    fd.append('signature', sig.signature)
    fd.append('public_id', sig.publicId)
    fd.append('overwrite', String(sig.overwrite))

    // Bước 3: POST lên Cloudinary
    const uploadRes = await axios.post<CloudinaryUploadResponse>(sig.uploadUrl, fd)

    const publicId = uploadRes.data.public_id || sig.publicId
    const photoUrl = uploadRes.data.secure_url || uploadRes.data.url
    if (!photoUrl) {
      throw new Error('Cloudinary upload succeeded but no URL returned (missing secure_url/url).')
    }
    return { publicId, photoUrl }
  }

  const onUploadPhotoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !journeyId) return
    setBusy(true)
    const t = toast.loading('Đang tải ảnh lên…')
    try {
      // Upload trực tiếp lên Cloudinary bằng signature từ BE
      const { photoUrl } = await uploadPhotoToCloudinary(file, uploadIsCover)

      // Gắn ảnh vào experience theo schema `ExperiencePhotoInput` (URL).
      // Nếu chỉ lưu public_id, UI sẽ render sai vì `resolveApiMediaUrl` sẽ hiểu là URL tương đối của API.
      const one: ExperiencePhotoInput = {
        photoUrl,
        caption: uploadCaption.trim() || undefined,
        isCover: uploadIsCover,
      }
      await api.put(`/api/micro-experiences/${journeyId}`, buildPutBody([one]))

      toast.success('Đã thêm ảnh', { id: t })
      setUploadCaption('')
      setUploadIsCover(false)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err), { id: t })
    } finally {
      setBusy(false)
    }
  }

  const appendPhotoByUrl = async () => {
    if (!journeyId || !urlPhotoUrl.trim()) {
      toast.warning('Nhập photoUrl.')
      return
    }
    const coord = resolveCoordinatePayload(latitudeStr, longitudeStr)
    if (coord.kind === 'invalid') {
      toast.warning(coord.message)
      return
    }
    const coordinatePair = coord.kind === 'fixed' ? { latitude: coord.latitude, longitude: coord.longitude } : undefined
    setBusy(true)
    const t = toast.loading('Đang thêm ảnh…')
    try {
      const one: ExperiencePhotoInput = {
        photoUrl: urlPhotoUrl.trim(),
        thumbnailUrl: urlThumb.trim() || undefined,
        caption: urlCaption.trim() || undefined,
        isCover: urlIsCover,
      }
      await api.put(`/api/micro-experiences/${journeyId}`, buildPutBody([one], coordinatePair))
      toast.success('Đã thêm ảnh (URL)', { id: t })
      setUrlPhotoUrl('')
      setUrlThumb('')
      setUrlCaption('')
      setUrlIsCover(false)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err), { id: t })
    } finally {
      setBusy(false)
    }
  }

  if (!journeyId) return null

  const sectionCard =
    'rounded-2xl bg-white border border-stone-200/80 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
  const formGridGap = 'grid grid-cols-1 md:grid-cols-2 gap-5'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] font-['Lato',system-ui,sans-serif]">
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/90 [backdrop-filter:saturate(180%)_blur(8px)] border-b border-stone-200/80">
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
            <h1 className="truncate text-base font-semibold text-stone-900 font-['Cormorant_Garamond',serif]">
              Sửa trải nghiệm{' '}
              <span className="font-mono text-sm font-normal text-stone-400">#{journeyId.slice(0, 8)}…</span>
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => navigate('/staff')} className="text-sm font-medium text-stone-600 hover:text-amber-800">
            Đóng
          </button>
          <PortalUserMenu profilePath="/staff/profile" />
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
          {loading && (
            <div className={`${sectionCard} p-10 text-center text-sm text-stone-500`}>Đang tải…</div>
          )}
          {!loading && (
            <>
              <section className={sectionCard}>
                <ExperienceFormSectionHeader
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  title="Trạng thái"
                />
                <div className="max-w-sm">
                  <label htmlFor="experience-status" className={labelCls}>
                    Trạng thái hiển thị
                  </label>
                  <select
                    id="experience-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy}
                    className={selectCls}
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Không hoạt động</option>
                  </select>
                </div>
              </section>

              <section className={sectionCard}>
                <ExperienceFormSectionHeader
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h7m-7 6h16" />
                    </svg>
                  }
                  title="Mô tả & ngữ cảnh"
                />
                <label className={labelCls}>Mô tả chi tiết</label>
                <textarea
                  value={richDescription}
                  onChange={(e) => setRichDescription(e.target.value)}
                  rows={5}
                  className={`${inputCls} min-h-[7rem] resize-y`}
                />
              </section>

              <section className={sectionCard}>
                <ExperienceFormSectionHeader
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  }
                  title="Địa điểm & phân loại"
                />
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch">
                  <div className="flex min-w-0 flex-col gap-5">
                    <div>
                      <label className={labelCls}>Tên</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Tên trải nghiệm" />
                    </div>
                    <div className={formGridGap}>
                      <div className="min-w-0 md:col-span-2">
                        <label className={labelCls}>Danh mục</label>
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                          <option value="">—</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Địa chỉ</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Địa chỉ đầy đủ" />
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col gap-5 lg:min-h-[300px]">
                    <div className={formGridGap}>
                      <div>
                        <label className={labelCls}>Thành phố</label>
                        <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Thành phố" />
                      </div>
                      <div>
                        <label className={labelCls}>Quốc gia</label>
                        <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="Quốc gia" />
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-dashed border-amber-200/90 bg-amber-50/50 p-4 sm:p-5">
                      <p className="text-xs font-semibold text-amber-900">Tọa độ WGS84 (tuỳ chọn)</p>
                      <div className={`mt-3 ${formGridGap}`}>
                        <div>
                          <label className={labelCls}>Vĩ độ (latitude)</label>
                          <input
                            value={latitudeStr}
                            onChange={(e) => setLatitudeStr(e.target.value)}
                            className={inputCls}
                            placeholder="Ví dụ: 10.7769"
                            inputMode="decimal"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Kinh độ (longitude)</label>
                          <input
                            value={longitudeStr}
                            onChange={(e) => setLongitudeStr(e.target.value)}
                            className={inputCls}
                            placeholder="Ví dụ: 106.7009"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionCard}>
                <ExperienceFormSectionHeader
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  }
                  title="Thuộc tính chi tiết"
                />
                <MicroExperienceExtraFields
                  hideOuterHeading
                  accessibleBy={accessibleBy}
                  onAccessibleByChange={setAccessibleBy}
                  preferredTimes={preferredTimes}
                  onPreferredTimesChange={setPreferredTimes}
                  weatherSuitability={weatherSuitability}
                  onWeatherSuitabilityChange={setWeatherSuitability}
                  seasonality={seasonality}
                  onSeasonalityChange={setSeasonality}
                  tags={tags}
                  onTagsChange={setTags}
                  tagsExtraInput={tagsExtraInput}
                  onTagsExtraInputChange={setTagsExtraInput}
                  amenityInput={amenityInput}
                  onAmenityInputChange={setAmenityInput}
                  openingHours={openingHours}
                  onOpeningHoursChange={setOpeningHours}
                  priceRange={priceRange}
                  onPriceRangeChange={setPriceRange}
                  crowdLevel={crowdLevel}
                  onCrowdLevelChange={setCrowdLevel}
                />
              </section>

              <section className={`${sectionCard} space-y-6`}>
                <ExperienceFormSectionHeader
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  }
                  title="Ảnh trải nghiệm"
                />

                {experiencePhotos.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 py-8 text-center text-sm text-stone-500">
                    Chưa có ảnh. Thêm ở hai ô bên dưới.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                    {experiencePhotos.map((ph) => (
                      <div key={ph.id} className="relative group rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                        {ph.isCover && (
                          <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">
                            Bìa
                          </span>
                        )}
                        <img
                          src={resolveApiMediaUrl(ph.thumbnailUrl || ph.photoUrl)}
                          alt=""
                          className="w-full aspect-[4/3] object-cover"
                          loading="lazy"
                        />
                        <div className="p-2 bg-white border-t border-stone-100 flex items-start justify-between gap-2">
                          <p className="text-[10px] text-stone-600 line-clamp-2">{ph.caption || ph.photoUrl}</p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeExperiencePhoto(ph.id)}
                            className="shrink-0 text-[10px] font-bold text-red-600 hover:underline"
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                  <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-600">Tải từ máy</p>
                    <input ref={uploadFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void onUploadPhotoFile(e)} />
                    <div className="space-y-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => uploadFileInputRef.current?.click()}
                        className="w-full rounded-xl bg-[#c5a070] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b08f5f] disabled:opacity-50 sm:w-auto"
                      >
                        Chọn ảnh…
                      </button>
                      <div>
                        <label className={labelCls}>Chú thích</label>
                        <input
                          value={uploadCaption}
                          onChange={(e) => setUploadCaption(e.target.value)}
                          className={inputCls}
                          placeholder="Tuỳ chọn"
                        />
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-600">
                        <input type="checkbox" checked={uploadIsCover} onChange={(e) => setUploadIsCover(e.target.checked)} />
                        Đặt làm ảnh bìa
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-600">Thêm bằng URL</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-4">
                      <div className="min-w-0 md:col-span-1">
                        <label className={labelCls}>URL ảnh *</label>
                        <input value={urlPhotoUrl} onChange={(e) => setUrlPhotoUrl(e.target.value)} className={inputCls} placeholder="https://…" />
                      </div>
                      <div className="min-w-0 md:col-span-1">
                        <label className={labelCls}>URL thu nhỏ</label>
                        <input value={urlThumb} onChange={(e) => setUrlThumb(e.target.value)} className={inputCls} placeholder="Tuỳ chọn" />
                      </div>
                      <div className="min-w-0 md:col-span-1">
                        <label className={labelCls}>Chú thích</label>
                        <input value={urlCaption} onChange={(e) => setUrlCaption(e.target.value)} className={inputCls} placeholder="Tuỳ chọn" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-stone-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                        <input type="checkbox" checked={urlIsCover} onChange={(e) => setUrlIsCover(e.target.checked)} />
                        Đặt làm ảnh bìa
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void appendPhotoByUrl()}
                        className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                      >
                        Thêm ảnh URL
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white/95 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="order-2 text-left text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 sm:order-1 sm:py-1"
                >
                  Xóa trải nghiệm
                </button>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/staff')}
                    className="rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className="rounded-xl bg-gradient-to-r from-[#c5a070] to-[#b08f5f] px-8 py-3 text-sm font-semibold text-white shadow-md hover:from-[#b08f5f] hover:to-[#9a7d52] disabled:opacity-50"
                  >
                    {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      {dialog}
    </div>
  )
}
