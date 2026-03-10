# NavKit — Responsive Map App

> A modern, responsive **Next.js 15** application with a Google Maps–like UI, powered by **Leaflet** on the client and **OpenRouteService (ORS)** proxied through secure Next.js Route Handlers. Built with TypeScript, TailwindCSS v4, shadcn/ui, and Framer Motion.

![TypeScript](https://img.shields.io/badge/TypeScript-94.3%25-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=nextdotjs)
![Leaflet](https://img.shields.io/badge/Leaflet-mapping-199900?logo=leaflet)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss)

---

## Table of Contents

- [Overview](#overview)
- [Folder Structure](#folder-structure)
- [Directory Reference](#directory-reference)
  - [Root Files](#root-files)
  - [app/](#app)
    - [app/api/ors/](#appiorsors)
    - [app/api/external/](#appapiexternal)
    - [app/map/](#appmap)
    - [app/map/google/](#appmapgoogle)
    - [app/map/plus/](#appmapplus)
  - [components/](#components)
    - [components/map/](#componentsmap)
    - [components/charts/](#componentscharts)
    - [components/ui/](#componentsui)
  - [lib/](#lib)
  - [styles/](#styles)
  - [public/](#public)
  - [docs/](#docs)
- [Key Dependencies](#key-dependencies)
- [Environment Setup](#environment-setup)
- [Available Scripts](#available-scripts)
- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Extending the Project](#extending-the-project)
- [Out-of-Scope / Future Work](#out-of-scope--future-work)
- [Contributing](#contributing)

---

## Overview

**NavKit** is a full-stack mapping application scaffolded with [v0.dev](https://v0.dev) and Next.js App Router. It provides:

- A **marketing landing page** with an animated hero background and a live preview widget (geolocation + battery status).
- A **full-featured map view** (`/map`) with routing, geocoding, reverse geocoding, isochrones, and elevation data — all powered by OpenRouteService.
- All external API calls are **server-proxied** through Next.js Route Handlers so that secrets (`ORS_API_KEY`) never reach the browser.

---

## Folder Structure

```
v0-responsive-map-app/
├── app/                          # Next.js App Router (pages & API routes)
│   ├── api/
│   │   ├── ors/                  # ORS proxy route handlers
│   │   │   ├── directions/       # POST: turn-by-turn routing
│   │   │   ├── geocode/          # GET:  address autocomplete / forward geocoding
│   │   │   ├── reverse/          # GET:  lat/lon → address
│   │   │   ├── isochrones/       # POST: reachability polygons
│   │   │   └── matrix/           # POST: multi-point ETA matrix
│   │   └── external/             # Third-party data proxy handlers
│   │       ├── air/              # Air quality data
│   │       ├── elevation/        # Terrain elevation profile
│   │       ├── ev/               # EV charging stations
│   │       └── weather/          # Weather data
│   ├── map/                      # Map route group
│   │   ├── page.tsx              # Default map page (→ google-like-map)
│   │   ├── client.tsx            # Client shell for the default map
│   │   ├── google/               # /map/google sub-route
│   │   │   ├── page.tsx
│   │   │   └── client.tsx
│   │   └── plus/                 # /map/plus sub-route (enhanced map)
│   │       └── page.tsx
│   ├── globals.css               # App-level global styles (Tailwind base)
│   ├── layout.tsx                # Root layout (fonts, Leaflet CDN CSS, ThemeProvider)
│   └── page.tsx                  # Landing / marketing hero page
│
├── components/                   # Shared React components
│   ├── map/                      # Map-specific components
│   │   ├── google-like-map.tsx   # Primary full-featured map UI (client-only)
│   │   ├── google-map-v2.tsx     # Alternate map implementation v2
│   │   ├── google-plus-map.tsx   # Enhanced "plus" map variant
│   │   ├── map-app.tsx           # Core map application shell
│   │   └── map-ui.tsx            # Map UI controls & panels
│   ├── charts/
│   │   └── elevation-chart.tsx   # Recharts elevation profile chart
│   ├── ui/                       # shadcn/ui primitives (auto-generated)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── input.tsx
│   │   ├── scroll-area.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   └── tabs.tsx
│   ├── hero-animated-bg.tsx      # Animated hero section background
│   ├── preview-widget.tsx        # Geolocation + battery status widget
│   ├── site-header.tsx           # Top navigation bar
│   ├── theme-provider.tsx        # next-themes ThemeProvider wrapper
│   └── theme-toggle.tsx          # Dark / light mode toggle button
│
├── lib/                          # Shared utility & API helper modules
│   ├── geo.ts                    # Geospatial helper functions
│   ├── ors.ts                    # OpenRouteService API client
│   └── utils.ts                  # General utilities (cn, clsx, etc.)
│
├── styles/
│   └── globals.css               # Standalone global CSS (Tailwind tokens)
│
├── public/                       # Static assets served at /
│   ├── placeholder-logo.png
│   ├── placeholder-logo.svg
│   ├── placeholder-user.jpg
│   ├── placeholder.jpg
│   └── placeholder.svg
│
├── docs/
│   └── PROJECT_GUIDE.md          # Detailed architecture & extension guide
│
├── components.json               # shadcn/ui CLI configuration
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies & scripts
���── pnpm-lock.yaml                # Lockfile (pnpm)
├── postcss.config.mjs            # PostCSS / Tailwind plugin config
├── tsconfig.json                 # TypeScript compiler options
└── .gitignore                    # Git ignore rules
```

---

## Directory Reference

### Root Files

| File | Purpose |
|---|---|
| `package.json` | Declares all dependencies and npm scripts (`dev`, `build`, `start`, `lint`) |
| `next.config.mjs` | Next.js configuration (image domains, experimental features, etc.) |
| `tsconfig.json` | TypeScript strict mode config with path aliases (`@/*`) |
| `postcss.config.mjs` | Enables Tailwind CSS v4 via `@tailwindcss/postcss` |
| `components.json` | shadcn/ui CLI config — sets style, base color, import paths, and Tailwind settings |
| `pnpm-lock.yaml` | Deterministic pnpm lockfile; commit this to ensure reproducible installs |
| `.gitignore` | Excludes `node_modules`, `.next`, `.env*`, and build artefacts |

---

### `app/`

**Purpose:** Next.js App Router root. Every sub-directory with a `page.tsx` becomes a route. Contains the global layout, global CSS, and the landing page.

| File | Role |
|---|---|
| `layout.tsx` | Root HTML shell — loads Geist font, injects Leaflet CSS via CDN `<link>`, wraps the app in `ThemeProvider` |
| `page.tsx` | Marketing/landing page — renders `SiteHeader`, animated hero with `HeroAnimatedBg`, and `PreviewWidget` |
| `globals.css` | Tailwind `@layer base` tokens and CSS custom properties for theming (mirrors `styles/globals.css`) |

**Dependencies:** `layout.tsx` imports `ThemeProvider` from `components/theme-provider.tsx` and references `app/globals.css`.

---

### `app/api/ors/`

**Purpose:** Server-side proxy for all **OpenRouteService** API calls. Keeps `ORS_API_KEY` out of the browser bundle. Each sub-directory contains a `route.ts` Next.js Route Handler.

| Sub-route | HTTP Method | Description |
|---|---|---|
| `ors/geocode/` | `GET` | Forward geocoding / address autocomplete. Accepts `text`/`q`/`query` + optional `size`, `lat`, `lon` for proximity bias |
| `ors/directions/` | `POST` | Turn-by-turn routing. Supports profiles (driving, cycling, walking), `alternatives`, `eco` → `preference=shortest`, and `avoid_features` |
| `ors/reverse/` | `GET` | Reverse geocoding — converts `lat`/`lon` to a human-readable address |
| `ors/isochrones/` | `POST` | Reachability polygons (how far can you reach in X minutes?) |
| `ors/matrix/` | `POST` | Multi-point ETA/distance matrix |

**Dependencies:** All handlers read `process.env.ORS_API_KEY` at runtime. The `lib/ors.ts` helper module provides the base URL and shared fetch logic consumed by these handlers.

---

### `app/api/external/`

**Purpose:** Proxy handlers for **third-party enrichment APIs** (air quality, elevation, EV stations, weather). Isolates external API keys from the client and normalises response shapes.

| Sub-route | Description |
|---|---|
| `external/air/` | Proxies an air quality data provider |
| `external/elevation/` | Fetches terrain elevation profile data for a route polyline |
| `external/ev/` | Returns nearby EV charging station data |
| `external/weather/` | Fetches current weather conditions for a coordinate |

**Dependencies:** These handlers may require additional environment variables beyond `ORS_API_KEY`. Check each `route.ts` for the exact env var name.

---

### `app/map/`

**Purpose:** The map feature route group (`/map`). Contains the default map page and sub-routes for map variants.

| File/Dir | Route | Description |
|---|---|---|
| `page.tsx` | `/map` | Entry point — dynamically imports the default map component (SSR disabled) |
| `client.tsx` | — | Client component wrapper used by the default `/map` page |
| `google/page.tsx` | `/map/google` | Renders the `GoogleMapV2` variant |
| `google/client.tsx` | — | Client wrapper for the Google map variant |
| `plus/page.tsx` | `/map/plus` | Renders the enhanced `GooglePlusMap` variant |

> **Why dynamic imports?** Leaflet accesses `window` and `document` during initialisation, which breaks Next.js SSR. All map components use `next/dynamic` with `{ ssr: false }`.

---

### `app/map/google/`

**Purpose:** Sub-route for the v2 Google-style map (`/map/google`).

| File | Description |
|---|---|
| `page.tsx` | Next.js page — wraps `client.tsx` as the default export |
| `client.tsx` | "use client" component that dynamically imports `components/map/google-map-v2.tsx` |

---

### `app/map/plus/`

**Purpose:** Sub-route for the enhanced "plus" map experience (`/map/plus`).

| File | Description |
|---|---|
| `page.tsx` | Dynamically imports `components/map/google-plus-map.tsx` with `ssr: false` |

---

### `components/`

**Purpose:** All shared, reusable React components. Divided into feature-specific sub-directories and a flat set of layout/theming components.

| File | Description |
|---|---|
| `hero-animated-bg.tsx` | Animated canvas/SVG background used in the landing page hero section |
| `preview-widget.tsx` | Floating info widget showing live geolocation coordinates and device battery level |
| `site-header.tsx` | Top navigation bar with branding and links |
| `theme-provider.tsx` | Thin wrapper around `next-themes` `ThemeProvider` |
| `theme-toggle.tsx` | Icon button to toggle between light and dark mode |

---

### `components/map/`

**Purpose:** All Leaflet-based, client-only map UI components. These are the core of the application.

| File | Size | Description |
|---|---|---|
| `google-like-map.tsx` | ~29 KB | **Primary map UI.** Full Google Maps–style interface: search with ORS autocomplete, A→B routing, draggable markers, turn-by-turn steps, mode selector, layer switcher (OSM / Esri Satellite / Topo), locate button, clear button, measure mode, isochrone/matrix wiring |
| `google-map-v2.tsx` | ~15 KB | Second iteration of the Google-style map — focused improvements over the original |
| `google-plus-map.tsx` | ~26 KB | Enhanced "plus" variant: extended panel, additional overlays, richer controls |
| `map-app.tsx` | ~16 KB | Foundational map application shell shared across variants |
| `map-ui.tsx` | ~20 KB | Reusable UI panels and controls (search bar, sidebar, route info cards) |

**Dependencies:** All files in this directory import from `components/ui/`, `lib/geo.ts`, `lib/ors.ts`, and call the `/api/ors/*` server routes at runtime.

---

### `components/charts/`

**Purpose:** Data visualisation components used within map panels.

| File | Description |
|---|---|
| `elevation-chart.tsx` | Renders a Recharts area/line chart of the elevation profile along a route |

**Dependencies:** Imports from `recharts` and is consumed by `map-ui.tsx` / `google-like-map.tsx` to display elevation data fetched from `app/api/external/elevation/`.

---

### `components/ui/`

**Purpose:** Auto-generated **shadcn/ui** primitive components. Do not hand-edit these; use the shadcn CLI (`pnpm dlx shadcn@latest add <component>`) to add or update them.

| File | Radix UI Primitive |
|---|---|
| `badge.tsx` | — (pure CSS) |
| `button.tsx` | `@radix-ui/react-slot` |
| `card.tsx` | — (pure CSS) |
| `checkbox.tsx` | `@radix-ui/react-checkbox` |
| `input.tsx` | — (native `<input>`) |
| `scroll-area.tsx` | `@radix-ui/react-scroll-area` |
| `select.tsx` | `@radix-ui/react-select` |
| `separator.tsx` | `@radix-ui/react-separator` |
| `slider.tsx` | `@radix-ui/react-slider` |
| `switch.tsx` | `@radix-ui/react-switch` |
| `tabs.tsx` | `@radix-ui/react-tabs` |

**Dependencies:** All components use `class-variance-authority` (CVA), `clsx`, and `tailwind-merge` (via `lib/utils.ts` `cn()` helper).

---

### `lib/`

**Purpose:** Shared utility modules consumed by both components and API route handlers.

| File | Description |
|---|---|
| `utils.ts` | Exports the `cn()` helper — merges Tailwind classes with `clsx` + `tailwind-merge` |
| `geo.ts` | Geospatial utilities: distance calculations, coordinate parsing, bounding box helpers |
| `ors.ts` | OpenRouteService base URL constant and shared fetch wrapper (used by API route handlers) |

---

### `styles/`

**Purpose:** Standalone global stylesheet. Contains CSS custom property definitions for the design token system (colours, radii, shadows) used by Tailwind and shadcn/ui.

| File | Description |
|---|---|
| `globals.css` | Defines `:root` / `.dark` CSS variables for all theme tokens; imported alongside `app/globals.css` |

---

### `public/`

**Purpose:** Static assets served directly at the root URL path. Ideal for images, icons, and files that need a stable public URL.

| File | Description |
|---|---|
| `placeholder-logo.png` | Raster placeholder logo (PNG) |
| `placeholder-logo.svg` | Vector placeholder logo (SVG) |
| `placeholder-user.jpg` | Placeholder user avatar (JPG) |
| `placeholder.jpg` | Generic placeholder image (JPG) |
| `placeholder.svg` | Generic placeholder image (SVG) |

> Replace these with your actual brand assets. Reference them in components as `/placeholder-logo.svg` (no import needed).

---

### `docs/`

**Purpose:** Project documentation beyond the README.

| File | Description |
|---|---|
| `PROJECT_GUIDE.md` | In-depth architecture walkthrough, setup notes, feature list, and extension guide (maintained alongside the codebase) |

---

## Key Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `next` | 15.2.4 | React framework with App Router, SSR, and Route Handlers |
| `react` / `react-dom` | ^19 | UI library |
| `typescript` | ^5 | Static typing |
| `leaflet` | latest | Client-side interactive map rendering |
| `geojson` | latest | GeoJSON type definitions |
| `swr` | latest | Client-side data fetching with caching (autocomplete) |
| `framer-motion` | latest | Animations (hero, transitions) |
| `recharts` | latest | Elevation profile chart |
| `next-themes` | latest | Dark/light mode theming |
| `tailwindcss` | ^4.1.9 | Utility-first CSS framework |
| `lucide-react` | ^0.454.0 | Icon library |
| `clsx` + `tailwind-merge` | latest | Conditional class merging |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `zod` | 3.25.67 | Schema validation |
| `react-hook-form` | ^7.60.0 | Form state management |

### Radix UI Primitives

All `@radix-ui/react-*` packages provide accessible, unstyled component primitives wrapped by shadcn/ui.

---

## Environment Setup

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8 (recommended; `npm` and `yarn` also work)
- An **OpenRouteService API key** — sign up free at [openrouteservice.org](https://openrouteservice.org/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ktripathi2611/v0-responsive-map-app.git
cd v0-responsive-map-app

# 2. Install dependencies
pnpm install

# 3. Set the required environment variable
#    Option A – local .env.local file (development only)
echo "ORS_API_KEY=your_key_here" > .env.local

#    Option B – Platform environment variables (Vercel / v0.dev)
#    Project Settings → Environment Variables → add ORS_API_KEY

# 4. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> ⚠️ **Never expose `ORS_API_KEY` on the client.** All ORS requests are routed through `/api/ors/*` server handlers.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Development | `pnpm dev` | Starts Next.js dev server with HMR on port 3000 |
| Build | `pnpm build` | Creates an optimised production build in `.next/` |
| Start | `pnpm start` | Serves the production build locally |
| Lint | `pnpm lint` | Runs ESLint via `next lint` |

---

## Architecture Overview

```
Browser                     Next.js Server               OpenRouteService / 3rd-party
  │                              │                                │
  │  GET /map                    │                                │
  │──────────────────────────►  app/map/page.tsx                  │
  │  (dynamic import, ssr:false) │                                │
  │◄────────────── google-like-map.tsx (Leaflet, client-only)     │
  │                              │                                │
  │  SWR: GET /api/ors/geocode   │                                │
  │──────────────────────────►  app/api/ors/geocode/route.ts      │
  │                              │──── ORS_API_KEY ──────────────►│
  │                              │◄─── GeoJSON features ──────────│
  │◄── autocomplete suggestions ─│                                │
  │                              │                                │
  │  POST /api/ors/directions    │                                │
  │──────────────────────────►  app/api/ors/directions/route.ts   │
  │                              │──── ORS_API_KEY ──────────────►│
  │                              │◄─── Route GeoJSON ─────────────│
  │◄── turn-by-turn + polyline ──│                                │
```

**Key architectural principles:**

1. **SSR safety** — Leaflet is always dynamically imported with `{ ssr: false }` to prevent `window is not defined` errors.
2. **Secret isolation** — `ORS_API_KEY` is read only in server-side Route Handlers; the client never sees it.
3. **Composable UI** — All map variants (`google-like-map`, `google-map-v2`, `google-plus-map`) share the same `components/ui/` primitives and `lib/` utilities.
4. **Design tokens** — Colours, spacing, and radii are defined as CSS custom properties in `styles/globals.css` and consumed by Tailwind.

---

## Features

| Feature | Status | Location |
|---|---|---|
| Landing page with animated hero | ✅ | `app/page.tsx`, `components/hero-animated-bg.tsx` |
| Geolocation + battery preview widget | ✅ | `components/preview-widget.tsx` |
| Dark / light mode | ✅ | `components/theme-toggle.tsx`, `theme-provider.tsx` |
| Interactive Leaflet map | ✅ | `components/map/google-like-map.tsx` |
| Address autocomplete (ORS geocoding) | ✅ | `app/api/ors/geocode/` + SWR |
| Turn-by-turn routing (drive/cycle/walk) | ✅ | `app/api/ors/directions/` |
| Alternate routes & eco mode | ✅ | `components/map/google-like-map.tsx` |
| Avoid highways / tolls / ferries | ✅ | `app/api/ors/directions/` |
| Draggable A/B markers + swap | ✅ | `components/map/google-like-map.tsx` |
| Reverse geocoding | ✅ | `app/api/ors/reverse/` |
| Isochrone polygons | ✅ (wired) | `app/api/ors/isochrones/` |
| Multi-point ETA matrix | ✅ (wired) | `app/api/ors/matrix/` |
| Elevation profile chart | ✅ | `components/charts/elevation-chart.tsx` |
| Layer switcher (OSM / Satellite / Topo) | ✅ | `components/map/google-like-map.tsx` |
| Mobile-first responsive layout | ✅ | Tailwind breakpoints throughout |

---

## Extending the Project

### Add a new map layer

```tsx
// In components/map/google-like-map.tsx
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenTopoMap',
  maxZoom: 17,
}).addTo(map);
```

### Add a new ORS endpoint

1. Create `app/api/ors/<endpoint>/route.ts`
2. Read `ORS_API_KEY` from `process.env`
3. Proxy the request to `https://api.openrouteservice.org/v2/<endpoint>`
4. Call it from the client using `fetch('/api/ors/<endpoint>', ...)`

### Add a shadcn/ui component

```bash
pnpm dlx shadcn@latest add <component-name>
# e.g.
pnpm dlx shadcn@latest add dialog
```

The component will be added to `components/ui/` automatically.

### Add a new page/route

Create a directory under `app/` with a `page.tsx` file:

```
app/
└── my-feature/
    ├── page.tsx        # Server component (default)
    └── client.tsx      # Client component (add "use client" directive)
```

---

## Out-of-Scope / Future Work

The following features require additional third-party providers and are not included in the current build:

| Feature | Suggested Provider |
|---|---|
| Live traffic & incidents | Google Maps Platform / HERE |
| Public transit routing | Google Maps Transit / Transitland |
| Street View / 3D imagery | Google Maps Platform |
| Rich business listings (Places) | Google Places API / Foursquare |
| Lane guidance & speed limits | HERE / TomTom |
| Offline maps | Mapbox offline tiles |
| Real-time EV parking & fuel prices | PlugShare API / NREL |

---

## Contributing

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ````
2. **Follow the conventions:**
   - Use TypeScript with strict mode enabled — no `any` types.
   - Name components in PascalCase; utility files in kebab-case.
   - Keep map components strictly client-only (`"use client"` + dynamic import).
   - Never read `ORS_API_KEY` or any secret inside a `"use client"` component.
   - Use `cn()` from `lib/utils.ts` for conditional Tailwind classes.
   - Add shadcn/ui primitives via the CLI — do not hand-edit `components/ui/`.
3. **Test your changes:**
   ```bash
   pnpm build   # ensure no TypeScript or build errors
   pnpm lint    # ensure no lint violations
   ```
4. **Open a Pull Request** with a clear description of what was changed and why.

---

> 📖 For a deeper architecture walkthrough, see [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md).