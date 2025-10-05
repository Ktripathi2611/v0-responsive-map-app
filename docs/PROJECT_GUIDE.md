# Responsive Map App – Project Guide

This project is a Next.js App Router app with a Google Maps–like UI powered by Leaflet on the client and OpenRouteService (ORS) via server route handlers.

## Architecture

- app/layout.tsx
  - Adds global Leaflet CSS via CDN to avoid bundling issues.
  - Provides the root HTML skeleton for the App Router.

- app/map/page.tsx
  - Client page that renders the new Google-like map (google-like-map) via dynamic import with `ssr: false`.

- components/map/google-like-map.tsx
  - Client-only map UI:
    - Dynamically imports Leaflet to avoid MIME-type issues.
    - Centers to the user’s device location by default (with graceful fallback).
    - Top search with live suggestions (ORS geocoding autocomplete via SWR) with proximity bias to the current map center.
    - Mode selector (driving, cycling, walking).
    - Toggles: alternate routes, eco (shortest), avoid highways/tolls/ferries.
    - Turn-by-turn steps list, measure mode, isochrones and matrix ETAs wiring.
    - Legal tile sources with a native layers control (OSM/Esri Satellite/Topo).
    - Floating controls: Locate and Clear.

- app/page.tsx
  - Marketing hero updated to use an animated background component at right for a richer visual introduction.

- app/api/ors/geocode/route.ts
  - Accepts `text`, `q`, or `query`; optional `size`.
  - Proximity bias via `lat`/`lon` or `proximity=lat,lon` passed through to `focus.point.*`.

- app/api/ors/directions/route.ts
  - Normalizes ORS requests, supports `alternatives` boolean, maps `eco` to `preference=shortest`, nests `avoid_features` in `options`.
  - Wrapped in try/catch to return structured errors on upstream failures.

## Features

- Google-like UI with legal map tiles (OSM, Esri).
- Default to user location on load; origin is prefilled if granted.
- Live search suggestions with ORS autocomplete.
- Driving, cycling, walking profiles.
- Alternate route suggestions, eco-friendly preference (shortest), and avoid highways/tolls/ferries.
- Draggable A/B markers, A↔B swap, and turn-by-turn steps panel.
- Layers control (Default, Satellite, Topo).
- Locate and Clear controls.

## Missing or Out-of-Scope (needs other providers)

- Live traffic/incidents, transit routing, Street View/3D, business listings (rich Places), lane guidance/speed limits, offline maps, real-time EV parking/fuel prices.

## Setup

- Environment variable: `ORS_API_KEY` (provided via v0 Integrations/Environment).
- No .env needed in Next.js; routes read env on server.

## Deployment Notes

- Uses dynamic imports to keep Leaflet strictly client-side.
- ORS requests are proxied through Next.js route handlers (no client-side secrets).
- Tailwind/shadcn available by default; UI uses semantically named tokens and ARIA attributes for accessibility.

## Extending

- Add more base layers (e.g., Topographic) via Leaflet tileLayer.
- Add measure mode or isochrones by wiring new toggles and calling existing ORS endpoints.
- Integrate third-party APIs for traffic, transit, Street View, or rich places if required.
