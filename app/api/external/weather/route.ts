import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  if (!lat || !lon) return NextResponse.json({ error: "lat/lon required" }, { status: 400 })
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code`
  const r = await fetch(url)
  const j = await r.json()
  const code = j?.current?.weather_code
  const summary = codeToSummary(code)
  return NextResponse.json({
    temp: j?.current?.temperature_2m,
    wind: j?.current?.wind_speed_10m,
    summary,
  })
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
