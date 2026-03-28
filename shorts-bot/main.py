"""main.py - CLI entry point for Shorts Bot.

Usage:
    python main.py --input ./clips/highlight.mp4 --title "Epic Moment" \\
                   --description "Check this out" --platforms youtube tiktok
"""

import asyncio
import json
import sys
import os
from pathlib import Path
from datetime import datetime

import click

from processor import process_clip, get_video_info
from config import config

# Data directory for UI status updates
PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
JOBS_FILE = DATA_DIR / "jobs.json"
ACTIVITY_FILE = DATA_DIR / "activity.json"
STATUS_FILE = DATA_DIR / "status.json"


def ensure_data_dir():
    """Ensure data directory and files exist."""
    DATA_DIR.mkdir(exist_ok=True)
    if not JOBS_FILE.exists():
        with open(JOBS_FILE, 'w') as f:
            json.dump({"jobs": []}, f)
    if not ACTIVITY_FILE.exists():
        with open(ACTIVITY_FILE, 'w') as f:
            json.dump({"activities": []}, f)


def load_json(filepath: Path, default=None):
    """Load JSON file or return default."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def save_json(filepath: Path, data: dict):
    """Save data to JSON file."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


def add_activity(message: str, activity_type: str = "info"):
    """Add an activity log entry."""
    ensure_data_dir()
    data = load_json(ACTIVITY_FILE, {"activities": []})
    data["activities"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "message": message,
        "type": activity_type
    })
    # Keep only last 50 activities
    data["activities"] = data["activities"][:50]
    save_json(ACTIVITY_FILE, data)


def update_job_status(job_id: str, status: str, output_path: str = None, results: dict = None, error: str = None):
    """Update job status in the jobs file."""
    ensure_data_dir()
    data = load_json(JOBS_FILE, {"jobs": []})
    
    for job in data.get("jobs", []):
        if job.get("id") == job_id:
            job["status"] = status
            job["updated_at"] = datetime.now().isoformat()
            if output_path:
                job["output_path"] = str(output_path)
            if results:
                job["results"] = results
            if error:
                job["error"] = error
            break
    
    save_json(JOBS_FILE, data)


def create_job(job_data: dict) -> str:
    """Create a new job entry and return its ID."""
    ensure_data_dir()
    data = load_json(JOBS_FILE, {"jobs": []})
    
    job_id = job_data.get("id", f"job_{int(datetime.now().timestamp() * 1000)}")
    job_data["id"] = job_id
    job_data["created_at"] = datetime.now().isoformat()
    job_data["updated_at"] = datetime.now().isoformat()
    job_data["status"] = "queued"
    
    data["jobs"].insert(0, job_data)
    save_json(JOBS_FILE, data)
    
    add_activity(f"New job created: '{job_data.get('title')}' (ID: {job_id[:8]}...)", "info")
    return job_id


def update_bot_status(status: str):
    """Update bot status in status file."""
    ensure_data_dir()
    status_data = load_json(STATUS_FILE, {})
    status_data["bot_status"] = status
    status_data["last_updated"] = datetime.now().isoformat()
    save_json(STATUS_FILE, status_data)


def _run_uploads(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
    job_id: str = None,
) -> dict[str, str]:
    """Run uploads to all specified platforms and return results.

    Args:
        video_path:  Path to the processed video file.
        title:       Video title.
        description: Video description.
        platforms:   List of platform names to upload to.
        job_id:      Optional job ID for status tracking.

    Returns:
        Dict mapping platform name to result URL or error message.
    """
    results: dict[str, str] = {}

    for platform in platforms:
        platform = platform.lower()
        try:
            if platform == "youtube":
                from uploaders.youtube import upload as yt_upload
                url = yt_upload(
                    video_path=video_path,
                    title=title,
                    description=description,
                )
                results["youtube"] = url

            elif platform == "tiktok":
                from uploaders.tiktok import upload as tt_upload
                url = tt_upload(video_path=video_path, title=title)
                results["tiktok"] = url

            elif platform == "instagram":
                from uploaders.instagram import upload as ig_upload
                url = ig_upload(video_path=video_path, caption=description or title)
                results["instagram"] = url

            else:
                results[platform] = f"ERROR: Unknown platform '{platform}'"

        except NotImplementedError as e:
            results[platform] = f"NOT IMPLEMENTED: {e}"
            click.echo(f"\n[{platform}] {e}", err=True)

        except Exception as e:
            results[platform] = f"ERROR: {e}"
            click.echo(f"\n[{platform}] Upload failed: {e}", err=True)

    # Update job with results
    if job_id:
        update_job_status(job_id, "completed", output_path=video_path, results=results)
        add_activity(f"Job '{title}' completed with {len(results)} uploads", "success")

    return results


async def _approval_and_upload(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
    duration: float,
    job_id: str = None,
) -> dict[str, str]:
    """Post video to Discord for approval, then upload on approval.

    Args:
        video_path:  Processed video path.
        title:       Video title.
        description: Video description.
        platforms:   Target platforms.
        duration:    Video duration in seconds.
        job_id:      Optional job ID for status tracking.

    Returns:
        Dict mapping platform name to result URL or error message, or
        empty dict if rejected.
    """
    from discord_bot import post_for_approval

    click.echo(f"[discord] Posting '{title}' for approval ...")
    
    if job_id:
        update_job_status(job_id, "awaiting_approval")
        add_activity(f"Job '{title}' awaiting Discord approval", "info")
    
    approved = await post_for_approval(
        video_path=video_path,
        title=title,
        description=description,
        platforms=platforms,
        duration=duration,
    )

    if not approved:
        click.echo("[discord] Video was rejected or timed out. Skipping upload.")
        if job_id:
            update_job_status(job_id, "rejected")
            add_activity(f"Job '{title}' was rejected or timed out", "warning")
        return {}

    click.echo("[discord] Approved! Starting uploads ...")
    if job_id:
        update_job_status(job_id, "uploading")
        add_activity(f"Job '{title}' approved, uploading to platforms", "info")
    
    return _run_uploads(video_path, title, description, platforms, job_id)


@click.command()
@click.option(
    "--input", "input_path",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to the input video clip.",
)
@click.option(
    "--title",
    required=True,
    help="Title for the video post.",
)
@click.option(
    "--description",
    default="",
    show_default=False,
    help="Optional description for the video post.",
)
@click.option(
    "--platforms",
    multiple=True,
    default=("youtube",),
    show_default=True,
    type=click.Choice(["youtube", "tiktok", "instagram"], case_sensitive=False),
    help="Platforms to upload to. Can be specified multiple times: --platforms youtube --platforms tiktok",
)
@click.option(
    "--no-blur-bg",
    is_flag=True,
    default=False,
    help="Disable blur background effect for landscape clips (use plain center crop instead).",
)
@click.option(
    "--max-duration",
    default=60,
    show_default=True,
    type=int,
    help="Maximum clip length in seconds. Clips longer than this are truncated.",
)
@click.option(
    "--skip-approval",
    is_flag=True,
    default=False,
    help="Skip Discord approval and upload directly. Useful for testing.",
)
@click.option(
    "--job-id",
    default=None,
    help="Job ID for tracking (auto-generated if not provided).",
)
def main(
    input_path: Path,
    title: str,
    description: str,
    platforms: tuple[str, ...],
    no_blur_bg: bool,
    max_duration: int,
    skip_approval: bool,
    job_id: str,
) -> None:
    """Shorts Bot — process a video clip and post it to social platforms.

    \b
    Workflow:
      1. Process the clip into 1080x1920 (9:16) Shorts format.
      2. Post to Discord for approval (unless --skip-approval).
      3. On approval, upload to the specified platforms.
      4. Report results.

    \b
    Example:
      python main.py --input ./clips/highlight.mp4 \\
                     --title "Epic Moment" \\
                     --description "Check this out #gaming" \\
                     --platforms youtube --platforms tiktok
    """
    platforms_list = list(platforms)
    blur_bg = not no_blur_bg

    click.echo(f"[shorts-bot] Input:     {input_path}")
    click.echo(f"[shorts-bot] Title:     {title}")
    click.echo(f"[shorts-bot] Platforms: {', '.join(platforms_list)}")
    click.echo(f"[shorts-bot] Blur BG:   {blur_bg}")
    click.echo(f"[shorts-bot] Max Dur:   {max_duration}s")
    click.echo("")

    # Create job entry for tracking
    job_data = {
        "input_path": str(input_path),
        "title": title,
        "description": description,
        "platforms": platforms_list,
        "blur_bg": blur_bg,
        "max_duration": max_duration,
        "skip_approval": skip_approval,
    }
    job_id = create_job(job_data)
    
    click.echo(f"[shorts-bot] Job ID:    {job_id}")

    # ── Step 1: Process video ─────────────────────────────────────────────────
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{input_path.stem}_shorts.mp4"

    click.echo("[shorts-bot] Processing clip ...")
    update_job_status(job_id, "processing")
    update_bot_status("running")
    
    try:
        process_clip(
            input_path=input_path,
            output_path=output_path,
            max_duration=max_duration,
            blur_bg=blur_bg,
        )
    except FileNotFoundError as e:
        click.echo(f"\n[shorts-bot] ERROR: {e}", err=True)
        update_job_status(job_id, "failed", error=str(e))
        add_activity(f"Job '{title}' failed: {e}", "error")
        update_bot_status("offline")
        sys.exit(1)
    except RuntimeError as e:
        click.echo(f"\n[shorts-bot] FFmpeg error:\n{e}", err=True)
        update_job_status(job_id, "failed", error=str(e))
        add_activity(f"Job '{title}' failed: FFmpeg error", "error")
        update_bot_status("offline")
        sys.exit(1)

    click.echo(f"[shorts-bot] Processed → {output_path}\n")

    # Get duration for display
    try:
        info = get_video_info(output_path)
        duration = info["duration"]
    except Exception:
        duration = 0.0

    # ── Step 2 & 3: Approval + Upload ─────────────────────────────────────────
    results: dict[str, str] = {}

    if skip_approval:
        click.echo("[shorts-bot] Skipping Discord approval (--skip-approval). Uploading directly ...")
        update_job_status(job_id, "uploading")
        results = _run_uploads(output_path, title, description, platforms_list, job_id)
    else:
        try:
            results = asyncio.run(
                _approval_and_upload(
                    video_path=output_path,
                    title=title,
                    description=description,
                    platforms=platforms_list,
                    duration=duration,
                    job_id=job_id,
                )
            )
        except EnvironmentError as e:
            click.echo(f"\n[discord] Configuration error:\n{e}", err=True)
            update_job_status(job_id, "failed", error=str(e))
            add_activity(f"Job '{title}' failed: Discord config error", "error")
            update_bot_status("offline")
            sys.exit(1)
        except Exception as e:
            click.echo(f"\n[discord] Unexpected error: {e}", err=True)
            update_job_status(job_id, "failed", error=str(e))
            add_activity(f"Job '{title}' failed: {e}", "error")
            update_bot_status("offline")
            sys.exit(1)

    # ── Step 4: Report ────────────────────────────────────────────────────────
    if results:
        click.echo("\n[shorts-bot] Upload results:")
        for platform, result in results.items():
            click.echo(f"  {platform}: {result}")
    else:
        click.echo("\n[shorts-bot] No uploads were performed.")

    update_bot_status("offline")
    click.echo("\n[shorts-bot] Done.")


if __name__ == "__main__":
    main()
