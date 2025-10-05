# NavKit — Leaflet + OpenRouteService

A modern, responsive Next.js demo with TailwindCSS, shadcn/ui, Framer Motion, and Leaflet integrated with OpenRouteService (ORS).

## Features
- Landing page with animated preview widget (geolocation + battery).
- Map app: directions (driving/walking/cycling/transit), alternate routes, eco option, avoid tolls/ferries/highways.
- Isochrones, geocoding/search, reverse geocoding, multipoint planning (ORS matrix).
- Controls: current location, fullscreen, layers (terrain/dark/satellite/bike), measure distances, share location link.
- Sidebar: saved places (localStorage), parking memory, itinerary builder.
- Dark mode and mobile-first.

## Setup
1. Create an OpenRouteService API key.
2. Add ORS_API_KEY to your project environment variables (Project Settings → Environment Variables). Do not expose this key on the client.
3. Publish/Preview. The app uses server route handlers to proxy ORS requests using the key.

Env example is in `.env.example`. Next.js reads envs from the platform; `.env` files are not used in preview.

## Notes
- Leaflet CSS is imported inside the map component.
- SWR is used for client-side data; ORS calls are proxied via `/api/ors/*`.
- If battery API is unsupported, the widget falls back gracefully.
