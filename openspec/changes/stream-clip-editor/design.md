## Context

面試 demo 專案，需在 2-4 天內完成可展示的版本。目標是展示：
- 即時串流處理能力（對應 Spot 的 LIVE 功能）
- AI 輔助剪輯工作流（對應 Spot 的 AI + Editor）
- Full-stack 整合能力（React + Python + Docker + ffmpeg）

開發環境：macOS Apple Silicon，可用 mlx_whisper 做本地推論。

## Goals / Non-Goals

**Goals:**
- 一鍵 `docker-compose up` 啟動完整系統
- 模擬直播串流 → 前端即時播放
- Near-realtime 轉錄（延遲 < 15 秒）
- AI 自動標記精彩片段 + 使用者可微調
- 一鍵剪輯輸出 mp4
- 程式碼乾淨、架構清楚，面試時能快速講解

**Non-Goals:**
- 不做多使用者/認證系統
- 不做真正的 production streaming（不處理多路串流）
- 不做影片上傳到雲端
- 不做 mobile responsive
- 不追求 Whisper 即時 streaming（chunked 即可）

## Decisions

### 1. Backend: FastAPI (Python)

**選擇**: FastAPI
**替代方案**: Node.js (Express)
**理由**:
- Spot JD 明確要求 Python backend
- mlx_whisper 直接 import，不需 subprocess
- FastAPI 原生支援 WebSocket + async
- 型別提示 + 自動 API docs 面試加分

### 2. 轉錄策略: Chunked near-realtime (每 10 秒)

**選擇**: 每 10 秒從串流抽一段音訊 → 送 Whisper → WebSocket 推前端
**替代方案**: 事後轉錄 / 真正 streaming ASR
**理由**:
- 事後轉錄不夠有說服力（不像即時產品）
- 真正 streaming ASR 需要特殊模型，開發時間不夠
- 10 秒 chunk 視覺上已經像即時，且可解釋延遲原因
- 帶前段 context 作為 initial_prompt 提升專有名詞準確度

### 3. 精彩片段偵測: 兩層架構

**選擇**: 第一層規則式（即時）+ 第二層 LLM（異步，透過本地 agent）
**替代方案**: 純規則式 / 純 LLM
**理由**:
- 純規則式太粗糙（「大聲」不一定精彩）
- 純 LLM 延遲高且要花 API 錢
- 兩層結合：規則式零延遲先標記候選，LLM 異步確認 + 分類
- LLM 層透過本地 Kiro agent 呼叫，零成本

### 4. Start/End 邊界: 音量波形驅動

**選擇**: 偵測音量上升起點 → start，音量回歸正常 → end
**替代方案**: 固定窗口（前 5 秒後 10 秒）
**理由**:
- 音量驅動切出來的片段更自然
- 展示信號處理能力（面試加分）
- 實作不複雜：ffmpeg loudness metadata 或 numpy 波形分析

### 5. 前端 Timeline: Canvas 自繪

**選擇**: 自訂 canvas timeline + AI 標記點 + 可拖動 in/out
**替代方案**: 簡單 slider / 第三方 video editor library
**理由**:
- 簡單 slider 視覺衝擊力不夠
- 第三方 library 太重且客製化困難
- Canvas 自繪可以精確控制：波形顯示、標記點、拖動互動
- 展示前端能力（Spot 要求 React + CSS 強）

### 6. 串流協議: RTMP → HLS

**選擇**: ffmpeg 推 RTMP 到 nginx-rtmp，自動轉 HLS 給前端
**替代方案**: 直接讀 mp4 / WebRTC
**理由**:
- RTMP + HLS 是業界標準（Spot JD 明確提到）
- nginx-rtmp 成熟穩定，Docker image 現成
- hls.js 前端播放簡單
- 面試可以解釋為什麼不直接讀 mp4（串流 vs 檔案的差異）

## Risks / Trade-offs

- **[Whisper 延遲]** mlx_whisper 處理 10 秒音訊約需 2-3 秒，總延遲 ~13 秒 → 可接受，面試時解釋 production 可用更小模型或 GPU
- **[音量偵測誤判]** 廣告、音樂也可能觸發 → 第二層 LLM 過濾；demo 用精選影片避免
- **[Docker 資源]** nginx-rtmp + FastAPI + Whisper 同時跑 → Apple Silicon 16GB 應該夠，必要時 Whisper 用 small model
- **[前端 Canvas 複雜度]** 自繪 timeline 可能花較多時間 → 先做基本版（標記點 + 拖動），波形顯示作為 nice-to-have
