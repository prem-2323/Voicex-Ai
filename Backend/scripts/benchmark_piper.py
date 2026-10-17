"""Repeatable benchmark script for Piper TTS performance measurement.

Measures:
- Cold-start model initialization time
- Warm audio generation time (short vs long sentence)
- Generated audio duration
- Real-Time Factor (RTF = synthesis_time / audio_duration)
"""

import time
import wave
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.services.piper_tts import (
    _model_cache,
    get_piper_models_dir,
    get_piper_voice,
    synthesize_piper_to_file,
)


def run_benchmark():
    settings = get_settings()
    print("=" * 60)
    print("VoiceX AI — Piper TTS Performance Benchmark (CPU)")
    print("=" * 60)

    hindi_model = settings.piper_hindi_model
    english_model = settings.piper_english_model

    # 1. Cold start measurements
    _model_cache.clear()
    t0 = time.perf_counter()
    v_hi = get_piper_voice(hindi_model)
    hi_cold_load = time.perf_counter() - t0
    print(f"\n[Cold Start] Hindi model ({hindi_model}): {hi_cold_load:.3f} s")

    t0 = time.perf_counter()
    v_en = get_piper_voice(english_model)
    en_cold_load = time.perf_counter() - t0
    print(f"[Cold Start] English model ({english_model}): {en_cold_load:.3f} s")

    # 2. Warm measurements
    test_cases = [
        (
            "Hindi Short",
            "नमस्ते, मैं आपकी क्या सहायता कर सकता हूँ?",
            "hi_IN-pratham-medium",
        ),
        (
            "Hindi Long",
            "वॉयसएक्स एआई एक आधुनिक बहुभाषी वॉयस असिस्टेंट है जो आपके कंप्यूटर पर पूरी तरह से काम करता है और आपकी भाषा में तुरंत उत्तर देता है।",
            "hi_IN-pratham-medium",
        ),
        (
            "English Short",
            "Hello! How can I help you today?",
            "en_US-lessac-medium",
        ),
        (
            "English Long",
            "VoiceX AI is a real-time multilingual voice assistant powered by local speech models and lightweight neural synthesis running entirely on CPU.",
            "en_US-lessac-medium",
        ),
    ]

    print("\n" + "-" * 75)
    print(f"{'Test Case':<15} | {'Length':<8} | {'Synth Time':<12} | {'Audio Dur':<10} | {'RTF':<8}")
    print("-" * 75)

    results = []
    for label, text, voice in test_cases:
        # Measure warm synthesis time
        t_start = time.perf_counter()
        wav_path = synthesize_piper_to_file(text, voice)
        synth_time = time.perf_counter() - t_start

        # Measure audio duration
        with wave.open(str(wav_path), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration = frames / rate

        rtf = synth_time / duration if duration > 0 else 0
        wav_path.unlink(missing_ok=True)

        print(f"{label:<15} | {len(text):<8} | {synth_time*1000:>7.1f} ms   | {duration:>6.2f} s   | {rtf:>6.3f}x")
        results.append({
            "label": label,
            "text": text,
            "char_count": len(text),
            "synth_ms": round(synth_time * 1000, 1),
            "audio_dur_s": round(duration, 2),
            "rtf": round(rtf, 3),
        })

    print("-" * 75)
    return {
        "cold_load_hi_s": round(hi_cold_load, 3),
        "cold_load_en_s": round(en_cold_load, 3),
        "cases": results,
    }


if __name__ == "__main__":
    run_benchmark()
