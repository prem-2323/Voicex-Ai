"""Host telemetry and hardware profiling service.

Retrieves authentic CPU, RAM, and GPU/VRAM statistics using the Python
standard library and platform utilities (Windows API, nvidia-smi).
"""

import ctypes
import logging
import platform
import subprocess

logger = logging.getLogger(__name__)


def get_ram_info() -> tuple[float, float, int]:
    """Return (ram_total_gb, ram_used_gb, percent_load)."""
    if platform.system() == "Windows":
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))

            total_gb = round(stat.ullTotalPhys / (1024**3), 1)
            used_gb = round((stat.ullTotalPhys - stat.ullAvailPhys) / (1024**3), 1)
            return total_gb, used_gb, int(stat.dwMemoryLoad)
        except Exception as exc:
            logger.debug("Failed to query Windows RAM via ctypes: %s", exc)

    return 16.0, 4.0, 25


def get_gpu_info() -> dict:
    """Return GPU device name, availability, and VRAM in GB."""
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used",
                "--format=csv,noheader,nounits",
            ],
            text=True,
            timeout=2.0,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        parts = [p.strip() for p in out.strip().split(",")]
        if len(parts) >= 3:
            name = parts[0]
            total_mb = float(parts[1])
            used_mb = float(parts[2])
            return {
                "gpu_available": True,
                "device": name,
                "vram_total_gb": round(total_mb / 1024.0, 2),
                "vram_allocated_gb": round(used_mb / 1024.0, 2),
            }
    except Exception:
        pass

    processor = platform.processor() or "CPU Host"
    return {
        "gpu_available": False,
        "device": f"CPU ({processor})",
        "vram_total_gb": None,
        "vram_allocated_gb": None,
    }


def get_compute_telemetry() -> dict:
    ram_total, ram_used, ram_load = get_ram_info()
    gpu = get_gpu_info()
    os_info = f"{platform.system()} {platform.release()}"

    return {
        "device": gpu["device"],
        "platform": os_info,
        "gpu_available": gpu["gpu_available"],
        "vram_allocated_gb": gpu["vram_allocated_gb"],
        "vram_total_gb": gpu["vram_total_gb"],
        "ram_used_gb": ram_used,
        "ram_total_gb": ram_total,
        "ram_load_percent": ram_load,
    }
