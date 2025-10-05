import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  const distance = searchParams.get("distance") ?? "5"
  if (!lat || !lon) return NextResponse.json({ error: "lat/lon required" }, { status: 400 })
  const url = `https://api.openchargemap.io/v3/poi?output=json&compact=true&verbose=false&latitude=${lat}&longitude=${lon}&distance=${distance}`
  const r = await fetch(url, { headers: { "X-API-Key": "OCM-API-KEY-OPTIONAL" } })
  const j = await r.json()
  const out = (j || []).slice(0, 20).map((p: any) => ({
    title: p?.AddressInfo?.Title,
    address: p?.AddressInfo?.AddressLine1,
    lat: p?.AddressInfo?.Latitude,
    lon: p?.AddressInfo?.Longitude,
  }))
  return NextResponse.json(out)
}
