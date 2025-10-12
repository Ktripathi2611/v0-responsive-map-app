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
import { X, Route, Navigation, LocateFixed, Ruler, Trash2, Bike, Car, Footprints } from "lucide-react"
import type { LatLngExpression } from "leaflet"
import { formatDistanceKm, haversineDistanceKm } from "@/lib/geo"
import type * as GeoJSON from "geojson"

type LType = typeof import("leaflet")

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
          instruction: string
          distance: number
          duration: number
          way_points: [number, number]
        }>
      }>
    }
  }>
}

type IsochronesResponse = {
  features: Array<{
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  }>
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function GoogleLikeMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const LRef = useRef<LType | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const routeLayersRef = useRef<import("leaflet").LayerGroup | null>(null)
  const isochroneLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const measureLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const userCircleRef = useRef<import("leaflet").CircleMarker | null>(null)
  const measurePointsRef = useRef<[number, number][]>([])
  const measurePolylineRef = useRef<import("leaflet").Polyline | null>(null)
  const [leafletReady, setLeafletReady] = useState(false)

  // UI state
  const [searchText, setSearchText] = useState("")
  const [originText, setOriginText] = useState("")
  const [destinationText, setDestinationText] = useState("")
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [mode, setMode] = useState<"driving-car" | "cycling-regular" | "foot-walking">("driving-car")
  const [eco, setEco] = useState(false)
  const [avoidHighways, setAvoidHighways] = useState(false)
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [avoidFerries, setAvoidFerries] = useState(false)
  const [activeTab, setActiveTab] = useState<"directions" | "isochrones" | "explore">("directions")
  const [showPanel, setShowPanel] = useState(true)
  const [measureMode, setMeasureMode] = useState<"off" | "distance">("off")
  const [measuredKm, setMeasuredKm] = useState(0)
  const [centerBias, setCenterBias] = useState<{ lat: number; lon: number } | null>(null)

  const measureModeRef = useRef<"off" | "distance">("off")
  useEffect(() => {
    measureModeRef.current = measureMode
  }, [measureMode])

  // turn-by-turn steps
  const [steps, setSteps] = useState<
    { instruction: string; distance: number; duration: number; coord: [number, number] }[]
  >([])

  // Suggestions for search and waypoint inputs
  const { data: searchResults } = useSWR(
    searchText.length > 2
      ? `/api/ors/geocode?text=${encodeURIComponent(searchText)}${
          centerBias ? `&lat=${centerBias.lat}&lon=${centerBias.lon}` : ""
        }`
      : null,
    fetcher,
  )
  const { data: originResults } = useSWR(
    originText.length > 2
      ? `/api/ors/geocode?text=${encodeURIComponent(originText)}${
          centerBias ? `&lat=${centerBias.lat}&lon=${centerBias.lon}` : ""
        }`
      : null,
    fetcher,
  )
  const { data: destResults } = useSWR(
    destinationText.length > 2
      ? `/api/ors/geocode?text=${encodeURIComponent(destinationText)}${
          centerBias ? `&lat=${centerBias.lat}&lon=${centerBias.lon}` : ""
        }`
      : null,
    fetcher,
  )

  // Load Leaflet dynamically + CSS via CDN link
  useEffect(() => {
    let mounted = true
    const ensureCss = () => {
      if (document.querySelector('link[data-leaflet-css="1"]')) return
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      link.crossOrigin = ""
      link.setAttribute("data-leaflet-css", "1")
      document.head.appendChild(link)
    }
    ensureCss()

    import("leaflet")
      .then((L) => {
        if (!mounted) return
        LRef.current = L
        // Default marker icons from CDN (avoid bundling assets)
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })
        setLeafletReady(true)
      })
      .catch((e) => {
        console.error("[v0] Leaflet dynamic import failed:", e)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!leafletReady || !mapEl.current || mapRef.current) return
    const L = LRef.current!
    const map = L.map(mapEl.current, {
      center: [37.773972, -122.431297], // SF default
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    })
    mapRef.current = map

    // initialize bias from initial center
    const c0 = map.getCenter()
    setCenterBias({ lat: c0.lat, lon: c0.lng })
    map.on("moveend", () => {
      const c = map.getCenter()
      setCenterBias({ lat: c.lat, lon: c.lng })
    })

    // Base layers
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map)
    const esriSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye",
      },
    )
    const esriTopo = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      },
    )

    const baseLayers: Record<string, import("leaflet").TileLayer> = {
      Default: osm,
      Satellite: esriSat,
      Topographic: esriTopo,
    }

    // Layer groups
    routeLayersRef.current = L.layerGroup().addTo(map)
    isochroneLayerRef.current = L.layerGroup().addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    measureLayerRef.current = L.layerGroup().addTo(map)

    // Add native Leaflet layers control (Google-like Map Type switch)
    const overlays = {
      Routes: routeLayersRef.current!,
      Isochrones: isochroneLayerRef.current!,
      Markers: markerLayerRef.current!,
      Measure: measureLayerRef.current!,
    }
    L.control.layers(baseLayers, overlays, { position: "topright", collapsed: true }).addTo(map)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 15)
          if (userCircleRef.current) {
            userCircleRef.current.setLatLng([latitude, longitude])
          } else {
            userCircleRef.current = L.circleMarker([latitude, longitude], {
              radius: 8,
              color: "#2563eb",
              weight: 2,
              fillColor: "#60a5fa",
              fillOpacity: 0.6,
            })
              .addTo(markerLayerRef.current!)
              .bindPopup("You are here")
              .openPopup()
          }
          // set as default origin for directions
          setOrigin([latitude, longitude])
        },
        (err) => {
          console.warn("[v0] geolocation denied or failed; using default center", err)
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
      )
    }

    // Click for reverse geocode and measure mode
    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng
      if (measureModeRef.current === "distance") {
        const L = LRef.current!
        measurePointsRef.current.push([lat, lng])
        L.circleMarker([lat, lng], {
          radius: 4,
          color: "#16a34a",
          weight: 2,
          fillColor: "#16a34a",
          fillOpacity: 0.9,
        }).addTo(measureLayerRef.current!)

        if (measurePointsRef.current.length >= 2) {
          const pts = measurePointsRef.current
          const lastTwo = pts.slice(-2)
          const segKm = haversineDistanceKm(lastTwo[0], lastTwo[1])
          setMeasuredKm((prev) => prev + segKm)
          if (!measurePolylineRef.current) {
            measurePolylineRef.current = L.polyline(pts as LatLngExpression[], {
              color: "#16a34a",
              weight: 3,
            }).addTo(measureLayerRef.current!)
          } else {
            measurePolylineRef.current.setLatLngs(pts as LatLngExpression[])
          }
        }
        return
      }

      // Reverse geocode
      try {
        const res = await fetch(`/api/ors/reverse?lat=${lat}&lon=${lng}`)
        const data = await res.json()
        const label = data?.features?.[0]?.properties?.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        L.marker([lat, lng]).addTo(markerLayerRef.current!).bindPopup(label).openPopup()
      } catch (err) {
        console.error("[v0] reverse geocode error", err)
      }
    })

    // Cleanup
    return () => {
      map.off()
      map.remove()
      mapRef.current = null
    }
  }, [leafletReady, measureMode])

  const L = LRef.current

  // Helper: fit bounds with padding
  const fitToCoords = useCallback(
    (coords: [number, number][]) => {
      if (!L || !mapRef.current || coords.length === 0) return
      const bounds = L.latLngBounds(coords.map(([lat, lon]) => [lat, lon]))
      mapRef.current.fitBounds(bounds, { padding: [24, 24] })
    },
    [L],
  )

  // Directions fetch
  const getDirections = useCallback(async () => {
    if (!origin || !destination) return
    const coords = [origin, ...waypoints, destination]
    const body = {
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
      profile: mode,
      preference: eco ? "shortest" : "recommended",
      alternatives: true, // use boolean; server will expand to alternative_routes
      options: {
        avoid_features: [
          ...(avoidHighways ? ["highways"] : []),
          ...(avoidTolls ? ["tollways"] : []),
          ...(avoidFerries ? ["ferries"] : []),
        ],
      },
      instructions: true,
      geometry: true,
    }
    const res = await fetch("/api/ors/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error("[v0] directions failed", await res.text())
      return
    }
    const json: DirectionsResponse = await res.json()

    // Draw routes (alternates)
    routeLayersRef.current!.clearLayers()
    const allCoords: [number, number][] = []
    json.features.forEach((f, idx) => {
      const latlngs = f.geometry.coordinates.map(([lon, lat]) => [lat, lon]) as [number, number][]
      allCoords.push(...latlngs)
      L!
        .polyline(latlngs as LatLngExpression[], {
          color: idx === 0 ? "#2563eb" : "#94a3b8",
          weight: idx === 0 ? 5 : 4,
          opacity: 0.9,
        })
        .addTo(routeLayersRef.current!)
    })
    if (allCoords.length) fitToCoords(allCoords)

    // Steps from primary route
    const primary = json.features[0]
    const segSteps = primary?.properties?.segments?.[0]?.steps ?? []
    setSteps(
      segSteps.map((s) => ({
        instruction: s.instruction,
        distance: s.distance,
        duration: s.duration,
        coord: [s.way_points?.[0] ?? 0, s.way_points?.[1] ?? 0] as [number, number],
      })),
    )
  }, [origin, destination, waypoints, mode, eco, avoidHighways, avoidTolls, avoidFerries, L, fitToCoords])

  // Isochrones
  const [isoTime, setIsoTime] = useState(10) // minutes
  const runIsochrone = useCallback(async () => {
    if (!origin) return
    isochroneLayerRef.current!.clearLayers()
    const body = {
      locations: [[origin[1], origin[0]]], // [lon, lat]
      range: [isoTime * 60],
      range_type: "time",
      profile: mode,
      smoothing: 0.3,
      intervals: null,
    }
    const res = await fetch("/api/ors/isochrones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error("[v0] isochrones failed", await res.text())
      return
    }
    const json: IsochronesResponse = await res.json()
    json.features.forEach((f) => {
      L!
        .geoJSON(f.geometry as any, {
          style: { color: "#16a34a", weight: 2, fillColor: "#16a34a", fillOpacity: 0.15 },
        })
        .addTo(isochroneLayerRef.current!)
    })
  }, [origin, isoTime, mode, L])

  // Geocode pickers
  const pickSearch = useCallback(
    (f: GeocodeFeature) => {
      const [lon, lat] = f.geometry.coordinates
      mapRef.current?.setView([lat, lon], 15)
      L!.marker([lat, lon]).addTo(markerLayerRef.current!)
      setSearchText("")
    },
    [L],
  )

  const pickOrigin = useCallback(
    (f: GeocodeFeature) => {
      const [lon, lat] = f.geometry.coordinates
      setOrigin([lat, lon])
      setOriginText(f.properties?.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
      L!.marker([lat, lon]).addTo(markerLayerRef.current!)
    },
    [L],
  )

  const pickDestination = useCallback(
    (f: GeocodeFeature) => {
      const [lon, lat] = f.geometry.coordinates
      setDestination([lat, lon])
      setDestinationText(f.properties?.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
      L!.marker([lat, lon]).addTo(markerLayerRef.current!)
    },
    [L],
  )

  const addWaypoint = useCallback(
    (coord: [number, number]) => {
      setWaypoints((prev) => [...prev, coord])
      L!.marker(coord).addTo(markerLayerRef.current!)
    },
    [L],
  )

  // Matrix ETAs for waypoints
  const [etas, setEtas] = useState<number[] | null>(null)
  const computeMatrix = useCallback(async () => {
    if (!origin || !destination) return
    const coords = [origin, ...waypoints, destination].map(([lat, lon]) => [lon, lat])
    const body = {
      profile: mode,
      locations: coords,
      sources: [0], // origin index
      destinations: coords.map((_, idx) => idx),
      metrics: ["duration", "distance"],
    }
    const res = await fetch("/api/ors/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error("[v0] matrix failed", await res.text())
      return
    }
    const json = await res.json()
    setEtas(json?.durations?.[0] ?? null)
  }, [origin, destination, waypoints, mode])

  // Locate me
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        mapRef.current?.setView([latitude, longitude], 15)
        if (userCircleRef.current) {
          userCircleRef.current.setLatLng([latitude, longitude])
        } else {
          userCircleRef.current = L!
            .circleMarker([latitude, longitude], {
              radius: 8,
              color: "#2563eb",
              weight: 2,
              fillColor: "#60a5fa",
              fillOpacity: 0.6,
            })
            .addTo(markerLayerRef.current!)
            .bindPopup("You are here")
            .openPopup()
        }
      },
      (err) => console.error("[v0] geolocation error", err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    )
  }, [L])

  // Clear map drawings
  const clearMap = useCallback(() => {
    routeLayersRef.current?.clearLayers()
    isochroneLayerRef.current?.clearLayers()
    markerLayerRef.current?.clearLayers()
    measureLayerRef.current?.clearLayers()
    measurePointsRef.current = []
    if (measurePolylineRef.current) {
      measurePolylineRef.current.remove()
      measurePolylineRef.current = null
    }
    setSteps([])
    setMeasuredKm(0)
    // Re-add user circle if we had one and we cleared markers
    if (userCircleRef.current) {
      userCircleRef.current.addTo(markerLayerRef.current!)
    }
  }, [])

  const toggleMeasure = useCallback(() => {
    if (measureMode === "off") {
      setMeasuredKm(0)
      setMeasureMode("distance")
    } else {
      setMeasureMode("off")
    }
  }, [measureMode])

  // UI Components
  const ModeButton = ({
    value,
    icon: Icon,
    label,
    disabled,
  }: {
    value: typeof mode
    icon: any
    label: string
    disabled?: boolean
  }) => (
    <Button
      type="button"
      variant={mode === value ? "default" : "secondary"}
      className={cn("gap-2")}
      onClick={() => !disabled && setMode(value)}
      disabled={disabled}
      aria-pressed={mode === value}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )

  return (
    <div className="relative h-[calc(100dvh-64px)] w-full bg-background">
      {/* Top Google-like bar */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 p-3">
        {/* keep mode buttons on the left */}
        <div className="hidden md:flex items-center gap-2">
          <ModeButton value="driving-car" icon={Car} label="Drive" />
          <ModeButton value="cycling-regular" icon={Bike} label="Bike" />
          <ModeButton value="foot-walking" icon={Footprints} label="Walk" />
        </div>
        {/* keep utility controls on the right */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={locateMe} aria-label="Locate me">
            <LocateFixed className="h-4 w-4" />
          </Button>
          <Button
            variant={measureMode === "distance" ? "default" : "secondary"}
            onClick={toggleMeasure}
            aria-label="Measure distance"
          >
            <Ruler className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={clearMap} aria-label="Clear map">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search suggestions dropdown */}
      {searchText.length > 2 && searchResults?.features?.length > 0 && (
        <div className="absolute left-3 right-3 top-[56px] z-30 max-h-72 overflow-auto rounded-md border bg-popover p-2 shadow">
          {searchResults.features.slice(0, 8).map((f: GeocodeFeature, i: number) => (
            <button key={i} className="w-full rounded p-2 text-left hover:bg-accent" onClick={() => pickSearch(f)}>
              {f.properties?.label || f.geometry.coordinates.join(", ")}
            </button>
          ))}
        </div>
      )}

      {/* Side panel */}
      <aside
        className={cn(
          "pointer-events-auto absolute left-3 top-[72px] z-20 w-[360px] max-w-[90vw] rounded-lg border bg-card shadow",
          showPanel ? "block" : "hidden",
        )}
      >
        <div className="flex items-center justify-between p-3">
          <div className="font-medium">Explore & Navigate</div>
          <Button size="icon" variant="ghost" onClick={() => setShowPanel(false)} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <div className="p-3">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="directions" className="text-xs">
                Directions
              </TabsTrigger>
              <TabsTrigger value="isochrones" className="text-xs">
                Isochrones
              </TabsTrigger>
              <TabsTrigger value="explore" className="text-xs">
                Explore
              </TabsTrigger>
            </TabsList>

            <TabsContent value="directions" className="mt-3 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Origin</label>
                <Input placeholder="Enter origin" value={originText} onChange={(e) => setOriginText(e.target.value)} />
                {originText.length > 2 && originResults?.features?.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded border bg-popover">
                    {originResults.features.slice(0, 6).map((f: GeocodeFeature, i: number) => (
                      <button
                        key={i}
                        className="block w-full p-2 text-left hover:bg-accent"
                        onClick={() => pickOrigin(f)}
                      >
                        {f.properties?.label || f.geometry.coordinates.join(", ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination</label>
                <Input
                  placeholder="Enter destination"
                  value={destinationText}
                  onChange={(e) => setDestinationText(e.target.value)}
                />
                {destinationText.length > 2 && destResults?.features?.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded border bg-popover">
                    {destResults.features.slice(0, 6).map((f: GeocodeFeature, i: number) => (
                      <button
                        key={i}
                        className="block w-full p-2 text-left hover:bg-accent"
                        onClick={() => pickDestination(f)}
                      >
                        {f.properties?.label || f.geometry.coordinates.join(", ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => origin && addWaypoint(origin)}
                  title="Add current origin as waypoint"
                >
                  + Stop
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => destination && addWaypoint(destination)}
                  title="Add current destination as waypoint"
                >
                  + Stop
                </Button>
                <Button variant="secondary" onClick={() => setWaypoints([])} title="Clear stops">
                  Clear stops
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="eco" checked={eco} onCheckedChange={(v) => setEco(Boolean(v))} />
                  <label htmlFor="eco" className="text-sm">
                    Eco-friendly
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ah" checked={avoidHighways} onCheckedChange={(v) => setAvoidHighways(Boolean(v))} />
                  <label htmlFor="ah" className="text-sm">
                    Avoid highways
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="at" checked={avoidTolls} onCheckedChange={(v) => setAvoidTolls(Boolean(v))} />
                  <label htmlFor="at" className="text-sm">
                    Avoid tolls
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="af" checked={avoidFerries} onCheckedChange={(v) => setAvoidFerries(Boolean(v))} />
                  <label htmlFor="af" className="text-sm">
                    Avoid ferries
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button className="w-full" onClick={getDirections}>
                  <Route className="mr-2 h-4 w-4" /> Get directions (alternates)
                </Button>
              </div>

              {steps.length > 0 && (
                <div className="rounded border">
                  <div className="flex items-center justify-between border-b p-2 text-sm font-medium">
                    <span>Turn-by-turn steps</span>
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <ol className="max-h-64 list-decimal space-y-1 overflow-auto p-3 pl-6 text-sm">
                    {steps.map((s, i) => (
                      <li key={i} className="text-pretty">
                        <div className="font-medium">{s.instruction}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceKm(s.distance)} • {Math.round(s.duration / 60)} min
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Multi-point planning (ETAs)</div>
                  <Button variant="secondary" size="sm" onClick={computeMatrix}>
                    Compute ETAs
                  </Button>
                </div>
                {etas && (
                  <div className="rounded border p-2 text-xs text-muted-foreground">
                    {etas.map((sec, idx) => (
                      <div key={idx}>
                        Stop #{idx}: {Math.round(sec / 60)} min
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="isochrones" className="mt-3 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Travel time (minutes)</div>
                  <div className="text-sm text-muted-foreground">{isoTime}m</div>
                </div>
                <Slider value={[isoTime]} onValueChange={([v]) => setIsoTime(v)} min={2} max={60} />
              </div>
              <Button onClick={runIsochrone}>Compute Isochrones</Button>
              <p className="text-xs text-muted-foreground">
                Click on the map to set your origin (or set in Directions) before computing isochrones.
              </p>
            </TabsContent>

            <TabsContent value="explore" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                • Click map to drop a pin with reverse geocode. • Use Measure tool to add segments and compute total
                distance. • Use Map Type to switch layers.
              </p>
              <div className="rounded border p-2 text-sm">
                Total measured: <span className="font-medium">{measuredKm.toFixed(2)} km</span>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </aside>

      {/* Toggle panel button (mobile) */}
      {!showPanel && (
        <div className="pointer-events-auto absolute left-3 top-[72px] z-20">
          <Button variant="secondary" onClick={() => setShowPanel(true)}>
            Open panel
          </Button>
        </div>
      )}

      {/* Map container */}
      <div ref={mapEl} className="absolute inset-0 z-10" aria-label="Map area" role="region" />

      {/* Add native Leaflet zoom control positioning space */}
      <div className="pointer-events-none absolute left-3 top-[120px] z-30 h-8 w-8" />
    </div>
  )
}
