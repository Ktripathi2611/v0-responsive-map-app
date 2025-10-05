"use client"

import dynamic from "next/dynamic"

const GoogleLikeMap = dynamic(() => import("@/components/map/google-like-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
      <div className="text-muted-foreground">Loading map…</div>
    </div>
  ),
})

export default function ClientMap() {
  return <GoogleLikeMap />
}
