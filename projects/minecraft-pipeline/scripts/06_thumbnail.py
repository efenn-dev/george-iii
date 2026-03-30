"""
06_thumbnail.py â€” Automated Thumbnail Generation
=================================================
Extracts the best frame from the video and composites a
YouTube-ready thumbnail with title text, gradient overlay,
channel logo, and episode badge.

Usage:
    python 06_thumbnail.py --title "We Found DIAMONDS!" --episode 14
"""

import subprocess
import json
import yaml
import logging
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/thumbnail.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def extract_candidate_frames(video_path: str, output_dir: str,
                             num_frames: int = 20) -> list[str]:
    """
    Extract evenly-spaced candidate frames from the video.
    Returns list of frame image paths.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    probe_cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", video_path
    ]
    result = subprocess.run(probe_cmd, capture_output=True, text=True)
    duration = float(json.loads(result.stdout)["format"]["duration"])

    frame_paths = []
    interval = duration / (num_frames + 1)

    for i in range(num_frames):
        timestamp = interval * (i + 1)
        frame_path = f"{output_dir}/frame_{i:03d}.jpg"
        cmd = [
            "ffmpeg", "-y", "-ss", str(timestamp),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "2",
            frame_path
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        frame_paths.append(frame_path)

    log.info(f"Extracted {len(frame_paths)} candidate frames")
    return frame_paths

def score_frame_visual_interest(frame_path: str) -> float:
    """
    Score a frame's visual interest based on color variance,
    saturation, and edge density. Higher = more interesting.
    """
    img = Image.open(frame_path).convert("RGB")
    import numpy as np

    pixels = np.array(img, dtype=np.float32)

    color_var = np.std(pixels)

    r, g, b = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.mean(max_c - min_c)

    brightness = np.mean(pixels)
    brightness_penalty = abs(brightness - 128) * 0.3

    score = color_var * 0.4 + saturation * 0.4 - brightness_penalty
    return score

def select_best_frame(frame_paths: list[str]) -> str:
    """Select the frame with the highest visual interest score."""
    scored = [(fp, score_frame_visual_interest(fp)) for fp in frame_paths]
    scored.sort(key=lambda x: x[1], reverse=True)

    best_path, best_score = scored[0]
    log.info(f"Best frame: {best_path} (score: {best_score:.2f})")
    return best_path

def composite_thumbnail(frame_path: str, output_path: str,
                        config: dict, title: str = "",
                        episode: int = None) -> str:
    """
    Composite the final thumbnail with gradient overlay,
    title text, logo, and episode badge.
    """
    thumb_cfg = config["thumbnail"]
    width = thumb_cfg["width"]
    height = thumb_cfg["height"]

    bg = Image.open(frame_path).convert("RGBA")
    bg = bg.resize((width, height), Image.LANCZOS)
    bg = bg.filter(ImageFilter.SHARPEN)

    gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_gradient = ImageDraw.Draw(gradient)
    opacity = int(thumb_cfg["gradient_opacity"] * 255)

    for y in range(height // 2, height):
        progress = (y - height // 2) / (height // 2)
        alpha = int(opacity * progress)
        draw_gradient.rectangle(
            [(0, y), (width, y + 1)],
            fill=(0, 0, 0, alpha)
        )

    for y in range(0, height // 4):
        progress = 1 - (y / (height // 4))
        alpha = int(opacity * 0.6 * progress)
        draw_gradient.rectangle(
            [(0, y), (width // 3, y + 1)],
            fill=(0, 0, 0, alpha)
        )

    bg = Image.alpha_composite(bg, gradient)

    draw = ImageDraw.Draw(bg)
    font_path = config["assets"]["thumbnail_font"]
    title_size = thumb_cfg["title_font_size"]

    try:
        font = ImageFont.truetype(font_path, title_size)
    except (IOError, OSError):
        log.warning(f"Font not found: {font_path}, using default")
        font = ImageFont.load_default()

    if title:
        shadow_offset = 3
        shadow_color = thumb_cfg["title_shadow_color"]
        title_color = thumb_cfg["title_color"]

        max_width = width - 80
        words = title.split()
        lines = []
        current_line = ""
        for word in words:
            test_line = f"{current_line} {word}".strip()
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)

        line_height = title_size + 8
        text_y = height - 40 - (len(lines) * line_height)

        for line in lines:
            draw.text(
                (42 + shadow_offset, text_y + shadow_offset),
                line, font=font, fill=shadow_color
            )
            draw.text(
                (42, text_y), line, font=font, fill=title_color
            )
            text_y += line_height

    logo_path = config["assets"]["logo"]
    if Path(logo_path).exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo_size = thumb_cfg["logo_size"]
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        logo_x = width - logo_size - 20
        logo_y = 20
        bg.paste(logo, (logo_x, logo_y), logo)

    if episode is not None and thumb_cfg.get("episode_badge"):
        badge_font_size = 32
        try:
            badge_font = ImageFont.truetype(font_path, badge_font_size)
        except (IOError, OSError):
            badge_font = ImageFont.load_default()

        badge_text = f"EP {episode}"
        bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
        badge_w = bbox[2] - bbox[0] + 24
        badge_h = bbox[3] - bbox[1] + 16

        draw.rectangle(
            [(16, 16), (16 + badge_w, 16 + badge_h)],
            fill="#E63946"
        )
        draw.text(
            (28, 20), badge_text, font=badge_font, fill="#FFFFFF"
        )

    final = bg.convert("RGB")
    final.save(output_path, "JPEG", quality=95)
    log.info(f"Thumbnail saved: {output_path} ({width}x{height})")
    return output_path

def main():
    parser = argparse.ArgumentParser(
        description="Generate YouTube thumbnail"
    )
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml")
    parser.add_argument("--title", default="Minecraft Highlights")
    parser.add_argument("--episode", type=int, default=None)
    args = parser.parse_args()

    config = load_config(args.config)

    captioned_dir = Path(config["paths"]["captioned"])
    video_files = sorted(captioned_dir.glob("captioned_final*.mp4"))
    if not video_files:
        branded_dir = Path(config["paths"]["branded"])
        video_files = sorted(branded_dir.glob("final_branded*.mp4"))
    if not video_files:
        log.error("No video found for thumbnail extraction!")
        return

    video_path = str(video_files[-1])
    thumb_dir = Path(config["paths"]["thumbnails"])
    thumb_dir.mkdir(parents=True, exist_ok=True)

    temp_frames_dir = str(thumb_dir / "temp_frames")
    frame_paths = extract_candidate_frames(
        video_path, temp_frames_dir, num_frames=20
    )
    best_frame = select_best_frame(frame_paths)

    output_path = str(thumb_dir / "thumbnail_1280x720.jpg")
    composite_thumbnail(
        best_frame, output_path, config,
        title=args.title, episode=args.episode
    )

    import shutil
    shutil.rmtree(temp_frames_dir, ignore_errors=True)

if __name__ == "__main__":
    main()




