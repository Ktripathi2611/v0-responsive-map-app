# NavKit — Responsive Map Application

> A full-stack **Next.js 15** mapping application with a Google Maps–style UI, powered by **Leaflet** on the client and **OpenRouteService (ORS)** proxied through secure server-side Route Handlers. Built with TypeScript, TailwindCSS v4, shadcn/ui, Framer Motion, and Recharts.

![TypeScript](https://img.shields.io/badge/TypeScript-94.3%25-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=nextdotjs)
![Leaflet](https://img.shields.io/badge/Leaflet-mapping-199900?logo=leaflet)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss)

---

## Table of Contents

- [Overview](#overview)
- [Folder Structure](#folder-structure)
- [Directory Reference](#directory-reference)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Running the App](#running-the-app)
  - [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Architecture & Dependencies](#architecture--dependencies)
- [Best Practices & Contributing](#best-practices--contributing)

---

## Overview

**NavKit** is a full-featured mapping application designed for high performance and extensibility. It includes:
- **Responsive Web UI**: A mobile-first, glassmorphism design with dark/light mode support.
- **Advanced Mapping**: Routing, Geocoding, Isochrones (reachability), and Matrix calculations.
- **Rich Data Overlays**: Live weather, air quality, EV charging stations, and POI searching.
- **Security**: All external API keys are kept on the server and proxied via Next.js Route Handlers.

---

## Folder Structure

```text
v0-responsive-map-app/
├── app/                          # Next.js App Router root
│   ├── api/                      # Server-side Route Handlers (ORS & External)
│   ├── map/                      # Map route group (SSR disabled)
│   └── globals.css               # Global styles & design tokens
├── components/                   # React components (map, charts, ui)
├── lib/                          # Utility functions (geo, ors, utils)
└── public/                       # Static public assets
```

---

## Getting Started

Follow these steps to get your local development environment set up.

### Prerequisites

- **Node.js**: v18.17 or later.
- **Package Manager**: `pnpm` (recommended) or `npm`.
- **OpenRouteService API Key**: Required for mapping features. Get a free key at [openrouteservice.org](https://openrouteservice.org/).

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ktripathi2611/v0-responsive-map-app.git
   cd v0-responsive-map-app
   ```

2. **Install Dependencies**:
   
   If using **pnpm**:
   ```bash
   pnpm install
   ```
   
   If using **npm**:
   ```bash
   npm install --legacy-peer-deps
   ```
   *Note: `--legacy-peer-deps` is required for npm due to React 19 peer dependency conflicts in early Next.js 15 libraries.*

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```text
   ORS_API_KEY=your_key_here
   ```

### Running the App

- **Development Mode**:
  ```bash
  pnpm dev   # or npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) to view the app.

- **Production Build**:
  ```bash
  pnpm build # or npm run build
  pnpm start # or npm start
  ```

### Troubleshooting

- **Lockfile Conflicts**: If you switch between `pnpm` and `npm`, delete `node_modules` and the other lockfile before installing.
- **Vercel Build Failure**: If Vercel fails with `ERR_PNPM_OUTDATED_LOCKFILE`, run `npx pnpm install --no-frozen-lockfile` locally and push the updated `pnpm-lock.yaml`.
- **Missing Module `react-is`**: This has been added to dependencies. If you encounter it, run a fresh install.

---

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Mapping** | Leaflet + OpenRouteService |
| **Styling** | TailwindCSS v4 + shadcn/ui |
| **Data Viz** | Recharts |
| **Animations**| Framer Motion |

---

## Best Practices & Contributing

1. **SSR Safety**: Always use dynamic imports with `{ ssr: false }` for Leaflet components.
2. **API Proxies**: Never call external APIs directly; use the `/api/*` server proxies.
3. **Branching**: Create a feature branch before opening a Pull Request.

---

> [!TIP]
> **Check Out the Guide**: For a deeper dive into the architecture, see [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md).
