"use client"
import { useEffect, useRef } from "react"

export default function AnimatedHeroBg() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext("2d")!
    let raf = 0

    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.floor(width * DPR)
      canvas.height = Math.floor(height * DPR)
    }
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0008,
      vy: (Math.random() - 0.5) * 0.0008,
    }))

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      // background wash
      ctx.fillStyle = "rgba(16,16,18,0.5)"
      ctx.fillRect(0, 0, w, h)

      // pointer influence
      const px = pointer.current.x * w
      const py = pointer.current.y * h

      particles.forEach((p) => {
        // simple flow + pointer repel
        const dx = p.x * w - px
        const dy = p.y * h - py
        const dist = Math.max(1, Math.hypot(dx, dy))
        const repel = Math.min(0.002, 60 / (dist * dist))
        p.vx += (dx / dist) * repel
        p.vy += (dy / dist) * repel

        p.x += p.vx
        p.y += p.vy

        // wrap
        if (p.x < 0) p.x += 1
        if (p.x > 1) p.x -= 1
        if (p.y < 0) p.y += 1
        if (p.y > 1) p.y -= 1

        // render node
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, 2.5 * DPR, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(56,189,248,0.9)" // brand accent (cyan)
        ctx.fill()
      })

      // lightweight connecting lines
      ctx.strokeStyle = "rgba(56,189,248,0.18)"
      ctx.lineWidth = 1 * DPR
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < i + 10 && j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = (a.x - b.x) * w
          const dy = (a.y - b.y) * h
          const d2 = dx * dx + dy * dy
          if (d2 < 14000) {
            ctx.beginPath()
            ctx.moveTo(a.x * w, a.y * h)
            ctx.lineTo(b.x * w, b.y * h)
            ctx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.current.x = (e.clientX - rect.left) / rect.width
      pointer.current.y = (e.clientY - rect.top) / rect.height
    }

    resize()
    draw()
    window.addEventListener("resize", resize)
    canvas.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("pointermove", onMove)
    }
  }, [])

  return (
    <div className="h-[60dvh] md:h-full w-full">
      <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
    </div>
  )
}
