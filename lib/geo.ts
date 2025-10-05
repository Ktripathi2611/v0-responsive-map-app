export const toRad = (deg: number) => (deg * Math.PI) / 180

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const sinDlat = Math.sin(dLat / 2)
  const sinDlon = Math.sin(dLon / 2)
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function polylineDistanceKm(points: Array<[number, number]>) {
  if (points.length < 2) return 0
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    sum += haversineKm(points[i - 1], points[i])
  }
  return sum
}

export function haversineDistanceKm(a: [number, number], b: [number, number]) {
  return haversineKm(a, b)
}

export function formatDistanceKm(meters: number) {
  if (meters < 950) return `${Math.round(meters)} m`
  const km = meters / 1000
  return `${km.toFixed(km < 9.95 ? 1 : 0)} km`
}

export function formatDuration(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h <= 0) return `${m} min`
  return `${h} h ${m} min`
}
