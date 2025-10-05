"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import AnimatedHeroBg from "@/components/hero-animated-bg"

export default function HomePage() {
  return (
    <div className="px-4 md:px-8">
      <section className="mx-auto max-w-6xl py-12 md:py-20 grid md:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <h1 className="text-balance text-4xl md:text-6xl font-semibold">
            Navigate smarter with a modern, privacy-friendly map.
          </h1>
          <p className="text-muted-foreground text-pretty">
            Built with Leaflet, OpenRouteService, Tailwind, and Framer Motion. Turn-by-turn routes, isochrones,
            multipoint planning, and more.
          </p>
          <div className="flex gap-3">
            <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
              <Link href="/map">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer">
                OpenRouteService
              </a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="rounded-xl border bg-card/50 backdrop-blur overflow-hidden">
            <AnimatedHeroBg />
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl pb-16 grid md:grid-cols-3 gap-6">
        {[
          { title: "Routes & Alternatives", desc: "Driving, walking, cycling, transit with alternate suggestions." },
          { title: "Eco & Preferences", desc: "Avoid tolls, ferries, highways. Eco-friendly option." },
          { title: "Isochrones & Matrix", desc: "Visualize travel-time areas and plan multi-stop trips." },
        ].map((f) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4 }}
            className="rounded-lg border p-6 bg-card"
          >
            <h3 className="text-lg font-medium">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
