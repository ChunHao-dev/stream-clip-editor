# Stream Clip Editor

Real-time stream clip editor with AI-powered highlight detection. Automatically identifies key moments in live sports broadcasts using speech transcription and LLM validation, then allows instant clip extraction.

## Demo

[![Demo Video](https://img.youtube.com/vi/CRi36K2KRGs/maxresdefault.jpg)](https://youtu.be/CRi36K2KRGs)

## Architecture

```
┌──────────┐     RTMP      ┌─────────────┐     HLS (.m3u8 + .ts)     ┌──────────┐
│  ffmpeg  │──────────────▶│ nginx-rtmp  │──────────────────────────▶│ Frontend │
│  source  │  H.264 + AAC  │  (Docker)   │   HTTP polling segments   │ (hls.js) │
└──────────┘               └──────┬──────┘                           └──────────┘
                                  │
                                  │ RTMP (multiple consumers)
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │ Recording │ │   Audio   │ │  (future  │
             │  .flv     │ │  10s WAV  │ │ consumers)│
             └─────┬─────┘ └─────┬─────┘ └───────────┘
                   │             │
                   │             ▼
                   │      ┌─────────────┐
                   │      │   Whisper   │
                   │      │ (mlx-local) │
                   │      └─────┬───────┘
                   │            │
                   │            ▼
                   │      ┌─────────────┐
                   │      │  Highlight  │──▶ LLM validation (Gemini)
                   │      │  Detection  │
                   │      └─────┬───────┘
                   │            │
                   │            ▼
                   │      ┌─────────────┐     WebSocket (JSON)      ┌──────────┐
                   │      │  Broadcast  │─────────────────────────▶│ Frontend │
                   │      └─────────────┘                           └──────────┘
                   │
                   ▼
             ┌───────────┐     HTTP (mp4)       ┌──────────┐
             │  Clip     │────────────────────▶│ Frontend │
             │  Extract  │   on-demand          │ preview  │
             └───────────┘                      └──────────┘
```

## Data Flow

| Data Type | Transport | Format | Description |
|-----------|-----------|--------|-------------|
| Live video | HLS over HTTP | .m3u8 + .ts | Frontend polls playlist, downloads segments |
| Real-time data | WebSocket | JSON | Transcripts + highlight notifications, server push |
| Clip export | HTTP download | .mp4 | Generated on-demand when user clicks highlight |

## Highlight Detection Pipeline

```
Audio chunk (10s) → Whisper transcription → Keyword scan → LLM validation → Broadcast
```

1. **Audio extraction**: ffmpeg records 10s WAV chunks from RTMP stream
2. **Transcription**: mlx_whisper with baseball terminology prompt, anti-hallucination settings
3. **Keyword scan**: Check each segment for configured keywords (安打, 得分, 三振, etc.)
4. **LLM validation**: Ask Gemini if the keyword refers to a live event or just discussion/recap
5. **Boundary calculation**: Center the keyword timestamp ±5 seconds
6. **Broadcast**: Push highlight event to all connected frontends via WebSocket

## Clip Export Flow

```
User clicks highlight → POST /api/clips {start, end}
                      → ffmpeg extracts from .flv recording
                      → re-encodes to .mp4
                      → returns download URL
                      → frontend plays preview
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite + hls.js
- **Backend**: Python (FastAPI) + WebSocket
- **Transcription**: mlx_whisper (Apple Silicon, local)
- **LLM**: Google Gemini API (highlight validation)
- **Streaming**: nginx-rtmp (Docker) → HLS
- **Video processing**: ffmpeg

## Quick Start

```bash
# 1. Start RTMP server
docker-compose up -d

# 2. Push stream (simulated live)
./scripts/push-stream.sh

# 3. Start backend (requires Apple Silicon for mlx_whisper)
cd backend
cp .env.example .env  # fill in GEMINI_API_KEY
uv run uvicorn app.main:app --port 8000

# 4. Start frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Time Synchronization

```
recording_start_time = time.time()     ← when recording starts

For each audio chunk:
  offset = time.time() - recording_start_time

Whisper returns segment.start (relative to chunk)
Absolute time = offset + segment.start

This timestamp maps to:
  - Position in stream.flv (for clip extraction)
  - Timeline position in frontend (for display)
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Streaming protocol | RTMP → HLS | Industry standard, CDN-friendly, browser compatible |
| Transcription | Chunked 10s (near-realtime) | Balance between latency and accuracy |
| Recording format | .flv | Native RTMP container, reliable video+audio capture |
| Clip extraction | Re-encode (not copy) | Ensures video at any seek position regardless of keyframes |
| Highlight validation | LLM (Gemini) | Distinguishes live events from discussion/recap |
| Frontend time source | WebSocket (not HLS) | HLS only has 60s window; WebSocket has full history |
