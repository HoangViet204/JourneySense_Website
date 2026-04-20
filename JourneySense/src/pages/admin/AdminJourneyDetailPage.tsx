import goongjs from '@goongmaps/goong-js'
import '@goongmaps/goong-js/dist/goong-js.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import type { GeoPointResponse, JourneyDetailResponse, JourneyWaypointResponse } from '../../types/portal'
import { getApiErrorMessage } from '../../utils/apiMessage'
import { displayJourneyStatus, formatDate } from '../../utils/format'

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
  const lat = Number((p as { latitude?: number | null }).latitude)
  const lng = Number((p as { longitude?: number | null }).longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lng, lat]
}

function sortWaypoints(waypoints: JourneyWaypointResponse[]): JourneyWaypointResponse[] {
  return [...waypoints].sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
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

function safeRemoveMarkers(markers: GoongMarkerInstance[]) {
  for (const m of markers) {
    try {
      m.remove?.()
    } catch {
      // ignore
    }
  }
}

function renderOverviewMap(opts: {
  map: GoongMapInstance
  sdk: GoongSdk
  markersRef: React.MutableRefObject<GoongMarkerInstance[]>
  mapData: {
    line: LngLat[]
    waypointPoints: Array<{ lngLat: LngLat; stopOrder: number; name?: string | null }>
    bounds: [LngLat, LngLat] | null
    center: LngLat
  }
}) {
  const { map, sdk, markersRef, mapData } = opts

  safeRemoveMarkers(markersRef.current)
  markersRef.current = []

  const sourceId = 'admin-journey-route'
  const layerId = 'admin-journey-route-line'

  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId)
  } catch {
    // ignore
  }
  try {
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  } catch {
    // ignore
  }

  if (mapData.line.length >= 2) {
    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: mapData.line,
      },
    }

    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    })

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#c5a070', 'line-width': 4 },
    })
  }

  for (const wp of mapData.waypointPoints) {
    const el = document.createElement('div')
    el.className =
      'w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shadow-sm ring-2 ring-white'
    el.title = wp.name ? `${wp.stopOrder}. ${wp.name}` : `${wp.stopOrder}`
    el.textContent = String(wp.stopOrder)
    const marker = new sdk.Marker({ element: el }).setLngLat(wp.lngLat).addTo(map)
    markersRef.current.push(marker)
  }

  if (mapData.bounds) {
    map.fitBounds(mapData.bounds, { padding: 48, maxZoom: 15 })
  } else {
    map.setCenter(mapData.center)
  }
}

export default function AdminJourneyDetailPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const goongMapKey = import.meta.env.VITE_GOONG_MAP_KEY

  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<JourneyDetailResponse | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoongMapInstance | null>(null)
  const markersRef = useRef<GoongMarkerInstance[]>([])
  const mapLoadedRef = useRef(false)

  const load = useCallback(async () => {
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
    void load()
  }, [load])

  const routePoints = useMemo(() => {
    const pts = detail?.routePoints && detail.routePoints.length ? detail.routePoints : detail?.setupPrimaryRoutePoints
    return Array.isArray(pts) ? pts : []
  }, [detail])

  const sortedWaypoints = useMemo(() => {
    const wps = Array.isArray(detail?.waypoints) ? detail!.waypoints!.filter(Boolean) : []
    return sortWaypoints(wps)
  }, [detail])

  const mapData = useMemo(() => {
    const line: LngLat[] = []
    for (const p of routePoints) {
      const ll = toLngLat(p)
      if (ll) line.push(ll)
    }

    const waypointPoints: Array<{ lngLat: LngLat; stopOrder: number; name?: string | null }> = []
    for (const wp of sortedWaypoints) {
      const ll = toLngLat(wp)
      if (!ll) continue
      waypointPoints.push({ lngLat: ll, stopOrder: wp.stopOrder, name: wp.name })
    }

    const all = [...line, ...waypointPoints.map((w) => w.lngLat)]
    return {
      line,
      waypointPoints,
      bounds: buildBounds(all),
      center: all.length ? all[0] : ([105.8342, 21.0278] as LngLat),
    }
  }, [routePoints, sortedWaypoints])

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
      renderOverviewMap({ map, sdk, markersRef, mapData })
    })

    return () => {
      safeRemoveMarkers(markersRef.current)
      markersRef.current = []

      try {
        map.remove()
      } catch {
        // ignore
      }
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [goongMapKey, mapData.center])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!mapLoadedRef.current) return

    const sdk = goongjs as unknown as GoongSdk
    renderOverviewMap({ map, sdk, markersRef, mapData })
  }, [mapData])

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-stone-900 sm:text-3xl">Chi tiết hành trình</h1>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {journeyId && (
              <Link
                to={`/admin/journeys/${journeyId}/tracking`}
                className="inline-flex items-center justify-center rounded-xl bg-[#c5a070] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b08f5f]"
              >
                Xem hành trình thực tế
              </Link>
            )}
            <Link
              to="/admin/journeys"
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Quay lại danh sách
            </Link>
          </div>
        </div>

        {loading && <div className={`${card} py-16 text-center text-stone-500`}>Đang tải dữ liệu…</div>}

        {!loading && !detail && <div className={`${card} py-16 text-center text-stone-500`}>Không có dữ liệu</div>}

        {detail && (
          <>
            <section className={card}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Điểm đi</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{detail.originAddress ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Điểm đến</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{detail.destinationAddress ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Trạng thái</p>
                  <p className="mt-1 text-sm text-stone-700">{displayJourneyStatus(detail.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tạo lúc</p>
                  <p className="mt-1 text-sm text-stone-700">{formatDate(detail.createdAt)}</p>
                </div>
              </div>
            </section>

            <section className={card}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-['Cormorant_Garamond',serif] text-lg font-semibold text-stone-900">Bản đồ tổng quan</h2>
                {!goongMapKey && (
                  <span className="text-xs font-semibold text-rose-700">Thiếu VITE_GOONG_MAP_KEY</span>
                )}
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200">
                {!goongMapKey ? (
                  <div className="flex h-[420px] items-center justify-center bg-stone-50 text-sm text-stone-600">
                    Không thể hiển thị bản đồ vì thiếu cấu hình Goong Map key.
                  </div>
                ) : mapData.line.length < 2 && mapData.waypointPoints.length === 0 ? (
                  <div className="flex h-[420px] items-center justify-center bg-stone-50 text-sm text-stone-600">
                    Hành trình chưa có đủ dữ liệu tuyến/waypoint để vẽ.
                  </div>
                ) : (
                  <div ref={mapContainerRef} className="h-[420px] w-full" />
                )}
              </div>
            </section>

            {sortedWaypoints.length > 0 && (
              <section className={`${card} overflow-hidden p-0`}>
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[80px]" />
                      <col className="min-w-0" />
                      <col className="w-[44%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#f5f0e8] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                        <th className="px-4 py-3">STT</th>
                        <th className="px-4 py-3">Tên</th>
                        <th className="px-4 py-3">Địa chỉ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedWaypoints.map((wp, i) => (
                        <tr key={wp.waypointId} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                          <td className="px-4 py-3 font-semibold text-stone-900">{wp.stopOrder}</td>
                          <td className="px-4 py-3 text-stone-800 truncate" title={wp.name ?? ''}>
                            {wp.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-stone-600 truncate" title={wp.address ?? ''}>
                            {wp.address ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
