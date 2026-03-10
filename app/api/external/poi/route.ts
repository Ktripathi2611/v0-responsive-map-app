import { NextRequest, NextResponse } from "next/server"

const CATEGORY_TAGS: Record<string, string> = {
  restaurant: "amenity=restaurant",
  cafe: "amenity=cafe",
  fuel: "amenity=fuel",
  hospital: "amenity=hospital",
  pharmacy: "amenity=pharmacy",
  parking: "amenity=parking",
  atm: "amenity=atm",
  hotel: "tourism=hotel",
  supermarket: "shop=supermarket",
}

// GET /api/external/poi?lat=&lon=&category=restaurant&radius=1000
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const lat = parseFloat(sp.get("lat") ?? "")
  const lon = parseFloat(sp.get("lon") ?? "")
  const category = sp.get("category") ?? "restaurant"
  const radius = Math.min(parseInt(sp.get("radius") ?? "1000"), 5000) // cap at 5 km

  if (!isFinite(lat) || !isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 })
  }

  const tag = CATEGORY_TAGS[category] ?? "amenity=restaurant"
  const [tagKey, tagValue] = tag.split("=")

  // Overpass QL query — nodes within radius
  const query = `
    [out:json][timeout:10];
    node["${tagKey}"="${tagValue}"](around:${radius},${lat},${lon});
    out body 25;
  `.trim()

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Overpass API error" }, { status: 502 })
    }

    const json = await res.json()
    const pois = (json.elements ?? []).slice(0, 25).map((el: any) => ({
      id: el.id,
      lat: el.lat,
      lon: el.lon,
      name: el.tags?.name || el.tags?.["name:en"] || category,
      type: category,
      address: [el.tags?.["addr:street"], el.tags?.["addr:housenumber"]]
        .filter(Boolean)
        .join(" ") || null,
    }))

    return NextResponse.json(pois, {
      headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch POIs" }, { status: 502 })
  }
}
