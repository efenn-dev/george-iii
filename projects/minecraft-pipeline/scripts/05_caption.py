"""
05_caption.py â€” Automated Captioning with Whisper
=================================================
Transcribes the assembled video with Whisper, generates SRT
subtitles, and burns them into the video with styled rendering.

Usage:
    python 05_caption.py
    python 05_caption.py --model medium --burn-in
"""

import whisper
import subprocess
import yaml
import logging
import argparse
from pathlib import Path
from datetime import timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/caption.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def format_srt_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)."""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def transcribe_to_srt(video_path: str, model_name: str = "medium",
                      language: str = "en") -> tuple[str, str]:
    """
    Transcribe video audio and generate SRT subtitle content.
    Returns (srt_content, raw_transcript).
    """
    log.info(f"Transcribing with Whisper model '{model_name}'...")
    model = whisper.load_model(model_name)
    result = model.transcribe(
        video_path,
        language=language,
        word_timestamps=True,
        verbose=False
    )

    srt_lines = []
    for i, segment in enumerate(result["segments"], 1):
        start = format_srt_timestamp(segment["start"])
        end = format_srt_timestamp(segment["end"])
        text = segment["text"].strip()

        srt_lines.append(f"{i}")
        srt_lines.append(f"{start} --> {end}")
        srt_lines.append(text)
        srt_lines.append("")

    srt_content = "\n".join(srt_lines)
    log.info(f"Generated {len(result['segments'])} subtitle segments")
    return srt_content, result["text"]

def burn_subtitles(video_path: str, srt_path: str,
                   output_path: str, style: dict) -> bool:
    """
    Burn SRT subtitles into video using FFmpeg's subtitles filter
    with ASS-style formatting for readability on gameplay.
    """
    font = style.get("font", "Arial")
    font_size = style.get("font_size", 22)
    primary_color = style.get("primary_color", "&H00FFFFFF")
    outline_color = style.get("outline_color", "&H00000000")
    outline_width = style.get("outline_width", 2)
    margin_v = style.get("margin_v", 40)

    force_style = (
        f"FontName={font},"
        f"FontSize={font_size},"
        f"PrimaryColour={primary_color},"
        f"OutlineColour={outline_color},"
        f"Outline={outline_width},"
        f"MarginV={margin_v},"
        f"Bold=1,"
        f"Shadow=1"
    )

    srt_escaped = str(srt_path).replace("\\", "/").replace(":", "\\\\:")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_escaped}':force_style='{force_style}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        output_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
        log.info(f"Subtitles burned in â†’ {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        log.error(f"Subtitle burn-in failed: {e.stderr.decode()}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Automated captioning")
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml")
    parser.add_argument("--model", default=None)
    parser.add_argument("--no-burn-in", action="store_true",
                        help="Generate SRT only, skip burn-in")
    args = parser.parse_args()

    config = load_config(args.config)
    cap_config = config["captioning"]
    model_name = args.model or cap_config["whisper_model"]
    language = cap_config["language"]
    style = cap_config["subtitle_style"]

    branded_dir = Path(config["paths"]["branded"])
    branded_files = sorted(branded_dir.glob("final_branded*.mp4"))
    if not branded_files:
        log.error("No branded video found!")
        return
    video_path = str(branded_files[-1])

    captioned_dir = Path(config["paths"]["captioned"])
    captioned_dir.mkdir(parents=True, exist_ok=True)

    srt_content, transcript = transcribe_to_srt(
        video_path, model_name, language
    )
    srt_path = captioned_dir / "captions.srt"
    srt_path.write_text(srt_content, encoding="utf-8")
    log.info(f"SRT saved: {srt_path}")

    transcript_path = captioned_dir / "transcript.txt"
    transcript_path.write_text(transcript, encoding="utf-8")

    if not args.no_burn_in:
        output_path = str(captioned_dir / "captioned_final.mp4")
        burn_subtitles(video_path, str(srt_path), output_path, style)
    else:
        log.info("Burn-in skipped (--no-burn-in flag)")

if __name__ == "__main__":
    main()




