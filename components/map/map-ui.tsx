"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { polylineDistanceKm } from "@/lib/geo"

type LType = typeof import("leaflet")
type TravelMode = "driving-car" | "cycling-regular" | "foot-walking"

type GeocodeFeature = {
  geometry: { coordinates: [number, number] } // [lon, lat]
  properties?: { label?: string }
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText))
  return r.json()
}

export default function MapUI() {
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const LRef = useRef<LType | null>(null)
  const routeLayersRef = useRef<import("leaflet").LayerGroup | null>(null)
  const isoLayersRef = useRef<import("leaflet").LayerGroup | null>(null)
  const measureLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const measurePtsRef = useRef<Array<[number, number]>>([])
  const measureModeRef = useRef(false)

  const [search, setSearch] = useState("")
  const [geocodeQuery, setGeocodeQuery] = useState("")
  const [travelMode, setTravelMode] = useState<TravelMode>("driving-car")
  const [eco, setEco] = useState(false)
  const [avoidHighways, setAvoidHighways] = useState(false)
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [avoidFerries, setAvoidFerries] = useState(false)
  const [alternates, setAlternates] = useState(2)
  const [waypoints, setWaypoints] = useState<Array<{ name: string; coord: [number, number] }>>([])
  const [steps, setSteps] = useState<Array<{ instruction: string; distance: number; duration: number }>>([])
  const [activeTab, setActiveTab] = useState("directions")
  const [isoRange, setIsoRange] = useState(10) // minutes
  const [isoBuckets, setIsoBuckets] = useState(3)
  const [measureMode, setMeasureMode] = useState(false)

  // Keep ref in sync to avoid stale closure in click handler
  useEffect(() => {
    measureModeRef.current = measureMode
  }, [measureMode])

  const { data: geoData } = useSWR(
    geocodeQuery.length > 2 ? `/api/ors/geocode?text=${encodeURIComponent(geocodeQuery)}` : null,
    fetcher,
  )

  // Map init once
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (typeof window === "undefined") return
      const L = await import("leaflet")
      LRef.current = L

      // Default marker icons via CDN to avoid asset resolution issues
      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png"
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
      L.Icon.Default.mergeOptions({
        iconUrl,
        iconRetinaUrl,
        shadowUrl,
        crossOrigin: "anonymous" as any,
      })

      const map = L.map("map", {
        center: [37.7749, -122.4194],
        zoom: 12,
        zoomControl: false,
      })
      mapRef.current = map

      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map)

      const cyclOSM = L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/tiles/cyclosm/{z}/{x}/{y}.png", {
        attribution: "&copy; CyclOSM & OpenStreetMap contributors",
      })

      const imagery = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri" },
      )

      const baseLayers = { "OSM Streets": osm, CyclOSM: cyclOSM, "Esri Imagery": imagery }
      L.control.layers(baseLayers, {}).addTo(map)

      routeLayersRef.current = L.layerGroup().addTo(map)
      isoLayersRef.current = L.layerGroup().addTo(map)
      measureLayerRef.current = L.layerGroup().addTo(map)

      // Measure click handler referencing ref
      const onClick = (e: any) => {
        if (!measureModeRef.current || !LRef.current || !measureLayerRef.current) return
        const L = LRef.current
        const { lat, lng } = e.latlng
        measurePtsRef.current.push([lat, lng])
        L.circleMarker([lat, lng], { radius: 4 }).addTo(measureLayerRef.current)
        if (measurePtsRef.current.length >= 2) {
          const pts = measurePtsRef.current
          const pl = L.polyline(pts, { color: "#0ea5e9" })
          measureLayerRef.current.addLayer(pl)
          const dist = polylineDistanceKm(pts)
          const last = pts[pts.length - 1]
          L.popup()
            .setLatLng(last)
            .setContent(`${dist.toFixed(2)} km`)
            .openOn(map)
        }
      }
      map.on("click", onClick)

      if (!mounted) return
    })()

    return () => {
      mounted = false
      // Cleanup map on unmount
      try {
        const map = mapRef.current
        if (map) {
          map.off()
          map.remove()
        }
      } catch {}
      mapRef.current = null
    }
  }, [])

  // Helpers
  const L = LRef.current
  const map = mapRef.current

  const addWaypoint = (name: string, coord: [number, number]) => {
    setWaypoints((prev) => [...prev, { name, coord }])
    if (L && map) {
      L.marker(coord).addTo(map)
      map.setView(coord, Math.max(map.getZoom(), 13))
    }
  }

  const geocodeSelect = (f: GeocodeFeature) => {
    const [lon, lat] = f.geometry.coordinates
    addWaypoint(f.properties?.label || "Pinned", [lat, lon])
    setSearch(f.properties?.label || "")
    setGeocodeQuery("")
  }

  const routeColors = ["#2563eb", "#22c55e", "#fb923c", "#a855f7"]

  const buildDirectionsBody = (coords: Array<[number, number]>) => {
    // ORS expects [lon, lat]
    const coordinates = coords.map(([lat, lon]) => [lon, lat])
    const avoid_features: string[] = []
    if (avoidHighways) avoid_features.push("motorway")
    if (avoidTolls) avoid_features.push("tollways")
    if (avoidFerries) avoid_features.push("ferries")
    const body: any = {
      coordinates,
      instructions: true,
      preference: eco ? "shortest" : "fastest",
      options: avoid_features.length ? { avoid_features } : undefined,
      geometry: true,
      extra_info: ["waycategory", "steepness"],
    }
    if (alternates > 0) {
      body.alternative_routes = {
        target_count: Math.min(alternates, 3),
        share_factor: 0.6,
        weight_factor: 1.4,
      }
    }
    return body
  }

  const drawRoutes = (geojson: any) => {
    if (!L || !map || !routeLayersRef.current) return
    routeLayersRef.current.clearLayers()
    setSteps([])
    const coll = geojson?.features?.length ? geojson : { features: [geojson] }
    coll.features.forEach((feat: any, idx: number) => {
      const color = routeColors[idx % routeColors.length]
      const g = L.geoJSON(feat, {
        style: { color, weight: idx === 0 ? 6 : 4, opacity: idx === 0 ? 0.9 : 0.7 },
      })
      routeLayersRef.current!.addLayer(g)
    })
    // steps
    const main = coll.features[0]
    const seg = main?.properties?.segments?.[0]
    if (seg?.steps?.length) {
      setSteps(
        seg.steps.map((s: any) => ({
          instruction: s.instruction,
          distance: s.distance,
          duration: s.duration,
        })),
      )
    }
    const b = routeLayersRef.current.getBounds()
    if (b && (b as any).isValid()) map.fitBounds(b, { padding: [24, 24] })
  }

  const onRoute = async () => {
    if (waypoints.length < 2) return
    const body = buildDirectionsBody(waypoints.map((w) => w.coord))
    const res = await fetch(`/api/ors/directions?profile=${travelMode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText)
      console.error("[v0] directions error:", txt)
      return
    }
    const data = await res.json()
    drawRoutes(data)
    setActiveTab("steps")
  }

  const onIsochrones = async () => {
    if (!waypoints.length || !L || !map) return
    isoLayersRef.current?.clearLayers()
    const center = waypoints[waypoints.length - 1].coord
    const body = {
      locations: [[center[1], center[0]]], // [lon, lat]
      range: [isoRange * 60], // seconds
      range_type: "time",
      units: "km",
      smoothing: 0.2,
      intervals: isoBuckets,
      area_units: "km",
      location_type: "start",
    }
    const res = await fetch(`/api/ors/isochrones?profile=${travelMode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText)
      console.error("[v0] isochrones error:", txt)
      return
    }
    const data = await res.json()
    const colors = ["#22c55e33", "#84cc1633", "#f59e0b33", "#ef444433"]
    L.geoJSON(data, {
      style: (f: any) => {
        const i = f?.properties?.value_index ?? 0
        return { color: "#10b981", weight: 1, fillColor: colors[i % colors.length], fillOpacity: 0.5 }
      },
    }).addTo(isoLayersRef.current!)
    const b = isoLayersRef.current!.getBounds()
    if (b && (b as any).isValid()) map.fitBounds(b, { padding: [24, 24] })
    setActiveTab("isochrones")
  }

  const onMatrix = async () => {
    if (waypoints.length < 2) return
    const locs = waypoints.map((w) => [w.coord[1], w.coord[0]]) // [lon, lat]
    const body = { locations: locs, metrics: ["duration", "distance"] }
    const res = await fetch(`/api/ors/matrix?profile=${travelMode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText)
      console.error("[v0] matrix error:", txt)
      return
    }
    const data = await res.json()
    setActiveTab("directions")
  }

  const onLocate = () => {
    if (!navigator.geolocation || !L || !map) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude]
        L.marker(pos).addTo(map)
        map.setView(pos, 15)
      },
      (err) => console.warn("[v0] geolocate error:", err?.message),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const onClear = () => {
    routeLayersRef.current?.clearLayers()
    isoLayersRef.current?.clearLayers()
    measureLayerRef.current?.clearLayers()
    measurePtsRef.current = []
    setSteps([])
    setWaypoints([])
  }

  const totalKm = useMemo(() => {
    if (waypoints.length < 2) return 0
    return polylineDistanceKm(waypoints.map((w) => w.coord))
  }, [waypoints])

  return (
    <div className="relative h-full w-full">
      <div id="map" className="h-full w-full bg-muted" />

      {/* Top toolbar */}
      <Card className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 w-[min(960px,95vw)] p-3 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setGeocodeQuery(e.target.value)
              }}
              placeholder="Search places..."
              aria-label="Search places"
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (!geoData?.features?.length) return
                geocodeSelect(geoData.features[0] as GeocodeFeature)
              }}
            >
              Add
            </Button>
          </div>
          <Select value={travelMode} onValueChange={(v: TravelMode) => setTravelMode(v)}>
            <SelectTrigger className="w-[170px]" aria-label="Travel mode">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="driving-car">Driving</SelectItem>
              <SelectItem value="cycling-regular">Cycling</SelectItem>
              <SelectItem value="foot-walking">Walking</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="eco">Eco</Label>
              <Switch id="eco" checked={eco} onCheckedChange={setEco} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Alternates</Label>
              <Select value={String(alternates)} onValueChange={(v) => setAlternates(Number(v))}>
                <SelectTrigger className="w-[90px]" aria-label="Alternate routes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Checkbox id="avoid-hwy" checked={avoidHighways} onCheckedChange={(v) => setAvoidHighways(Boolean(v))} />
              <Label htmlFor="avoid-hwy">Avoid highways</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="avoid-tolls" checked={avoidTolls} onCheckedChange={(v) => setAvoidTolls(Boolean(v))} />
              <Label htmlFor="avoid-tolls">Avoid tolls</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="avoid-ferries"
                checked={avoidFerries}
                onCheckedChange={(v) => setAvoidFerries(Boolean(v))}
              />
              <Label htmlFor="avoid-ferries">Avoid ferries</Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onRoute}>Route</Button>
            <Button variant="secondary" onClick={onIsochrones}>
              Isochrones
            </Button>
            <Button variant="outline" onClick={onMatrix}>
              Matrix
            </Button>
            <Button variant="destructive" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>

        {/* Geocode suggestions */}
        {geocodeQuery.length > 2 && geoData?.features?.length ? (
          <div className="mt-2 grid gap-1 max-h-48 overflow-auto">
            {geoData.features.slice(0, 6).map((f: any, i: number) => (
              <button key={i} className="text-left px-2 py-1 rounded hover:bg-accent" onClick={() => geocodeSelect(f)}>
                {f.properties?.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Waypoints */}
        {waypoints.length ? (
          <div className="mt-3 text-sm text-muted-foreground">
            {waypoints.map((w, i) => (
              <span key={i} className="mr-3">{`${i + 1}. ${w.name}`}</span>
            ))}
            {totalKm > 0 ? (
              <span className="font-medium text-foreground"> • {totalKm.toFixed(2)} km (as drawn)</span>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Floating controls */}
      <div className="absolute left-3 top-28 z-[500] grid gap-2">
        <Button size="sm" variant="secondary" onClick={onLocate} title="Locate me" aria-label="Locate me">
          Locate
        </Button>
        <Button
          size="sm"
          variant={measureMode ? "default" : "outline"}
          onClick={() => setMeasureMode((s) => !s)}
          title="Measure distance"
          aria-label="Measure distance"
        >
          Measure
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!map) return
            map.zoomIn()
          }}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!map) return
            map.zoomOut()
          }}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </Button>
      </div>

      {/* Right panel */}
      <Card className="absolute right-3 top-3 z-[500] w-[min(360px,90vw)] p-3 shadow-lg">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="directions">Directions</TabsTrigger>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="isochrones">Isochrones</TabsTrigger>
          </TabsList>

          <TabsContent value="directions" className="mt-3">
            <p className="text-sm text-muted-foreground">
              Add waypoints with the Search box (Add), then click Route. Add more places for multi-point routes. Use
              Avoid options and Alternates for route preferences. Eco uses shortest preference.
            </p>
          </TabsContent>

          <TabsContent value="steps" className="mt-3">
            {steps.length ? (
              <ol className="text-sm max-h-[40vh] overflow-auto pr-2 list-decimal list-inside space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="leading-relaxed">
                    <div className="text-foreground">{s.instruction}</div>
                    <div className="text-muted-foreground">
                      {(s.distance / 1000).toFixed(2)} km • {(s.duration / 60).toFixed(0)} min
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted-foreground">No steps yet. Build a route first.</div>
            )}
          </TabsContent>

          <TabsContent value="isochrones" className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="iso-range">Range (min)</Label>
                <Input
                  id="iso-range"
                  type="number"
                  min={1}
                  max={60}
                  value={isoRange}
                  onChange={(e) => setIsoRange(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="iso-buckets">Bands</Label>
                <Input
                  id="iso-buckets"
                  type="number"
                  min={1}
                  max={6}
                  value={isoBuckets}
                  onChange={(e) => setIsoBuckets(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={onIsochrones}>Compute</Button>
              <Button variant="secondary" onClick={() => isoLayersRef.current?.clearLayers()}>
                Clear
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Isochrones use the last waypoint as center. Add a waypoint via Search, then Compute.
            </p>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
