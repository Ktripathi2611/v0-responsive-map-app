"use client"

import { useEffect, useRef, useState } from "react"
import { ElevationChart } from "@/components/charts/elevation-chart"
import { formatDistanceKm, formatDuration, haversineKm } from "@/lib/geo"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

type LModule = typeof import("leaflet")

type Mode = "driving-car" | "cycling-regular" | "foot-walking"

type GeocodeResult = {
  name: string
  coord: [number, number] // [lon, lat]
}

type RouteAlt = {
  id: string
  geometry: any
  summary: { distance: number; duration: number }
  steps: Array<{ instruction: string; distance: number; duration: number }>
}

export function GooglePlusMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const LRef = useRef<LModule | null>(null)
  const mapRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const altLayersRef = useRef<any[]>([])
  const isoLayerRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const watchIdRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [center, setCenter] = useState<[number, number]>([40.7484, -73.9857]) // lat, lon (NYC fallback)
  const [mode, setMode] = useState<Mode>("driving-car")
  const [eco, setEco] = useState(false)
  const [avoid, setAvoid] = useState<{ highways: boolean; tolls: boolean; ferries: boolean }>({
    highways: false,
    tolls: false,
    ferries: false,
  })
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [waypoints, setWaypoints] = useState<[number, number][]>([]) // [lon,lat]
  const [routes, setRoutes] = useState<RouteAlt[]>([])
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [steps, setSteps] = useState<RouteAlt["steps"]>([])
  const [voice, setVoice] = useState(true)
  const [follow, setFollow] = useState(true)
  const [isoParams, setIsoParams] = useState({ minutes: 10 })
  const [elev, setElev] = useState<{ d: number; elev: number }[]>([])
  const [layerType, setLayerType] = useState<"default" | "satellite" | "topo" | "cyclosm">("default")

  // Dynamic Leaflet import + init map
  useEffect(() => {
    let cancelled = false
    async function boot() {
      const L = await import("leaflet")
      if (cancelled) return
      LRef.current = L
      // Set default marker icons to CDN to avoid asset resolution issues
      // @ts-ignore
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })
      if (!mapEl.current) return

      const map = L.map(mapEl.current, {
        center: [center[1], center[0]],
        zoom: 13,
        zoomControl: false,
      })
      mapRef.current = map

      const baseLayers: Record<string, any> = {
        "Default (OSM)": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map),
        Satellite: L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Tiles &copy; Esri" },
        ),
        Topographic: L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Tiles &copy; Esri" },
        ),
        "CyclOSM (Bike)": L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; CyclOSM & OpenStreetMap contributors",
        }),
      }

      // Layer control like Google "map/satellite"
      L.control.layers(baseLayers, {}, { position: "topright", collapsed: true }).addTo(map)

      // Custom zoom control (bottom-right)
      L.control.zoom({ position: "bottomright" }).addTo(map)

      // Initialize layers refs
      routeLayerRef.current = L.geoJSON().addTo(map)
      isoLayerRef.current = L.geoJSON().addTo(map)

      setReady(true)

      // Geolocate by default
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lon = pos.coords.longitude
            const lat = pos.coords.latitude
            setCenter([lon, lat])
            map.setView([lat, lon], 15)
            const m = L.marker([lat, lon]).addTo(map).bindPopup("You are here")
            markersRef.current.push(m)
          },
          () => {
            // ignore; center already at fallback
          },
        )
      }
    }
    boot()
    return () => {
      cancelled = true
      try {
        mapRef.current?.remove()
      } catch {}
    }
  }, [])

  // Update basemap when layerType changes (optional; control also available)
  useEffect(() => {
    // Users can switch using built-in control; this state can be used for badges or style cues.
  }, [layerType])

  // Auto-reroute: watch position and recompute if deviating significantly
  useEffect(() => {
    if (!follow || !routes.length || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const L = LRef.current
        if (!L) return
        const cur: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        // If off-route beyond ~200m, recompute using current as origin
        const active = routes.find((r) => r.id === activeRouteId) || routes[0]
        if (!active) return
        const line = (active.geometry?.coordinates ?? []) as [number, number][]
        const near = nearestDistanceToLineKm(cur, line)
        if (near > 0.2) {
          const rest = waypoints.slice(1)
          setWaypoints([cur, ...rest])
          void getDirections([cur, ...rest])
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )
    watchIdRef.current = id
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [follow, routes, activeRouteId, waypoints])

  // Helpers
  function nearestDistanceToLineKm(p: [number, number], line: [number, number][]) {
    // naive: min haversine to vertices; adequate for reroute threshold
    let min = Number.POSITIVE_INFINITY
    for (const ll of line) {
      const d = haversineKm(p, ll)
      if (d < min) min = d
    }
    return min
  }
  async function searchPlaces(q: string) {
    setQuery(q)
    if (!q || q.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const res = await fetch(`/api/ors/geocode?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const out: GeocodeResult[] =
        data?.features?.map((f: any) => ({
          name: f.properties.label,
          coord: f.geometry.coordinates,
        })) ?? []
      setSuggestions(out.slice(0, 8))
    } catch {
      setSuggestions([])
    }
  }

  function addWaypoint(coord: [number, number]) {
    setWaypoints((prev) => [...prev, coord])
    setSuggestions([])
    setQuery("")
  }

  async function reverseGeocodeAtCenter() {
    try {
      const res = await fetch(`/api/ors/reverse?lon=${center[0]}&lat=${center[1]}`)
      const data = await res.json()
      return data?.features?.[0]?.properties?.label as string | undefined
    } catch {
      return undefined
    }
  }

  async function getDirections(points = waypoints) {
    if (!points || points.length < 2) return
    try {
      const body = {
        coordinates: points, // [[lon,lat],...]
        profile: mode,
        preference: eco ? "shortest" : "recommended",
        alternative_routes: { target_count: 2, share_factor: 0.6, weight_factor: 1.1 },
        options: {
          avoid_features: [
            ...(avoid.highways ? ["highways"] : []),
            ...(avoid.tolls ? ["tollways"] : []),
            ...(avoid.ferries ? ["ferries"] : []),
          ],
        },
        instructions: true,
        geometry_simplify: true,
        geometry: true,
        elevation: false,
      }
      const res = await fetch("/api/ors/directions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        console.log("[v0] directions error status:", res.status)
        return
      }
      const data = await res.json()
      const L = LRef.current
      if (!L || !mapRef.current) return

      // Clear existing layers
      routeLayerRef.current.clearLayers()
      altLayersRef.current.forEach((l) => l.remove())
      altLayersRef.current = []
      setRoutes([])
      setSteps([])

      const coll: RouteAlt[] = []
      const feats = data.routes ?? data.features ?? []
      feats.forEach((r: any, idx: number) => {
        const geom = r.geometry || r.features?.[0]?.geometry
        const summary = r.summary ?? r.properties?.summary
        const steps =
          r.segments?.[0]?.steps?.map((s: any) => ({
            instruction: s.instruction,
            distance: s.distance,
            duration: s.duration,
          })) ??
          r.features?.[0]?.properties?.segments?.[0]?.steps?.map((s: any) => ({
            instruction: s.instruction,
            distance: s.distance,
            duration: s.duration,
          })) ??
          []
        coll.push({
          id: `r${idx}`,
          geometry: geom,
          summary: {
            distance: summary?.distance ?? 0,
            duration: summary?.duration ?? 0,
          },
          steps,
        })
      })

      // Draw primary and alternates
      coll.forEach((route, i) => {
        const color = i === 0 ? "#2563eb" : i === 1 ? "#059669" : "#d97706"
        const layer = L.geoJSON(route.geometry, { style: { color, weight: i === 0 ? 5 : 3 } })
        layer.addTo(mapRef.current)
        if (i === 0) {
          routeLayerRef.current = layer
          setSteps(route.steps)
          setActiveRouteId(route.id)
        } else {
          altLayersRef.current.push(layer)
        }
      })
      setRoutes(coll)

      // Fit map
      const allLayers = L.featureGroup([routeLayerRef.current, ...altLayersRef.current])
      mapRef.current.fitBounds(allLayers.getBounds(), { padding: [32, 32] })
      // Elevation profile (sampled)
      void buildElevationProfile(coll[0])
    } catch (e) {
      console.log("[v0] directions error:", (e as Error).message)
    }
  }

  async function buildElevationProfile(route: RouteAlt | undefined) {
    if (!route?.geometry?.coordinates?.length) {
      setElev([])
      return
    }
    // sample up to 100 points along the geometry
    const coords: [number, number][] = route.geometry.coordinates
    const step = Math.max(1, Math.floor(coords.length / 100))
    const sampled = coords.filter((_, i) => i % step === 0)
    try {
      const res = await fetch("/api/external/elevation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: sampled }),
      })
      const data = await res.json()
      const elevations: number[] = data?.elevations ?? []
      const pts: { d: number; elev: number }[] = []
      let dist = 0
      for (let i = 0; i < sampled.length; i++) {
        pts.push({ d: parseFloat(dist.toFixed(3)), elev: elevations[i] ?? 0 })
        if (i < sampled.length - 1) {
          // sampled coords are [lon, lat]; haversineKm expects [lat, lon]
          const a: [number, number] = [sampled[i][1], sampled[i][0]]
          const b: [number, number] = [sampled[i + 1][1], sampled[i + 1][0]]
          dist += haversineKm(a, b)
        }
      }
      setElev(pts)
    } catch {
      setElev([])
    }
  }

  function speakSteps(steps: RouteAlt["steps"]) {
    if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) return
    const utter = new SpeechSynthesisUtterance(steps.map((s) => s.instruction).join(". "))
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  async function drawIsochrones(origin: [number, number]) {
    try {
      const res = await fetch(
        `/api/ors/isochrones?lon=${origin[0]}&lat=${origin[1]}&minutes=${isoParams.minutes}&profile=${mode}`,
      )
      if (!res.ok) return
      const data = await res.json()
      const L = LRef.current
      if (!L || !mapRef.current) return
      isoLayerRef.current.clearLayers()
      L.geoJSON(data).addTo(mapRef.current)
    } catch {}
  }

  function clearMap() {
    routeLayerRef.current?.clearLayers()
    altLayersRef.current.forEach((l) => l.remove())
    altLayersRef.current = []
    isoLayerRef.current?.clearLayers()
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    setRoutes([])
    setSteps([])
    setElev([])
  }

  // UI
  return (
    <div className="relative h-full w-full">
      {/* Top search & controls */}
      <div className="pointer-events-auto absolute left-1/2 top-3 z-20 w-full -translate-x-1/2 px-3">
        <Card className="mx-auto max-w-3xl border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label="Search"
                placeholder="Search places"
                value={query}
                onChange={(e) => searchPlaces(e.target.value)}
                className="flex-1"
              />
              <Select value={mode} onValueChange={(v: Mode) => setMode(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driving-car">Driving</SelectItem>
                  <SelectItem value="cycling-regular">Cycling</SelectItem>
                  <SelectItem value="foot-walking">Walking</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => reverseWaypoints()} variant="outline" aria-label="Swap origin/destination">
                Swap
              </Button>
              <Button onClick={() => getDirections()} aria-label="Get directions">
                Go
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="rounded-md border bg-background">
                <ScrollArea className="max-h-56">
                  <ul className="divide-y">
                    {suggestions.map((s, idx) => (
                      <li key={idx}>
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onClick={() => addWaypoint(s.coord)}
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={eco} onCheckedChange={setEco} id="eco" />
                <label htmlFor="eco" className="text-sm">
                  Eco
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={avoid.highways}
                  onCheckedChange={(v) => setAvoid((a) => ({ ...a, highways: v }))}
                  id="avoid-highways"
                />
                <label htmlFor="avoid-highways" className="text-sm">
                  Avoid highways
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={avoid.tolls}
                  onCheckedChange={(v) => setAvoid((a) => ({ ...a, tolls: v }))}
                  id="avoid-tolls"
                />
                <label htmlFor="avoid-tolls" className="text-sm">
                  Avoid tolls
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={avoid.ferries}
                  onCheckedChange={(v) => setAvoid((a) => ({ ...a, ferries: v }))}
                  id="avoid-ferries"
                />
                <label htmlFor="avoid-ferries" className="text-sm">
                  Avoid ferries
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={voice} onCheckedChange={setVoice} id="voice" />
                <label htmlFor="voice" className="text-sm">
                  Voice
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={follow} onCheckedChange={setFollow} id="follow" />
                <label htmlFor="follow" className="text-sm">
                  Follow
                </label>
              </div>
              <Button variant="outline" onClick={() => drawIsochrones(center)} aria-label="Isochrones">
                Isochrones
              </Button>
              <Button variant="ghost" onClick={() => clearMap()} aria-label="Clear">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Left panel like Google Maps directions */}
      <div className="pointer-events-auto absolute left-3 top-24 z-20 w-[360px] max-w-[92vw]">
        <Card className="border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Route Planner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setWaypoints([center])}>
                Set origin to map center
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const label = await reverseGeocodeAtCenter()
                  addWaypoint(center)
                }}
              >
                Add stop
              </Button>
            </div>
            <div className="space-y-2">
              {waypoints.map((wp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge variant="outline">{idx === 0 ? "A" : idx === waypoints.length - 1 ? "B" : idx + 1}</Badge>
                  <div className="text-sm text-muted-foreground truncate">
                    {wp[0].toFixed(5)},{wp[1].toFixed(5)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => removeWaypoint(idx)}
                    aria-label="Remove"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              {routes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveRouteId(r.id)
                    setSteps(r.steps)
                    if (voice) speakSteps(r.steps)
                  }}
                  className={cn(
                    "w-full rounded-md p-2 text-left hover:bg-accent",
                    activeRouteId === r.id && "bg-accent",
                  )}
                >
                  <div className="flex justify-between text-sm">
                    <span>{formatDuration(r.summary.duration)}</span>
                    <span>{formatDistanceKm(r.summary.distance)}</span>
                  </div>
                </button>
              ))}
              {routes.length === 0 && (
                <div className="text-xs text-muted-foreground">Add at least A and B to compute directions.</div>
              )}
            </div>
            <Tabs defaultValue="steps">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="elev">Elevation</TabsTrigger>
                <TabsTrigger value="explore">Explore</TabsTrigger>
              </TabsList>
              <TabsContent value="steps" className="mt-2">
                <ScrollArea className="h-48">
                  <ol className="space-y-1 text-sm">
                    {steps.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="text-pretty">{s.instruction}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceKm(s.distance)} • {formatDuration(s.duration)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="elev" className="mt-2">
                <ElevationChart data={elev} />
                {!elev.length && (
                  <div className="text-xs text-muted-foreground">Elevation will appear after routing.</div>
                )}
              </TabsContent>
              <TabsContent value="explore" className="mt-2">
                <ExplorePanel center={center} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Map container */}
      <div ref={mapEl} className="h-full w-full" role="region" aria-label="Map" />

      {/* Right micro-controls like Google floating buttons */}
      <div className="pointer-events-auto absolute right-3 top-24 z-20 flex flex-col gap-2">
        <Button variant="secondary" onClick={() => recenter()} aria-label="My location">
          My location
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (waypoints.length >= 2) getDirections()
          }}
          aria-label="Recalculate"
        >
          Recalculate
        </Button>
      </div>
    </div>
  )

  function recenter() {
    if (!mapRef.current) return
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          setCenter([lon, lat])
          mapRef.current.setView([lat, lon], 15)
        },
        () => {},
      )
    }
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
  }

  function reverseWaypoints() {
    setWaypoints((prev) => {
      if (prev.length < 2) return prev
      const next = [...prev]
      const a = next[0]
      next[0] = next[next.length - 1]
      next[next.length - 1] = a
      return next
    })
  }
}

function ExplorePanel({ center }: { center: [number, number] }) {
  const [weather, setWeather] = useState<any>(null)
  const [air, setAir] = useState<any>(null)
  const [ev, setEv] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [w, a, e] = await Promise.all([
          fetch(`/api/external/weather?lon=${center[0]}&lat=${center[1]}`)
            .then((r) => r.json())
            .catch(() => null),
          fetch(`/api/external/air?lon=${center[0]}&lat=${center[1]}`)
            .then((r) => r.json())
            .catch(() => null),
          fetch(`/api/external/ev?lon=${center[0]}&lat=${center[1]}&distance=5`)
            .then((r) => r.json())
            .catch(() => []),
        ])
        setWeather(w)
        setAir(a)
        setEv(e)
      } catch {}
    }
    void load()
  }, [center])

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-sm font-medium">Weather</div>
        {weather ? (
          <div className="text-sm text-muted-foreground">
            {weather.summary} • {Math.round(weather.temp)}°C • Wind {Math.round(weather.wind)} m/s
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Weather unavailable.</div>
        )}
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">Air quality</div>
        {air?.aqi != null ? (
          <div className="text-sm text-muted-foreground">
            AQI: {air.aqi} ({air.parameter})
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Air quality unavailable.</div>
        )}
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">EV chargers (5km)</div>
        <ScrollArea className="h-24">
          <ul className="space-y-1 text-sm">
            {ev?.length ? (
              ev.map((p, i) => (
                <li key={i}>
                  {p.title} • {p.address || ""}
                </li>
              ))
            ) : (
              <li className="text-xs text-muted-foreground">No stations found.</li>
            )}
          </ul>
        </ScrollArea>
      </div>
    </div>
  )
}
