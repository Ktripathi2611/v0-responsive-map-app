import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  // validate
  const latNum = lat ? Number(lat) : Number.NaN
  const lonNum = lon ? Number(lon) : Number.NaN
  if (!isFinite(latNum) || !isFinite(lonNum)) {
    return NextResponse.json({ error: "lat/lon required as numbers" }, { status: 400 })
  }
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latNum}&longitude=${lonNum}&current=us_aqi`

  const r = await fetch(url, { next: { revalidate: 300 } })
  if (!r.ok) {
    return NextResponse.json({ error: "upstream error", status: r.status }, { status: 502 })
  }
  const j = await r.json()
  const aqi = j?.current?.us_aqi
  
  return new NextResponse(
    JSON.stringify({
      aqi: aqi ?? null,
      parameter: "US AQI",
      unit: "Index",
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}
