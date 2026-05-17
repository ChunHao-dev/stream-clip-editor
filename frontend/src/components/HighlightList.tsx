import type { Highlight } from '../App'

interface Props {
  highlights: Highlight[]
  onSelect: (h: Highlight) => void
  onBackToLive: () => void
  isLive: boolean
}

export function HighlightList({ highlights, onSelect, onBackToLive, isLive }: Props) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 16,
      maxHeight: 300,
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, margin: 0, color: '#888' }}>Highlights ({highlights.length})</h2>
        {!isLive && (
          <button
            onClick={onBackToLive}
            style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
          >
            ● LIVE
          </button>
        )}
      </div>
      {highlights.length === 0 && (
        <p style={{ color: '#555', fontSize: 13 }}>No highlights detected yet...</p>
      )}
      {highlights.map((h, i) => (
        <div
          key={i}
          onClick={() => onSelect(h)}
          style={{
            padding: '8px 10px',
            marginBottom: 6,
            borderRadius: 6,
            cursor: 'pointer',
            background: h.confidence === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.08)',
            borderLeft: `3px solid ${h.confidence === 'high' ? '#ef4444' : '#eab308'}`,
          }}
        >
          <div style={{ fontSize: 13, color: '#e0e0e0' }}>{h.reason}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
            {formatTime(h.start)} → {formatTime(h.end)}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
