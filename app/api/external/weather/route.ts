import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  const latNum = lat ? Number(lat) : Number.NaN
  const lonNum = lon ? Number(lon) : Number.NaN
  if (!isFinite(latNum) || !isFinite(lonNum)) {
    return NextResponse.json({ error: "lat/lon required as numbers" }, { status: 400 })
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,wind_speed_10m,weather_code`
  const r = await fetch(url, { next: { revalidate: 300 } }) // cache 5 min
  if (!r.ok) {
    return NextResponse.json({ error: "upstream error", status: r.status }, { status: 502 })
  }
  const j = await r.json()
  const code = j?.current?.weather_code
  const summary = codeToSummary(code)
  return new NextResponse(
    JSON.stringify({
      temp: j?.current?.temperature_2m,
      wind: j?.current?.wind_speed_10m,
      summary,
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}

function codeToSummary(code?: number) {
  if (code == null) return "Unknown"
  if (code === 0) return "Clear"
  if ([1, 2, 3].includes(code)) return "Cloudy"
  if ([45, 48].includes(code)) return "Fog"
  if ([51, 53, 55, 61, 63, 65].includes(code)) return "Rain"
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow"
  if ([95, 96, 99].includes(code)) return "Thunderstorms"
  return "Mixed"
}
