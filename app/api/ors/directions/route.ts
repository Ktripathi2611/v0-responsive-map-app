import type { NextRequest } from "next/server"
import { ORS_BASE, orsHeaders } from "@/lib/ors"

// POST: { profile, coordinates, avoid, alternatives, alternative_routes, preference, eco, instructions, avoid_features }
export async function POST(req: NextRequest) {
  const body = await req.json()

  // basic validation
  if (!Array.isArray(body.coordinates) || body.coordinates.length < 2) {
    return new Response("At least 2 coordinates are required", { status: 400 })
  }

  const profile = body.profile || "driving-car"
  // force GeoJSON response so frontends can draw polylines consistently
  const url = `${ORS_BASE}/v2/directions/${encodeURIComponent(profile)}/geojson`

  const options: any = {
    coordinates: body.coordinates, // [lon, lat] pairs
    preference: body.eco ? "shortest" : body.preference || "recommended",
    instructions: body.instructions !== undefined ? !!body.instructions : true,
    geometry: true,
  }

  if (body.options && typeof body.options === "object") {
    options.options = { ...(options.options || {}), ...body.options }
  }

  const mergedAvoid: string[] = [
    ...((options.options?.avoid_features as string[]) ?? []),
    ...(Array.isArray(body.avoid_features) ? body.avoid_features : []),
  ]

  // map avoid flags to ORS avoid_features (kept for backward compatibility)
  if (body.avoid?.tollways) mergedAvoid.push("tollways")
  if (body.avoid?.ferries) mergedAvoid.push("ferries")
  if (body.avoid?.highways) mergedAvoid.push("highways")
  if (mergedAvoid.length) {
    options.options = {
      ...(options.options || {}),
      avoid_features: Array.from(new Set(mergedAvoid)),
    }
  }

  // support either boolean 'alternatives' or an object 'alternative_routes'
  if (body.alternative_routes || body.alternatives) {
    options.alternative_routes =
      typeof body.alternative_routes === "object" && body.alternative_routes
        ? body.alternative_routes
        : { target_count: 3, share_factor: 0.6 }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: orsHeaders(),
      body: JSON.stringify(options),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`ORS Directions Error [${res.status}]:`, text)
      return new Response(text || "ORS error", { status: res.status })
    }

    const data = await res.json()
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: "ors_directions_failed", detail: e?.message }, { status: 500 })
  }
}
