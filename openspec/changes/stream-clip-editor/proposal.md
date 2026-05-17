## Why

Spot（媒體/體育 AI 新創）的 Full-stack Engineer 面試需要一個 demo 專案，展示即時串流影片剪輯的完整流程：從串流接收 → AI 偵測精彩片段 → 自動/手動剪輯。這直接對應 Spot 產品的核心功能（LIVE + Editor + AI）。

## What Changes

- 建立完整的即時串流影片剪輯系統
- Docker Compose 一鍵啟動 nginx-rtmp 串流 server + FastAPI backend
- ffmpeg 模擬直播推流
- React + hls.js 前端播放串流
- Chunked near-realtime Whisper 轉錄（每 10 秒一批，帶 context 提升準確度）
- 音量突變偵測（歡呼聲辨識）
- 兩層精彩片段判斷：規則式即時篩選 + LLM 精準分類（透過本地 agent 免 API 費用）
- 音量波形驅動的 start/end 邊界自動計算
- Canvas timeline UI 顯示 AI 標記點，使用者可微調 in/out
- WebSocket 即時推送轉錄結果與標記到前端
- 後端 ffmpeg 切片輸出 mp4

## Capabilities

### New Capabilities
- `stream-ingest`: nginx-rtmp 串流接收 + HLS 轉換 + ffmpeg 模擬推流
- `realtime-transcription`: Chunked Whisper 轉錄 pipeline（每 10s chunk、帶前段 context、WebSocket 推送）
- `highlight-detection`: 兩層精彩片段偵測（規則式關鍵字/音量 + LLM 判斷）+ 音量驅動 start/end 邊界
- `clip-editor-ui`: React canvas timeline + hls.js 播放 + 逐字稿顯示 + AI 標記微調 + 剪輯請求
- `clip-export`: 後端 ffmpeg 根據時間戳切片輸出 mp4

### Modified Capabilities

## Impact

- 新專案，無既有程式碼影響
- 依賴：Docker、ffmpeg、nginx-rtmp、Python (FastAPI)、mlx_whisper、React、hls.js
- 需要本地 Apple Silicon 跑 mlx_whisper
- 需要一段體育影片素材（CPBL 精華或類似）作為測試用
