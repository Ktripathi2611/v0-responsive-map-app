import type { NextRequest } from "next/server"
import { ORS_BASE, orsHeaders } from "@/lib/ors"

// GET: ?q=search
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const q = sp.get("q") || sp.get("text") || sp.get("query") || ""
    const size = Math.min(Math.max(Number(sp.get("size") || 8), 1), 15)
    if (!q) return Response.json({ features: [] })

    let lat = Number(sp.get("lat"))
    let lon = Number(sp.get("lon"))
    const proximity = sp.get("proximity")
    if (proximity && proximity.includes(",")) {
      const [plat, plon] = proximity.split(",").map(Number)
      if (Number.isFinite(plat) && Number.isFinite(plon)) {
        lat = plat
        lon = plon
      }
    }
    const focusParams =
      Number.isFinite(lat) && Number.isFinite(lon) ? `&focus.point.lat=${lat}&focus.point.lon=${lon}` : ""

    const key = process.env.ORS_API_KEY
    const url = `${ORS_BASE}/geocode/search?api_key=${key}&text=${encodeURIComponent(q)}&size=${size}${focusParams}`
    const res = await fetch(url, { headers: orsHeaders() })

    if (!res.ok) {
      return Response.json({ features: [], error: `upstream:${res.status}` }, { status: 200 })
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err: any) {
    return Response.json({ features: [], error: err?.message ?? "geocode_failed" }, { status: 200 })
  }
}
