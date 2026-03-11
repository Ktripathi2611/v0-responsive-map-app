import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  const distance = searchParams.get("distance") ?? "5"
  if (!lat || !lon) return NextResponse.json({ error: "lat/lon required" }, { status: 400 })
  const url = `https://api.openchargemap.io/v3/poi?output=json&compact=true&verbose=false&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=KM`
  
  const r = await fetch(url, {
    headers: {
      "User-Agent": "v0-map-app/1.0",
      "X-API-Key": process.env.OCM_API_KEY ?? "OCM-API-KEY-OPTIONAL"
    }
  })
  
  if (!r.ok) {
    const text = await r.text().catch(() => "N/A")
    console.error("OCM Upstream Error:", r.status, text)
    return NextResponse.json({ error: "OCM error", status: r.status, detail: text.slice(0, 100) }, { status: 502 })
  }
  
  const j = await r.json()
  const out = (Array.isArray(j) ? j : []).slice(0, 20).map((p: any) => ({
    title: p?.AddressInfo?.Title,
    address: p?.AddressInfo?.AddressLine1,
    lat: p?.AddressInfo?.Latitude,
    lon: p?.AddressInfo?.Longitude,
  }))
  return NextResponse.json(out)
}
