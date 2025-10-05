import type { NextRequest } from "next/server"
import { ORS_BASE, orsHeaders } from "@/lib/ors"

// POST: { profile, locations: [[lng,lat], ...] }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const profile = body.profile || "driving-car"
  const url = `${ORS_BASE}/v2/matrix/${encodeURIComponent(profile)}`
  const res = await fetch(url, {
    method: "POST",
    headers: orsHeaders(),
    body: JSON.stringify({ locations: body.locations, metrics: ["distance", "duration"] }),
  })
  const data = await res.json()
  return new Response(JSON.stringify(data), { status: res.status })
}
