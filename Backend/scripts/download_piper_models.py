"""Script to download official Piper TTS voice models for Hindi and English.

Models downloaded from rhasspy/piper-voices on Hugging Face:
- Hindi: hi_IN-pratham-medium (ONNX + JSON)
- English: en_US-lessac-medium (ONNX + JSON)
"""

import sys
from pathlib import Path
import httpx

MODELS = {
    "hi_IN-pratham-medium": {
        "onnx": "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx",
        "json": "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json",
    },
    "en_US-lessac-medium": {
        "onnx": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        "json": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
    },
}


def download_file(url: str, dest_path: Path) -> None:
    if dest_path.exists() and dest_path.stat().st_size > 0:
        print(f"Already exists: {dest_path.name} ({dest_path.stat().st_size / 1024 / 1024:.2f} MB)")
        return

    print(f"Downloading {dest_path.name} from {url}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
    with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as response:
        response.raise_for_status()
        with open(temp_path, "wb") as f:
            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)
    temp_path.rename(dest_path)
    print(f"Downloaded: {dest_path.name} ({dest_path.stat().st_size / 1024 / 1024:.2f} MB)")


def main():
    target_dir = Path(__file__).resolve().parent.parent / "models" / "piper"
    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"Saving Piper models to: {target_dir}")

    for voice_name, urls in MODELS.items():
        print(f"\nProcessing voice: {voice_name}")
        onnx_file = target_dir / f"{voice_name}.onnx"
        json_file = target_dir / f"{voice_name}.onnx.json"
        download_file(urls["onnx"], onnx_file)
        download_file(urls["json"], json_file)

    print("\nAll Piper models downloaded successfully!")


if __name__ == "__main__":
    main()
