import { useEffect, useRef, useState } from 'react'
import { Player } from './components/Player'
import { Timeline } from './components/Timeline'
import { Transcript } from './components/Transcript'
import { HighlightList } from './components/HighlightList'

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Highlight {
  start: number
  end: number
  confidence: 'high' | 'low'
  reason: string
}

function App() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [isLive, setIsLive] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const playerRef = useRef<{ seek: (t: number) => void; seekToLive: () => void }>(null)

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      ws = new WebSocket(`ws://${window.location.hostname}:8000/ws`)
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'transcript') {
          setSegments((prev) => [...prev, ...data.segments])
          if (data.segments.length > 0) {
            const lastSeg = data.segments[data.segments.length - 1]
            setCurrentTime(lastSeg.end)
          }
        } else if (data.type === 'highlight') {
          setHighlights((prev) => [...prev, data])
        }
      }
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => { ws?.close(); clearTimeout(reconnectTimer) }
  }, [])

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time)
    setIsLive(false)
  }

  const handleBackToLive = () => {
    setPreviewUrl(null)
    setIsLive(true)
    playerRef.current?.seekToLive()
  }

  const handleHighlightSelect = async (h: Highlight) => {
    setInPoint(h.start)
    setOutPoint(h.end)
    setIsLive(false)
    // Fetch clip from backend recording
    const res = await fetch(`http://${window.location.hostname}:8000/api/clips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: Math.max(0, h.start - 2), end: h.end + 2 }),
    })
    const data = await res.json()
    if (data.downloadUrl) {
      setPreviewUrl(`http://${window.location.hostname}:8000${data.downloadUrl}`)
    }
  }

  const handleExport = async () => {
    if (inPoint === null || outPoint === null) return
    setExporting(true)
    setClipUrl(null)
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/api/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: inPoint, end: outPoint }),
      })
      const data = await res.json()
      if (data.downloadUrl) {
        setClipUrl(`http://${window.location.hostname}:8000${data.downloadUrl}`)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ background: '#0a0a0f', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0, color: '#fff' }}>Stream Clip Editor</h1>
        {isLive && <span style={{ fontSize: 11, background: '#dc2626', padding: '2px 8px', borderRadius: 4 }}>● LIVE</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left: Player + Timeline */}
        <div>
          {previewUrl ? (
            <div>
              <video
                src={previewUrl}
                controls
                autoPlay
                style={{ width: '100%', borderRadius: 8, background: '#000' }}
                onEnded={handleBackToLive}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                Preview: {inPoint?.toFixed(1)}s → {outPoint?.toFixed(1)}s
              </div>
            </div>
          ) : (
            <Player
              ref={playerRef}
              src="/hls/stream.m3u8"
              onTimeUpdate={() => {}}
              onDuration={() => {}}
            />
          )}
          <Timeline
            currentTime={currentTime}
            duration={duration}
            highlights={highlights}
            inPoint={inPoint}
            outPoint={outPoint}
            onInChange={setInPoint}
            onOutChange={setOutPoint}
            onSeek={handleSeek}
            onHighlightClick={handleHighlightSelect}
          />
          {/* Export bar */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleExport}
              disabled={inPoint === null || outPoint === null || exporting}
              style={{ padding: '8px 16px', background: inPoint !== null && outPoint !== null ? '#4f46e5' : '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              {exporting ? 'Exporting...' : 'Export Clip'}
            </button>
            {inPoint !== null && outPoint !== null && (
              <span style={{ fontSize: 13, color: '#888' }}>
                {inPoint.toFixed(1)}s → {outPoint.toFixed(1)}s ({(outPoint - inPoint).toFixed(1)}s)
              </span>
            )}
            {clipUrl && (
              <a href={clipUrl} download style={{ color: '#60a5fa', fontSize: 13 }}>⬇ Download clip</a>
            )}
          </div>
        </div>
        {/* Right: Highlights + Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 80px)' }}>
          <HighlightList
            highlights={highlights}
            onSelect={handleHighlightSelect}
            onBackToLive={handleBackToLive}
            isLive={isLive}
          />
          <div style={{ flex: 1, minHeight: 0 }}>
            <Transcript
              segments={segments}
              currentTime={currentTime}
              onSegmentClick={(s) => handleSeek(s.start)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
