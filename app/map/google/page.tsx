// Note: This adds a new route at /map/google to avoid editing your existing /map page.
import dynamic from "next/dynamic"

export const metadata = {
  title: "Map (Google-like)",
  description: "Redesigned map UI with ORS features",
}

const GoogleLikeMap = dynamic(() => import("@/components/map/google-like-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
      <div className="text-muted-foreground">Loading map…</div>
    </div>
  ),
})

export default function Page() {
  return (
    <main className="relative min-h-[calc(100dvh-64px)]">
      <GoogleLikeMap />
    </main>
  )
}
