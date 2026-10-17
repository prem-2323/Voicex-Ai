"""GPU and CUDA device detection, configuration, and fallback management.

Provides automatic detection for NVIDIA GPUs, registers NVIDIA CUDA/cuBLAS/cuDNN
runtime DLLs on Windows (including Ollama and site-packages locations), and
safely configures execution devices for STT and TTS.
"""

import ctypes
import logging
import os
import platform
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_dll_directories_added = False


def setup_cuda_dll_paths() -> list[str]:
    """Register NVIDIA CUDA and cuDNN runtime DLL directories on Windows.

    Python 3.8+ on Windows does not automatically load DLLs from PATH or
    site-packages when C-extensions (like ctranslate2 or onnxruntime) invoke
    LoadLibraryEx without os.add_dll_directory or ctypes preload.
    """
    global _dll_directories_added
    if _dll_directories_added or platform.system() != "Windows":
        return []

    added_paths: list[str] = []

    # 1. Candidate paths from Python environment / site-packages
    candidate_subdirs = [
        ("nvidia", "cublas", "bin"),
        ("nvidia", "cudnn", "bin"),
        ("nvidia", "cuda_nvrtc", "bin"),
        ("nvidia", "cuda_runtime", "bin"),
    ]
    for prefix in [sys.prefix, sys.base_prefix]:
        sp = Path(prefix) / "Lib" / "site-packages"
        if sp.exists():
            for parts in candidate_subdirs:
                bin_dir = sp.joinpath(*parts)
                if bin_dir.is_dir():
                    path_str = str(bin_dir)
                    try:
                        os.add_dll_directory(path_str)
                        added_paths.append(path_str)
                    except Exception as exc:
                        logger.debug("Could not add DLL dir %s: %s", path_str, exc)

    # 2. Look for Ollama's bundled CUDA libraries (found on local developer machines)
    ollama_base = Path.home() / "AppData" / "Local" / "Programs" / "Ollama" / "lib" / "ollama"
    if ollama_base.is_dir():
        for cuda_ver in ["cuda_v12", "cuda_v13", "cuda_v11"]:
            cuda_dir = ollama_base / cuda_ver
            if cuda_dir.is_dir():
                path_str = str(cuda_dir)
                try:
                    os.add_dll_directory(path_str)
                    added_paths.append(path_str)
                except Exception as exc:
                    logger.debug("Could not add Ollama DLL dir %s: %s", path_str, exc)

    # 3. Look for system CUDA Toolkit
    cuda_path = os.environ.get("CUDA_PATH")
    if cuda_path:
        cuda_bin = Path(cuda_path) / "bin"
        if cuda_bin.is_dir():
            try:
                os.add_dll_directory(str(cuda_bin))
                added_paths.append(str(cuda_bin))
            except Exception:
                pass

    # Ensure added paths are at the front of os.environ["PATH"]
    if added_paths:
        current_path = os.environ.get("PATH", "")
        new_entries = os.pathsep.join(added_paths)
        os.environ["PATH"] = f"{new_entries}{os.pathsep}{current_path}"
        logger.info("Registered %d CUDA DLL directories: %s", len(added_paths), added_paths)

    # Preload essential cuBLAS DLLs directly into process space so ctranslate2 finds them
    essential_dlls = [
        "cudart64_12.dll",
        "cublasLt64_12.dll",
        "cublas64_12.dll",
        "cudart64_11.dll",
        "cublasLt64_11.dll",
        "cublas64_11.dll",
    ]
    for d_path in added_paths:
        dir_p = Path(d_path)
        for dll_name in essential_dlls:
            dll_file = dir_p / dll_name
            if dll_file.is_file():
                try:
                    ctypes.CDLL(str(dll_file))
                    logger.debug("Preloaded CUDA runtime DLL: %s", dll_file)
                except Exception as exc:
                    logger.debug("Preloading %s failed: %s", dll_file, exc)

    _dll_directories_added = True
    return added_paths


# Initialize DLL paths as early as possible on module import
setup_cuda_dll_paths()


def is_nvidia_smi_available() -> bool:
    """Check if nvidia-smi command is present and runnable."""
    try:
        subprocess.check_output(
            ["nvidia-smi"],
            text=True,
            timeout=2.0,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return True
    except Exception:
        return False


def test_ctranslate2_cuda() -> tuple[bool, str]:
    """Test whether ctranslate2 can actually execute on CUDA without DLL or runtime errors."""
    setup_cuda_dll_paths()
    try:
        import ctranslate2
        device_count = ctranslate2.get_cuda_device_count()
        if device_count <= 0:
            return False, "No CUDA devices reported by ctranslate2."

        # Verify cuBLAS resolution
        for dll_name in ("cublas64_12.dll", "cublas64_11.dll", "cublas.dll"):
            try:
                ctypes.CDLL(dll_name)
                return True, f"CUDA functional ({device_count} device(s) found, {dll_name} active)."
            except Exception:
                continue

        return True, f"CUDA reported ({device_count} device(s) available)."
    except Exception as exc:
        return False, f"ctranslate2 CUDA verification failed: {exc}"


@lru_cache(maxsize=1)
def detect_cuda_support() -> bool:
    """Return True if GPU is present and CUDA execution is functional."""
    setup_cuda_dll_paths()
    is_ok, reason = test_ctranslate2_cuda()
    if is_ok:
        logger.info("GPU acceleration verified: %s", reason)
    else:
        logger.info("GPU acceleration unavailable (%s), defaulting to CPU.", reason)
    return is_ok


def resolve_whisper_device(
    requested_device: str | None = None,
    requested_compute: str | None = None,
) -> tuple[str, str]:
    """Resolve Whisper execution device and compute type with automatic fallback.

    Rules:
    - If device is "auto" (or empty):
        Uses "cuda" and "float16" if GPU is available and functional.
        Otherwise falls back to "cpu" and "int8".
    - If device is "cuda" or "gpu":
        Checks CUDA support. If supported, returns ("cuda", compute or "float16").
        If CUDA fails, logs a warning and gracefully falls back to ("cpu", "int8").
    - If device is "cpu":
        Returns ("cpu", compute or "int8").
    """
    dev = (requested_device or "auto").strip().lower()
    compute = (requested_compute or "").strip().lower()

    if dev in ("auto", "gpu", "cuda"):
        if detect_cuda_support():
            # For CUDA, float16 or int8_float16 is standard and fast
            final_compute = compute if compute in ("float16", "int8_float16", "float32") else "float16"
            return "cuda", final_compute
        elif dev in ("cuda", "gpu"):
            logger.warning("CUDA was explicitly requested but is not functional on host. Falling back to CPU.")

    final_compute = compute if compute in ("int8", "int8_float16", "float32") else "int8"
    return "cpu", final_compute


def resolve_piper_cuda(requested_cuda: bool | str | None = None) -> bool:
    """Resolve whether Piper TTS should use CUDA.

    Gracefully falls back to CPU if ONNX Runtime does not have CUDAExecutionProvider.
    """
    if isinstance(requested_cuda, str):
        val = requested_cuda.strip().lower()
        if val in ("false", "0", "no", "cpu"):
            return False
        if val in ("true", "1", "yes", "cuda", "gpu"):
            requested_cuda = True
        else:
            requested_cuda = "auto"

    if requested_cuda is False:
        return False

    try:
        import onnxruntime as ort
        available = ort.get_available_providers()
        if "CUDAExecutionProvider" in available:
            return True
        logger.debug("ONNX Runtime CUDAExecutionProvider not found (providers: %s). Piper using CPU.", available)
        return False
    except Exception:
        return False
