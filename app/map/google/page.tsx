// Note: This adds a new route at /map/google to avoid editing your existing /map page.
import ClientMap from "./client"

export const metadata = {
  title: "Map (Google-like)",
  description: "Redesigned map UI with ORS features",
}

export default function Page() {
  return (
    <main className="relative min-h-[calc(100dvh-64px)]">
      <ClientMap />
    </main>
  )
}
