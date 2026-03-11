"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  X, Route, Navigation, LocateFixed, Ruler, Trash2, Bike, Car, Footprints,
  Accessibility, Truck, PanelLeftOpen, Play, Square, Download, Leaf,
  Fuel, Flame, Map, ChevronDown, ChevronUp, Search, TreePine,
  CloudSun, Wind, Zap, AlertTriangle, Info,
} from "lucide-react"
import type { LatLngExpression } from "leaflet"
import { formatDistanceKm, formatDuration, haversineKm } from "@/lib/geo"
import type * as GeoJSON from "geojson"

// ── Types ─────────────────────────────────────────────────────────────────────
type LType = typeof import("leaflet")
type TransportMode = "driving-car" | "cycling-regular" | "foot-walking" | "wheelchair" | "driving-hgv"

type GeocodeFeature = {
  geometry: { coordinates: [number, number] }
  properties?: { label?: string }
}
type DirectionsResponse = {
  features: Array<{
    geometry: { coordinates: [number, number][] }
    properties: {
      summary?: { distance?: number; duration?: number }
      segments?: Array<{
        steps?: Array<{
          instruction: string; distance: number; duration: number; way_points: [number, number]
        }>
      }>
    }
  }>
}
type IsochronesResponse = {
  features: Array<{ geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }>
}
type RouteMetric = { index: number; distance: number; duration: number; co2g: number }
type POI = { id: number; lat: number; lon: number; name: string; type: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const CO2_G_PER_KM: Record<TransportMode, number> = {
  "driving-car": 120, "driving-hgv": 280,
  "cycling-regular": 0, "foot-walking": 0, wheelchair: 0,
}
const FUEL_L_PER_KM: Partial<Record<TransportMode, number>> = {
  "driving-car": 0.08, "driving-hgv": 0.30,
}
const KCAL_PER_KM: Partial<Record<TransportMode, number>> = {
  "cycling-regular": 30, "foot-walking": 60, wheelchair: 15,
}
const ROUTE_COLORS = ["#3b82f6", "#8b5cf6", "#64748b"]
const POI_CATEGORIES = [
  { value: "restaurant", label: "Restaurants", emoji: "🍽️" },
  { value: "cafe", label: "Cafes", emoji: "☕" },
  { value: "fuel", label: "Fuel Stations", emoji: "⛽" },
  { value: "hospital", label: "Hospitals", emoji: "🏥" },
  { value: "pharmacy", label: "Pharmacy", emoji: "💊" },
  { value: "parking", label: "Parking", emoji: "🅿️" },
  { value: "supermarket", label: "Supermarket", emoji: "🛒" },
  { value: "hotel", label: "Hotels", emoji: "🏨" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json())

function generateGpx(coords: [number, number][], name: string): string {
  const pts = coords.map(([lat, lon]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NavKit">\n  <trk>\n    <name>${name}</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>\n</gpx>`
}

function downloadBlob(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = fileName; a.click()
  URL.revokeObjectURL(url)
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GoogleLikeMap() {
  // Leaflet refs
  const mapEl = useRef<HTMLDivElement | null>(null)
  const LRef = useRef<LType | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const routeLayersRef = useRef<import("leaflet").LayerGroup | null>(null)
  const isochroneLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const measureLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const poiLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const noiseTileRef = useRef<import("leaflet").TileLayer | null>(null)
  const userCircleRef = useRef<import("leaflet").CircleMarker | null>(null)
  const replayMarkerRef = useRef<import("leaflet").CircleMarker | null>(null)
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const measurePointsRef = useRef<[number, number][]>([])
  const measurePolylineRef = useRef<import("leaflet").Polyline | null>(null)
  const evLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const primaryCoordsRef = useRef<[number, number][]>([])
  const [leafletReady, setLeafletReady] = useState(false)

  // UI state
  const [originText, setOriginText] = useState("")
  const [destinationText, setDestinationText] = useState("")
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [mode, setMode] = useState<TransportMode>("driving-car")
  const [eco, setEco] = useState(false)
  const [avoidHighways, setAvoidHighways] = useState(false)
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [avoidFerries, setAvoidFerries] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [activeTab, setActiveTab] = useState<"directions" | "isochrones" | "explore">("directions")
  const [showPanel, setShowPanel] = useState(true)
  const [measureMode, setMeasureMode] = useState<"off" | "distance">("off")
  const [measuredKm, setMeasuredKm] = useState(0)
  const [centerBias, setCenterBias] = useState<{ lat: number; lon: number } | null>(null)
  const [noiseLayerOn, setNoiseLayerOn] = useState(false)
  const [replayActive, setReplayActive] = useState(false)
  const [isoTime, setIsoTime] = useState(10)
  const [poiCategory, setPoiCategory] = useState<string>("restaurant")
  const [pois, setPois] = useState<POI[]>([])
  const [poisLoading, setPoisLoading] = useState(false)
  const [fuelCostPerLiter, setFuelCostPerLiter] = useState(1.5)
  const [steps, setSteps] = useState<{ instruction: string; distance: number; duration: number }[]>([])
  const [routeMetrics, setRouteMetrics] = useState<RouteMetric[]>([])
  const [activeRouteIdx, setActiveRouteIdx] = useState(0)
  const [bottomBar, setBottomBar] = useState<{ dist: number; dur: number; co2g: number; costLabel: string } | null>(null)
  const [loadingDirections, setLoadingDirections] = useState(false)
  const [directionsError, setDirectionsError] = useState<string | null>(null)
  const [evStatsOn, setEvStatsOn] = useState(false)
  const [evLoading, setEvLoading] = useState(false)

  const measureModeRef = useRef<"off" | "distance">("off")
  useEffect(() => { measureModeRef.current = measureMode }, [measureMode])

  // SWR autocomplete
  const { data: originResults } = useSWR(
    originText.length > 2
      ? `/api/ors/geocode?text=${encodeURIComponent(originText)}${centerBias ? `&lat=${centerBias.lat}&lon=${centerBias.lon}` : ""}`
      : null,
    fetcher,
  )
  const { data: destResults } = useSWR(
    destinationText.length > 2
      ? `/api/ors/geocode?text=${encodeURIComponent(destinationText)}${centerBias ? `&lat=${centerBias.lat}&lon=${centerBias.lon}` : ""}`
      : null,
    fetcher,
  )

  // Floating Data (Weather & AQI)
  const { data: weather } = useSWR(
    centerBias ? `/api/external/weather?lat=${centerBias.lat}&lon=${centerBias.lon}` : null,
    fetcher,
    { refreshInterval: 300000 } // 5 min
  )
  const { data: air } = useSWR(
    centerBias ? `/api/external/air?lat=${centerBias.lat}&lon=${centerBias.lon}` : null,
    fetcher,
    { refreshInterval: 600000 } // 10 min
  )

  // ── Leaflet init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    import("leaflet").then((L) => {
      if (!mounted) return
      LRef.current = L
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })
      setLeafletReady(true)
    }).catch((e) => console.error("Leaflet dynamic import failed:", e))
    return () => { mounted = false }
  }, [])

  // ── Map setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapEl.current || mapRef.current) return
    const L = LRef.current!
    const map = L.map(mapEl.current, { center: [37.774, -122.431], zoom: 12, zoomControl: false })
    mapRef.current = map

    map.on("moveend", () => {
      const c = map.getCenter()
      setCenterBias({ lat: c.lat, lon: c.lng })
    })

    // Base layers
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map)
    const sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles &copy; Esri" },
    )
    const topo = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles &copy; Esri" },
    )
    const bike = L.tileLayer(
      "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
      { maxZoom: 20, attribution: "CyclOSM" },
    )

    routeLayersRef.current = L.layerGroup().addTo(map)
    isochroneLayerRef.current = L.layerGroup().addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    measureLayerRef.current = L.layerGroup().addTo(map)
    poiLayerRef.current = L.layerGroup().addTo(map)
    evLayerRef.current = L.layerGroup().addTo(map)

    L.control.layers(
      { Street: osm, Satellite: sat, Topographic: topo, Cycling: bike },
      {
        Routes: routeLayersRef.current,
        Isochrones: isochroneLayerRef.current,
        Markers: markerLayerRef.current,
        POIs: poiLayerRef.current,
        "EV Stations": evLayerRef.current,
      },
      { position: "bottomright", collapsed: true },
    ).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          map.setView([latitude, longitude], 15)
          userCircleRef.current = L.circleMarker([latitude, longitude], {
            radius: 9, color: "#3b82f6", weight: 2.5, fillColor: "#93c5fd", fillOpacity: 0.7,
          }).addTo(markerLayerRef.current!).bindPopup("You are here").openPopup()
          setOrigin([latitude, longitude])
          setOriginText("My location")
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
      )
    }

    // Click handler
    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng
      if (measureModeRef.current === "distance") {
        measurePointsRef.current.push([lat, lng])
        L.circleMarker([lat, lng], {
          radius: 4, color: "#10b981", weight: 2, fillColor: "#10b981", fillOpacity: 0.9,
        }).addTo(measureLayerRef.current!)
        if (measurePointsRef.current.length >= 2) {
          const pts = measurePointsRef.current
          const seg = haversineKm(pts[pts.length - 2], pts[pts.length - 1])
          setMeasuredKm((p) => p + seg)
          if (!measurePolylineRef.current) {
            measurePolylineRef.current = L.polyline(pts as LatLngExpression[], {
              color: "#10b981", weight: 3, dashArray: "6 4",
            }).addTo(measureLayerRef.current!)
          } else {
            measurePolylineRef.current.setLatLngs(pts as LatLngExpression[])
          }
        }
        return
      }
      try {
        const res = await fetch(`/api/ors/reverse?lat=${lat}&lon=${lng}`)
        const data = await res.json()
        const label = data?.features?.[0]?.properties?.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        L.marker([lat, lng]).addTo(markerLayerRef.current!).bindPopup(label).openPopup()
      } catch { /* silent */ }
    })

    return () => { map.off(); map.remove(); mapRef.current = null }
  }, [leafletReady])

  const L = LRef.current
  const fitToCoords = useCallback((coords: [number, number][]) => {
    if (!L || !mapRef.current || !coords.length) return
    mapRef.current.fitBounds(L.latLngBounds(coords), { padding: [32, 32] })
  }, [L])

  // ── Noise overlay ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapRef.current) return
    if (noiseLayerOn) {
      if (!noiseTileRef.current) {
        noiseTileRef.current = L.tileLayer(
          "https://noise.inovex.de/tiles/road/{z}/{x}/{y}.png",
          { opacity: 0.55, maxZoom: 16, attribution: "Noise data &copy; iNOVEX" },
        ).addTo(mapRef.current)
      }
    } else {
      noiseTileRef.current?.remove()
      noiseTileRef.current = null
    }
  }, [noiseLayerOn, L])

  // ── Directions ────────────────────────────────────────────────────────────
  const getDirections = useCallback(async () => {
    if (!origin || !destination || !L) return
    setLoadingDirections(true)
    setDirectionsError(null)
    const coords = [origin, ...waypoints, destination]
    const body = {
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
      profile: mode,
      preference: eco ? "shortest" : "recommended",
      alternatives: true,
      options: {
        avoid_features: [
          ...(avoidHighways ? ["highways"] : []),
          ...(avoidTolls ? ["tollways"] : []),
          ...(avoidFerries ? ["ferries"] : []),
        ],
      },
      instructions: true, geometry: true,
    }
    try {
      const res = await fetch("/api/ors/directions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setDirectionsError("Invalid or missing API key. Please check your .env.local")
        } else {
          setDirectionsError("Routing failed. The service might be temporarily unavailable.")
        }
        return
      }
      const json: DirectionsResponse = await res.json()

      routeLayersRef.current!.clearLayers()
      const allCoords: [number, number][] = []
      const metrics: RouteMetric[] = []

      json.features.forEach((f, idx) => {
        const latlngs = f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
        allCoords.push(...latlngs)
        const dist = f.properties.summary?.distance ?? 0
        const dur = f.properties.summary?.duration ?? 0
        const co2g = (dist / 1000) * CO2_G_PER_KM[mode]
        metrics.push({ index: idx, distance: dist, duration: dur, co2g })
        if (idx === 0) primaryCoordsRef.current = latlngs
        L!.polyline(latlngs as LatLngExpression[], {
          color: ROUTE_COLORS[idx] ?? "#64748b",
          weight: idx === 0 ? 5 : 3.5,
          opacity: idx === 0 ? 0.95 : 0.5,
        }).addTo(routeLayersRef.current!)
      })

      if (allCoords.length) fitToCoords(allCoords)
      setRouteMetrics(metrics)
      setActiveRouteIdx(0)

      // Bottom bar for primary route
      const primary = metrics[0]
      if (primary) {
        const distKm = primary.distance / 1000
        const fuel = FUEL_L_PER_KM[mode]
        const kcal = KCAL_PER_KM[mode]
        let costLabel = ""
        if (fuel) costLabel = `~$${(distKm * fuel * fuelCostPerLiter).toFixed(2)} fuel`
        else if (kcal) costLabel = `~${Math.round(distKm * kcal)} kcal`
        setBottomBar({ dist: primary.distance, dur: primary.duration, co2g: primary.co2g, costLabel })
      }

      // Steps from primary route
      const seg = json.features[0]?.properties?.segments?.[0]?.steps ?? []
      setSteps(seg.map((s) => ({ instruction: s.instruction, distance: s.distance, duration: s.duration })))
    } catch (e) {
      setDirectionsError("Network error. Please try again.")
      console.error("Directions error:", e)
    } finally {
      setLoadingDirections(false)
    }
  }, [origin, destination, waypoints, mode, eco, avoidHighways, avoidTolls, avoidFerries, L, fitToCoords, fuelCostPerLiter])

  // ── GPX Export ────────────────────────────────────────────────────────────
  const exportGpx = useCallback(() => {
    if (!primaryCoordsRef.current.length) return
    const gpx = generateGpx(primaryCoordsRef.current, `${originText} to ${destinationText}`)
    downloadBlob(gpx, "navkit-route.gpx", "application/gpx+xml")
  }, [originText, destinationText])

  // ── Route Replay ──────────────────────────────────────────────────────────
  const startReplay = useCallback(() => {
    const coords = primaryCoordsRef.current
    if (!coords.length || !L || !mapRef.current) return
    setReplayActive(true)
    let i = 0
    if (replayMarkerRef.current) replayMarkerRef.current.remove()
    replayMarkerRef.current = L.circleMarker(coords[0] as LatLngExpression, {
      radius: 10, color: "#f59e0b", weight: 3, fillColor: "#fbbf24", fillOpacity: 0.9,
    }).addTo(mapRef.current)
    replayIntervalRef.current = setInterval(() => {
      i++
      if (i >= coords.length) {
        clearInterval(replayIntervalRef.current!)
        replayIntervalRef.current = null
        setReplayActive(false)
        return
      }
      replayMarkerRef.current?.setLatLng(coords[i] as LatLngExpression)
    }, 40)
  }, [L])

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) { clearInterval(replayIntervalRef.current); replayIntervalRef.current = null }
    replayMarkerRef.current?.remove()
    replayMarkerRef.current = null
    setReplayActive(false)
  }, [])

  // ── Isochrone ─────────────────────────────────────────────────────────────
  const runIsochrone = useCallback(async () => {
    if (!origin || !L) return
    isochroneLayerRef.current!.clearLayers()
    const res = await fetch("/api/ors/isochrones", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: [[origin[1], origin[0]]], range: [isoTime * 60], profile: mode }),
    })
    if (!res.ok) return
    const json: IsochronesResponse = await res.json()
    json.features.forEach((f, idx) => {
      L!.geoJSON(f.geometry as any, {
        style: {
          color: ROUTE_COLORS[idx] ?? "#10b981",
          weight: 2, fillColor: ROUTE_COLORS[idx] ?? "#10b981", fillOpacity: 0.15,
        },
      }).addTo(isochroneLayerRef.current!)
    })
  }, [origin, isoTime, mode, L])

  // ── POI Search ────────────────────────────────────────────────────────────
  const searchPOIs = useCallback(async () => {
    if (!centerBias || !L) return
    setPoisLoading(true)
    poiLayerRef.current!.clearLayers()
    try {
      const res = await fetch(`/api/external/poi?lat=${centerBias.lat}&lon=${centerBias.lon}&category=${poiCategory}&radius=1500`)
      if (!res.ok) return
      const data: POI[] = await res.json()
      setPois(data)
      const cat = POI_CATEGORIES.find((c) => c.value === poiCategory)
      data.forEach((p) => {
        L!.circleMarker([p.lat, p.lon], {
          radius: 7, color: "#8b5cf6", weight: 2, fillColor: "#c4b5fd", fillOpacity: 0.8,
        }).addTo(poiLayerRef.current!).bindPopup(`<b>${cat?.emoji ?? "📌"} ${p.name}</b>${p.address ? `<br/><small>${p.address}</small>` : ""}`)
      })
    } catch { /* silent */ } finally { setPoisLoading(false) }
  }, [centerBias, poiCategory, L])

  // ── EV Search ─────────────────────────────────────────────────────────────
  const toggleEVLayer = useCallback(async () => {
    if (!L || !mapRef.current || !centerBias) return
    if (evStatsOn) {
      evLayerRef.current?.clearLayers()
      setEvStatsOn(false)
      return
    }

    setEvLoading(true)
    try {
      const res = await fetch(`/api/external/ev?lat=${centerBias.lat}&lon=${centerBias.lon}&distance=10`)
      if (!res.ok) return
      const data = await res.json()
      evLayerRef.current?.clearLayers()
      data.forEach((p: any) => {
        L!.circleMarker([p.lat, p.lon], {
          radius: 8, color: "#0ea5e9", weight: 2, fillColor: "#0ea5e9", fillOpacity: 0.8,
        }).addTo(evLayerRef.current!).bindPopup(`<b>⚡ ${p.title}</b><br/><small>${p.address}</small>`)
      })
      setEvStatsOn(true)
    } catch { /* silent */ } finally { setEvLoading(false) }
  }, [centerBias, evStatsOn, L])

  // ── Map controls ──────────────────────────────────────────────────────────
  const locateMe = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(({ coords: { latitude, longitude } }) => {
      mapRef.current?.setView([latitude, longitude], 15)
      if (userCircleRef.current) userCircleRef.current.setLatLng([latitude, longitude])
      else {
        userCircleRef.current = L!.circleMarker([latitude, longitude], {
          radius: 9, color: "#3b82f6", weight: 2.5, fillColor: "#93c5fd", fillOpacity: 0.7,
        }).addTo(markerLayerRef.current!).bindPopup("You are here").openPopup()
      }
    }, undefined, { enableHighAccuracy: true })
  }, [L])

  const clearMap = useCallback(() => {
    routeLayersRef.current?.clearLayers()
    isochroneLayerRef.current?.clearLayers()
    markerLayerRef.current?.clearLayers()
    measureLayerRef.current?.clearLayers()
    poiLayerRef.current?.clearLayers()
    measurePointsRef.current = []
    measurePolylineRef.current?.remove(); measurePolylineRef.current = null
    evLayerRef.current?.clearLayers()
    primaryCoordsRef.current = []
    stopReplay()
    setSteps([]); setRouteMetrics([]); setBottomBar(null); setMeasuredKm(0); setPois([])
    setEvStatsOn(false)
    if (userCircleRef.current) userCircleRef.current.addTo(markerLayerRef.current!)
  }, [stopReplay])

  const pickOrigin = useCallback((f: GeocodeFeature) => {
    const [lon, lat] = f.geometry.coordinates
    setOrigin([lat, lon])
    setOriginText(f.properties?.label ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
    L?.marker([lat, lon]).addTo(markerLayerRef.current!)
    mapRef.current?.setView([lat, lon], 13) // Re-center to update Weather/AQI/Bias
  }, [L])

  const pickDestination = useCallback((f: GeocodeFeature) => {
    const [lon, lat] = f.geometry.coordinates
    setDestination([lat, lon])
    setDestinationText(f.properties?.label ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
    L?.marker([lat, lon]).addTo(markerLayerRef.current!)
    mapRef.current?.setView([lat, lon], 13) // Re-center to update Weather/AQI/Bias
  }, [L])

  // ── Sub-components ────────────────────────────────────────────────────────
  const modes: { value: TransportMode; icon: any; label: string }[] = [
    { value: "driving-car", icon: Car, label: "Drive" },
    { value: "cycling-regular", icon: Bike, label: "Bike" },
    { value: "foot-walking", icon: Footprints, label: "Walk" },
    { value: "wheelchair", icon: Accessibility, label: "Accessible" },
    { value: "driving-hgv", icon: Truck, label: "HGV" },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-[calc(100dvh-64px)] w-full bg-background overflow-hidden">
      {/* Map canvas — behind everything */}
      <div ref={mapEl} className="absolute inset-0 z-0" aria-label="Interactive map" role="region" />

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      {showPanel && (
        <aside className="absolute left-3 top-3 z-20 flex flex-col glass-panel rounded-2xl shadow-2xl w-[340px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-80px)] overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-sm">NavKit</span>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Separator className="opacity-50" />

          {/* Mode selector */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
              {modes.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  title={label}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all duration-150",
                    mode === value
                      ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 h-8">
                <TabsTrigger value="directions" className="text-xs rounded-lg">Directions</TabsTrigger>
                <TabsTrigger value="isochrones" className="text-xs rounded-lg">Reach</TabsTrigger>
                <TabsTrigger value="explore" className="text-xs rounded-lg">Explore</TabsTrigger>
              </TabsList>

              {/* ── DIRECTIONS TAB ─────────────────────────────────────── */}
              <TabsContent value="directions" className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
                {/* Origin */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background z-10" />
                    <Input
                      className="pl-8 text-sm rounded-xl border-border/60 bg-background/60"
                      placeholder="From — origin"
                      value={originText}
                      onChange={(e) => setOriginText(e.target.value)}
                    />
                  </div>
                  {originText.length > 2 && originResults?.features?.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-lg">
                      {originResults.features.slice(0, 5).map((f: GeocodeFeature, i: number) => (
                        <button key={i} className="block w-full px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0" onClick={() => pickOrigin(f)}>
                          {f.properties?.label ?? f.geometry.coordinates.join(", ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-background" />
                    <Input
                      className="pl-8 text-sm rounded-xl border-border/60 bg-background/60"
                      placeholder="To — destination"
                      value={destinationText}
                      onChange={(e) => setDestinationText(e.target.value)}
                    />
                  </div>
                  {destinationText.length > 2 && destResults?.features?.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-lg">
                      {destResults.features.slice(0, 5).map((f: GeocodeFeature, i: number) => (
                        <button key={i} className="block w-full px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0" onClick={() => pickDestination(f)}>
                          {f.properties?.label ?? f.geometry.coordinates.join(", ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Options toggle */}
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className="flex w-full items-center justify-between py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Route preferences</span>
                  {showOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showOptions && (
                  <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "eco", label: "Eco route", state: eco, set: setEco },
                        { id: "ah", label: "No highways", state: avoidHighways, set: setAvoidHighways },
                        { id: "at", label: "No tolls", state: avoidTolls, set: setAvoidTolls },
                        { id: "af", label: "No ferries", state: avoidFerries, set: setAvoidFerries },
                      ].map(({ id, label, state, set }) => (
                        <div key={id} className="flex items-center gap-2">
                          <Checkbox id={id} checked={state} onCheckedChange={(v) => set(Boolean(v))} className="h-3.5 w-3.5" />
                          <label htmlFor={id} className="text-xs cursor-pointer">{label}</label>
                        </div>
                      ))}
                    </div>
                    {(mode === "driving-car" || mode === "driving-hgv") && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> Fuel price</span>
                          <span>${fuelCostPerLiter.toFixed(2)}/L</span>
                        </div>
                        <Slider value={[fuelCostPerLiter]} onValueChange={([v]) => setFuelCostPerLiter(v)} min={0.5} max={4} step={0.1} />
                      </div>
                    )}
                  </div>
                )}

                {/* Get Directions button */}
                <Button
                  className="w-full rounded-xl btn-gradient font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-60"
                  onClick={getDirections}
                  disabled={!origin || !destination || loadingDirections}
                >
                  {loadingDirections ? (
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Getting directions…</span>
                  ) : (
                    <span className="flex items-center gap-2"><Route className="h-4 w-4" /> Get Directions</span>
                  )}
                </Button>
                {directionsError && (
                  <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">{directionsError}</p>
                )}

                {/* Route cards */}
                {routeMetrics.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{routeMetrics.length} route{routeMetrics.length > 1 ? "s" : ""} found</span>
                      <button onClick={exportGpx} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                        <Download className="h-3 w-3" /> GPX
                      </button>
                    </div>
                    {routeMetrics.map((m, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveRouteIdx(idx)}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-all",
                          activeRouteIdx === idx
                            ? "border-primary/60 bg-primary/8 shadow-sm"
                            : "border-border/50 hover:border-border hover:bg-muted/30",
                        )}
                        style={{ borderLeftWidth: "3px", borderLeftColor: ROUTE_COLORS[idx] ?? "#64748b" }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{idx === 0 ? "Best route" : idx === 1 ? "Alternative 1" : "Alternative 2"}</span>
                          {m.co2g > 0 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Leaf className="h-3 w-3" /> {m.co2g < 1000 ? `${Math.round(m.co2g)}g` : `${(m.co2g / 1000).toFixed(1)}kg`} CO₂
                            </span>
                          )}
                          {m.co2g === 0 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Leaf className="h-3 w-3" /> Zero emissions
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDistanceKm(m.distance)}</span>
                          <span>·</span>
                          <span>{formatDuration(m.duration)}</span>
                        </div>
                      </button>
                    ))}

                    {/* Route replay control */}
                    <button
                      onClick={replayActive ? stopReplay : startReplay}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium transition-all",
                        replayActive
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {replayActive ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {replayActive ? "Stop replay" : "Replay route"}
                    </button>
                  </div>
                )}

                {/* Turn-by-turn steps */}
                {steps.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Navigation className="h-3.5 w-3.5 text-primary" />
                      Turn-by-turn directions
                    </div>
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {steps.map((s, i) => (
                        <div key={i} className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-xs leading-snug">{s.instruction}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDistanceKm(s.distance)} · {Math.round(s.duration / 60)} min
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── ISOCHRONES TAB ─────────────────────────────────────── */}
              <TabsContent value="isochrones" className="mt-3 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Travel time</span>
                    <span className="text-muted-foreground">{isoTime} min</span>
                  </div>
                  <Slider value={[isoTime]} onValueChange={([v]) => setIsoTime(v)} min={2} max={60} className="my-1" />
                </div>
                <Button className="w-full rounded-xl btn-gradient" onClick={runIsochrone} disabled={!origin}>
                  Compute Reachable Area
                </Button>
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-3 py-2.5 leading-relaxed">
                  Set an origin in Directions first, then compute to see how far you can travel in {isoTime} minutes.
                </p>
              </TabsContent>

              {/* ── EXPLORE TAB ────────────────────────────────────────── */}
              <TabsContent value="explore" className="mt-3 space-y-3">
                {/* Measure tool status */}
                <div className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2.5",
                  measureMode === "distance" ? "border-emerald-500/50 bg-emerald-500/8" : "border-border/50",
                )}>
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">Distance Measure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {measuredKm > 0 && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{measuredKm.toFixed(2)} km</span>}
                    <button
                      onClick={() => { setMeasureMode(measureMode === "off" ? "distance" : "off"); if (measureMode !== "off") setMeasuredKm(0) }}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        measureMode === "distance"
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {measureMode === "distance" ? "Stop" : "Start"}
                    </button>
                  </div>
                </div>

                {/* Noise overlay */}
                <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Map className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Noise Overlay</span>
                  </div>
                  <button
                    onClick={() => setNoiseLayerOn(!noiseLayerOn)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      noiseLayerOn ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {noiseLayerOn ? "On" : "Off"}
                  </button>
                </div>

                {/* EV Stations Toggle */}
                <div className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2.5",
                  evStatsOn ? "border-sky-500/50 bg-sky-500/8" : "border-border/50",
                )}>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-sky-500" />
                    <span className="font-medium">EV Charging Stations</span>
                  </div>
                  <button
                    onClick={toggleEVLayer}
                    disabled={evLoading}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      evStatsOn ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {evLoading ? "..." : evStatsOn ? "On" : "Off"}
                  </button>
                </div>

                {/* POI Search */}
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-2"><TreePine className="h-3.5 w-3.5 text-violet-500" /> Nearby Places</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {POI_CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setPoiCategory(c.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all",
                          poiCategory === c.value
                            ? "border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium"
                            : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <span>{c.emoji}</span> {c.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={searchPOIs}
                    variant="outline"
                    className="w-full rounded-xl text-xs border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
                    disabled={poisLoading}
                  >
                    {poisLoading ? (
                      <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" /> Searching…</span>
                    ) : (
                      <span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Search near map center</span>
                    )}
                  </Button>
                  {pois.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto rounded-xl border border-border/50 p-1.5">
                      {pois.slice(0, 10).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => mapRef.current?.setView([p.lat, p.lon], 17)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left"
                        >
                          <span className="shrink-0 mt-0.5">{POI_CATEGORIES.find((c) => c.value === p.type)?.emoji ?? "📌"}</span>
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      )}

      {/* ── Panel toggle (when closed) ──────────────────────────────────── */}
      {!showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl glass-panel px-3 py-2.5 text-sm font-medium shadow-lg hover:shadow-xl transition-shadow"
        >
          <PanelLeftOpen className="h-4 w-4" />
          <span>Open panel</span>
        </button>
      )}

      {/* ── Floating right controls ─────────────────────────────────────── */}
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
        {[
          { onClick: locateMe, icon: LocateFixed, title: "Locate me", active: false },
          { onClick: () => { setMeasureMode(measureMode === "off" ? "distance" : "off"); if (measureMode !== "off") setMeasuredKm(0) }, icon: Ruler, title: "Measure distance", active: measureMode === "distance" },
          { onClick: clearMap, icon: Trash2, title: "Clear map", active: false },
        ].map(({ onClick, icon: Icon, title, active }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl glass-panel shadow-lg transition-all hover:shadow-xl",
              active && "ring-2 ring-primary bg-primary/10",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-foreground")} />
          </button>
        ))}
      </div>

      {/* ── Weather & Air Floating Display ─────────────────────────────── */}
      <div className="absolute right-3 bottom-12 z-20 flex flex-col gap-2 scale-90 sm:scale-100 origin-bottom-right">
        {(weather || air) && (
          <div className="glass-panel p-3 rounded-2xl shadow-xl border border-white/10 flex flex-col gap-2 min-w-[140px]">
            {weather && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CloudSun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">{weather.temp}°C</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">{weather.summary}</span>
              </div>
            )}
            {air && (
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-2">
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold">AQI {Math.round(air.aqi)}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">{air.unit}</span>
              </div>
            )}
          </div>
        )}

        {/* API Key Warning */}
        {directionsError?.includes("API key") && (
          <div className="bg-destructive/15 border border-destructive/20 p-3 rounded-2xl flex gap-3 max-w-[240px]">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-destructive">API Key Required</span>
              <p className="text-[10px] text-destructive/80 leading-tight">ORS_API_KEY is missing in your .env.local. Directions and Geocoding will not function.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom status bar ───────────────────────────────────────────── */}
      {bottomBar && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex items-center gap-4 rounded-2xl glass-panel px-5 py-3 shadow-2xl text-sm whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-semibold">{formatDistanceKm(bottomBar.dist)}</span>
          </div>
          <Separator orientation="vertical" className="h-4 opacity-40" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{formatDuration(bottomBar.dur)}</span>
          </div>
          {bottomBar.co2g > 0 && (
            <>
              <Separator orientation="vertical" className="h-4 opacity-40" />
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Leaf className="h-3.5 w-3.5" />
                <span>{bottomBar.co2g < 1000 ? `${Math.round(bottomBar.co2g)}g` : `${(bottomBar.co2g / 1000).toFixed(1)}kg`} CO₂</span>
              </div>
            </>
          )}
          {bottomBar.costLabel && (
            <>
              <Separator orientation="vertical" className="h-4 opacity-40" />
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                {bottomBar.costLabel.includes("kcal") ? <Flame className="h-3.5 w-3.5" /> : <Fuel className="h-3.5 w-3.5" />}
                <span>{bottomBar.costLabel}</span>
              </div>
            </>
          )}
          <Separator orientation="vertical" className="h-4 opacity-40" />
          <button onClick={() => setBottomBar(null)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
