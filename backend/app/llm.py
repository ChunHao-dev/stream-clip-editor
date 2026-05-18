"""LLM-based highlight validation via Google Gemini API."""
import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

SYSTEM_PROMPT = """你是棒球轉播分析助手。判斷逐字稿是否在描述「當下正在發生的打擊/跑壘動作」。
只回答 JSON：{"is_live": true/false}

true 的例子：
- 「帶起來要形成安打在左半邊方向落地」（正在描述球的飛行）
- 「三壘上的跑者回來得分」（正在描述跑壘）
- 「穿出去形成安打」（正在描述擊球結果）

false 的例子：
- 「現在敲了11支安打」（統計數據）
- 「安打對手的打者設定都會在前球區」（分析策略）
- 「剛才那個安打真漂亮」（回顧）
- 「連續的三支安打讓富邦先馳得點」（總結）"""


async def validate_highlight(text: str, keywords: list[str]) -> bool:
    """Ask LLM if this is a live event. Returns True if live or on error."""
    if not API_KEY:
        return True

    prompt = f"逐字稿：「{text}」\n關鍵字：{keywords}\n這是正在發生的事件嗎？"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={
                "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 50},
            })
            resp.raise_for_status()
            content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(content[start:end])
                is_live = result.get("is_live", True)
                logger.info(f"LLM: is_live={is_live} | {text[:40]}")
                return is_live
    except Exception as e:
        logger.warning(f"LLM failed: {e}")
    return True
