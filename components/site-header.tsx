"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "./theme-toggle"
import { cn } from "@/lib/utils"

export default function SiteHeader() {
  const pathname = usePathname()
  const nav = [
    { href: "/", label: "Home" },
    { href: "/map", label: "Map" },
  ]
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 md:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          NavKit
        </Link>
        <nav className="flex items-center gap-4">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "text-sm text-muted-foreground hover:text-foreground transition-colors",
                pathname === n.href && "text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
