import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { points } = await req.json()
    if (!Array.isArray(points) || points.length === 0) {
      return Response.json({ error: "invalid_points" }, { status: 400 })
    }
    // batch in chunks of ~80 to keep URL under limits
    const chunkSize = 80
    const chunks: Array<[number, number][]> = []
    for (let i = 0; i < points.length; i += chunkSize) chunks.push(points.slice(i, i + chunkSize))

    const results: number[] = []
    for (const chunk of chunks) {
      const locations = chunk.map(([lon, lat]) => `${lat},${lon}`).join("|")
      const res = await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${locations}`)
      if (!res.ok) throw new Error(`elevation provider error ${res.status}`)
      const data = await res.json()
      results.push(...(data.results || []).map((r: any) => r?.elevation ?? null))
    }
    return Response.json({ elevations: results })
  } catch (e: any) {
    return Response.json({ error: "elevation_error", detail: e?.message }, { status: 500 })
  }
}
