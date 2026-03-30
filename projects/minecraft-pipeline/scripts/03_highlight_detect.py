"""
03_highlight_detect.py — AI-Powered Highlight Detection
======================================================
Combines visual scene detection (PySceneDetect) with audio
keyword detection (Whisper) to identify and rank the most
exciting moments in gameplay recordings.

Key robustness fixes:
- Uses absolute project-root paths consistently.
- Finds videos in processed/synced/ first, then raw/pc/ as fallback.
- Accepts common video extensions, not just .mkv.
- Uses a lower/more forgiving scene detection threshold.
- Handles audio/transcription failures without aborting the stage.
- Falls back to evenly spaced highlight segments if detection is sparse.
- Always writes highlights.json.

Usage:
    python 03_highlight_detect.py
    python 03_highlight_detect.py --threshold 18 --max-highlights 10
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import whisper
import yaml
from scenedetect import SceneManager, open_video
from scenedetect.detectors import AdaptiveDetector

# Validate imports work
try:
    _ = whisper.load_model.__doc__
    _ = SceneManager().__class__.__name__
except Exception as _import_exc:
    logging.error("Failed to validate imports: %s", _import_exc)
    raise

PROJECT_ROOT = Path("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline")
CONFIG_PATH = PROJECT_ROOT / "config/pipeline_config.yaml"
LOG_PATH = PROJECT_ROOT / "logs/highlight_detect.log"
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


@dataclass
class Highlight:
    """Represents a detected highlight moment."""

    start_sec: float
    end_sec: float
    visual_score: float
    audio_score: float
    combined_score: float
    source: str
    keywords_found: list[str]
    description: str


def resolve_project_path(path_value: str | Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()


def load_config(path: str | Path = CONFIG_PATH) -> dict:
    config_path = resolve_project_path(path)
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def ensure_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


# -----------------------------------------------------------------------------
# VIDEO DISCOVERY / PROBING
# -----------------------------------------------------------------------------
def find_video_candidates(directory: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in VIDEO_EXTENSIONS:
        files.extend(directory.glob(pattern))
    return sorted({f.resolve() for f in files}, key=lambda p: p.stat().st_mtime)


def select_source_video(config: dict) -> Path:
    synced_dir = resolve_project_path(config["paths"]["synced"])
    raw_pc_dir = resolve_project_path(config["paths"]["raw_pc"])

    log.info("Looking for source video...")
    log.info("  synced dir: %s", synced_dir)
    log.info("  raw pc dir: %s", raw_pc_dir)

    synced_candidates = [
        p for p in find_video_candidates(synced_dir) if p.name.lower().startswith("pc_")
    ]
    raw_candidates = find_video_candidates(raw_pc_dir)

    if synced_candidates:
        chosen = synced_candidates[-1]
        log.info("Using synced PC recording: %s", chosen)
        return chosen

    if raw_candidates:
        chosen = raw_candidates[-1]
        log.warning("No synced PC recording found. Falling back to raw PC video: %s", chosen)
        return chosen

    raise FileNotFoundError(
        f"No source video found in {synced_dir} or {raw_pc_dir}. "
        f"Supported extensions: {', '.join(ext.replace('*', '') for ext in VIDEO_EXTENSIONS)}"
    )


def get_video_duration(video_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        duration = float(result.stdout.strip())
        log.info("Video duration: %.2fs (%.2f min)", duration, duration / 60)
        return duration
    except Exception as exc:
        raise RuntimeError(f"Unable to probe duration for {video_path}: {exc}") from exc


# -----------------------------------------------------------------------------
# METHOD A: Visual Scene Detection
# -----------------------------------------------------------------------------
def detect_visual_highlights(
    video_path: Path,
    threshold: int = 18,
    min_scene_len: float = 1.0,
) -> list[dict]:
    """Use PySceneDetect to find likely action moments."""
    log.info(
        "Running visual scene detection (threshold=%s, min_scene_len=%.2fs)...",
        threshold,
        min_scene_len,
    )

    try:
        log.info("Opening video for scene detection: %s", video_path)
        video = open_video(str(video_path))
        fps = float(video.frame_rate) if video.frame_rate else 30.0
        duration_sec = video.duration.get_seconds() if hasattr(video, 'duration') and video.duration else 0
        log.info("Video FPS: %.2f, Duration: %.1f sec (%.1f min)", fps, duration_sec, duration_sec/60 if duration_sec else 0)
        
        scene_manager = SceneManager()
        scene_manager.add_detector(
            AdaptiveDetector(
                adaptive_threshold=threshold,
                min_scene_len=max(1, int(min_scene_len * fps)),
            )
        )
        log.info("Starting scene detection (this may take a while for long videos)...")
        
        # Don't show progress bar - can cause issues on some terminals
        scene_manager.detect_scenes(video, show_progress=False)
        scene_list = scene_manager.get_scene_list()
        log.info("Raw scene list length: %s", len(scene_list))
    except Exception as exc:
        log.exception("Visual scene detection failed: %s", exc)
        log.warning("Scene detection error details: %s", str(exc))
        return []

    highlights = []
    for i, (start, end) in enumerate(scene_list):
        start_sec = start.get_seconds()
        end_sec = end.get_seconds()
        duration = max(0.1, end_sec - start_sec)

        if duration < 4:
            intensity = 92
        elif duration < 8:
            intensity = 82
        elif duration < 15:
            intensity = 68
        elif duration < 30:
            intensity = 50
        else:
            intensity = 30

        highlights.append(
            {
                "start_sec": start_sec,
                "end_sec": end_sec,
                "intensity": float(intensity),
                "scene_index": i,
            }
        )

    log.info("Visual detection kept %s highlight candidates", len(highlights))
    return highlights


# -----------------------------------------------------------------------------
# METHOD B: Audio Keyword Detection
# -----------------------------------------------------------------------------
def detect_audio_highlights(
    video_path: Path,
    whisper_model: str = "base",
    keywords: list[str] | None = None,
) -> tuple[list[dict], str]:
    """Transcribe audio with Whisper and search for excitement cues."""
    if keywords is None:
        keywords = [
            "yes",
            "no",
            "oh my god",
            "wow",
            "died",
            "creeper",
            "diamond",
            "ender",
            "let's go",
            "clutch",
            "insane",
            "watch out",
            "run",
            "nether",
            "wither",
        ]

    keyword_weights = {
        "diamond": 1.8,
        "ender": 1.7,
        "wither": 1.7,
        "clutch": 2.0,
        "insane": 1.6,
        "oh my god": 1.8,
        "died": 1.4,
        "creeper": 1.5,
        "let's go": 1.6,
        "watch out": 1.5,
        "run": 1.2,
        "yes": 0.9,
        "no": 0.9,
        "wow": 1.1,
        "nether": 1.2,
    }

    log.info("Running Whisper transcription (model=%s)...", whisper_model)

    try:
        log.info("Loading Whisper model '%s'... (this may take a moment on first run)", whisper_model)
        model = whisper.load_model(whisper_model)
        log.info("Whisper model loaded successfully")
        log.info("Starting transcription...")
        result = model.transcribe(
            str(video_path),
            language="en",
            word_timestamps=True,
            verbose=False,
            fp16=False,
        )
        log.info("Transcription complete")
    except Exception as exc:
        log.exception("Audio transcription failed: %s", exc)
        return [], ""

    full_transcript = result.get("text", "")
    segments = result.get("segments", [])
    log.info(
        "Transcription complete: %s chars across %s segments",
        len(full_transcript),
        len(segments),
    )

    highlights = []
    for segment in segments:
        segment_text = segment.get("text", "").strip()
        lowered = segment_text.lower()
        found_keywords = []
        score = 0.0

        for kw in keywords:
            kw_lower = kw.lower()
            count = lowered.count(kw_lower)
            if count:
                found_keywords.append(kw)
                score += count * 18 * keyword_weights.get(kw_lower, 1.0)

        exclamation_count = segment_text.count("!")
        question_count = segment_text.count("?")
        score += exclamation_count * 6
        score += question_count * 2

        energy_words = ("whoa", "woah", "holy", "nice", "go", "look", "wait")
        score += sum(4 for word in energy_words if word in lowered)

        score = min(100.0, score)

        if found_keywords or score >= 10:
            highlights.append(
                {
                    "start_sec": float(segment.get("start", 0.0)),
                    "end_sec": float(segment.get("end", 0.0)),
                    "score": float(score),
                    "keywords": found_keywords,
                    "text": segment_text,
                }
            )

    log.info("Audio detection found %s candidate moments", len(highlights))
    return highlights, full_transcript


# -----------------------------------------------------------------------------
# FALLBACK SAMPLING
# -----------------------------------------------------------------------------
def build_evenly_spaced_fallbacks(
    duration_sec: float,
    clip_padding: float,
    sample_count: int,
) -> list[Highlight]:
    """Create evenly spaced highlight windows so Stage 3 always outputs something."""
    sample_count = max(1, sample_count)
    clip_length = max(10.0, clip_padding * 2)
    safe_duration = max(duration_sec, clip_length)

    if sample_count == 1:
        centers = [safe_duration / 2]
    else:
        step = safe_duration / (sample_count + 1)
        centers = [step * (i + 1) for i in range(sample_count)]

    highlights: list[Highlight] = []
    for idx, center in enumerate(centers, start=1):
        start = max(0.0, center - clip_padding)
        end = min(duration_sec, center + clip_padding)
        if end - start < 6:
            end = min(duration_sec, start + clip_length)
            start = max(0.0, end - clip_length)

        highlights.append(
            Highlight(
                start_sec=round(start, 3),
                end_sec=round(end, 3),
                visual_score=20.0,
                audio_score=10.0,
                combined_score=18.0,
                source="fallback",
                keywords_found=[],
                description=f"Evenly spaced fallback sample #{idx}",
            )
        )

    log.warning("Generated %s evenly spaced fallback highlights", len(highlights))
    return highlights


# -----------------------------------------------------------------------------
# COMBINED SCORING & RANKING
# -----------------------------------------------------------------------------
def dedupe_keywords(items: Iterable[str]) -> list[str]:
    seen = set()
    output = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            output.append(normalized)
    return output


def merge_and_rank_highlights(
    visual_hits: list[dict],
    audio_hits: list[dict],
    video_duration: float,
    clip_padding: float = 15.0,
    max_highlights: int = 12,
    target_duration_min: float = 12.0,
) -> list[Highlight]:
    """Merge visual and audio highlights and select the best non-overlapping windows."""
    candidates: list[Highlight] = []

    log.info(
        "Merging %s visual hits and %s audio hits (padding=%.1fs, max=%s, target=%.1f min)",
        len(visual_hits),
        len(audio_hits),
        clip_padding,
        max_highlights,
        target_duration_min,
    )

    for vh in visual_hits:
        mid = (vh["start_sec"] + vh["end_sec"]) / 2
        clip_start = max(0.0, mid - clip_padding)
        clip_end = min(video_duration, mid + clip_padding)

        overlapping_audio = [
            ah
            for ah in audio_hits
            if ah["start_sec"] < clip_end and ah["end_sec"] > clip_start
        ]

        audio_score = max((ah["score"] for ah in overlapping_audio), default=0.0)
        keywords = dedupe_keywords(
            kw for ah in overlapping_audio for kw in ah.get("keywords", [])
        )
        visual_score = float(vh.get("intensity", 0.0))

        combined = 0.65 * visual_score + 0.35 * audio_score
        if visual_score >= 60 and audio_score >= 25:
            combined += 10
        combined = min(100.0, combined)

        candidates.append(
            Highlight(
                start_sec=round(clip_start, 3),
                end_sec=round(clip_end, 3),
                visual_score=visual_score,
                audio_score=audio_score,
                combined_score=round(combined, 3),
                source="both" if overlapping_audio else "visual",
                keywords_found=keywords,
                description=f"Scene change around {mid:.1f}s",
            )
        )

    for ah in audio_hits:
        mid = (ah["start_sec"] + ah["end_sec"]) / 2
        clip_start = max(0.0, mid - clip_padding)
        clip_end = min(video_duration, mid + clip_padding)

        already_covered = any(c.start_sec <= mid <= c.end_sec for c in candidates)
        if already_covered:
            continue

        combined = min(100.0, 15.0 + 0.75 * float(ah["score"]))
        candidates.append(
            Highlight(
                start_sec=round(clip_start, 3),
                end_sec=round(clip_end, 3),
                visual_score=0.0,
                audio_score=float(ah["score"]),
                combined_score=round(combined, 3),
                source="audio",
                keywords_found=dedupe_keywords(ah.get("keywords", [])),
                description=ah.get("text", "")[:120],
            )
        )

    candidates.sort(key=lambda h: h.combined_score, reverse=True)
    log.info("Built %s combined candidates", len(candidates))

    selected: list[Highlight] = []
    for candidate in candidates:
        if len(selected) >= max_highlights:
            break
        overlaps = any(
            s.start_sec < candidate.end_sec and s.end_sec > candidate.start_sec
            for s in selected
        )
        if not overlaps:
            selected.append(candidate)

    selected.sort(key=lambda h: h.start_sec)

    total_duration = sum(h.end_sec - h.start_sec for h in selected)
    log.info(
        "Selected %s highlights, total duration %.2f min",
        len(selected),
        total_duration / 60 if selected else 0,
    )

    if not selected:
        fallback_count = max(8, min(max_highlights, 10))
        return build_evenly_spaced_fallbacks(video_duration, clip_padding, fallback_count)

    min_needed = min(8, max_highlights)
    if len(selected) < min_needed:
        log.warning(
            "Only %s highlights selected; padding with fallback samples to reach %s",
            len(selected),
            min_needed,
        )
        fallback_pool = build_evenly_spaced_fallbacks(video_duration, clip_padding, min_needed + 4)
        for candidate in fallback_pool:
            if len(selected) >= min_needed:
                break
            overlaps = any(
                s.start_sec < candidate.end_sec and s.end_sec > candidate.start_sec
                for s in selected
            )
            if not overlaps:
                selected.append(candidate)
        selected.sort(key=lambda h: h.start_sec)

    return selected[:max_highlights]


# -----------------------------------------------------------------------------
# CLIP EXTRACTION
# -----------------------------------------------------------------------------
def extract_highlight_clips(video_path: Path, highlights: list[Highlight], output_dir: Path) -> list[str]:
    """Extract highlight segments from video using FFmpeg."""
    ensure_directory(output_dir)
    clip_paths: list[str] = []

    for i, hl in enumerate(highlights):
        clip_file = output_dir / f"highlight_{i:03d}.mkv"
        duration = max(0.1, hl.end_sec - hl.start_sec)
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{hl.start_sec:.3f}",
            "-i",
            str(video_path),
            "-t",
            f"{duration:.3f}",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            str(clip_file),
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            clip_paths.append(str(clip_file))
            log.info(
                "Clip %s/%s: %.1fs-%.1fs score=%.1f source=%s",
                i + 1,
                len(highlights),
                hl.start_sec,
                hl.end_sec,
                hl.combined_score,
                hl.source,
            )
        except subprocess.CalledProcessError as exc:
            log.error("Failed to extract clip %s: %s", i, exc.stderr)

    return clip_paths


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="AI-powered highlight detection")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--threshold", type=int, default=None)
    parser.add_argument("--max-highlights", type=int, default=None)
    parser.add_argument("--whisper-model", default=None)
    parser.add_argument("--skip-visual", action="store_true",
                        help="Skip visual scene detection (use audio only + fallback)")
    args = parser.parse_args()

    config = load_config(args.config)
    hl_config = config["highlights"]

    threshold = args.threshold if args.threshold is not None else int(hl_config.get("scene_threshold", 18))
    threshold = min(threshold, 18)
    max_hl = args.max_highlights or int(hl_config.get("max_highlights", 12))
    wh_model = args.whisper_model or hl_config.get("whisper_model", "base")
    skip_visual = args.skip_visual
    keywords = hl_config.get("excitement_keywords", [])
    padding = float(hl_config.get("clip_padding_sec", 15))
    target_min = float(hl_config.get("target_duration_min", 12.0))
    min_scene_len = min(float(hl_config.get("min_scene_len_sec", 2.0)), 1.0)

    highlights_dir = ensure_directory(resolve_project_path(config["paths"]["highlights"]))

    try:
        video_path = select_source_video(config)
        log.info("Analyzing source video: %s", video_path)
        
        if not video_path.exists():
            raise FileNotFoundError(f"Video file does not exist: {video_path}")
        if video_path.stat().st_size == 0:
            raise ValueError(f"Video file is empty: {video_path}")
            
        video_duration = get_video_duration(video_path)

        if skip_visual:
            log.info("--skip-visual flag set, skipping visual scene detection")
            visual_hits = []
        else:
            visual_hits = detect_visual_highlights(
                video_path,
                threshold=threshold,
                min_scene_len=min_scene_len,
            )
        audio_hits, transcript = detect_audio_highlights(
            video_path,
            whisper_model=wh_model,
            keywords=keywords,
        )

        highlights = merge_and_rank_highlights(
            visual_hits,
            audio_hits,
            video_duration=video_duration,
            clip_padding=padding,
            max_highlights=max_hl,
            target_duration_min=target_min,
        )

        if not highlights:
            log.warning("No highlights survived ranking. Forcing fallback output.")
            highlights = build_evenly_spaced_fallbacks(video_duration, padding, max(8, min(max_hl, 10)))

        clip_paths = extract_highlight_clips(video_path, highlights, highlights_dir)

        output_data = {
            "source_video": str(video_path),
            "detection_params": {
                "visual_threshold": threshold,
                "whisper_model": wh_model,
                "clip_padding_sec": padding,
                "max_highlights": max_hl,
                "target_duration_min": target_min,
                "min_scene_len_sec": min_scene_len,
            },
            "stats": {
                "visual_candidates": len(visual_hits),
                "visual_skipped": skip_visual,
                "audio_candidates": len(audio_hits),
                "selected_highlights": len(highlights),
                "video_duration_sec": video_duration,
            },
            "highlights": [asdict(h) for h in highlights],
            "clip_paths": clip_paths,
            "transcript": transcript,
        }
    except Exception as exc:
        log.exception("Highlight detection encountered a fatal error: %s", exc)
        output_data = {
            "source_video": None,
            "detection_params": {
                "visual_threshold": threshold,
                "whisper_model": wh_model,
                "clip_padding_sec": padding,
                "max_highlights": max_hl,
                "target_duration_min": target_min,
                "min_scene_len_sec": min_scene_len,
            },
            "stats": {
                "visual_candidates": 0,
                "audio_candidates": 0,
                "selected_highlights": 0,
                "video_duration_sec": 0,
            },
            "highlights": [],
            "clip_paths": [],
            "transcript": "",
            "error": str(exc),
        }

    output_file = highlights_dir / "highlights.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    log.info("Highlight data saved to %s", output_file)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log.exception("FATAL: Unhandled exception at top level: %s", exc)
        print(f"\n[FATAL ERROR] {exc}", flush=True)
        raise
