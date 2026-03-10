"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "./theme-toggle"
import { cn } from "@/lib/utils"
import { MapPin } from "lucide-react"

export default function SiteHeader() {
  const pathname = usePathname()
  const nav = [
    { href: "/", label: "Home" },
    { href: "/map", label: "Map" },
    { href: "/map/plus", label: "Map+" },
  ]

  return (
    <header className="sticky top-0 z-40 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50">
      {/* Subtle gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">
            NavKit
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {/* Pill nav container */}
          <div className="hidden sm:flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1.5 py-1 backdrop-blur">
            {nav.map((n) => {
              const isActive = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href))
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative px-3.5 py-1.5 text-sm rounded-full transition-all duration-200",
                    isActive
                      ? "text-white font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-violet-600" />
                  )}
                  <span className="relative">{n.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Mobile nav links */}
          <div className="flex sm:hidden items-center gap-3 mr-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "text-sm transition-colors",
                  pathname === n.href
                    ? "font-semibold gradient-text"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
}
