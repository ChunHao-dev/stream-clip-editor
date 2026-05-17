import asyncio
import json
import subprocess
import time
import uuid
from pathlib import Path
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MEDIA_DIR = Path("/tmp/stream-clips")
RECORD_DIR = Path("/tmp/stream-record")
MEDIA_DIR.mkdir(exist_ok=True)
RECORD_DIR.mkdir(exist_ok=True)

# WebSocket connection manager
clients: Set[WebSocket] = set()
history: list[dict] = []


async def broadcast(event: dict):
    history.append(event)
    msg = json.dumps(event)
    for ws in list(clients):
        try:
            await ws.send_text(msg)
        except Exception:
            clients.discard(ws)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    # Send history to new client
    for event in history:
        await ws.send_text(json.dumps(event))
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)


# Clip API
class ClipRequest(BaseModel):
    start: float
    end: float


@app.post("/api/clips")
async def create_clip(req: ClipRequest):
    if req.start >= req.end or req.start < 0:
        return {"error": "Invalid time range"}, 400

    clip_id = str(uuid.uuid4())[:8]
    output = MEDIA_DIR / f"{clip_id}.mp4"
    recording = RECORD_DIR / "stream.mp4"

    if not recording.exists():
        return {"error": "No recording available"}, 404

    duration = req.end - req.start
    cmd = [
        "ffmpeg", "-y", "-ss", str(req.start), "-i", str(recording),
        "-t", str(duration), "-c:v", "libx264", "-preset", "ultrafast",
        "-c:a", "aac", "-movflags", "+faststart",
        str(output)
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    await proc.wait()

    if proc.returncode != 0 or not output.exists():
        return {"error": "Clip extraction failed"}, 500

    return {"clipId": clip_id, "downloadUrl": f"/api/clips/{clip_id}/download"}


@app.get("/api/clips/{clip_id}/download")
async def download_clip(clip_id: str):
    path = MEDIA_DIR / f"{clip_id}.mp4"
    if not path.exists():
        return {"error": "Clip not found"}, 404
    return FileResponse(path, media_type="video/mp4", filename=f"clip-{clip_id}.mp4")


# Stream recording process
recording_process: asyncio.subprocess.Process | None = None
recording_start_time: float = 0


async def start_recording():
    global recording_process, recording_start_time
    RECORD_DIR.mkdir(exist_ok=True)
    output = RECORD_DIR / "stream.mp4"
    cmd = [
        "ffmpeg", "-y", "-i", "rtmp://localhost:1935/live/stream",
        "-c", "copy", "-movflags", "+frag_keyframe+empty_moov",
        str(output)
    ]
    recording_process = await asyncio.create_subprocess_exec(
        *cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    recording_start_time = time.time()


async def stop_recording():
    global recording_process
    if recording_process:
        recording_process.terminate()
        await recording_process.wait()
        recording_process = None


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(start_recording())
    from .transcribe import transcription_loop
    asyncio.create_task(transcription_loop())


@app.on_event("shutdown")
async def on_shutdown():
    await stop_recording()
