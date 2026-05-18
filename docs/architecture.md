# Stream Clip Editor - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STREAMING PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     RTMP      ┌─────────────┐     HLS (.m3u8 + .ts)     ┌──────────┐
│  ffmpeg  │──────────────▶│ nginx-rtmp  │──────────────────────────▶│ Frontend │
│  推流     │  H.264 + AAC  │  (Docker)   │   HTTP polling segments   │ (hls.js) │
└──────────┘               └──────┬──────┘                           └──────────┘
                                  │
                                  │ RTMP (同一個串流，多個 consumer)
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │  錄影      │ │  音訊抽取  │ │           │
             │  stream   │ │  10s WAV  │ │  (未來可   │
             │  .flv     │ │  chunks   │ │  加更多)   │
             └─────┬─────┘ └─────┬─────┘ └───────────┘
                   │             │
                   │             ▼
                   │      ┌─────────────┐
                   │      │   Whisper   │
                   │      │  (mlx)      │
                   │      └─────┬───────┘
                   │            │ 逐字稿 + 時間戳
                   │            ▼
                   │      ┌─────────────┐
                   │      │  Highlight  │
                   │      │  Detection  │
                   │      └─────┬───────┘
                   │            │
                   │            ▼
                   │      ┌─────────────┐     WebSocket (JSON)      ┌──────────┐
                   │      │  Broadcast  │─────────────────────────▶│ Frontend │
                   │      └─────────────┘  transcript + highlight   └──────────┘
                   │
                   │  ← 使用者點擊 highlight
                   ▼
             ┌───────────┐     HTTP (mp4)       ┌──────────┐
             │  ffmpeg   │────────────────────▶│ Frontend │
             │  切片     │   POST /api/clips    │ <video>  │
             └───────────┘                      └──────────┘
```

## Video Delivery Methods

| 資料類型 | 傳遞方式 | 格式 | 說明 |
|----------|----------|------|------|
| 直播影片 | HLS over HTTP | .m3u8 + .ts | 前端 polling playlist，下載 segments 播放 |
| 即時資料 | WebSocket | JSON | 逐字稿、highlight 通知，server push |
| 剪輯片段 | HTTP download | .mp4 | 點擊 highlight 後 on-demand 產生 |

## Highlight Detection Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HIGHLIGHT DETECTION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Audio Extraction
────────────────────────
  RTMP Stream ──▶ ffmpeg -t 10s -vn -ar 16000 ──▶ chunk_0001.wav (10秒音訊)
                                                         │
Step 2: Transcription                                    │
─────────────────────                                    ▼
  chunk.wav ──▶ mlx_whisper (large-v3-turbo) ──▶ segments[]
                    │                                    │
                    │ initial_prompt: 棒球術語            │
                    │ condition_on_previous_text: False  │
                    │                                    │
                    ▼                                    ▼
              ┌──────────────────────────────────────────────┐
              │ segments = [                                 │
              │   { start: 45.2, end: 47.8, text: "安打" },   │
              │   { start: 47.8, end: 50.1, text: "落地" },   │
              │ ]                                            │
              └──────────────────────────────────────────────┘
                                    │
Step 3: Keyword Scan                │
────────────────────                ▼
  對每個 segment 檢查是否包含關鍵字：
  ["全壘打", "得分", "三振", "安打", "再見", "逆轉", "滿貫"]
                                    │
                          找到 "安打" │
                                    ▼
Step 4: LLM Validation (Gemini API)
────────────────────────────────────
  ┌─────────────────────────────────────────────────────┐
  │ System: 判斷是「正在發生」還是「回顧/討論」               │
  │ User: 逐字稿：「帶起來要形成安打在左半邊方向落地」          │
  │       關鍵字：['安打']                                │
  │                                                     │
  │ Response: {"is_live": true}                         │
  └─────────────────────────────────────────────────────┘
                                    │
                          is_live?  │
                         ┌──────────┴──────────┐
                         │                     │
                    true ▼                false ▼
              ┌──────────────┐          ┌──────────┐
              │ 標記 Highlight│          │  丟棄    │
              └──────┬───────┘          └──────────┘
                     │
Step 5: Boundary Calculation
────────────────────────────
  keyword 出現在 segment 的 start=45.2, end=47.8
  mid = (45.2 + 47.8) / 2 = 46.5
  highlight.start = 46.5 - 5 = 41.5s  ← 前 5 秒
  highlight.end   = 46.5 + 5 = 51.5s  ← 後 5 秒
                     │
Step 6: Broadcast    │
─────────────────    ▼
  WebSocket ──▶ Frontend
  {
    "type": "highlight",
    "start": 41.5,
    "end": 51.5,
    "confidence": "low",
    "reason": "Keywords: ['安打']"
  }
```

## Clip Export Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIP EXPORT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  使用者點擊 Highlight
         │
         ▼
  Frontend POST /api/clips { start: 41.5, end: 51.5 }
         │
         ▼
  Backend: ffmpeg -ss 41.5 -i stream.flv -t 10 -c:v libx264 -c:a aac clip.mp4
         │
         │  重新編碼（確保任意時間點都能正確切出影片）
         ▼
  Response: { clipId: "abc123", downloadUrl: "/api/clips/abc123/download" }
         │
         ▼
  Frontend: 切換到 <video src="/api/clips/abc123/download"> 播放預覽
         │
         │  播完或點 "LIVE"
         ▼
  Frontend: 切回 HLS 直播播放
```

## Time Synchronization

```
recording_start_time = time.time()     ← 錄影開始的 Unix timestamp

每個 chunk 開始錄時：
  offset = time.time() - recording_start_time

Whisper 回傳 segment.start = 3.2 (chunk 內相對時間)
實際時間 = offset + segment.start

這個時間同時對應：
  - 錄影檔 stream.flv 的第 N 秒（用於切片）
  - 前端 timeline 的位置（用於顯示）
```
