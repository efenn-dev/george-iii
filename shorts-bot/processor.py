"""processor.py - FFmpeg-based video processing for Shorts format (1080x1920, 9:16)."""

import subprocess
import json
import shutil
from pathlib import Path


def _ffprobe(input_path: Path) -> dict:
    """Run ffprobe on a file and return parsed stream/format info."""
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
        raise RuntimeError(
            f"ffprobe failed on '{input_path}'.\n"
            "Make sure FFmpeg is installed and on your PATH.\n"
            f"Error: {result.stderr.strip()}"
        )
    return json.loads(result.stdout)


def get_video_info(input_path: Path) -> dict:
    """Return a dict with width, height, duration, and fps for the input video.

    Args:
        input_path: Path to the input video file.

    Returns:
        dict with keys: width, height, duration (float seconds), fps (float).
    """
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

    # Parse FPS (may be a fraction like "30000/1001")
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

    Behavior:
    - If the source is wider than 9:16 (e.g. 16:9): center-crop to fill 1080x1920.
      With blur_bg=True, a blurred + scaled version fills the background and the
      original sits centered on top — looks great for Shorts.
    - If the source is already 9:16 or taller: scale to fit 1080 wide, pad top/bottom.
    - Warns if input is longer than max_duration (truncates to max_duration).
    - Outputs h264 / aac mp4.

    Args:
        input_path:    Path to the source video file.
        output_path:   Destination path for the processed mp4.
        max_duration:  Maximum clip length in seconds (default 60). Clips longer
                       than this are truncated with a warning.
        blur_bg:       When True and source is landscape (wider than 9:16), use a
                       blurred version of the video as background behind the main clip.

    Returns:
        Path to the output file.

    Raises:
        FileNotFoundError: If ffmpeg/ffprobe is not on PATH or input file missing.
        RuntimeError:      If FFmpeg processing fails.
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not shutil.which("ffmpeg"):
        raise FileNotFoundError(
            "ffmpeg not found on PATH. "
            "Install it from https://ffmpeg.org/download.html and add it to your PATH."
        )
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    info = get_video_info(input_path)
    width = info["width"]
    height = info["height"]
    duration = info["duration"]

    if duration > max_duration:
        print(
            f"[processor] WARNING: Clip is {duration:.1f}s, exceeds max {max_duration}s. "
            f"Truncating to {max_duration}s."
        )

    target_w, target_h = 1080, 1920
    src_ratio = width / height
    target_ratio = target_w / target_h  # 9:16 ≈ 0.5625

    # Duration args: only add -t if we need to truncate
    duration_args = ["-t", str(max_duration)] if duration > max_duration else []

    if src_ratio > target_ratio:
        # Source is wider than 9:16 (e.g. landscape 16:9)
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
            # Scale so height == target_h, then crop width
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
        # Source is taller or already 9:16 — scale to 1080 wide, pad height
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

    print(f"[processor] Running FFmpeg on '{input_path.name}' → '{output_path.name}'")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed processing '{input_path}'.\n"
            f"Command: {' '.join(cmd)}\n"
            f"Stderr:\n{result.stderr[-2000:]}"
        )

    print(f"[processor] Done. Output: {output_path}")
    return output_path


def _build_blur_bg_filter(
    src_w: int, src_h: int, target_w: int, target_h: int
) -> str:
    """Build a filter_complex string that places the source video centered over a
    blurred + scaled background version of itself.

    Layout:
    - Background: source scaled to cover 1080x1920, then blurred (boxblur).
    - Foreground: source scaled so it fits entirely within 1080 wide (height may
      be less than 1920), centered vertically.

    Args:
        src_w:    Source video width in pixels.
        src_h:    Source video height in pixels.
        target_w: Output width (1080).
        target_h: Output height (1920).

    Returns:
        filter_complex string for FFmpeg -filter_complex flag.
    """
    # Background: scale to fill target_w x target_h (may overshoot one dimension)
    bg_scale_w = target_w
    bg_scale_h = int(src_h * target_w / src_w)
    if bg_scale_h < target_h:
        bg_scale_h = target_h
        bg_scale_w = int(src_w * target_h / src_h)

    bg_crop_x = (bg_scale_w - target_w) // 2
    bg_crop_y = (bg_scale_h - target_h) // 2

    # Foreground: scale to fit within target_w, keep aspect ratio
    fg_scale_w = target_w
    fg_scale_h = int(src_h * target_w / src_w)

    overlay_y = (target_h - fg_scale_h) // 2

    filter_complex = (
        # Background stream: scale, crop, blur
        f"[0:v]scale={bg_scale_w}:{bg_scale_h},"
        f"crop={target_w}:{target_h}:{bg_crop_x}:{bg_crop_y},"
        f"boxblur=20:5[bg];"
        # Foreground stream: scale to fit width
        f"[0:v]scale={fg_scale_w}:{fg_scale_h}[fg];"
        # Overlay foreground centered on background
        f"[bg][fg]overlay=0:{overlay_y}[out]"
    )
    return filter_complex
