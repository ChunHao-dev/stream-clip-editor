import { useEffect, useRef } from 'react'
import type { Segment } from '../App'

interface Props {
  segments: Segment[]
  currentTime: number
  onSegmentClick: (s: Segment) => void
}

export function Transcript({ segments, currentTime, onSegmentClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments.length])

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 16,
      height: '100%',
      overflowY: 'auto',
    }}>
      <h2 style={{ fontSize: 14, margin: '0 0 12px', color: '#888' }}>Transcript</h2>
      {segments.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>Waiting for transcription...</p>
      )}
      {segments.map((seg, i) => {
        const active = currentTime >= seg.start && currentTime <= seg.end
        return (
          <span
            key={i}
            onClick={() => onSegmentClick(seg)}
            style={{
              display: 'inline',
              cursor: 'pointer',
              padding: '2px 0',
              background: active ? 'rgba(79, 70, 229, 0.3)' : 'transparent',
              borderRadius: 3,
              fontSize: 14,
              lineHeight: 1.8,
              transition: 'background 0.2s',
            }}
          >
            {seg.text}
          </span>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
