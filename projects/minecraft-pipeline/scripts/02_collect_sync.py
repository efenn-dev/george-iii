"""
02_collect_sync.py — File Collection & Multi-Source Synchronization
==================================================================
Watches raw recording folders for new files, performs temporal
alignment using audio cross-correlation, and outputs synced
clip pairs to the processed/synced/ directory.

Robustness fixes:
- Uses absolute project-root paths consistently.
- Accepts common video extensions, not just .mkv.
- Works correctly in single-source mode (PC-only recording).
- Logs discovered files and sync decisions more clearly.

Usage:
    python 02_collect_sync.py
    python 02_collect_sync.py --method ntp_timestamp
"""

from __future__ import annotations

import argparse
import logging
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np
import yaml
from scipy import signal
from scipy.io import wavfile

PROJECT_ROOT = Path("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline")
CONFIG_PATH = PROJECT_ROOT / "config/pipeline_config.yaml"
LOG_PATH = PROJECT_ROOT / "logs/collect_sync.log"
VIDEO_EXTENSIONS = ("*.mkv", "*.mp4", "*.mov", "*.avi", "*.webm", "*.m4v")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


def resolve_project_path(path_value: str | Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()


def load_config(path: str | Path = CONFIG_PATH) -> dict:
    config_path = resolve_project_path(path)
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def find_video_files(directory: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in VIDEO_EXTENSIONS:
        files.extend(directory.glob(pattern))
    return sorted({f.resolve() for f in files}, key=lambda p: p.stat().st_mtime)


def extract_audio_wav(video_path: str, output_wav: str, sample_rate: int = 22050) -> bool:
    """Extract mono audio from video file as WAV using FFmpeg."""
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "wav",
        output_wav,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        log.info("Extracted audio: %s", output_wav)
        return True
    except subprocess.CalledProcessError as e:
        log.error("Audio extraction failed for %s: %s", video_path, e.stderr)
        return False


def compute_audio_offset(wav_a: str, wav_b: str) -> float:
    """Compute temporal offset between two audio files using cross-correlation."""
    rate_a, data_a = wavfile.read(wav_a)
    rate_b, data_b = wavfile.read(wav_b)

    if rate_a != rate_b:
        raise ValueError("Sample rates must match")

    a = data_a.astype(np.float32) / np.iinfo(data_a.dtype).max
    b = data_b.astype(np.float32) / np.iinfo(data_b.dtype).max

    max_samples = rate_a * 60
    a = a[:max_samples]
    b = b[:max_samples]

    correlation = signal.correlate(a, b, mode="full")
    lag_indices = signal.correlation_lags(len(a), len(b), mode="full")
    best_lag = lag_indices[np.argmax(np.abs(correlation))]

    offset_sec = best_lag / rate_a
    confidence = float(np.max(np.abs(correlation)) / max(len(a), 1))

    log.info("Audio offset: %.4fs (confidence: %.4f)", offset_sec, confidence)
    return offset_sec


def parse_ntp_timestamp(filename: str) -> datetime:
    """Extract NTP timestamp from filename format like minecraft_pc_20260328_153000_123456.mkv."""
    parts = filename.split("_")
    for i, part in enumerate(parts):
        if len(part) == 8 and part.isdigit() and i + 2 < len(parts):
            date_str = part
            time_str = parts[i + 1]
            micro_str = parts[i + 2].split(".")[0]
            ts_str = f"{date_str}_{time_str}_{micro_str}"
            return datetime.strptime(ts_str, "%Y%m%d_%H%M%S_%f")
    raise ValueError(f"Cannot parse timestamp from: {filename}")


def sync_by_ntp(file_a: Path, file_b: Path) -> float:
    """Compute offset between two files based on NTP timestamps embedded in filenames."""
    ts_a = parse_ntp_timestamp(file_a.name)
    ts_b = parse_ntp_timestamp(file_b.name)
    offset = (ts_b - ts_a).total_seconds()
    log.info("NTP-based offset: %.3fs", offset)
    return offset


def trim_and_align(video_path: str, offset_sec: float, output_path: str) -> bool:
    """Trim video to apply synchronization offset using FFmpeg."""
    cmd = ["ffmpeg", "-y", "-ss", str(abs(offset_sec)), "-i", video_path, "-c", "copy", output_path]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        log.info("Trimmed %s by %.3fs -> %s", video_path, abs(offset_sec), output_path)
        return True
    except subprocess.CalledProcessError as e:
        log.error("Trim failed for %s: %s", video_path, e.stderr)
        return False


def copy_single_source(pc_file: Path, synced_dir: Path) -> None:
    destination = synced_dir / f"pc_{pc_file.name}"
    shutil.copy2(pc_file, destination)
    log.info("Single-source mode complete: copied %s -> %s", pc_file, destination)


def collect_and_sync(config: dict, method: str = "audio_fingerprint") -> None:
    """Main sync workflow: find paired recordings and align them."""
    raw_pc = resolve_project_path(config["paths"]["raw_pc"])
    raw_device = resolve_project_path(config["paths"]["raw_device"])
    synced_dir = resolve_project_path(config["paths"]["synced"])
    synced_dir.mkdir(parents=True, exist_ok=True)

    pc_files = find_video_files(raw_pc)
    device_files = find_video_files(raw_device)

    log.info("Discovered %s PC recording(s) in %s", len(pc_files), raw_pc)
    log.info("Discovered %s device recording(s) in %s", len(device_files), raw_device)

    if not pc_files:
        log.warning("No PC recordings found.")
        if device_files:
            log.warning("Only device recordings exist; copying latest device file through unsynced path.")
            latest_device = device_files[-1]
            destination = synced_dir / f"device_{latest_device.name}"
            shutil.copy2(latest_device, destination)
            log.info("Copied %s -> %s", latest_device, destination)
        return

    pc_file = pc_files[-1]
    log.info("Processing latest PC recording: %s", pc_file)

    if not device_files:
        log.info("No device recording found — single-source PC-only mode")
        copy_single_source(pc_file, synced_dir)
        return

    device_file = device_files[-1]
    log.info("Processing latest device recording: %s", device_file)

    if method == "audio_fingerprint":
        wav_a = synced_dir / "temp_pc.wav"
        wav_b = synced_dir / "temp_device.wav"
        sr = int(config["sync"]["sample_rate"])

        ok_a = extract_audio_wav(str(pc_file), str(wav_a), sr)
        ok_b = extract_audio_wav(str(device_file), str(wav_b), sr)
        if not ok_a or not ok_b:
            log.warning("Audio fingerprint sync unavailable. Falling back to direct copy of both recordings.")
            shutil.copy2(pc_file, synced_dir / f"pc_{pc_file.name}")
            shutil.copy2(device_file, synced_dir / f"device_{device_file.name}")
            wav_a.unlink(missing_ok=True)
            wav_b.unlink(missing_ok=True)
            return

        offset = compute_audio_offset(str(wav_a), str(wav_b))

        wav_a.unlink(missing_ok=True)
        wav_b.unlink(missing_ok=True)

    elif method == "ntp_timestamp":
        offset = sync_by_ntp(pc_file, device_file)
    else:
        raise ValueError(f"Unknown sync method: {method}")

    max_offset = float(config["sync"]["max_offset_sec"])
    if abs(offset) > max_offset:
        log.warning(
            "Offset %.2fs exceeds max (%.2fs). Files may not be from the same session.",
            offset,
            max_offset,
        )

    if offset >= 0:
        shutil.copy2(pc_file, synced_dir / f"pc_{pc_file.name}")
        trim_and_align(str(device_file), offset, str(synced_dir / f"device_{device_file.name}"))
    else:
        trim_and_align(str(pc_file), abs(offset), str(synced_dir / f"pc_{pc_file.name}"))
        shutil.copy2(device_file, synced_dir / f"device_{device_file.name}")

    log.info("Sync complete — paired files written to %s", synced_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect and sync multi-device recordings")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument(
        "--method",
        default=None,
        choices=["audio_fingerprint", "ntp_timestamp"],
        help="Override sync method from config",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    method = args.method or config["sync"]["method"]
    collect_and_sync(config, method)


if __name__ == "__main__":
    main()
