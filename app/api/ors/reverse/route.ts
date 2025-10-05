import type { NextRequest } from "next/server"
import { ORS_BASE, orsHeaders } from "@/lib/ors"

// GET: ?lat=..&lng=..
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat")
  const lng = req.nextUrl.searchParams.get("lng")
  if (!lat || !lng) return Response.json({ features: [] })
  const url = `${ORS_BASE}/geocode/reverse?point.lat=${lat}&point.lon=${lng}`
  const res = await fetch(url, { headers: orsHeaders() })
  const data = await res.json()
  return Response.json(data)
}
