"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"

type LatLng = { lat: number; lng: number }
type Profile = "driving-car" | "cycling-regular" | "foot-walking"

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) {
      const t = await r.text().catch(() => "")
      throw new Error(`Request failed: ${r.status} ${t}`)
    }
    return r.json()
  })

export default function GoogleMapV2() {
  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)

  const [ready, setReady] = useState(false)
  const [center, setCenter] = useState<LatLng>({ lat: 40.7128, lng: -74.006 }) // NYC fallback
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [destination, setDestination] = useState<LatLng | null>(null)
  const [waypoints, setWaypoints] = useState<LatLng[]>([])
  const [activeField, setActiveField] = useState<"origin" | "destination">("origin")

  const [query, setQuery] = useState("")
  const [profile, setProfile] = useState<Profile>("driving-car")
  const [alternates, setAlternates] = useState(true)
  const [eco, setEco] = useState(false)
  const [avoidHighways, setAvoidHighways] = useState(false)
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [avoidFerries, setAvoidFerries] = useState(false)

  const [routeGeoJSON, setRouteGeoJSON] = useState<any | null>(null)
  const [altRoutes, setAltRoutes] = useState<any[]>([])
  const [steps, setSteps] = useState<any[]>([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggestions
  const enableSuggest = query.trim().length >= 2
  const { data: suggestData } = useSWR(
    enableSuggest ? `/api/ors/geocode?text=${encodeURIComponent(query)}&size=6` : null,
    fetcher,
  )

  // Dynamic Leaflet import and map init
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (LRef.current) return // already loaded
      const L = await import("leaflet")
      if (cancelled) return
      LRef.current = L

      // Fix default icon paths (avoid bundling CSS assets)
      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png"
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

      // Try to center on user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setCenter(ll)
            if (!origin) setOrigin(ll)
            initMap(L, ll)
          },
          () => {
            initMap(L, center)
          },
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 },
        )
      } else {
        initMap(L, center)
      }
    })()

    function initMap(L: any, initial: LatLng) {
      if (mapRef.current) {
        setReady(true)
        return
      }
      const map = L.map("map-root", {
        center: [initial.lat, initial.lng],
        zoom: 13,
        zoomControl: false,
      })
      mapRef.current = map

      // Base layers
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      })
      const esri = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye" },
      )
      osm.addTo(map)
      const baseLayers = { Default: osm, Satellite: esri }

      L.control.layers(baseLayers, {}, { position: "topright" }).addTo(map)
      L.control.zoom({ position: "topright" }).addTo(map)

      setReady(true)
    }

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw origin/destination markers and route on changes
  useEffect(() => {
    if (!ready || !LRef.current || !mapRef.current) return
    const L = LRef.current as any
    const map = mapRef.current as any

    // Clear prior markers layer if any
    ;(map._originMarker as any)?.remove?.()
    ;(map._destinationMarker as any)?.remove?.()

    if (origin) {
      const m = L.marker([origin.lat, origin.lng], { draggable: true })
      m.on("dragend", () => {
        const { lat, lng } = m.getLatLng()
        setOrigin({ lat, lng })
      })
      m.addTo(map)
      map._originMarker = m
    }
    if (destination) {
      const m = L.marker([destination.lat, destination.lng], { draggable: true })
      m.on("dragend", () => {
        const { lat, lng } = m.getLatLng()
        setDestination({ lat, lng })
      })
      m.addTo(map)
      map._destinationMarker = m
    }
  }, [origin, destination, ready])

  // Helper: fit all route layers
  const fitRouteBounds = (fc: any) => {
    if (!LRef.current || !mapRef.current || !fc) return
    const L = LRef.current as any
    const map = mapRef.current as any
    const coords: [number, number][] = []
    for (const feat of fc.features ?? []) {
      const geom = feat.geometry
      if (!geom) continue
      if (geom.type === "LineString") {
        for (const [lng, lat] of geom.coordinates) coords.push([lat, lng])
      } else if (geom.type === "MultiLineString") {
        for (const line of geom.coordinates) {
          for (const [lng, lat] of line) coords.push([lat, lng])
        }
      }
    }
    if (coords.length) {
      const bounds = (L as any).latLngBounds(coords)
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }

  // Draw route GeoJSON
  useEffect(() => {
    if (!ready || !LRef.current || !mapRef.current) return
    const L = LRef.current as any
    const map = mapRef.current as any

    // Clear old layers
    ;(map._routeLayer as any)?.remove?.()
    ;(map._altLayers as any)?.forEach?.((l: any) => l.remove())

    const allAltLayers: any[] = []
    if (altRoutes.length) {
      for (const alt of altRoutes) {
        const layer = (L as any).geoJSON(alt, {
          style: { color: "#9aa0a6", weight: 5, opacity: 0.9 },
        })
        layer.addTo(map)
        allAltLayers.push(layer)
      }
    }
    map._altLayers = allAltLayers

    if (routeGeoJSON) {
      const layer = (L as any).geoJSON(routeGeoJSON, {
        style: { color: "#1a73e8", weight: 6, opacity: 1 },
      })
      layer.addTo(map)
      map._routeLayer = layer
      fitRouteBounds(routeGeoJSON)
    }
  }, [routeGeoJSON, altRoutes, ready])

  async function doRoute() {
    setError(null)
    setLoadingRoute(true)
    try {
      const coords: [number, number][] = []
      if (origin) coords.push([origin.lng, origin.lat])
      for (const w of waypoints) coords.push([w.lng, w.lat])
      if (destination) coords.push([destination.lng, destination.lat])

      if (coords.length < 2) {
        setError("Please set both origin and destination.")
        setLoadingRoute(false)
        return
      }

      const res = await fetch("/api/ors/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          coordinates: coords,
          alternatives: alternates,
          eco,
          avoid_features: [
            ...(avoidHighways ? ["highways"] : []),
            ...(avoidTolls ? ["tollways"] : []),
            ...(avoidFerries ? ["ferries"] : []),
          ],
          instructions: true,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Directions failed: ${res.status} ${t}`)
      }
      const data = await res.json()

      // Expect features array; first is primary, rest alternates if present.
      const features = data?.features ?? []
      const primary = features[0] ? { type: "FeatureCollection", features: [features[0]] } : null
      const alts = features.slice(1).map((f: any) => ({ type: "FeatureCollection", features: [f] }))

      setRouteGeoJSON(primary)
      setAltRoutes(alts)

      // Steps
      const first = features[0]
      const segs = first?.properties?.segments ?? []
      const stepsArr = segs[0]?.steps ?? []
      setSteps(stepsArr)
    } catch (e: any) {
      setError(e.message || "Failed to fetch directions")
    } finally {
      setLoadingRoute(false)
    }
  }

  function onSelectSuggestion(item: any) {
    const c = item?.geometry?.coordinates
    if (!c) return
    const lng = c[0]
    const lat = c[1]
    if (activeField === "origin") {
      setOrigin({ lat, lng })
    } else {
      setDestination({ lat, lng })
    }
    setCenter({ lat, lng })
    setQuery("")
  }

  function swapAB() {
    setOrigin((o) => {
      const newO = destination ? { ...destination } : o
      setDestination(o ? { ...o } : destination)
      return newO
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          {/* Origin and Destination inputs */}
          <div className="flex-1 relative">
            <div className="flex gap-2">
              <input
                aria-label="Origin"
                className="w-1/2 rounded-md border bg-background px-3 py-2 text-sm outline-none"
                placeholder="Origin"
                value={activeField === "origin" ? query : origin ? "" : query}
                onFocus={() => setActiveField("origin")}
                onChange={(e) => setQuery(e.target.value)}
              />
              <input
                aria-label="Destination"
                className="w-1/2 rounded-md border bg-background px-3 py-2 text-sm outline-none"
                placeholder="Destination"
                value={activeField === "destination" ? query : destination ? "" : query}
                onFocus={() => setActiveField("destination")}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Suggestions dropdown */}
            {enableSuggest && suggestData?.features?.length ? (
              <ul className="absolute z-20 mt-2 w-full rounded-md border bg-background shadow">
                {suggestData.features.map((f: any, i: number) => (
                  <li
                    key={i}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                    onMouseDown={() => onSelectSuggestion(f)}
                    aria-label={`Suggestion ${i + 1}`}
                  >
                    {f?.properties?.label || f?.properties?.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Travel mode"
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={profile}
              onChange={(e) => setProfile(e.target.value as Profile)}
            >
              <option value="driving-car">Driving</option>
              <option value="cycling-regular">Cycling</option>
              <option value="foot-walking">Walking</option>
            </select>
            <button
              className="rounded-md border px-2 py-2 text-sm"
              onClick={swapAB}
              aria-label="Swap origin and destination"
            >
              Swap
            </button>
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              onClick={doRoute}
              disabled={loadingRoute}
            >
              {loadingRoute ? "Routing…" : "Route"}
            </button>
          </div>
        </div>

        {/* Toggles row */}
        <div className="mx-auto max-w-6xl px-4 pb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alternates} onChange={(e) => setAlternates(e.target.checked)} />
            Alternate routes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={eco} onChange={(e) => setEco(e.target.checked)} />
            Eco-friendly
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} />
            Avoid highways
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />
            Avoid tolls
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avoidFerries} onChange={(e) => setAvoidFerries(e.target.checked)} />
            Avoid ferries
          </label>
        </div>
      </header>

      <main className="relative flex-1">
        <div id="map-root" className="absolute inset-0" role="region" aria-label="Map" />
        {/* Steps panel */}
        <aside className="absolute left-4 top-4 z-10 w-80 max-h-[70vh] overflow-auto rounded-md border bg-background shadow">
          <div className="border-b px-3 py-2 text-sm font-medium">Directions</div>
          <div className="p-3">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!steps?.length ? (
              <p className="text-sm text-muted-foreground">Enter origin and destination, then press Route.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {steps.map((s: any, i: number) => (
                  <li key={i} className="rounded bg-muted px-2 py-1">
                    <div className="font-medium">{s.instruction}</div>
                    <div className="text-xs text-muted-foreground">
                      {(s.distance / 1000).toFixed(2)} km · {Math.round(s.duration / 60)} min
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>

        {/* Floating controls */}
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <button
            className="rounded-md border bg-background px-2 py-2 text-sm shadow"
            onClick={() => {
              if (!mapRef.current) return
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  setCenter(ll)
                  mapRef.current.setView([ll.lat, ll.lng], 15)
                })
              }
            }}
            aria-label="Locate me"
          >
            Locate
          </button>
          <button
            className="rounded-md border bg-background px-2 py-2 text-sm shadow"
            onClick={() => {
              setOrigin(null)
              setDestination(null)
              setWaypoints([])
              setRouteGeoJSON(null)
              setAltRoutes([])
              setSteps([])
              setError(null)
            }}
            aria-label="Clear map"
          >
            Clear
          </button>
        </div>
      </main>
    </div>
  )
}
