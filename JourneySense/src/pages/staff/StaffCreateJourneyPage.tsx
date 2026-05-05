import axios from 'axios'
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import goongjs from '@goongmaps/goong-js'
import '@goongmaps/goong-js/dist/goong-js.css'
import {
  ExperienceFormSectionHeader,
  experienceFieldLabel as labelCls,
  experienceInputClass as inputCls,
  experienceSelectClass as selectCls,
} from '../../components/staff/ExperienceFormSectionHeader'
import MicroExperienceExtraFields from '../../components/staff/MicroExperienceExtraFields'
import PortalUserMenu from '../../components/portal/PortalUserMenu'
import api from '../../api/axios'
import { parseAmenityInput } from '../../constants/microExperienceEnums'
import type { StaffOutletContext } from '../../layouts/staffOutletContext'
import type { CategoryResponseDto, CloudinaryUploadSignatureResponse, ExperiencePhotoInput } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { resolveCoordinatePayload } from '../../utils/coordinates'
import {
  type OpeningHoursValue,
  serializeOpeningHours,
} from '../../components/staff/OpeningHoursPicker'

function buildTagsPayload(enumTags: string[], tagsExtraLine: string): string[] | undefined {
  const extra = parseAmenityInput(tagsExtraLine)
  const merged = [...new Set([...enumTags, ...extra])]
  return merged.length ? merged : undefined
}

type PhotoDraftRow = ExperiencePhotoInput & { key: string }

type PendingFilePhotoDraft = {
  key: string
  file: File
  previewUrl: string
  caption?: string
  isCover: boolean
}

type ProvinceRow = { code: number; name: string }
type DistrictRow = { code: number; name: string }
type WardRow = { code: number; name: string }

type ProvinceDetailV2 = {
  code: number
  name: string
  districts?: Array<{ code: number; name: string; wards?: WardRow[] | null }>
}

type ProvinceDetailV1 = {
  code: number
  name: string
  districts?: Array<{ code: number; name: string; wards?: WardRow[] | null }>
}

type DistrictDetailV1 = {
  code: number
  name: string
  wards?: WardRow[] | null
}

type PlaceSuggestion = {
  description: string
  placeId: string
  mainText?: string | null
  secondaryText?: string | null
  plusCode?: string | null
}

type PlaceDetail = {
  placeId: string
  name?: string | null
  formattedAddress?: string | null
  latitude?: number | null
  longitude?: number | null
}

type CoordinateMode = 'manual' | 'goong'

type LngLat = [number, number]

type GoongMapInstance = {
  setCenter: (center: LngLat) => void
  remove: () => void
}

type GoongMarkerInstance = {
  setLngLat: (pos: LngLat) => GoongMarkerInstance
  addTo: (map: GoongMapInstance) => GoongMarkerInstance
}

type GoongSdk = {
  accessToken: string
  Map: new (opts: { container: HTMLElement; style: string; center: LngLat; zoom: number }) => GoongMapInstance
  Marker: new () => GoongMarkerInstance
}

const COUNTRY_LOCKED = 'Vietnam'

function normalizeVi(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function normalizeAdminName(s: string): string {
  return normalizeVi(s)
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b0+(\d)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function adminNameVariants(s: string): string[] {
  const base = normalizeAdminName(s)
  const stripped = base.replace(/^(tinh|thanh pho|tp|quan|q|huyen|h|thi xa|tx|phuong|p|xa|thi tran)\s+/, '')
  return Array.from(new Set([base, stripped].filter(Boolean)))
}

function findBestNameMatch<T extends { name: string }>(target: string, list: T[]): T | null {
  const tv = adminNameVariants(target)
  if (!tv.length) return null

  for (const item of list) {
    const iv = adminNameVariants(item.name)
    if (tv.some((t) => iv.includes(t))) return item
  }

  for (const item of list) {
    const itemNorm = normalizeAdminName(item.name)
    if (tv.some((t) => itemNorm.includes(t) || t.includes(itemNorm))) return item
  }

  return null
}

function parseAdminFromFormattedAddress(formattedAddress: string): {
  streetAddress: string
  wardName: string
  districtName: string
  provinceName: string
} {
  const rawParts = formattedAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  const parts = [...rawParts]
  while (parts.length) {
    const last = parts[parts.length - 1]
    const lastNorm = normalizeVi(last)
    if (lastNorm === 'vietnam' || lastNorm === 'viet nam') {
      parts.pop()
      continue
    }
    if (/^\d{4,6}$/.test(lastNorm)) {
      parts.pop()
      continue
    }
    break
  }

  const provinceName = parts.pop() ?? ''
  const districtName = parts.pop() ?? ''
  const wardName = parts.pop() ?? ''
  const streetAddress = parts.join(', ').trim()
  return { streetAddress, wardName, districtName, provinceName }
}

function inferCityFromFormattedAddress(formattedAddress: string): string {
  const parts = formattedAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  const last = parts[parts.length - 1]
  const lastNorm = normalizeVi(last)
  if (lastNorm === 'vietnam' || lastNorm === 'viet nam') {
    return parts.length >= 2 ? parts[parts.length - 2] : ''
  }
  return last
}

type PendingAdminSelection = {
  provinceName: string
  districtName: string
  wardName: string
  appliedProvince: boolean
  appliedDistrict: boolean
  appliedWard: boolean
}

export default function StaffCreateJourneyPage() {
  const { setSidebarCollapsed } = useOutletContext<StaffOutletContext>()
  const navigate = useNavigate()
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const goongMapKey = import.meta.env.VITE_GOONG_MAP_KEY

  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  /** Cặp WGS84 hoặc bỏ trống cả hai → geocode (MICRO_EXPERIENCE_FE.md §3). */
  const [latitudeStr, setLatitudeStr] = useState('')
  const [longitudeStr, setLongitudeStr] = useState('')
  const [richDescription, setRichDescription] = useState('')

  // Province Open API (Vietnam)
  const [provinces, setProvinces] = useState<ProvinceRow[]>([])
  const [provinceCode, setProvinceCode] = useState('')
  const [districts, setDistricts] = useState<DistrictRow[]>([])
  const [districtCode, setDistrictCode] = useState('')
  const [wards, setWards] = useState<WardRow[]>([])
  const [wardCode, setWardCode] = useState('')
  const [wardsByDistrictCode, setWardsByDistrictCode] = useState<Record<number, WardRow[]>>({})

  const [pendingAdmin, setPendingAdmin] = useState<PendingAdminSelection | null>(null)

  // Coordinate / Place search
  const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>('manual')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([])
  const [placeLoading, setPlaceLoading] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetail | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const goongMapRef = useRef<GoongMapInstance | null>(null)
  const goongMarkerRef = useRef<GoongMarkerInstance | null>(null)

  const [accessibleBy, setAccessibleBy] = useState<string[]>(['walking', 'motorbike'])
  const [preferredTimes, setPreferredTimes] = useState<string[]>([])
  const [weatherSuitability, setWeatherSuitability] = useState<string[]>([])
  const [seasonality, setSeasonality] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagsExtraInput, setTagsExtraInput] = useState('')
  const [amenityInput, setAmenityInput] = useState('')
  const [openingHours, setOpeningHours] = useState<OpeningHoursValue>({})
  const [priceRange, setPriceRange] = useState('')
  const [crowdLevel, setCrowdLevel] = useState('normal')
  /** Ảnh kèm POST — `ExperiencePhotoInput` (URL). */
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraftRow[]>([])

  /** Ảnh chọn từ máy — sẽ upload sau khi tạo (cần `id` để xin signature). */
  const [pendingFilePhotos, setPendingFilePhotos] = useState<PendingFilePhotoDraft[]>([])
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadIsCover, setUploadIsCover] = useState(false)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)
  const pendingFilePhotosRef = useRef<PendingFilePhotoDraft[]>([])

  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await axios.get<CategoryResponseDto[]>(`${base}/api/categories`)
        setCategories(Array.isArray(data) ? data : [])
        if (data?.[0]?.id) setCategoryId(data[0].id)
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được danh mục.'))
      }
    })()
  }, [base])

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await axios.get<ProvinceRow[]>('https://provinces.open-api.vn/api/v2/p/')
        setProvinces(Array.isArray(data) ? data : [])
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được danh sách tỉnh/thành.'))
      }
    })()
  }, [])

  useEffect(() => {
    if (!provinceCode) {
      setDistricts([])
      setDistrictCode('')
      setWards([])
      setWardCode('')
      setWardsByDistrictCode({})
      return
    }

    void (async () => {
      try {
        const v2Url = `https://provinces.open-api.vn/api/v2/p/${encodeURIComponent(provinceCode)}?depth=2`
        const v1Url = `https://provinces.open-api.vn/api/p/${encodeURIComponent(provinceCode)}?depth=2`

        const { data: v2 } = await axios.get<ProvinceDetailV2>(v2Url)
        const v2HasDistricts = Array.isArray(v2?.districts) && v2.districts.length > 0
        const data = v2HasDistricts ? v2 : (await axios.get<ProvinceDetailV1>(v1Url)).data

        const dList = Array.isArray(data?.districts) ? data.districts.map((d) => ({ code: d.code, name: d.name })) : []
        setWardsByDistrictCode({})
        setDistricts(dList)
        setDistrictCode('')
        setWards([])
        setWardCode('')
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được quận/huyện.'))
      }
    })()
  }, [provinceCode])

  useEffect(() => {
    if (!districtCode) {
      setWards([])
      setWardCode('')
      return
    }

    const codeNum = Number(districtCode)
    if (!Number.isFinite(codeNum)) {
      setWards([])
      setWardCode('')
      return
    }

    const cached = wardsByDistrictCode[codeNum]
    if (Array.isArray(cached) && cached.length > 0) {
      setWards(cached)
      setWardCode('')
      return
    }

    const ctrl = new AbortController()
    void (async () => {
      try {
        const { data } = await axios.get<DistrictDetailV1>(
          `https://provinces.open-api.vn/api/d/${encodeURIComponent(String(codeNum))}?depth=2`,
          { signal: ctrl.signal },
        )
        const next = Array.isArray(data?.wards) ? (data.wards as WardRow[]) : []
        setWards(next)
        setWardCode('')
        setWardsByDistrictCode((prev) => ({ ...prev, [codeNum]: next }))
      } catch (e) {
        if (axios.isCancel(e)) return
        setWards([])
        setWardCode('')
        toast.error(getApiErrorMessage(e, 'Không tải được phường/xã.'))
      }
    })()

    return () => {
      ctrl.abort()
    }
  }, [districtCode, wardsByDistrictCode])

  const selectedDistrictName = useMemo(() => {
    if (!districtCode) return ''
    const codeNum = Number(districtCode)
    const found = districts.find((d) => d.code === codeNum)
    return found?.name ?? ''
  }, [districtCode, districts])

  const selectedWardName = useMemo(() => {
    if (!wardCode) return ''
    const codeNum = Number(wardCode)
    const found = wards.find((w) => w.code === codeNum)
    return found?.name ?? ''
  }, [wardCode, wards])

  useEffect(() => {
    if (!city.trim() || provinces.length === 0) return

    if (pendingAdmin) return
    const matched = findBestNameMatch(city, provinces)
    if (matched && String(matched.code) !== provinceCode) setProvinceCode(String(matched.code))
  }, [city, provinces, provinceCode, pendingAdmin])

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
          if (axios.isCancel(e)) return
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
      const addr = data.formattedAddress?.trim() || s.description
      const parsedAdmin = addr ? parseAdminFromFormattedAddress(addr) : null
      setAddress(parsedAdmin?.streetAddress || addr)
      const inferredCity = addr ? inferCityFromFormattedAddress(addr) : ''
      if (inferredCity) setCity(inferredCity)

      if (parsedAdmin) {
        setPendingAdmin({
          provinceName: parsedAdmin.provinceName,
          districtName: parsedAdmin.districtName,
          wardName: parsedAdmin.wardName,
          appliedProvince: false,
          appliedDistrict: false,
          appliedWard: false,
        })
      } else {
        setPendingAdmin(null)
      }

      if (data.latitude != null && data.longitude != null) {
        setLatitudeStr(String(data.latitude))
        setLongitudeStr(String(data.longitude))
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không lấy được chi tiết địa điểm từ Goong.'))
    } finally {
      setPlaceLoading(false)
    }
  }

  useEffect(() => {
    if (!pendingAdmin) return
    if (pendingAdmin.appliedProvince) return
    if (!pendingAdmin.provinceName || provinces.length === 0) return

    const matched = findBestNameMatch(pendingAdmin.provinceName, provinces)
    if (matched) {
      const codeStr = String(matched.code)
      if (codeStr !== provinceCode) setProvinceCode(codeStr)
      setCity(matched.name)
    }

    setPendingAdmin((p) => (p ? { ...p, appliedProvince: true } : p))
  }, [pendingAdmin, provinces, provinceCode])

  useEffect(() => {
    if (!pendingAdmin) return
    if (!pendingAdmin.appliedProvince || pendingAdmin.appliedDistrict) return
    if (!pendingAdmin.districtName) {
      setPendingAdmin((p) => (p ? { ...p, appliedDistrict: true } : p))
      return
    }
    if (!provinceCode || districts.length === 0) return

    const matched = findBestNameMatch(pendingAdmin.districtName, districts)
    if (matched) {
      const codeStr = String(matched.code)
      if (codeStr !== districtCode) setDistrictCode(codeStr)
    }

    setPendingAdmin((p) => (p ? { ...p, appliedDistrict: true } : p))
  }, [pendingAdmin, provinceCode, districts, districtCode])

  useEffect(() => {
    if (!pendingAdmin) return
    if (!pendingAdmin.appliedDistrict || pendingAdmin.appliedWard) return
    if (!pendingAdmin.wardName) {
      setPendingAdmin((p) => (p ? { ...p, appliedWard: true } : p))
      return
    }
    if (!districtCode || wards.length === 0) return

    const matched = findBestNameMatch(pendingAdmin.wardName, wards)
    if (matched) {
      const codeStr = String(matched.code)
      if (codeStr !== wardCode) setWardCode(codeStr)
    }

    setPendingAdmin((p) => (p ? { ...p, appliedWard: true } : p))
  }, [pendingAdmin, districtCode, wards, wardCode])

  useEffect(() => {
    if (!pendingAdmin) return
    if (pendingAdmin.appliedProvince && pendingAdmin.appliedDistrict && pendingAdmin.appliedWard) {
      setPendingAdmin(null)
    }
  }, [pendingAdmin])

  useEffect(() => {
    if (coordinateMode !== 'goong') setPendingAdmin(null)
  }, [coordinateMode])

  useEffect(() => {
    if (coordinateMode !== 'goong') return
    if (!goongMapKey) return
    if (!mapContainerRef.current) return

    const lat = Number(latitudeStr)
    const lng = Number(longitudeStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const sdk = goongjs as unknown as GoongSdk

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
  }, [coordinateMode, goongMapKey, latitudeStr, longitudeStr])

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

  type CloudinaryUploadResponse = {
    public_id?: string
    url?: string
    secure_url?: string
  }

  const uploadPhotoToCloudinary = async (experienceId: string, file: File, isCover: boolean): Promise<string> => {
    const signatureRes = await api.post<CloudinaryUploadSignatureResponse>(
      `/api/micro-experiences/${experienceId}/photos/cloudinary-signature`,
      { isCover },
    )
    const sig = signatureRes.data

    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', sig.apiKey)
    fd.append('timestamp', String(sig.timestamp))
    fd.append('signature', sig.signature)
    fd.append('public_id', sig.publicId)
    fd.append('overwrite', String(sig.overwrite))

    const uploadRes = await axios.post<CloudinaryUploadResponse>(sig.uploadUrl, fd)
    const photoUrl = uploadRes.data.secure_url || uploadRes.data.url
    if (!photoUrl) throw new Error('Cloudinary upload succeeded but no URL returned (missing secure_url/url).')
    return photoUrl
  }

  const onPickUploadFile = () => {
    uploadFileInputRef.current?.click()
  }

  const onUploadPhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setPendingFilePhotos((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        file,
        previewUrl,
        caption: uploadCaption.trim() || undefined,
        isCover: uploadIsCover,
      },
    ])
    setUploadCaption('')
    setUploadIsCover(false)
  }

  useEffect(() => {
    pendingFilePhotosRef.current = pendingFilePhotos
  }, [pendingFilePhotos])

  useEffect(() => {
    return () => {
      for (const row of pendingFilePhotosRef.current) {
        try {
          URL.revokeObjectURL(row.previewUrl)
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const submit = async () => {
    if (!categoryId || !name.trim()) {
      toast.warning('Vui lòng nhập tên và chọn danh mục.')
      return
    }
    if (accessibleBy.length === 0) {
      toast.warning('Chọn ít nhất một phương tiện tiếp cận.')
      return
    }
    const coord = resolveCoordinatePayload(latitudeStr, longitudeStr)
    if (coord.kind === 'invalid') {
      toast.warning(coord.message)
      return
    }
    const amenityTags = parseAmenityInput(amenityInput)
    const tagsPayload = buildTagsPayload(tags, tagsExtraInput)
    const photosPayload: ExperiencePhotoInput[] = photoDrafts
      .filter((p) => p.photoUrl.trim())
      .map((p) => ({
        photoUrl: p.photoUrl.trim(),
        thumbnailUrl: p.thumbnailUrl?.trim() || undefined,
        caption: p.caption?.trim() || undefined,
        isCover: p.isCover,
      }))

    setBusy(true)
    const t = toast.loading('Đang tạo trải nghiệm…')

    const addressPayload = [address.trim(), selectedWardName, selectedDistrictName].filter(Boolean).join(', ') || undefined
    try {
      const createBody = {
        name: name.trim(),
        categoryId,
        address: addressPayload,
        city: city.trim() || undefined,
        country: COUNTRY_LOCKED,
        ...(coord.kind === 'fixed'
          ? { latitude: coord.latitude, longitude: coord.longitude }
          : {}),
        accessibleBy,
        preferredTimes: preferredTimes.length ? preferredTimes : undefined,
        weatherSuitability: weatherSuitability.length ? weatherSuitability : undefined,
        seasonality: seasonality.length ? seasonality : undefined,
        amenityTags: amenityTags.length ? amenityTags : undefined,
        tags: tagsPayload,
        richDescription: richDescription.trim() || undefined,
        openingHours: serializeOpeningHours(openingHours) ?? undefined,
        priceRange: priceRange.trim() || undefined,
        crowdLevel: crowdLevel.trim() || 'normal',
        ...(photosPayload.length ? { photos: photosPayload } : {}),
      }

      const { data, status, headers } = await api.post('/api/micro-experiences', createBody)

      const idFromBody = (data as { id?: string }).id
      const idFromLocation = (() => {
        const loc = headers.location
        if (!loc) return undefined
        const m = /([0-9a-f-]{36})$/i.exec(loc)
        return m?.[1]
      })()
      const createdId = (status === 201 ? idFromBody : undefined) || idFromLocation

      if (!createdId) {
        toast.success('Tạo trải nghiệm thành công', { id: t })
        return
      }

      if (pendingFilePhotos.length) {
        toast.loading('Đang tải ảnh lên…', { id: t })
        const uploaded: ExperiencePhotoInput[] = []
        for (const row of pendingFilePhotos) {
          const photoUrl = await uploadPhotoToCloudinary(createdId, row.file, row.isCover)
          uploaded.push({
            photoUrl,
            caption: row.caption,
            isCover: row.isCover,
          })
        }
        if (uploaded.length) {
          await api.put(`/api/micro-experiences/${createdId}`, {
            ...createBody,
            // `ExperiencePhotoInput` trong PUT là append (không gửi lại photosPayload để tránh duplicate)
            photos: uploaded,
            // Create không cho chọn status, nên giữ active cho lần PUT an toàn hơn.
            status: 'active',
          })
        }
      }

      toast.success('Tạo trải nghiệm thành công', { id: t })
      navigate(`/staff/journeys/${createdId}/edit`, { replace: true })
    } catch (e) {
      toast.error(getApiErrorMessage(e), { id: t })
    } finally {
      setBusy(false)
    }
  }

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
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-stone-900 font-['Cormorant_Garamond',serif]">Tạo trải nghiệm</h1>
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
              className={`${inputCls} resize-y min-h-[7rem]`}
              placeholder="Khoảng 100–200 chữ: không khí, điểm nổi bật, đối tượng phù hợp…"
            />
          </section>

          <section className={sectionCard}>
            <ExperienceFormSectionHeader
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="Địa điểm & phân loại"
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch">
              <div className="flex min-w-0 flex-col gap-5">
                <div>
                  <label className={labelCls}>Tên trải nghiệm *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Ví dụ: Quán cà phê view đồi"
                  />
                </div>
                <div>
                  <label className={labelCls}>Danh mục *</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Địa chỉ</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Số nhà, đường, phường…" />
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col gap-5 lg:min-h-[280px]">
                <div className={formGridGap}>
                  <div>
                    <label className={labelCls}>Tỉnh / thành phố</label>
                    <select
                      value={provinceCode}
                      onChange={(e) => {
                        const code = e.target.value
                        setProvinceCode(code)
                        const codeNum = Number(code)
                        const p = provinces.find((x) => x.code === codeNum)
                        setCity(p?.name ?? '')
                      }}
                      className={selectCls}
                    >
                      <option value="">-- Chọn tỉnh/thành --</option>
                      {provinces.map((p) => (
                        <option key={p.code} value={String(p.code)}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Quốc gia</label>
                    <input value={COUNTRY_LOCKED} readOnly className={inputCls} placeholder="Quốc gia" />
                  </div>
                </div>
                <div className={formGridGap}>
                  <div>
                    <label className={labelCls}>Quận / huyện</label>
                    <select
                      value={districtCode}
                      onChange={(e) => setDistrictCode(e.target.value)}
                      className={selectCls}
                      disabled={!provinceCode}
                    >
                      <option value="">-- Chọn quận/huyện --</option>
                      {districts.map((d) => (
                        <option key={d.code} value={String(d.code)}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Phường / xã</label>
                    <select
                      value={wardCode}
                      onChange={(e) => setWardCode(e.target.value)}
                      className={selectCls}
                      disabled={!districtCode}
                    >
                      <option value="">-- Chọn phường/xã --</option>
                      {wards.map((w) => (
                        <option key={w.code} value={String(w.code)}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-dashed border-amber-200/90 bg-amber-50/50 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs font-semibold text-amber-900">Tọa độ / tìm địa điểm (tuỳ chọn)</p>
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
                  </div>

                  {coordinateMode === 'manual' && (
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
                  )}

                  {coordinateMode === 'goong' && (
                    <div className="mt-3 space-y-3">
                      <div className="relative">
                        <label className={labelCls}>Tìm địa điểm (Goong)</label>
                        <input
                          value={placeQuery}
                          onChange={(e) => {
                            setPlaceQuery(e.target.value)
                            setSelectedPlace(null)
                          }}
                          className={inputCls}
                          placeholder="Nhập tên quán, địa chỉ…"
                        />
                        {placeLoading && (
                          <div className="absolute right-3 top-9 text-[11px] font-semibold text-stone-500">Đang tìm…</div>
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

                      <div className={formGridGap}>
                        <div>
                          <label className={labelCls}>Vĩ độ (latitude)</label>
                          <input value={latitudeStr} readOnly className={`${inputCls} bg-stone-50`} placeholder="—" />
                        </div>
                        <div>
                          <label className={labelCls}>Kinh độ (longitude)</label>
                          <input value={longitudeStr} readOnly className={`${inputCls} bg-stone-50`} placeholder="—" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-stone-200/80 bg-white p-3">
                        {!goongMapKey && (
                          <p className="text-xs text-stone-600">
                            Chưa cấu hình <span className="font-mono">VITE_GOONG_MAP_KEY</span> nên chưa hiển thị bản đồ.
                          </p>
                        )}
                        {goongMapKey && (
                          <div
                            ref={mapContainerRef}
                            className="h-[260px] w-full overflow-hidden rounded-2xl bg-stone-100"
                            aria-label="Bản đồ Goong"
                          />
                        )}
                        {selectedPlace?.name && (
                          <p className="mt-2 text-[11px] font-semibold text-stone-600 truncate">
                            Đã chọn: <span className="text-stone-900">{selectedPlace.name}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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

          <section className={`${sectionCard} space-y-5`}>
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
              title="Ảnh từ máy (tuỳ chọn)"
            />

            <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-stone-50/40 p-4 sm:p-5">
              <input
                ref={uploadFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUploadPhotoFile}
              />

              <p className="text-xs font-semibold text-stone-600">
                Chọn ảnh từ máy. Ảnh sẽ được upload sau khi bấm <span className="text-stone-900">Tạo trải nghiệm</span>.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                <div className="min-w-0 md:col-span-2">
                  <label className={labelCls}>Chú thích</label>
                  <input
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    className={inputCls}
                    placeholder="Tuỳ chọn"
                  />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer">
                    <input type="checkbox" checked={uploadIsCover} onChange={(e) => setUploadIsCover(e.target.checked)} />
                    Ảnh bìa
                  </label>
                  <button
                    type="button"
                    onClick={onPickUploadFile}
                    className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Chọn ảnh…
                  </button>
                </div>
              </div>

              {pendingFilePhotos.length > 0 && (
                <div className="space-y-2 border-t border-stone-200/70 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Ảnh đã chọn</p>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                    {pendingFilePhotos.map((row) => (
                      <div key={row.key} className="relative group rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                        {row.isCover && (
                          <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">
                            Bìa
                          </span>
                        )}
                        <img
                          src={row.previewUrl}
                          alt=""
                          className="w-full aspect-[4/3] object-cover"
                          loading="lazy"
                        />
                        <div className="p-2 bg-white border-t border-stone-100 flex items-start justify-between gap-2">
                          <p className="text-[10px] text-stone-600 line-clamp-2">{row.caption || row.file.name}</p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setPendingFilePhotos((rows) => {
                                const found = rows.find((r) => r.key === row.key)
                                if (found) {
                                  try {
                                    URL.revokeObjectURL(found.previewUrl)
                                  } catch {
                                    // ignore
                                  }
                                }
                                return rows.filter((r) => r.key !== row.key)
                              })
                            }
                            className="shrink-0 text-[10px] font-bold text-red-600 hover:underline"
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={`${sectionCard} space-y-5`}>
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
              title="Ảnh theo URL (tuỳ chọn)"
            />
            {photoDrafts.map((row) => (
              <div
                key={row.key}
                className="space-y-4 rounded-2xl border border-stone-200/80 bg-stone-50/40 p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                  <div className="min-w-0">
                    <label className={labelCls}>URL ảnh *</label>
                    <input
                      value={row.photoUrl}
                      onChange={(e) =>
                        setPhotoDrafts((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, photoUrl: e.target.value } : r)),
                        )
                      }
                      className={inputCls}
                      placeholder="https://… hoặc /uploads/…"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>URL ảnh thu nhỏ</label>
                    <input
                      value={row.thumbnailUrl ?? ''}
                      onChange={(e) =>
                        setPhotoDrafts((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, thumbnailUrl: e.target.value } : r)),
                        )
                      }
                      className={inputCls}
                      placeholder="Tuỳ chọn"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Chú thích</label>
                    <input
                      value={row.caption ?? ''}
                      onChange={(e) =>
                        setPhotoDrafts((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, caption: e.target.value } : r)),
                        )
                      }
                      className={inputCls}
                      placeholder="Tuỳ chọn"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/70 pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.isCover}
                      onChange={(e) =>
                        setPhotoDrafts((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, isCover: e.target.checked } : r)),
                        )
                      }
                    />
                    Đặt làm ảnh bìa
                  </label>
                  <button
                    type="button"
                    onClick={() => setPhotoDrafts((rows) => rows.filter((r) => r.key !== row.key))}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Xoá dòng ảnh
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setPhotoDrafts((rows) => [
                  ...rows,
                  {
                    key: crypto.randomUUID(),
                    photoUrl: '',
                    thumbnailUrl: '',
                    caption: '',
                    isCover: rows.length === 0,
                  },
                ])
              }
              className="text-sm font-semibold text-[#c5a070] hover:underline"
            >
              + Thêm ảnh (URL)
            </button>
          </section>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white/95 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/staff')}
              className="order-2 rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:order-1"
            >
              Quay lại danh sách
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="order-1 rounded-xl bg-gradient-to-r from-[#c5a070] to-[#b08f5f] px-8 py-3 text-sm font-semibold text-white shadow-md hover:from-[#b08f5f] hover:to-[#9a7d52] disabled:opacity-55 sm:order-2"
            >
              {busy ? 'Đang tạo…' : 'Tạo trải nghiệm'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
