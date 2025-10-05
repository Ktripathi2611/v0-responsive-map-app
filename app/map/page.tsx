import dynamic from "next/dynamic"

const GoogleLikeMap = dynamic(() => import("@/components/map/google-like-map"), { ssr: false })

export default function MapPage() {
  return (
    <div className="h-[calc(100dvh-56px)]" role="main" aria-label="Map page">
      <GoogleLikeMap />
    </div>
  )
}
