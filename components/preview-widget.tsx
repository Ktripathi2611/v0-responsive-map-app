"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { MapPin, Battery } from "lucide-react"

type BatteryInfo = { level: number; charging: boolean } | null

export default function PreviewWidget() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [battery, setBattery] = useState<BatteryInfo>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setError(err.message),
        { enableHighAccuracy: true, timeout: 8000 },
      )
    } else {
      setError("Geolocation not available")
    }

    // Battery API
    // Some browsers require navigator.getBattery; others may not support it.
    // @ts-ignore
    let batteryRef: any = null
    // @ts-ignore
    if (navigator.getBattery) {
      // @ts-ignore
      navigator
        .getBattery()
        .then((b: any) => {
          batteryRef = b
          const update = () => setBattery({ level: b.level, charging: b.charging })
          update()
          b.addEventListener("levelchange", update)
          b.addEventListener("chargingchange", update)
        })
        .catch(() => setBattery(null))
    }

    // Cleanup listeners on unmount
    return () => {
      if (batteryRef) {
        try {
          const update = () => {}
          batteryRef.removeEventListener("levelchange", update)
          batteryRef.removeEventListener("chargingchange", update)
        } catch {}
      }
    }
  }, [])

  return (
    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
      <div className="rounded-lg border p-4 bg-card">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h4 className="font-medium">Your Location</h4>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {coords ? `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}` : (error ?? "Locating...")}
        </p>
      </div>

      <div className="rounded-lg border p-4 bg-card">
        <div className="flex items-center gap-2">
          <Battery className="h-4 w-4 text-primary" />
          <h4 className="font-medium">Battery Status</h4>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {battery ? `${Math.round(battery.level * 100)}% ${battery.charging ? "(charging)" : ""}` : "Not available"}
        </p>
      </div>
    </motion.div>
  )
}
