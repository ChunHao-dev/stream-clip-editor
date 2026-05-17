## 1. Project Setup & Stream Ingest

- [ ] 1.1 Create project directory structure (frontend/, backend/, scripts/, docker/)
- [ ] 1.2 Create Docker Compose with nginx-rtmp service (ports 1935, 8080, HLS segment 2-4s)
- [ ] 1.3 Create nginx-rtmp config with HLS output
- [ ] 1.4 Create push-stream.sh script (ffmpeg -re to RTMP)
- [ ] 1.5 Verify: docker-compose up → push script → HLS playlist accessible

## 2. Backend Foundation

- [ ] 2.1 Init FastAPI project with pyproject.toml (dependencies: fastapi, uvicorn, websockets)
- [ ] 2.2 Create WebSocket endpoint at /ws for realtime events
- [ ] 2.3 Create POST /api/clips endpoint (accepts { start, end }, returns { clipId, downloadUrl })
- [ ] 2.4 Implement stream recording (ffmpeg continuous record to rolling mp4)
- [ ] 2.5 Implement ffmpeg clip extraction (input: recording file + start/end → output: mp4)
- [ ] 2.6 Serve clip files via static file route with Content-Disposition header
- [ ] 2.7 Add backend to Docker Compose

## 3. Realtime Transcription

- [ ] 3.1 Implement audio chunk extractor (ffmpeg extracts 10s WAV chunks from RTMP stream continuously)
- [ ] 3.2 Integrate mlx_whisper transcription with word-level timestamps
- [ ] 3.3 Add context passing (previous chunk transcript as initial_prompt)
- [ ] 3.4 Push transcript results via WebSocket ({ text, segments: [{ start, end, text }] })
- [ ] 3.5 Verify: stream playing → transcripts appearing via WebSocket within 15s

## 4. Highlight Detection

- [ ] 4.1 Implement volume analysis per audio chunk (compute peak/average loudness via numpy)
- [ ] 4.2 Implement volume spike detection (peak > 2x running average = spike)
- [ ] 4.3 Implement keyword scanner (configurable keyword list matched against transcript)
- [ ] 4.4 Implement two-layer scoring (both signals = high confidence, single = low)
- [ ] 4.5 Implement volume-driven boundary detection (scan back for rise, forward for return to baseline)
- [ ] 4.6 Push highlight events via WebSocket ({ start, end, confidence, reason, type })

## 5. Frontend: Player & Timeline

- [ ] 5.1 Init React + TypeScript project (Vite)
- [ ] 5.2 Implement HLS player component with hls.js
- [ ] 5.3 Implement canvas timeline component (playhead synced to player time)
- [ ] 5.4 Render highlight markers on timeline (red = high confidence, yellow = low)
- [ ] 5.5 Implement draggable in/out handles on timeline
- [ ] 5.6 Click highlight marker → set in/out to highlight boundaries

## 6. Frontend: Transcript & Export

- [ ] 6.1 Implement WebSocket client connecting to backend /ws
- [ ] 6.2 Implement transcript panel (appends text as chunks arrive)
- [ ] 6.3 Implement click-to-seek on transcript segments
- [ ] 6.4 Implement "Export Clip" button (POST to /api/clips, show download link)
- [ ] 6.5 Add frontend to Docker Compose (or dev proxy to backend)

## 7. Integration & Polish

- [ ] 7.1 End-to-end test: push stream → transcription → highlight detected → clip exported
- [ ] 7.2 Download a CPBL/sports highlight video for demo
- [ ] 7.3 Configure keyword list for demo video (球員名、得分用語)
- [ ] 7.4 Write README with setup instructions and architecture diagram
