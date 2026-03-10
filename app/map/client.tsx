"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

const GoogleLikeMap = dynamic(() => import("@/components/map/google-like-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-muted-foreground">Loading map…</div>
  ),
})

export default function MapClient() {
  return (
    <div className="h-[calc(100dvh-64px)] w-full" role="region" aria-label="Interactive map">
      <Suspense
        fallback={<div className="h-full w-full flex items-center justify-center text-muted-foreground">Loading…</div>}
      >
        <GoogleLikeMap />
      </Suspense>
    </div>
  )
}
