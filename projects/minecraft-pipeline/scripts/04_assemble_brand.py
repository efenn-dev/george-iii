"""
04_assemble_brand.py â€” Video Assembly & Branding
================================================
Assembles highlight clips into a branded video with intro,
outro, logo watermark, and optional picture-in-picture.

Usage:
    python 04_assemble_brand.py
"""

import json
import time
import uuid
import subprocess
import yaml
import logging
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/assemble_brand.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def resolve_path(path_str: str) -> Path:
    path = Path(path_str)
    if not path.is_absolute():
        path = (PROJECT_ROOT / path).resolve()
    return path

def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout or "{}")
    if "format" not in data or "duration" not in data["format"]:
        stderr = (result.stderr or "").strip()
        raise RuntimeError(f"ffprobe failed for {video_path}: {stderr or result.stdout}")
    return float(data["format"]["duration"])

def concatenate_clips(clip_paths: list[str], output_path: str,
                      crossfade_sec: float = 0.5) -> bool:
    """Concatenate multiple clips using FFmpeg concat demuxer."""
    output_path = str(resolve_path(output_path))
    concat_file = Path(output_path).parent / f"concat_list_{uuid.uuid4().hex}.txt"
    with open(concat_file, "w", encoding="utf-8") as f:
        for clip in clip_paths:
            f.write(f"file '{resolve_path(clip)}'\n")

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_file),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        log.info(f"Concatenated {len(clip_paths)} clips -> {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        log.error(f"Concatenation failed: {e.stderr}")
        return False
    finally:
        for _ in range(10):
            try:
                concat_file.unlink(missing_ok=True)
                break
            except PermissionError:
                time.sleep(0.25)
            except FileNotFoundError:
                break
        else:
            log.warning(f"Could not delete temp concat file immediately: {concat_file}")

def add_branding(input_path: str, output_path: str,
                 config: dict) -> bool:
    """Apply logo watermark and branding to the video."""
    input_path = str(resolve_path(input_path))
    output_path = str(resolve_path(output_path))
    assets = config["assets"]
    assembly = config["assembly"]
    logo = str(resolve_path(assets["logo"]))
    opacity = assembly["logo_opacity"]

    filters = []
    logo_filter = (
        f"[1:v]format=rgba,"
        f"colorchannelmixer=aa={opacity}[logo];"
        f"[0:v][logo]overlay=W-w-20:H-h-20"
    )
    filters.append(logo_filter)

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-i", logo,
        "-filter_complex", ";".join(filters) if len(filters) > 1 else filters[0],
        "-c:v", "libx264", "-preset", "medium",
        "-crf", str(assembly["crf"]),
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        log.info(f"Branding applied -> {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        log.error(f"Branding failed: {e.stderr}")
        return False

def add_intro_outro(content_path: str, output_path: str,
                    intro_path: str, outro_path: str) -> bool:
    """Prepend intro and append outro using concat demuxer."""
    clips = []
    intro = resolve_path(intro_path)
    outro = resolve_path(outro_path)
    content = resolve_path(content_path)

    if intro.exists():
        clips.append(str(intro))
    clips.append(str(content))
    if outro.exists():
        clips.append(str(outro))
    return concatenate_clips(clips, output_path)

def create_pip_composite(main_video: str, pip_video: str,
                         output_path: str, config: dict) -> bool:
    """Create picture-in-picture composite from dual feeds."""
    main_video = str(resolve_path(main_video))
    pip_video = str(resolve_path(pip_video))
    output_path = str(resolve_path(output_path))
    assembly = config["assembly"]
    pip_size = assembly["pip_size"]
    w, h = pip_size.split("x")

    position = assembly["pip_position"]
    if position == "top-right":
        overlay_pos = f"W-{w}-10:10"
    elif position == "top-left":
        overlay_pos = "10:10"
    elif position == "bottom-left":
        overlay_pos = f"10:H-{h}-10"
    else:
        overlay_pos = f"W-{w}-10:H-{h}-10"

    cmd = [
        "ffmpeg", "-y",
        "-i", main_video,
        "-i", pip_video,
        "-filter_complex",
        f"[1:v]scale={pip_size}[pip];"
        f"[0:v][pip]overlay={overlay_pos}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        output_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        log.info(f"PiP composite created -> {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        log.error(f"PiP failed: {e.stderr}")
        return False

def main():
    config = load_config()
    assembly_cfg = config["assembly"]
    assets = config["assets"]

    hl_file = resolve_path(config["paths"]["highlights"]) / "highlights.json"
    if not hl_file.exists():
        raise FileNotFoundError(f"Highlight manifest not found: {hl_file}")

    with open(hl_file, encoding="utf-8") as f:
        hl_data = json.load(f)

    clip_paths = hl_data["clip_paths"]
    if not clip_paths:
        raise RuntimeError("No highlight clips to assemble!")

    branded_dir = resolve_path(config["paths"]["branded"])
    branded_dir.mkdir(parents=True, exist_ok=True)

    concat_path = str(branded_dir / "concatenated.mp4")
    if not concatenate_clips(clip_paths, concat_path):
        raise RuntimeError("Clip concatenation failed")

    branded_path = str(branded_dir / "branded.mp4")
    if not add_branding(concat_path, branded_path, config):
        raise RuntimeError("Branding failed")

    synced_dir = resolve_path(config["paths"]["synced"])
    device_files = sorted(synced_dir.glob("device_*.mkv"))
    if device_files and assembly_cfg.get("pip_enabled"):
        pip_path = str(branded_dir / "branded_pip.mp4")
        if not create_pip_composite(branded_path, str(device_files[-1]),
                                    pip_path, config):
            raise RuntimeError("Picture-in-picture assembly failed")
        branded_path = pip_path

    final_path = str(branded_dir / "final_branded.mp4")
    if not add_intro_outro(
        branded_path, final_path,
        intro_path=assets["intro"],
        outro_path=assets["outro"]
    ):
        raise RuntimeError("Intro/outro assembly failed")

    log.info(f"Assembly complete: {final_path}")
    duration = get_video_duration(final_path)
    log.info(f"Final duration: {duration / 60:.1f} minutes")

if __name__ == "__main__":
    main()




