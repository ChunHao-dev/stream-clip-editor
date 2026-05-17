import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Hls from 'hls.js'

interface Props {
  src: string
  onTimeUpdate: (time: number) => void
  onDuration: (duration: number) => void
}

export const Player = forwardRef<{ seek: (t: number) => void; seekToLive: () => void }, Props>(
  ({ src, onTimeUpdate, onDuration }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const [muted, setMuted] = useState(true)
    const lastTime = useRef(0)
    const lastDuration = useRef(0)

    useImperativeHandle(ref, () => ({
      seek: (t: number) => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(t, video.duration || 0)
      },
      seekToLive: () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = video.duration || 0
        video.play()
      },
    }))

    useEffect(() => {
      const video = videoRef.current!
      if (!Hls.isSupported()) { video.src = src; return }

      const hls = new Hls({ liveSyncDurationCount: 2 })
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play())
      hlsRef.current = hls

      // Throttled time/duration updates via interval instead of events
      const interval = setInterval(() => {
        const t = video.currentTime
        const d = video.duration
        if (Math.abs(t - lastTime.current) > 0.5) {
          lastTime.current = t
          onTimeUpdate(t)
        }
        if (d && Math.abs(d - lastDuration.current) > 1) {
          lastDuration.current = d
          onDuration(d)
        }
      }, 500)

      return () => { clearInterval(interval); hls.destroy() }
    }, [src])

    return (
      <div style={{ position: 'relative' }}>
        <video
          ref={videoRef}
          muted={muted}
          autoPlay
          style={{ width: '100%', borderRadius: 8, background: '#000' }}
        />
        <button
          onClick={() => { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted }}
          style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 16 }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    )
  }
)
