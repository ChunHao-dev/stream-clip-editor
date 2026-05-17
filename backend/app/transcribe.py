import asyncio
import logging
import subprocess
import tempfile
import time
from pathlib import Path

import mlx_whisper

from .main import broadcast

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

CHUNK_DURATION = 10
RTMP_URL = "rtmp://localhost:1935/live/stream"
MODEL = "mlx-community/whisper-large-v3-turbo"

_prev_text = ""


BASEBALL_PROMPT = "棒球轉播：安打、三振、全壘打、得分、再見、逆轉、滿貫、盜壘、觸身球、保送、雙殺"


def _transcribe_sync(audio_path: str, offset: float) -> dict | None:
    global _prev_text
    prompt = BASEBALL_PROMPT
    if _prev_text:
        prompt = _prev_text[-200:] + " " + BASEBALL_PROMPT
    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=MODEL,
        word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt=prompt,
        language="zh",
    )
    text = result.get("text", "").strip()
    if not text:
        return None

    _prev_text = text
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": round(seg["start"] + offset, 2),
            "end": round(seg["end"] + offset, 2),
            "text": seg["text"].strip(),
        })

    return {"type": "transcript", "text": text, "segments": segments}


async def transcription_loop():
    """Extract 10s audio chunks sequentially and transcribe."""
    tmp_dir = Path("/tmp/whisper_chunks")
    tmp_dir.mkdir(exist_ok=True)
    chunk_index = 0

    # Wait for stream to stabilize
    await asyncio.sleep(8)
    from .main import recording_start_time
    logger.info("Transcription loop started")

    while True:
        chunk_path = tmp_dir / f"chunk_{chunk_index:04d}.wav"
        record_start = time.time()
        offset = record_start - recording_start_time

        # Record exactly CHUNK_DURATION seconds from the live stream
        cmd = [
            "ffmpeg", "-y",
            "-i", RTMP_URL,
            "-t", str(CHUNK_DURATION),
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(chunk_path)
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        await proc.wait()

        if not chunk_path.exists() or chunk_path.stat().st_size < 1000:
            logger.warning(f"Chunk {chunk_index} failed or too small, retrying...")
            await asyncio.sleep(2)
            continue

        logger.info(f"Transcribing chunk {chunk_index} (offset={offset}s, size={chunk_path.stat().st_size})")

        # Transcribe in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, _transcribe_sync, str(chunk_path), offset
        )

        if result:
            logger.info(f"Transcript: {result['text'][:60]}...")
            await broadcast(result)
            # Run highlight detection on same chunk
            from .highlights import analyze_chunk
            await analyze_chunk(str(chunk_path), offset, result["text"])

        # chunk_path.unlink(missing_ok=True)  # keep for debugging
        chunk_index += 1
