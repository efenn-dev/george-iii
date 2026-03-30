"""processor.py - FFmpeg-based video processing for Shorts format (1080x1920, 9:16)."""

import subprocess
import json
import shutil
from pathlib import Path


def _ffprobe(input_path: Path) -> dict:
    """Run ffprobe and return parsed stream/format info."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        str(input_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def get_video_info(input_path: Path) -> dict:
    """Return video metadata: width, height, duration, fps."""
    probe = _ffprobe(input_path)
    video_stream = None
    for stream in probe.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if video_stream is None:
        raise ValueError(f"No video stream found in '{input_path}'")

    width = int(video_stream["width"])
    height = int(video_stream["height"])
    duration = float(probe["format"].get("duration", 0))

    fps_raw = video_stream.get("r_frame_rate", "30/1")
    if "/" in fps_raw:
        num, den = fps_raw.split("/")
        fps = float(num) / float(den) if float(den) != 0 else 30.0
    else:
        fps = float(fps_raw)

    return {"width": width, "height": height, "duration": duration, "fps": fps}


def process_clip(
    input_path: Path | str,
    output_path: Path | str,
    max_duration: int = 60,
    blur_bg: bool = True,
) -> Path:
    """Process a video clip into vertical 9:16 Shorts format (1080x1920).

    For landscape videos: Uses blur background effect to fill frame
    without cropping. For portrait: scales and pads if needed.
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not shutil.which("ffmpeg"):
        raise FileNotFoundError(
            "ffmpeg not found on PATH. Install from https://ffmpeg.org/download.html"
        )
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    info = get_video_info(input_path)
    width = info["width"]
    height = info["height"]
    duration = info["duration"]

    if duration > max_duration:
        print(f"[processor] Truncating from {duration:.1f}s to {max_duration}s")

    target_w, target_h = 1080, 1920
    src_ratio = width / height
    target_ratio = target_w / target_h

    duration_args = ["-t", str(max_duration)] if duration > max_duration else []

    if src_ratio > target_ratio:
        # Landscape - use blur background
        if blur_bg:
            filter_complex = _build_blur_bg_filter(width, height, target_w, target_h)
            cmd = [
                "ffmpeg", "-y",
                "-i", str(input_path),
            ] + duration_args + [
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(output_path),
            ]
        else:
            # Simple center crop
            scale_h = target_h
            scale_w = int(width * target_h / height)
            crop_x = (scale_w - target_w) // 2
            vf = f"scale={scale_w}:{scale_h},crop={target_w}:{target_h}:{crop_x}:0"
            cmd = [
                "ffmpeg", "-y",
                "-i", str(input_path),
            ] + duration_args + [
                "-vf", vf,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(output_path),
            ]
    else:
        # Portrait - scale to width, pad height
        vf = (
            f"scale={target_w}:-2,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"
        )
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_path),
        ] + duration_args + [
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(output_path),
        ]

    print(f"[processor] Processing '{input_path.name}'...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-2000:]}")

    print(f"[processor] Done: {output_path}")
    return output_path


def _build_blur_bg_filter(src_w: int, src_h: int, target_w: int, target_h: int) -> str:
    """Build FFmpeg filter for blur background effect.

    Creates a blurred, scaled version of the video as background,
    with the original video centered on top.
    """
    # Background: scale to fill target, blur it
    bg_scale_w = target_w
    bg_scale_h = int(src_h * target_w / src_w)
    if bg_scale_h < target_h:
        bg_scale_h = target_h
        bg_scale_w = int(src_w * target_h / src_h)

    bg_crop_x = (bg_scale_w - target_w) // 2
    bg_crop_y = (bg_scale_h - target_h) // 2

    # Foreground: scale to fit target width
    fg_scale_w = target_w
    fg_scale_h = int(src_h * target_w / src_w)
    overlay_y = (target_h - fg_scale_h) // 2

    filter_complex = (
        # Background: scale, crop, blur
        f"[0:v]scale={bg_scale_w}:{bg_scale_h},"
        f"crop={target_w}:{target_h}:{bg_crop_x}:{bg_crop_y},"
        f"boxblur=20:5[bg];"
        # Foreground: scale
        f"[0:v]scale={fg_scale_w}:{fg_scale_h}[fg];"
        # Overlay
        f"[bg][fg]overlay=0:{overlay_y}[out]"
    )
    return filter_complex
