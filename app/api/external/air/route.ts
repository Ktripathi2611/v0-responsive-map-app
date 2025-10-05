import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  if (!lat || !lon) return NextResponse.json({ error: "lat/lon required" }, { status: 400 })
  const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=5000&limit=1`
  const r = await fetch(url)
  const j = await r.json()
  const m = j?.results?.[0]?.measurements?.[0]
  return NextResponse.json({
    aqi: m?.value ?? null,
    parameter: m?.parameter ?? null,
    unit: m?.unit ?? null,
  })
}
