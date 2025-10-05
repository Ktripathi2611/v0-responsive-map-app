"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export type ElevationPoint = { d: number; elev: number }

export function ElevationChart({ data }: { data: ElevationPoint[] }) {
  if (!data?.length) return null
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis dataKey="d" tickFormatter={(v) => `${Math.round(v)} km`} stroke="hsl(var(--muted-foreground))" />
          <YAxis tickFormatter={(v) => `${Math.round(v)} m`} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            formatter={(value) => [`${Math.round(Number(value))} m`, "Elevation"]}
            labelFormatter={(label) => `${Math.round(Number(label))} km`}
          />
          <Line type="monotone" dataKey="elev" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
