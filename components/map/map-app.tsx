"use client"

import type { LatLngExpression, TileLayer, LeafletMouseEvent, LatLng, GeoJSON as GeoJSONType } from "leaflet"
import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MapPin, Target, Maximize2, Minimize2, Ruler, Share2, Trash2, Star, ParkingCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type RouteReq = {
  profile: "driving-car" | "foot-walking" | "cycling-regular" | "driving-hgv" | "wheelchair"
  coordinates: [number, number][]
  avoid?: { ferries?: boolean; tollways?: boolean; highways?: boolean }
  alternatives?: boolean
  preference?: "recommended" | "shortest" | "fastest"
}

type GeocodeRes = { features: Array<{ properties: { label: string }; geometry: { coordinates: [number, number] } }> }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function useQueryGeocode(query: string) {
  return useSWR(query ? `/api/ors/geocode?q=${encodeURIComponent(query)}` : null, fetcher)
}

const defaultCenter: LatLngExpression = [40.7128, -74.006] // NYC

export default function MapApp() {
  const mapRef = useRef<null | any>(null)
  const routeLayerRef = useRef<null | any>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [profile, setProfile] = useState<RouteReq["profile"]>("driving-car")
  const [preference, setPreference] = useState<RouteReq["preference"]>("recommended")
  const [avoid, setAvoid] = useState({ ferries: false, tollways: false, highways: false })
  const [alternatives, setAlternatives] = useState(true)
  const [eco, setEco] = useState(false)
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [search, setSearch] = useState("")
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([])
  const [saved, setSaved] = useState<{ name: string; coord: [number, number] }[]>([])
  const [parking, setParking] = useState<[number, number] | null>(null)

  const LeafletModRef = useRef<null | typeof import("leaflet")>(null)
  const [leafletReady, setLeafletReady] = useState(false)

  const { data: searchData } = useQueryGeocode(search)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (LeafletModRef.current) {
        setLeafletReady(true)
        return
      }
      const mod = await import("leaflet")
      if (cancelled) return
      mod.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })
      LeafletModRef.current = mod
      setLeafletReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!leafletReady || mapRef.current) return
    const L = LeafletModRef.current!
    const map = L.map("map", {
      center: defaultCenter as LatLngExpression,
      zoom: 12,
      zoomControl: false,
    })
    mapRef.current = map

    const baseLayers: Record<string, TileLayer> = {
      terrain: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }),
      dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors, © Carto",
      }),
      satellite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" },
      ),
      bike: L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors, CyclOSM",
      }),
    }
    baseLayers.terrain.addTo(map)

    L.control.zoom({ position: "bottomright" }).addTo(map)
    L.control.layers(baseLayers, undefined, { position: "topright", collapsed: true }).addTo(map)

    try {
      const params = new URLSearchParams(window.location.search)
      const lat = Number(params.get("lat"))
      const lng = Number(params.get("lng"))
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        map.setView([lat, lng], 14)
        L.marker([lat, lng]).addTo(map)
      }
    } catch {
      /* noop */
    }

    try {
      const sv = localStorage.getItem("navkit_saved")
      if (sv) setSaved(JSON.parse(sv))
      const pk = localStorage.getItem("navkit_parking")
      if (pk) setParking(JSON.parse(pk))
    } catch {}

    return () => {
      map.off()
      map.remove()
      mapRef.current = null
    }
  }, [leafletReady])

  useEffect(() => {
    const map = mapRef.current
    const L = LeafletModRef.current
    if (!map || !L) return
    const handler = (e: LeafletMouseEvent) => {
      if (measureMode) {
        setMeasurePoints((pts) => [...pts, e.latlng])
      } else {
        setWaypoints((pts) => [...pts, [e.latlng.lng, e.latlng.lat]])
      }
    }
    map.on("click", handler)
    return () => {
      map.off("click", handler)
    }
  }, [measureMode])

  useEffect(() => {
    const map = mapRef.current
    const L = LeafletModRef.current
    if (!map || !L || waypoints.length < 2) return
    const req: RouteReq = {
      profile,
      coordinates: waypoints,
      alternatives,
      preference: eco ? "shortest" : preference,
      avoid,
    }
    fetch("/api/ors/directions", { method: "POST", body: JSON.stringify(req) })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((geo) => {
        if (routeLayerRef.current) routeLayerRef.current.remove()
        const layer = L.geoJSON(geo as any, {
          style: (_f, i) => ({
            color: i === 0 ? "var(--color-primary)" : "var(--color-muted-foreground)",
            weight: i === 0 ? 5 : 3,
          }),
        })
        routeLayerRef.current = layer as unknown as GeoJSONType
        layer.addTo(map)
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40] })
        } catch {}
      })
      .catch(() => {
        // optional: toast error
      })
  }, [waypoints, profile, alternatives, preference, avoid, eco])

  const distance = useMemo(() => {
    if (measurePoints.length < 2) return 0
    let d = 0
    for (let i = 1; i < measurePoints.length; i++) {
      d += measurePoints[i - 1].distanceTo(measurePoints[i])
    }
    return d // meters
  }, [measurePoints])

  const centerOnUser = () => {
    const map = mapRef.current
    const L = LeafletModRef.current
    if (!map || !L) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude] as [number, number]
        map.setView(p, 15)
        L.marker(p).addTo(map)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const shareLocation = async () => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    const url = new URL(window.location.href)
    url.pathname = "/map"
    url.searchParams.set("lat", String(c.lat))
    url.searchParams.set("lng", String(c.lng))
    const shareUrl = url.toString()
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert("Map link copied to clipboard!")
    } catch {
      alert(shareUrl)
    }
  }

  const toggleFullscreen = () => setFullscreen((f) => !f)

  const addWaypointFromSearch = (f: any) => {
    const [lng, lat] = f.geometry.coordinates
    setWaypoints((pts) => [...pts, [lng, lat]])
    setSearch("")
    const map = mapRef.current
    const L = LeafletModRef.current
    if (map && L) {
      map.setView([lat, lng], 15)
      L.marker([lat, lng]).addTo(map)
    }
  }

  const clearRoute = () => {
    setWaypoints([])
    if (routeLayerRef.current) {
      routeLayerRef.current.remove()
      routeLayerRef.current = null
    }
  }

  const saveCurrentAs = (name: string) => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    const item = { name, coord: [c.lng, c.lat] as [number, number] }
    const next = [...saved, item]
    setSaved(next)
    localStorage.setItem("navkit_saved", JSON.stringify(next))
  }

  const rememberParking = () => {
    const map = mapRef.current
    const L = LeafletModRef.current
    if (!map || !L) return
    const c: [number, number] = [map.getCenter().lng, map.getCenter().lat]
    setParking(c)
    localStorage.setItem("navkit_parking", JSON.stringify(c))
    L.marker([c[1], c[0]], { title: "Parking" }).addTo(map)
  }

  const gotoParking = () => {
    const map = mapRef.current
    const L = LeafletModRef.current
    if (!parking || !map || !L) return
    map.setView([parking[1], parking[0]], 16)
    L.marker([parking[1], parking[0]], { title: "Parking" }).addTo(map)
  }

  return (
    <div className={cn("relative h-full", fullscreen && "fixed inset-0 z-50")}>
      <div id="map" className="h-full w-full" />

      {/* Sidebar */}
      <div className="absolute top-2 left-2 z-50 w-[min(92vw,360px)]">
        <Card className="p-3 space-y-3 bg-background/90 backdrop-blur border">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Itinerary Builder</div>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Search place..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="secondary" onClick={() => setSearch("")}>
              Clear
            </Button>
          </div>
          {searchData?.features?.length ? (
            <div className="max-h-40 overflow-auto rounded border">
              {searchData.features.slice(0, 6).map((f: any) => (
                <button
                  key={f.properties.label}
                  className="block w-full text-left text-sm px-3 py-2 hover:bg-accent"
                  onClick={() => addWaypointFromSearch(f)}
                >
                  {f.properties.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Select value={profile} onValueChange={(v: any) => setProfile(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driving-car">Driving</SelectItem>
                <SelectItem value="foot-walking">Walking</SelectItem>
                <SelectItem value="cycling-regular">Cycling</SelectItem>
                <SelectItem value="driving-hgv">Transit (HGV)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={preference} onValueChange={(v: any) => setPreference(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="fastest">Fastest</SelectItem>
                <SelectItem value="shortest">Shortest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={avoid.tollways} onCheckedChange={(v) => setAvoid((a) => ({ ...a, tollways: !!v }))} />
              <span>Avoid tolls</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={avoid.ferries} onCheckedChange={(v) => setAvoid((a) => ({ ...a, ferries: !!v }))} />
              <span>Avoid ferries</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={avoid.highways} onCheckedChange={(v) => setAvoid((a) => ({ ...a, highways: !!v }))} />
              <span>Avoid highways</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={alternatives} onCheckedChange={(v) => setAlternatives(!!v)} />
              <span>Alternate routes</span>
            </label>
          </div>

          <Separator />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={eco} onCheckedChange={(v) => setEco(!!v)} />
            <span>Eco-friendly (prefer shortest)</span>
          </label>

          <Separator />
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Waypoints ({waypoints.length})</div>
            <div className="flex flex-wrap gap-2">
              {waypoints.map((w, i) => (
                <span key={i} className="text-xs bg-secondary px-2 py-1 rounded">
                  {w[1].toFixed(4)},{w[0].toFixed(4)}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={clearRoute}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button size="sm" onClick={() => saveCurrentAs(`Place ${saved.length + 1}`)}>
                <Star className="h-4 w-4 mr-1" />
                Save center
              </Button>
              <Button size="sm" variant="outline" onClick={rememberParking}>
                <ParkingCircle className="h-4 w-4 mr-1" />
                Remember Parking
              </Button>
              <Button size="sm" variant="outline" onClick={gotoParking} disabled={!parking}>
                Go Parking
              </Button>
            </div>

            {saved.length > 0 && (
              <div className="max-h-28 overflow-auto rounded border">
                {saved.map((s, i) => (
                  <button
                    key={i}
                    className="block w-full text-left text-sm px-3 py-2 hover:bg-accent"
                    onClick={() => {
                      const map = mapRef.current
                      if (!map) return
                      map.setView([s.coord[1], s.coord[0]], 15)
                      LeafletModRef.current?.marker([s.coord[1], s.coord[0]]).addTo(map)
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-2 z-[60] flex gap-2">
        <Button size="sm" onClick={centerOnUser} disabled={locating}>
          <Target className="h-4 w-4 mr-1" />
          {locating ? "Locating..." : "My location"}
        </Button>
        <Button size="sm" variant="outline" onClick={shareLocation}>
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMeasureMode((m) => !m)}>
          <Ruler className="h-4 w-4 mr-1" />
          {measureMode ? "Finish" : "Measure"}
        </Button>
        <Button size="sm" variant="secondary" onClick={toggleFullscreen}>
          {fullscreen ? (
            <>
              <Minimize2 className="h-4 w-4 mr-1" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4 mr-1" />
              Fullscreen
            </>
          )}
        </Button>
      </div>

      {/* Measurement HUD */}
      {measureMode && (
        <div className="absolute bottom-3 right-2 z-[60] rounded border bg-background/90 backdrop-blur px-3 py-2 text-sm">
          Distance: {(distance / 1000).toFixed(2)} km
        </div>
      )}
    </div>
  )
}
