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
  const url = `https://api.openaq.org/v2/latest?coordinates=${latNum},${lonNum}&radius=5000&limit=1`

  const r = await fetch(url, { next: { revalidate: 300 } }) // cache 5 min on Vercel
  if (!r.ok) {
    return NextResponse.json({ error: "upstream error", status: r.status }, { status: 502 })
  }
  const j = await r.json()
  const m = j?.results?.[0]?.measurements?.[0]
  return new NextResponse(
    JSON.stringify({
      aqi: m?.value ?? null,
      parameter: m?.parameter ?? null,
      unit: m?.unit ?? null,
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}
