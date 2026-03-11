export const ORS_BASE = "https://api.openrouteservice.org"

export function orsHeaders() {
  const key = process.env.ORS_API_KEY
  if (!key) {
    throw new Error("Missing ORS_API_KEY")
  }
  return { 
    "Authorization": key, 
    "api-key": key,
    "Content-Type": "application/json" 
  }
}
