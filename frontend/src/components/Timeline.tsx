import { useEffect, useRef, useState } from 'react'
import type { Highlight } from '../App'

interface Props {
  currentTime: number
  duration: number
  highlights: Highlight[]
  inPoint: number | null
  outPoint: number | null
  onInChange: (t: number | null) => void
  onOutChange: (t: number | null) => void
  onSeek: (t: number) => void
  onHighlightClick: (h: Highlight) => void
}

const HEIGHT = 80
const HANDLE_W = 8

export function Timeline({ currentTime, duration, highlights, inPoint, outPoint, onInChange, onOutChange, onSeek, onHighlightClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null)
  const rafRef = useRef<number>(0)
  const propsRef = useRef({ currentTime, duration, highlights, inPoint, outPoint })
  propsRef.current = { currentTime, duration, highlights, inPoint, outPoint }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const draw = () => {
      const { currentTime, duration, highlights, inPoint, outPoint } = propsRef.current
      // Use max time from highlights/currentTime, not HLS duration (which is only a 60s window)
      const maxHighlight = highlights.length > 0 ? Math.max(...highlights.map(h => h.end)) : 0
      const effectiveDuration = Math.max(maxHighlight, currentTime + 30, 60)
      const w = container.clientWidth
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== HEIGHT) canvas.height = HEIGHT
      const ctx = canvas.getContext('2d')!
      const h = HEIGHT

      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)

      // Selected region
      if (inPoint !== null && outPoint !== null) {
        const x1 = (inPoint / effectiveDuration) * w
        const x2 = (outPoint / effectiveDuration) * w
        ctx.fillStyle = 'rgba(79, 70, 229, 0.2)'
        ctx.fillRect(x1, 0, x2 - x1, h)
        ctx.fillStyle = '#4f46e5'
        ctx.fillRect(x1 - HANDLE_W / 2, 0, HANDLE_W, h)
        ctx.fillRect(x2 - HANDLE_W / 2, 0, HANDLE_W, h)
      }

      // Playhead
      const px = (currentTime / effectiveDuration) * w
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - 1, 0, 2, h)

      // Time labels
      ctx.fillStyle = '#666'
      ctx.font = '11px system-ui'
      const step = effectiveDuration > 300 ? 60 : effectiveDuration > 60 ? 30 : 10
      for (let t = 0; t <= effectiveDuration; t += step) {
        const x = (t / effectiveDuration) * w
        ctx.fillText(formatTime(t), x + 2, h - 4)
        ctx.fillRect(x, h - 14, 1, 4)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const getTimeFromX = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const { highlights, currentTime } = propsRef.current
    const maxHighlight = highlights.length > 0 ? Math.max(...highlights.map(h => h.end)) : 0
    const effectiveDuration = Math.max(maxHighlight, currentTime + 30, 60)
    return (x / rect.width) * effectiveDuration
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const t = getTimeFromX(e.clientX)
    const { inPoint, outPoint, highlights, currentTime } = propsRef.current
    const maxHighlight = highlights.length > 0 ? Math.max(...highlights.map(h => h.end)) : 0
    const effectiveDuration = Math.max(maxHighlight, currentTime + 30, 60)
    if (inPoint !== null && Math.abs(t - inPoint) < effectiveDuration * 0.015) {
      setDragging('in')
    } else if (outPoint !== null && Math.abs(t - outPoint) < effectiveDuration * 0.015) {
      setDragging('out')
    } else {
      const clicked = propsRef.current.highlights.find(h => t >= h.start && t <= h.end)
      if (clicked) {
        onHighlightClick(clicked)
      } else {
        onSeek(t)
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const t = getTimeFromX(e.clientX)
    if (dragging === 'in') onInChange(t)
    else onOutChange(t)
  }

  const handleMouseUp = () => setDragging(null)

  return (
    <div
      ref={containerRef}
      style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', cursor: dragging ? 'col-resize' : 'pointer' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: HEIGHT }} />
    </div>
  )
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
