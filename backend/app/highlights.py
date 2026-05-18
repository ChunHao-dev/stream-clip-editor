import asyncio
import logging
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np

from .main import broadcast

logger = logging.getLogger(__name__)

RTMP_URL = "rtmp://localhost:1935/live/stream"
CHUNK_DURATION = 10
VOLUME_SPIKE_THRESHOLD = 2.0  # peak > 2x running average = spike

# Configurable keywords for highlight detection
KEYWORDS = ["全壘打", "得分", "三振", "安打", "再見", "逆轉", "滿貫", "goal", "score", "home run"]

# Running average of loudness
_loudness_history: deque = deque(maxlen=20)


def _analyze_volume(audio_path: str) -> dict:
    """Compute peak and average RMS loudness from a WAV file."""
    import wave
    with wave.open(audio_path, "rb") as wf:
        frames = wf.readframes(wf.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

    if len(samples) == 0:
        return {"peak": 0, "avg": 0, "spike": False}

    # Compute RMS in 0.5s windows
    window_size = 8000  # 0.5s at 16kHz
    rms_values = []
    for i in range(0, len(samples) - window_size, window_size):
        window = samples[i:i + window_size]
        rms_values.append(float(np.sqrt(np.mean(window ** 2))))

    if not rms_values:
        return {"peak": 0, "avg": 0, "spike": False}

    peak = max(rms_values)
    avg = float(np.mean(rms_values))

    # Compare to running average
    running_avg = float(np.mean(_loudness_history)) if _loudness_history else avg
    _loudness_history.append(avg)

    spike = peak > running_avg * VOLUME_SPIKE_THRESHOLD
    return {"peak": peak, "avg": avg, "running_avg": running_avg, "spike": spike}


def _find_boundaries(audio_path: str, spike_detected: bool) -> tuple[float, float]:
    """Find start/end boundaries based on volume rise/fall."""
    if not spike_detected:
        return (0, CHUNK_DURATION)

    import wave
    with wave.open(audio_path, "rb") as wf:
        frames = wf.readframes(wf.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

    window_size = 4000  # 0.25s windows
    rms_timeline = []
    for i in range(0, len(samples) - window_size, window_size):
        rms_timeline.append(float(np.sqrt(np.mean(samples[i:i + window_size] ** 2))))

    if not rms_timeline:
        return (0, CHUNK_DURATION)

    threshold = np.mean(rms_timeline) * 1.3
    # Find where volume rises above threshold (start)
    start_idx = 0
    for i, v in enumerate(rms_timeline):
        if v > threshold:
            start_idx = max(0, i - 2)
            break

    # Find where volume drops back (end)
    end_idx = len(rms_timeline) - 1
    for i in range(len(rms_timeline) - 1, start_idx, -1):
        if rms_timeline[i] > threshold:
            end_idx = min(len(rms_timeline) - 1, i + 2)
            break

    time_per_idx = 0.25  # seconds per window
    return (start_idx * time_per_idx, end_idx * time_per_idx)


def _check_keywords(transcript_text: str) -> list[str]:
    """Check transcript for highlight keywords."""
    found = [kw for kw in KEYWORDS if kw in transcript_text]
    return found


HIGHLIGHT_PADDING = 5  # seconds before and after keyword


async def analyze_chunk(audio_path: str, offset: float, transcript_text: str, segments: list[dict]) -> None:
    """Analyze a chunk for highlights and broadcast if found."""
    loop = asyncio.get_event_loop()
    volume = await loop.run_in_executor(None, _analyze_volume, audio_path)

    # Check each segment for keywords with precise timing
    for seg in segments:
        keywords = _check_keywords(seg["text"])
        if not keywords and not volume["spike"]:
            continue
        if not keywords:
            continue  # volume spike alone not enough for now

        # Use segment's precise time (already includes offset from transcribe.py)
        seg_mid = (seg["start"] + seg["end"]) / 2
        start = round(max(0, seg_mid - HIGHLIGHT_PADDING), 2)
        end = round(seg_mid + HIGHLIGHT_PADDING, 2)

        # Validate with LLM if this is a live event
        from .llm import validate_highlight
        is_live = await validate_highlight(seg["text"], keywords)
        if not is_live:
            logger.info(f"  → Filtered out (not live event)")
            continue

        if volume["spike"] and keywords:
            confidence = "high"
            reason = f"Volume spike + keywords: {', '.join(keywords)}"
        else:
            confidence = "low"
            reason = f"Keywords: {', '.join(keywords)}"

        logger.info(f"Highlight @ {seg['start']:.1f}-{seg['end']:.1f}s | keywords={keywords} | clip={start}-{end}s")

        event = {
            "type": "highlight",
            "start": start,
            "end": end,
            "confidence": confidence,
            "reason": reason,
        }
        await broadcast(event)
