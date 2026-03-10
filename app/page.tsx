"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Route, Clock3, BarChart3, CloudSun, Zap, Leaf, Mic2, MapPin, Layers, ChevronRight, Github, Globe } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import AnimatedHeroBg from "@/components/hero-animated-bg"

const features = [
  {
    icon: Route,
    title: "Turn-by-Turn Routing",
    desc: "Drive, cycle, or walk with up to 3 alternative routes, step-by-step instructions, and real-time rerouting.",
    color: "from-blue-500/20 to-blue-600/10",
    iconColor: "text-blue-500",
  },
  {
    icon: Clock3,
    title: "Isochrone Maps",
    desc: "Visualise exactly how far you can reach in any direction within a chosen time window.",
    color: "from-violet-500/20 to-violet-600/10",
    iconColor: "text-violet-500",
  },
  {
    icon: BarChart3,
    title: "Elevation Profiles",
    desc: "See the terrain elevation along any route with an interactive chart — ideal for cyclists and hikers.",
    color: "from-emerald-500/20 to-emerald-600/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: CloudSun,
    title: "Live Weather & Air",
    desc: "Current temperature, wind speed, and air quality index fetched for any location on the map.",
    color: "from-sky-500/20 to-sky-600/10",
    iconColor: "text-sky-500",
  },
  {
    icon: Zap,
    title: "EV Charging Stations",
    desc: "Find nearby electric vehicle charging points layered directly onto your map view.",
    color: "from-amber-500/20 to-amber-600/10",
    iconColor: "text-amber-500",
  },
  {
    icon: Leaf,
    title: "Eco & Carbon Metrics",
    desc: "Eco routing mode, avoid-tollway/highway options, and per-route CO₂ emission estimates.",
    color: "from-green-500/20 to-green-600/10",
    iconColor: "text-green-500",
  },
  {
    icon: Mic2,
    title: "Voice Navigation",
    desc: "Hands-free turn-by-turn directions read aloud via the Web Speech Synthesis API.",
    color: "from-pink-500/20 to-pink-600/10",
    iconColor: "text-pink-500",
  },
  {
    icon: MapPin,
    title: "POI Search",
    desc: "Discover restaurants, fuel stations, pharmacies, and parking along your route via OpenStreetMap.",
    color: "from-orange-500/20 to-orange-600/10",
    iconColor: "text-orange-500",
  },
  {
    icon: Layers,
    title: "Multi-Layer Maps",
    desc: "Switch between OSM, Esri satellite, topographic, CyclOSM, and noise-pollution overlays.",
    color: "from-indigo-500/20 to-indigo-600/10",
    iconColor: "text-indigo-500",
  },
]

const stats = [
  { value: "9", label: "API Routes" },
  { value: "5", label: "Transport Modes" },
  { value: "4", label: "Map Layers" },
  { value: "100%", label: "Open Source" },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100dvh-64px)] flex items-center">
        {/* Radial gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-violet-600/6 dark:from-blue-600/12 dark:to-violet-600/10" />
        {/* Animated particle canvas */}
        <div className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-50">
          <AnimatedHeroBg />
        </div>

        <div className="relative mx-auto max-w-7xl w-full px-4 md:px-6 py-16 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-sm font-medium text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Free &amp; Privacy-Friendly Navigation
            </motion.div>

            <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold leading-[1.08] tracking-tight">
              Navigate{" "}
              <span className="gradient-text">smarter,</span>
              <br />
              go anywhere.
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Full-stack mapping with Leaflet, OpenRouteService, and live data — routing, isochrones, elevation,
              weather, EV stations, and more. Your API keys stay on the server.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="btn-gradient rounded-full px-6 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow font-semibold"
              >
                <Link href="/map">
                  Open Map <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-6 font-medium">
                <Link href="/map/plus">
                  Try Map+ <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="rounded-full px-4 text-muted-foreground">
                <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer">
                  <Globe className="mr-2 h-4 w-4" /> ORS Docs
                </a>
              </Button>
            </div>

            {/* Floating metric badges */}
            <motion.div
              className="flex flex-wrap gap-2 pt-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {stats.map((s) => (
                <motion.div
                  key={s.label}
                  variants={itemVariants}
                  className="flex items-baseline gap-1.5 rounded-full border border-border/60 bg-card/60 px-3.5 py-1.5 backdrop-blur text-sm"
                >
                  <span className="font-bold gradient-text text-base">{s.value}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — visual */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-blue-500/10 aspect-[4/3]">
              {/* Gradient ring glow */}
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-blue-500/20 via-transparent to-violet-500/15 pointer-events-none z-10" />
              <AnimatedHeroBg />
              {/* Floating stat chip */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between rounded-2xl glass-panel px-4 py-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium">Live routing active</span>
                </div>
                <span className="text-xs text-muted-foreground">via ORS + Leaflet</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 space-y-3"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Everything you need
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Packed with <span className="gradient-text">powerful features</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every feature proxied through secure server routes. No API key ever reaches your browser.
          </p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={itemVariants}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition-colors overflow-hidden"
            >
              {/* Gradient bg on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative space-y-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/60 ${f.iconColor}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── CTA Strip ─────────────────────────────────────────────────── */}
      <section className="mx-4 md:mx-6 mb-16 rounded-3xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-violet-700" />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC43NSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWx0ZXI9InVybCgjYSkiIG9wYWNpdHk9IjEiLz48L3N2Zz4=')]" />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-16 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Ready to navigate?
            </h2>
            <p className="mt-3 text-blue-100/80 max-w-md mx-auto">
              Open the map, search an address, and get turn-by-turn directions in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-xl px-8 transition-colors"
              >
                <Link href="/map">
                  Start navigating <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="rounded-full text-white hover:bg-white/10 px-6"
              >
                <a href="https://github.com/Ktripathi2611/v0-responsive-map-app" target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" /> View on GitHub
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
