import goongjs from '@goongmaps/goong-js'
import '@goongmaps/goong-js/dist/goong-js.css'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type {
  AdminJourneyWaypointProgressSummaryResponse,
  GeoPointResponse,
  JourneyDetailResponse,
  JourneyMemberLocationNotification,
  JourneyMemberRosterItemResponse,
  JourneyPolylineResponse,
  JourneyWaypointResponse,
} from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { getStoredAccessToken } from '../../utils/authStorage'
import { displayJourneyStatus, isJourneyInProgressStatus } from '../../utils/format'

type LngLat = [number, number]

type GoongMapInstance = {
  on: (event: 'load', cb: () => void) => void
  addSource: (id: string, source: unknown) => void
  addLayer: (layer: unknown) => void
  removeLayer: (id: string) => void
  removeSource: (id: string) => void
  getLayer: (id: string) => unknown
  getSource: (id: string) => unknown
  fitBounds: (bounds: [LngLat, LngLat], options?: { padding?: number; maxZoom?: number }) => void
  setCenter: (center: LngLat) => void
  remove: () => void
}

type GoongMarkerInstance = {
  setLngLat: (pos: LngLat) => GoongMarkerInstance
  addTo: (map: GoongMapInstance) => GoongMarkerInstance
  remove?: () => void
}

type GoongSdk = {
  accessToken: string
  Map: new (opts: { container: HTMLElement; style: string; center: LngLat; zoom: number }) => GoongMapInstance
  Marker: new (opts?: { element?: HTMLElement }) => GoongMarkerInstance
}

const card = 'rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'

function toLngLat(p: { latitude?: number | null; longitude?: number | null } | GeoPointResponse): LngLat | null {
  const rawLat = (p as { latitude?: number | null }).latitude
  const rawLng = (p as { longitude?: number | null }).longitude

  // IMPORTANT: Number(null) === 0. Many APIs return null when no location is available.
  // Treat null/undefined as missing instead of (0,0), otherwise fitBounds zooms out massively.
  if (rawLat == null || rawLng == null) return null

  let lat = Number(rawLat)
  let lng = Number(rawLng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // Heuristic: backend/mobile sometimes swaps lat/lng.
  // Vietnam example: correct lat ~ 10..21, lng ~ 102..110.
  // If we see lat out of [-90, 90] but lng looks like a latitude, swap.
  if ((lat < -90 || lat > 90) && lng >= -90 && lng <= 90) {
    const swappedLat = lng
    const swappedLng = lat
    lat = swappedLat
    lng = swappedLng
  }

  if (lat < -90 || lat > 90) return null
  if (lng < -180 || lng > 180) return null

  return [lng, lat]
}

function normalizeJourneyId(id: string): string {
  return id.trim().toLowerCase().replace(/[{}]/g, '')
}

function isCollapsedBounds(bounds: [LngLat, LngLat]): boolean {
  return bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]
}

function buildBounds(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null
  let minLng = points[0][0]
  let maxLng = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]

  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(maxLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLat)) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

function projectPointToPolylineMeters(point: LngLat, line: LngLat[]): { projected: LngLat; distanceMeters: number } | null {
  if (line.length < 2) return null

  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  let best: { projected: LngLat; distanceMeters: number } | null = null

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]
    const b = line[i + 1]

    const lat0 = toRad((a[1] + b[1] + point[1]) / 3)
    const cosLat = Math.cos(lat0)

    const ax = R * toRad(a[0]) * cosLat
    const ay = R * toRad(a[1])
    const bx = R * toRad(b[0]) * cosLat
    const by = R * toRad(b[1])
    const px = R * toRad(point[0]) * cosLat
    const py = R * toRad(point[1])

    const abx = bx - ax
    const aby = by - ay
    const apx = px - ax
    const apy = py - ay
    const abLen2 = abx * abx + aby * aby
    if (abLen2 <= 0) continue

    let t = (apx * abx + apy * aby) / abLen2
    if (t < 0) t = 0
    if (t > 1) t = 1

    const qx = ax + t * abx
    const qy = ay + t * aby
    const dx = px - qx
    const dy = py - qy
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (!best || dist < best.distanceMeters) {
      const projLng = toDeg(qx / (R * cosLat))
      const projLat = toDeg(qy / R)
      best = { projected: [projLng, projLat], distanceMeters: dist }
    }
  }

  return best
}

function safeRemoveMarkers(markers: GoongMarkerInstance[]) {
  for (const m of markers) {
    try {
      m.remove?.()
    } catch {
      // ignore
    }
  }
}

function isCompletedStatus(status?: string | null): boolean {
  const s = status?.toLowerCase() ?? ''
  return s === 'completed' || s === 'complete'
}

function canLiveTrackStatus(status?: string | null): boolean {
  return isJourneyInProgressStatus(status)
}

function sortWaypoints(waypoints: JourneyWaypointResponse[]): JourneyWaypointResponse[] {
  return [...waypoints].sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
}

type WaypointMark = 'none' | 'visited' | 'skipped'

export default function AdminJourneyTrackingPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const goongMapKey = import.meta.env.VITE_GOONG_MAP_KEY

  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<JourneyDetailResponse | null>(null)
  const [polyline, setPolyline] = useState<JourneyPolylineResponse | null>(null)
  const [progress, setProgress] = useState<AdminJourneyWaypointProgressSummaryResponse | null>(null)
  const [members, setMembers] = useState<JourneyMemberRosterItemResponse[]>([])

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoongMapInstance | null>(null)
  const mapLoadedRef = useRef(false)
  const routeMarkersRef = useRef<GoongMarkerInstance[]>([])
  const memberMarkersRef = useRef<Map<string, GoongMarkerInstance>>(new Map())
  const hubRef = useRef<ReturnType<HubConnectionBuilder['build']> | null>(null)

  const loadDetail = useCallback(async () => {
    if (!journeyId) return
    setLoading(true)
    try {
      const { data } = await api.get<JourneyDetailResponse>(`/api/admin/journeys/${encodeURIComponent(journeyId)}`)
      setDetail(data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được chi tiết hành trình'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [journeyId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const sortedWaypoints = useMemo(() => {
    const wps = Array.isArray(detail?.waypoints) ? detail!.waypoints!.filter(Boolean) : []
    return sortWaypoints(wps)
  }, [detail])

  const waypointMarkById = useMemo(() => {
    const m = new Map<string, WaypointMark>()
    if (!progress?.waypoints?.length) return m
    for (const wp of progress.waypoints) {
      if (wp.visitedCount > 0) m.set(wp.waypointId, 'visited')
      else if (wp.skippedCount > 0) m.set(wp.waypointId, 'skipped')
      else m.set(wp.waypointId, 'none')
    }
    return m
  }, [progress])

  const polylineLine = useMemo(() => {
    const pts = polyline?.points ?? []
    const line: LngLat[] = []
    for (const p of pts) {
      const ll = toLngLat(p)
      if (ll) line.push(ll)
    }
    return line
  }, [polyline])

  const plannedLine = useMemo(() => {
    const pts = detail?.routePoints && detail.routePoints.length ? detail.routePoints : detail?.setupPrimaryRoutePoints
    if (!Array.isArray(pts)) return []
    const line: LngLat[] = []
    for (const p of pts) {
      const ll = toLngLat(p)
      if (ll) line.push(ll)
    }
    return line
  }, [detail])

  const mapData = useMemo(() => {
    const canUsePlanned = detail ? !isCompletedStatus(detail.status) : false

    const waypointPoints: Array<{ waypointId: string; stopOrder: number; lngLat: LngLat; name?: string | null; mark: WaypointMark }> = []
    for (const wp of sortedWaypoints) {
      const ll = toLngLat(wp)
      if (!ll) continue
      waypointPoints.push({
        waypointId: wp.waypointId,
        stopOrder: wp.stopOrder,
        lngLat: ll,
        name: wp.name,
        mark: waypointMarkById.get(wp.waypointId) ?? 'none',
      })
    }

    const memberPoints: Array<{ memberId: string; displayName: string; lngLat: LngLat }> = []
    for (const m of members) {
      const ll = toLngLat({ latitude: m.latitude, longitude: m.longitude })
      if (!ll) continue
      memberPoints.push({ memberId: m.memberId, displayName: m.displayName, lngLat: ll })
    }

    const planned = canUsePlanned ? plannedLine : []
    const all = [...polylineLine, ...planned, ...waypointPoints.map((w) => w.lngLat), ...memberPoints.map((m) => m.lngLat)]
    return {
      polylineLine,
      plannedLine: planned,
      waypointPoints,
      memberPoints,
      bounds: buildBounds(all),
      center: all.length ? all[0] : ([105.8342, 21.0278] as LngLat),
    }
  }, [detail, members, plannedLine, polylineLine, sortedWaypoints, waypointMarkById])

  const renderMap = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (!mapLoadedRef.current) return

    const sdk = goongjs as unknown as GoongSdk

    safeRemoveMarkers(routeMarkersRef.current)
    routeMarkersRef.current = []

    for (const marker of memberMarkersRef.current.values()) {
      try {
        marker.remove?.()
      } catch {
        // ignore
      }
    }
    memberMarkersRef.current = new Map()

    const sourceId = 'admin-journey-tracking-route'
    const layerId = 'admin-journey-tracking-route-line'
    const casingLayerId = 'admin-journey-tracking-route-casing'

    const connectorsSourceId = 'admin-journey-tracking-connectors'
    const connectorsLayerId = 'admin-journey-tracking-connectors-line'

    const plannedSourceId = 'admin-journey-tracking-planned'
    const plannedLayerId = 'admin-journey-tracking-planned-line'

    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    } catch {
      // ignore
    }
    try {
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId)
    } catch {
      // ignore
    }
    try {
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    } catch {
      // ignore
    }

    try {
      if (map.getLayer(connectorsLayerId)) map.removeLayer(connectorsLayerId)
    } catch {
      // ignore
    }
    try {
      if (map.getSource(connectorsSourceId)) map.removeSource(connectorsSourceId)
    } catch {
      // ignore
    }

    try {
      if (map.getLayer(plannedLayerId)) map.removeLayer(plannedLayerId)
    } catch {
      // ignore
    }
    try {
      if (map.getSource(plannedSourceId)) map.removeSource(plannedSourceId)
    } catch {
      // ignore
    }

    if (mapData.polylineLine.length >= 2) {
      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: mapData.polylineLine,
        },
      }

      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      })

      // Casing to make the tracking route stand out from the overview route.
      map.addLayer({
        id: casingLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.85 },
      })

      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#c5a070', 'line-width': 4, 'line-dasharray': [2, 2] },
      })

      // Connector lines from snapped route to POI waypoints (when they are far apart).
      if (mapData.waypointPoints.length) {
        const CONNECTOR_MIN_METERS = 50
        const features: Array<{
          type: 'Feature'
          properties: { distanceMeters: number; stopOrder: number }
          geometry: { type: 'LineString'; coordinates: LngLat[] }
        }> = []

        for (const wp of mapData.waypointPoints) {
          const projected = projectPointToPolylineMeters(wp.lngLat, mapData.polylineLine)
          if (!projected) continue
          if (projected.distanceMeters < CONNECTOR_MIN_METERS) continue
          features.push({
            type: 'Feature',
            properties: { distanceMeters: projected.distanceMeters, stopOrder: wp.stopOrder },
            geometry: { type: 'LineString', coordinates: [projected.projected, wp.lngLat] },
          })
        }

        if (features.length) {
          map.addSource(connectorsSourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
          })

          map.addLayer({
            id: connectorsLayerId,
            type: 'line',
            source: connectorsSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#c5a070', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [1, 2] },
          })
        }
      }
    }

    // For non-completed journeys, draw the planned route (from detail.routePoints) as a dashed baseline.
    if (!isCompletedStatus(detail?.status) && mapData.plannedLine.length >= 2) {
      const plannedGeojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: mapData.plannedLine,
        },
      }

      map.addSource(plannedSourceId, {
        type: 'geojson',
        data: plannedGeojson,
      })

      map.addLayer({
        id: plannedLayerId,
        type: 'line',
        source: plannedSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#c5a070', 'line-width': 3, 'line-opacity': 0.5, 'line-dasharray': [2, 2] },
      })
    }

    for (const wp of mapData.waypointPoints) {
      const el = document.createElement('div')
      const clsBase =
        'w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-sm ring-2 ring-white'

      const clsMark = wp.mark === 'visited' ? 'bg-emerald-600' : wp.mark === 'skipped' ? 'bg-stone-500' : 'bg-amber-600'
      el.className = `${clsBase} ${clsMark}`
      el.title = wp.name ? `${wp.stopOrder}. ${wp.name}` : `${wp.stopOrder}`
      el.textContent = String(wp.stopOrder)
      const marker = new sdk.Marker({ element: el }).setLngLat(wp.lngLat).addTo(map)
      routeMarkersRef.current.push(marker)
    }

    for (const m of mapData.memberPoints) {
      const el = document.createElement('div')
      el.className =
        'w-7 h-7 rounded-full bg-stone-900 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white'
      el.title = m.displayName
      el.textContent = m.displayName.trim().slice(0, 2).toUpperCase() || 'M'
      const marker = new sdk.Marker({ element: el }).setLngLat(m.lngLat).addTo(map)
      memberMarkersRef.current.set(m.memberId, marker)
    }

    if (mapData.bounds) {
      if (isCollapsedBounds(mapData.bounds)) map.setCenter(mapData.bounds[0])
      else map.fitBounds(mapData.bounds, { padding: 48, maxZoom: 16 })
    } else map.setCenter(mapData.center)
  }, [detail?.status, mapData])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return
    if (!goongMapKey) return

    const sdk = goongjs as unknown as GoongSdk
    sdk.accessToken = goongMapKey

    const map = new sdk.Map({
      container,
      style: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(goongMapKey)}`,
      center: mapData.center,
      zoom: 11,
    })

    mapRef.current = map
    mapLoadedRef.current = false

    map.on('load', () => {
      mapLoadedRef.current = true
      renderMap()
    })

    return () => {
      safeRemoveMarkers(routeMarkersRef.current)
      routeMarkersRef.current = []

      for (const marker of memberMarkersRef.current.values()) {
        try {
          marker.remove?.()
        } catch {
          // ignore
        }
      }
      memberMarkersRef.current = new Map()

      try {
        map.remove()
      } catch {
        // ignore
      }

      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [goongMapKey, mapData.center, renderMap])

  useEffect(() => {
    renderMap()
  }, [renderMap])

  // Completed: load polyline + progress once.
  useEffect(() => {
    if (!journeyId) return
    if (!detail) return

    if (!isCompletedStatus(detail.status)) {
      setPolyline(null)
      setProgress(null)
      return
    }

    const run = async () => {
      try {
        const [polyRes, progRes] = await Promise.all([
          api.get<JourneyPolylineResponse>(`/api/admin/journeys/${encodeURIComponent(journeyId)}/polyline`),
          api.get<AdminJourneyWaypointProgressSummaryResponse>(
            `/api/admin/journeys/${encodeURIComponent(journeyId)}/waypoints/progress`,
          ),
        ])
        setPolyline(polyRes.data)
        setProgress(progRes.data)
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được dữ liệu hành trình thực tế'))
      }
    }

    void run()
  }, [detail, journeyId])

  // Not completed: load member snapshot and connect SignalR.
  useEffect(() => {
    if (!journeyId) return
    if (!detail) return

    if (isCompletedStatus(detail.status)) {
      setMembers([])
      return
    }

    if (!canLiveTrackStatus(detail.status)) {
      setMembers([])
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const { data } = await api.get<JourneyMemberRosterItemResponse[]>(
          `/api/admin/journeys/${encodeURIComponent(journeyId)}/members`,
        )
        if (!cancelled) setMembers(Array.isArray(data) ? data : [])
      } catch (e) {
        toast.error(getApiErrorMessage(e, 'Không tải được danh sách thành viên'))
        if (!cancelled) setMembers([])
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [detail, journeyId])

  useEffect(() => {
    if (!journeyId) return
    if (!detail) return
    if (isCompletedStatus(detail.status)) return
    if (!canLiveTrackStatus(detail.status)) return

    const resolvedBase = base || (typeof window !== 'undefined' ? window.location.origin : '')
    if (!resolvedBase) return

    const token = getStoredAccessToken()
    if (!token) return

    const hubUrl = `${resolvedBase.replace(/\/$/, '')}/hubs/journey-live`

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getStoredAccessToken() ?? '',
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    hubRef.current = conn

    conn.on('MemberLocationUpdated', (payload: JourneyMemberLocationNotification) => {
      if (!payload) return
      if (payload.journeyId && normalizeJourneyId(payload.journeyId) !== normalizeJourneyId(journeyId)) return
      const ll = toLngLat({ latitude: payload.latitude, longitude: payload.longitude })
      if (!ll) return

      const existing = memberMarkersRef.current.get(payload.memberId)

      if (existing) {
        existing.setLngLat(ll)
        return
      }

      // Create marker lazily for a member not in initial roster.
      const map = mapRef.current
      if (!map || !mapLoadedRef.current) return

      const sdk = goongjs as unknown as GoongSdk
      const el = document.createElement('div')
      el.className =
        'w-7 h-7 rounded-full bg-stone-900 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white'
      el.title = payload.displayName ?? 'Member'
      el.textContent = (payload.displayName ?? 'M').trim().slice(0, 2).toUpperCase() || 'M'

      const marker = new sdk.Marker({ element: el }).setLngLat(ll).addTo(map)
      memberMarkersRef.current.set(payload.memberId, marker)
    })

    let cancelled = false

    const isIgnorableSignalRError = (e: unknown): boolean => {
      const msg = (e as { message?: string })?.message ?? String(e)
      return (
        cancelled ||
        msg.includes('Invocation canceled') ||
        msg.includes('underlying connection being closed') ||
        msg.includes('The connection was stopped')
      )
    }

    const join = async () => {
      await conn.invoke('JoinJourneyAsAdminObserver', journeyId)
    }

    conn.onreconnected(() => {
      void join().catch(() => {
        // ignore noisy failures during reconnect; user will see live data when the next reconnect succeeds
      })
    })

    const start = async () => {
      try {
        await conn.start()
        if (cancelled) return
        await join()
      } catch (e) {
        if (isIgnorableSignalRError(e)) return
        toast.error(getApiErrorMessage(e, 'Không kết nối được theo dõi thời gian thực'))
      }
    }

    void start()

    return () => {
      cancelled = true
      conn.off('MemberLocationUpdated')
      void conn.stop()
      hubRef.current = null
    }
  }, [base, detail, journeyId])

  const canShowMap = Boolean(goongMapKey)

  const gpsStatusText = useMemo(() => {
    if (!detail || isCompletedStatus(detail.status) || !canLiveTrackStatus(detail.status)) return null
    if (!members.length) return 'Chưa có thành viên trong hành trình.'
    const withGps = mapData.memberPoints.length
    if (withGps <= 0) return 'Chưa có GPS từ thành viên (có thể chưa bật quyền vị trí hoặc GPS chưa gửi lên server).'
    if (withGps < members.length) return `Một số thành viên chưa có GPS (${withGps}/${members.length}).`
    return null
  }, [detail, mapData.memberPoints.length, members.length])

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">Hành trình thực tế</h1>
          <Link
            to={journeyId ? `/admin/journeys/${journeyId}` : '/admin/journeys'}
            className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Quay lại chi tiết
          </Link>
        </div>

        {loading && <div className={`${card} py-16 text-center text-stone-500`}>Đang tải dữ liệu…</div>}

        {!loading && !detail && <div className={`${card} py-16 text-center text-stone-500`}>Không có dữ liệu</div>}

        {detail && (
          <>
            <section className={card}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-stone-700">
                  <span className="font-semibold text-stone-900">Trạng thái:</span> {displayJourneyStatus(detail.status)}
                </div>
                {isCompletedStatus(detail.status) ? (
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Hoàn thành
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    Theo dõi trực tiếp
                  </span>
                )}
              </div>

              {!isCompletedStatus(detail.status) && (
                <div className="mt-3" />
              )}

              {!isCompletedStatus(detail.status) && gpsStatusText && (
                <p className="mt-2 text-sm font-semibold text-amber-800">{gpsStatusText}</p>
              )}
            </section>

            {/* No location tracking consent notice */}
            {detail.allowLocationTracking === false && (
              <section className="rounded-2xl border border-stone-200/80 bg-gradient-to-r from-stone-50 to-slate-50 px-5 py-4 flex items-start gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-700">Người dùng chưa đồng ý chia sẻ vị trí GPS</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    Hành trình này có <code className="bg-stone-100 px-1 rounded text-[11px]">allowLocationTracking = false</code>.
                    Dữ liệu vị trí thành viên sẽ không có — bản đồ live và danh sách thành viên sẽ trống.
                  </p>
                </div>
              </section>
            )}

            <section className={card}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Bản đồ</h2>
                {!goongMapKey && <span className="text-xs font-semibold text-rose-700">Thiếu VITE_GOONG_MAP_KEY</span>}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200">
                {!canShowMap ? (
                  <div className="flex h-[480px] items-center justify-center bg-stone-50 text-sm text-stone-600">
                    Không thể hiển thị bản đồ vì thiếu cấu hình Goong Map key.
                  </div>
                ) : detail.allowLocationTracking === false && !isCompletedStatus(detail.status) ? (
                  <div className="flex h-[480px] flex-col items-center justify-center gap-3 bg-stone-50 text-center px-6">
                    <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-stone-600">Không có dữ liệu vị trí</p>
                    <p className="text-xs text-stone-400 max-w-xs leading-relaxed">
                      Người dùng chưa đồng ý chia sẻ GPS. Bản đồ live không khả dụng cho hành trình này.
                    </p>
                  </div>
                ) : (
                  <div ref={mapContainerRef} className="h-[480px] w-full" />
                )}
              </div>

            </section>
          </>
        )}
      </div>
    </main>
  )
}
