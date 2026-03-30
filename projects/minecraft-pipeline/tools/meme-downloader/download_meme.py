#!/usr/bin/env python3
"""Download and convert meme GIFs/videos into overlay-ready MP4 clips."""

from __future__ import annotations

import argparse
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

import requests

PROJECT_ROOT = Path("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline")
ASSETS_ROOT = PROJECT_ROOT / "assets" / "memes" / "clips"
TOOL_ROOT = PROJECT_ROOT / "tools" / "meme-downloader"
VALID_CATEGORIES = ["death", "victory", "surprise", "funny", "hype", "reactions"]
PROMPT_ALIASES = {
    "reaction": "reactions",
    "reactions": "reactions",
}
REQUEST_TIMEOUT = 20
MAX_DURATION_SECONDS = 10
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)


class MemeDownloadError(Exception):
    """Raised when a download or conversion step fails."""


def ensure_directories() -> None:
    for category in VALID_CATEGORIES:
        (ASSETS_ROOT / category).mkdir(parents=True, exist_ok=True)
    TOOL_ROOT.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())
    cleaned = cleaned.strip("._")
    return cleaned or "meme_clip"


def normalize_category(category: Optional[str]) -> str:
    if category:
        normalized = PROMPT_ALIASES.get(category.strip().lower(), category.strip().lower())
        if normalized not in VALID_CATEGORIES:
            raise MemeDownloadError(
                f"Invalid category '{category}'. Choose from: {', '.join(VALID_CATEGORIES)}"
            )
        return normalized

    print("Choose a category:")
    for idx, item in enumerate(VALID_CATEGORIES, start=1):
        print(f"  {idx}. {item}")

    while True:
        answer = input("Category [1-6 or name]: ").strip().lower()
        if not answer:
            print("Please choose a category.")
            continue
        if answer.isdigit():
            index = int(answer) - 1
            if 0 <= index < len(VALID_CATEGORIES):
                return VALID_CATEGORIES[index]
        normalized = PROMPT_ALIASES.get(answer, answer)
        if normalized in VALID_CATEGORIES:
            return normalized
        print(f"Invalid category. Choose from: {', '.join(VALID_CATEGORIES)}")


def parse_giphy_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "giphy.com" not in host:
        return None

    path = parsed.path.strip("/")
    if not path:
        return None

    parts = [part for part in path.split("/") if part]
    if not parts:
        return None

    last_segment = parts[-1]
    if last_segment in {"giphy.gif", "giphy.mp4"} and len(parts) >= 2:
        return parts[-2]

    if "-" in last_segment:
        candidate = last_segment.split("-")[-1]
        if candidate:
            return candidate

    if "gifs" in parts:
        gifs_index = parts.index("gifs")
        if gifs_index + 1 < len(parts):
            candidate = parts[gifs_index + 1]
            if "-" in candidate:
                return candidate.split("-")[-1]
            return candidate

    return last_segment or None


def resolve_source_url(url: str) -> Tuple[str, str]:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise MemeDownloadError("URL must include http:// or https://")

    giphy_id = parse_giphy_id(url)
    if giphy_id:
        mp4_url = f"https://media.giphy.com/media/{giphy_id}/giphy.mp4"
        gif_url = f"https://media.giphy.com/media/{giphy_id}/giphy.gif"
        return choose_first_available([(mp4_url, ".mp4"), (gif_url, ".gif")])

    extension = Path(parsed.path).suffix.lower()
    if extension in {".gif", ".mp4", ".webm", ".mov", ".m4v"}:
        return url, extension

    if any(host in parsed.netloc.lower() for host in ["tenor.com", "reddit.com", "redd.it", "imgur.com"]):
        return url, extension or ".bin"

    return url, extension or ".bin"


def choose_first_available(candidates: list[Tuple[str, str]]) -> Tuple[str, str]:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    for candidate_url, extension in candidates:
        try:
            response = session.head(candidate_url, allow_redirects=True, timeout=REQUEST_TIMEOUT)
            if response.ok:
                return candidate_url, extension
        except requests.RequestException:
            continue
    return candidates[-1]


def sniff_extension(url: str, response: requests.Response) -> str:
    direct_suffix = Path(urlparse(str(response.url)).path).suffix.lower()
    if direct_suffix:
        return direct_suffix

    header_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
    guessed = mimetypes.guess_extension(header_type) if header_type else None
    if guessed == ".jpe":
        guessed = ".jpg"
    return guessed or ".bin"


def download_file(url: str, dest_dir: Path, name_hint: str) -> Path:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    try:
        response = session.get(url, stream=True, allow_redirects=True, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise MemeDownloadError(f"Download failed: {exc}") from exc

    extension = sniff_extension(url, response)
    temp_path = dest_dir / f"{sanitize_filename(name_hint)}{extension}"

    try:
        with temp_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
    except OSError as exc:
        raise MemeDownloadError(f"Failed to write download: {exc}") from exc

    return temp_path


def infer_name(url: str, provided_name: Optional[str]) -> str:
    if provided_name:
        return sanitize_filename(provided_name)

    parsed = urlparse(url)
    stem = Path(parsed.path).stem
    if stem and stem not in {"giphy", "video", "download"}:
        return sanitize_filename(stem)

    giphy_id = parse_giphy_id(url)
    if giphy_id:
        return sanitize_filename(giphy_id)

    return "meme_clip"


def has_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise MemeDownloadError("ffmpeg was not found in PATH.")


def build_ffmpeg_command(input_path: Path, output_path: Path) -> list[str]:
    suffix = input_path.suffix.lower()
    vf = (
        "fps=min(30\\,source_fps),"
        "scale='if(gt(iw,720),720,iw)':'-2':flags=lanczos,"
        f"trim=duration={MAX_DURATION_SECONDS}"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-t",
        str(MAX_DURATION_SECONDS),
        "-an",
        "-movflags",
        "faststart",
        "-vf",
        vf,
    ]

    if suffix == ".gif":
        cmd += ["-pix_fmt", "yuv420p"]
    else:
        cmd += ["-pix_fmt", "yuv420p"]

    cmd.append(str(output_path))
    return cmd


def convert_to_mp4(input_path: Path, output_path: Path) -> None:
    has_ffmpeg()
    command = build_ffmpeg_command(input_path, output_path)

    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise MemeDownloadError(f"Failed to launch ffmpeg: {exc}") from exc

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        raise MemeDownloadError(f"ffmpeg conversion failed: {stderr or 'unknown error'}")


def process_url(url: str, category: Optional[str] = None, name: Optional[str] = None) -> Path:
    ensure_directories()
    normalized_category = normalize_category(category)
    output_dir = ASSETS_ROOT / normalized_category
    base_name = infer_name(url, name)

    with tempfile.TemporaryDirectory(prefix="meme_dl_") as temp_dir:
        temp_path = Path(temp_dir)
        source_url, _ = resolve_source_url(url)
        downloaded_path = download_file(source_url, temp_path, base_name)
        final_path = output_dir / f"{base_name}.mp4"

        try:
            convert_to_mp4(downloaded_path, final_path)
        except MemeDownloadError:
            if final_path.exists():
                final_path.unlink(missing_ok=True)
            raise

    return final_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Download and convert meme GIF/video URLs to MP4 clips.")
    parser.add_argument("url", help="Source URL (Giphy, Tenor, Reddit, Imgur, or direct media URL)")
    parser.add_argument("--category", help="Meme category")
    parser.add_argument("--name", help="Output file name (without extension)")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        output = process_url(args.url, category=args.category, name=args.name)
    except MemeDownloadError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Cancelled.", file=sys.stderr)
        return 130

    print(f"Saved: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
