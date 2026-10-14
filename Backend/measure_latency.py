"""Phase 6 Step 3: measure per-stage latency of the voice pipeline.

Runs the live chain (STT -> chat -> TTS) against local services and
prints timings. Requires Ollama running and internet for Edge-TTS.
Usage: .venv/Scripts/python.exe measure_latency.py
"""

import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def main() -> None:
    with open("voice-test.wav", "rb") as f:
        audio_bytes = f.read()

    t0 = time.perf_counter()
    stt = client.post(
        "/api/transcribe",
        files={"file": ("voice-test.wav", audio_bytes, "audio/wav")},
    )
    stt_ms = (time.perf_counter() - t0) * 1000.0
    assert stt.status_code == 200, stt.text
    transcript = stt.json()["text"]

    t0 = time.perf_counter()
    chat = client.post("/api/chat", json={"message": transcript})
    llm_ms = (time.perf_counter() - t0) * 1000.0
    assert chat.status_code == 200, chat.text
    answer = chat.json()["response"]

    t0 = time.perf_counter()
    tts = client.post(
        "/api/tts",
        json={"text": answer[:500], "voice": "en-US-AriaNeural"},
    )
    tts_ms = (time.perf_counter() - t0) * 1000.0
    assert tts.status_code == 200, tts.text[:200]

    total_ms = stt_ms + llm_ms + tts_ms
    print(f"STT        : {stt_ms:8.0f} ms  (transcript: {transcript!r})")
    print(f"LLM (Qwen) : {llm_ms:8.0f} ms  ({len(answer)} chars)")
    print(
        f"TTS        : {tts_ms:8.0f} ms  "
        f"({len(tts.content)} bytes audio/mpeg)"
    )
    print(f"TOTAL      : {total_ms:8.0f} ms  (recording done -> audio ready)")


if __name__ == "__main__":
    main()
