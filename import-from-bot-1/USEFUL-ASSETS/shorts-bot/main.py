"""main.py - CLI entry point for Shorts Bot.

Usage:
    python main.py --input ./clips/highlight.mp4 --title "Epic Moment"
"""

import asyncio
import sys
from pathlib import Path

import click

from processor import process_clip, get_video_info


def _run_uploads(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
) -> dict[str, str]:
    """Run uploads to all specified platforms."""
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

    return results


async def _approval_and_upload(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
    duration: float,
) -> dict[str, str]:
    """Post video to Discord for approval, then upload on approval."""
    from discord_bot import post_for_approval

    click.echo(f"[discord] Posting '{title}' for approval ...")

    approved = await post_for_approval(
        video_path=video_path,
        title=title,
        description=description,
        platforms=platforms,
        duration=duration,
    )

    if not approved:
        click.echo("[discord] Video was rejected or timed out. Skipping upload.")
        return {}

    click.echo("[discord] Approved! Starting uploads ...")
    return _run_uploads(video_path, title, description, platforms)


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
    help="Optional description for the video post.",
)
@click.option(
    "--platforms",
    multiple=True,
    default=("youtube",),
    type=click.Choice(["youtube", "tiktok", "instagram"], case_sensitive=False),
    help="Platforms to upload to.",
)
@click.option(
    "--no-blur-bg",
    is_flag=True,
    default=False,
    help="Disable blur background effect.",
)
@click.option(
    "--max-duration",
    default=60,
    type=int,
    help="Maximum clip length in seconds.",
)
@click.option(
    "--skip-approval",
    is_flag=True,
    default=False,
    help="Skip Discord approval and upload directly.",
)
def main(
    input_path: Path,
    title: str,
    description: str,
    platforms: tuple[str, ...],
    no_blur_bg: bool,
    max_duration: int,
    skip_approval: bool,
) -> None:
    """Shorts Bot — process a video clip and post it to social platforms."""
    platforms_list = list(platforms)
    blur_bg = not no_blur_bg

    click.echo(f"[shorts-bot] Input:     {input_path}")
    click.echo(f"[shorts-bot] Title:     {title}")
    click.echo(f"[shorts-bot] Platforms: {', '.join(platforms_list)}")
    click.echo(f"[shorts-bot] Blur BG:   {blur_bg}")
    click.echo(f"[shorts-bot] Max Dur:   {max_duration}s\n")

    # Process video
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{input_path.stem}_shorts.mp4"

    click.echo("[shorts-bot] Processing clip ...")
    try:
        process_clip(
            input_path=input_path,
            output_path=output_path,
            max_duration=max_duration,
            blur_bg=blur_bg,
        )
    except FileNotFoundError as e:
        click.echo(f"\n[shorts-bot] ERROR: {e}", err=True)
        sys.exit(1)
    except RuntimeError as e:
        click.echo(f"\n[shorts-bot] FFmpeg error:\n{e}", err=True)
        sys.exit(1)

    click.echo(f"[shorts-bot] Processed → {output_path}\n")

    # Get duration for display
    try:
        info = get_video_info(output_path)
        duration = info["duration"]
    except Exception:
        duration = 0.0

    # Upload
    results: dict[str, str] = {}

    if skip_approval:
        click.echo("[shorts-bot] Skipping Discord approval. Uploading directly ...")
        results = _run_uploads(output_path, title, description, platforms_list)
    else:
        try:
            results = asyncio.run(
                _approval_and_upload(
                    video_path=output_path,
                    title=title,
                    description=description,
                    platforms=platforms_list,
                    duration=duration,
                )
            )
        except EnvironmentError as e:
            click.echo(f"\n[discord] Configuration error:\n{e}", err=True)
            sys.exit(1)
        except Exception as e:
            click.echo(f"\n[discord] Unexpected error: {e}", err=True)
            sys.exit(1)

    # Report
    if results:
        click.echo("\n[shorts-bot] Upload results:")
        for platform, result in results.items():
            click.echo(f"  {platform}: {result}")
    else:
        click.echo("\n[shorts-bot] No uploads were performed.")

    click.echo("\n[shorts-bot] Done.")


if __name__ == "__main__":
    main()
