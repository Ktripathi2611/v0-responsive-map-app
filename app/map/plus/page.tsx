"use client"

import dynamic from "next/dynamic"

const GooglePlusMap = dynamic(() => import("@/components/map/google-plus-map").then((m) => m.GooglePlusMap), {
  ssr: false,
})

export default function MapPlusPage() {
  return (
    <main className="h-[calc(100dvh-0px)] w-full">
      <GooglePlusMap />
    </main>
  )
}
