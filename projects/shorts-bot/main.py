#!/usr/bin/env python3
"""
Highlight Shorts - A video editor that converts highlight clips to vertical shorts format.

This CLI tool takes video highlight clips, reformats them to 9:16 vertical format,
adds optional subtitles, and presents them for approval before export.
"""

import os
import sys
import argparse
import logging
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple
from rich.console import Console
from rich.prompt import Confirm
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
import ffmpeg

# ---------------------------------------------------------------------------
# NOTE: Social-upload dependencies are optional. Install only what you need:
#   pip install google-auth google-auth-oauthlib google-api-python-client  # YouTube
#   pip install tiktok-uploader                                              # TikTok
# ---------------------------------------------------------------------------

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('highlight_shorts.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

console = Console()

# Constants
SHORTS_WIDTH = 1080
SHORTS_HEIGHT = 1920
SUPPORTED_FORMATS = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv')


class FFmpegError(Exception):
    """Custom exception for FFmpeg-related errors."""
    pass


class VideoProcessor:
    """Handles video processing operations using FFmpeg."""
    
    def __init__(self, input_dir: Path, output_dir: Path):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.temp_dir = Path(output_dir) / '.temp'
        
    def setup_directories(self):
        """Create output and temp directories if they don't exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Temp directory: {self.temp_dir}")
        
    def check_ffmpeg(self) -> bool:
        """Check if FFmpeg is installed and accessible."""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                version_line = result.stdout.split('\n')[0]
                logger.info(f"FFmpeg found: {version_line}")
                return True
            return False
        except FileNotFoundError:
            logger.error("FFmpeg not found in PATH")
            return False
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg check timed out")
            return False
        except Exception as e:
            logger.error(f"Error checking FFmpeg: {e}")
            return False
    
    def get_video_files(self) -> List[Path]:
        """Get all supported video files from input directory."""
        if not self.input_dir.exists():
            raise FileNotFoundError(f"Input directory not found: {self.input_dir}")
            
        video_files = [
            f for f in self.input_dir.iterdir()
            if f.is_file() and f.suffix.lower() in SUPPORTED_FORMATS
        ]
        
        if not video_files:
            logger.warning(f"No video files found in {self.input_dir}")
            
        return sorted(video_files)
    
    def get_video_info(self, video_path: Path) -> dict:
        """Get video metadata using ffprobe."""
        try:
            probe = ffmpeg.probe(str(video_path))
            video_stream = next(
                (stream for stream in probe['streams'] if stream['codec_type'] == 'video'),
                None
            )
            
            if video_stream is None:
                raise FFmpegError(f"No video stream found in {video_path}")
                
            # Safely compute FPS from a "num/den" string without using eval()
            fps_str = video_stream.get('r_frame_rate', '0/1')
            try:
                num, den = fps_str.split('/')
                fps = float(num) / float(den) if float(den) != 0 else 0.0
            except (ValueError, ZeroDivisionError):
                fps = 0.0

            # Duration may live in the format container instead of the stream
            duration_raw = video_stream.get('duration') or probe.get('format', {}).get('duration', 0)
            try:
                duration = float(duration_raw)
            except (TypeError, ValueError):
                duration = 0.0

            return {
                'width': int(video_stream['width']),
                'height': int(video_stream['height']),
                'duration': duration,
                'fps': fps,
                'codec': video_stream.get('codec_name', 'unknown')
            }
        except ffmpeg.Error as e:
            raise FFmpegError(f"FFprobe error for {video_path}: {e}")
        except (KeyError, ValueError, StopIteration) as e:
            raise FFmpegError(f"Error parsing video info for {video_path}: {e}")
        except Exception as e:
            raise FFmpegError(f"Error getting video info: {e}")
    
    def convert_to_shorts(self, input_path: Path, output_path: Path, 
                          add_subtitles: bool = False, subtitle_file: Optional[Path] = None) -> Path:
        """
        Convert a video to vertical 9:16 shorts format.
        
        Strategy: Center crop and scale to fit 1080x1920.
        If video is wider than 9:16, crop sides. If taller, crop top/bottom.
        """
        try:
            info = self.get_video_info(input_path)
            current_width = info['width']
            current_height = info['height']
            
            # Calculate target aspect ratio (9:16 = 0.5625)
            target_ratio = SHORTS_WIDTH / SHORTS_HEIGHT
            current_ratio = current_width / current_height
            
            # Determine crop parameters (store as plain numbers, no string tricks)
            if current_ratio > target_ratio:
                # Video is too wide — crop sides
                crop_w = int(current_height * target_ratio)
                crop_h = current_height
                crop_x = (current_width - crop_w) // 2
                crop_y = 0
                needs_crop = True
            elif current_ratio < target_ratio:
                # Video is too tall — crop top/bottom
                crop_w = current_width
                crop_h = int(current_width / target_ratio)
                crop_x = 0
                crop_y = (current_height - crop_h) // 2
                needs_crop = True
            else:
                needs_crop = False

            # Build FFmpeg stream
            stream = ffmpeg.input(str(input_path))

            # Apply crop if needed
            if needs_crop:
                stream = stream.filter('crop', w=crop_w, h=crop_h, x=crop_x, y=crop_y)
            
            # Scale to target dimensions
            stream = stream.filter('scale', SHORTS_WIDTH, SHORTS_HEIGHT)
            
            # Add subtitles if requested
            if add_subtitles and subtitle_file and subtitle_file.exists():
                stream = stream.filter(
                    'subtitles',
                    str(subtitle_file),
                    force_style='Fontsize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2'
                )
            
            # Output with good quality settings
            stream = ffmpeg.output(
                stream,
                str(output_path),
                vcodec='libx264',
                pix_fmt='yuv420p',
                preset='medium',
                crf=23,
                acodec='aac',
                audio_bitrate='192k',
                movflags='+faststart'
            )
            
            # Execute FFmpeg
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            logger.info(f"Successfully converted: {input_path.name} -> {output_path.name}")
            return output_path
            
        except ffmpeg.Error as e:
            raise FFmpegError(f"FFmpeg error converting {input_path}: {e}")
        except Exception as e:
            raise FFmpegError(f"Error converting {input_path}: {e}")
    
    def preview_video(self, video_path: Path):
        """Open video in default system player for preview."""
        try:
            if sys.platform == 'darwin':  # macOS
                subprocess.run(['open', str(video_path)], check=False)
            elif sys.platform == 'win32':  # Windows
                os.startfile(str(video_path))
            else:  # Linux
                subprocess.run(['xdg-open', str(video_path)], check=False)
        except Exception as e:
            logger.warning(f"Could not open preview: {e}")


class ApprovalWorkflow:
    """Handles the clip approval workflow."""
    
    def __init__(self, processor: VideoProcessor):
        self.processor = processor
        self.approved_clips: List[Path] = []
        self.rejected_clips: List[Path] = []
        
    def review_clip(self, original_path: Path, preview_path: Path) -> bool:
        """
        Present a clip for approval.
        
        Returns True if approved, False if rejected.
        """
        console.print(Panel.fit(
            f"[bold cyan]Reviewing:[/bold cyan] {original_path.name}",
            border_style="cyan"
        ))
        
        # Show video info
        try:
            info = self.processor.get_video_info(original_path)
            console.print(f"  Original: {info['width']}x{info['height']} @ {info['fps']:.2f}fps")
            console.print(f"  Duration: {info['duration']:.1f}s")
        except Exception as e:
            logger.debug(f"Could not retrieve video info for {original_path.name}: {e}")
        
        # Ask if user wants to preview
        if Confirm.ask("Open preview in system video player?", default=False):
            self.processor.preview_video(preview_path)
        
        # Get approval decision
        approved = Confirm.ask(
            "[green]Approve[/green] this clip for export?",
            default=True
        )
        
        return approved
    
    def run_workflow(self, video_files: List[Path], add_subtitles: bool = False,
                     subtitle_files: dict = None):
        """Run the approval workflow for all clips."""
        subtitle_files = subtitle_files or {}
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            task = progress.add_task("Processing clips...", total=len(video_files))
            
            for video_file in video_files:
                progress.update(task, description=f"Processing {video_file.name}...")
                
                # Create temporary preview file
                preview_path = self.processor.temp_dir / f"preview_{video_file.stem}.mp4"
                subtitle_file = subtitle_files.get(video_file.stem)
                
                try:
                    # Convert to shorts format for preview
                    self.processor.convert_to_shorts(
                        video_file, 
                        preview_path,
                        add_subtitles=add_subtitles,
                        subtitle_file=subtitle_file
                    )
                    
                    # Show for approval
                    console.print()  # Spacing
                    approved = self.review_clip(video_file, preview_path)
                    
                    if approved:
                        self.approved_clips.append((video_file, preview_path))
                        console.print(f"[green]✅ Approved:[/green] {video_file.name}")
                    else:
                        self.rejected_clips.append(video_file)
                        console.print(f"[red]❌ Rejected:[/red] {video_file.name}")
                        # Clean up rejected preview
                        if preview_path.exists():
                            preview_path.unlink()
                    
                    console.print()  # Spacing
                    
                except Exception as e:
                    logger.error(f"Error processing {video_file.name}: {e}")
                    console.print(f"[red]Error processing {video_file.name}: {e}[/red]")
                    self.rejected_clips.append(video_file)
                
                progress.advance(task)
    
    def export_approved(self, final_output: bool = True) -> List[Path]:
        """Export all approved clips to final output directory."""
        exported = []
        
        if not self.approved_clips:
            console.print("[yellow]No clips were approved. Nothing to export.[/yellow]")
            return exported
        
        console.print(f"\n[bold green]Exporting {len(self.approved_clips)} approved clip(s)...[/bold green]")
        
        for original_path, preview_path in self.approved_clips:
            output_filename = f"{original_path.stem}_short.mp4"
            final_path = self.processor.output_dir / output_filename
            
            try:
                if final_output:
                    # Move from temp to final location
                    shutil.move(str(preview_path), str(final_path))
                else:
                    # Copy if keeping temp
                    shutil.copy2(str(preview_path), str(final_path))
                
                exported.append(final_path)
                console.print(f"[green]✓ Exported:[/green] {final_path.name}")
                
            except Exception as e:
                logger.error(f"Error exporting {original_path.name}: {e}")
                console.print(f"[red]Error exporting {original_path.name}: {e}[/red]")
        
        return exported


class SocialUploader:
    """
    Uploads exported shorts to social platforms after approval.

    Supported platforms (set via environment variables):
      YouTube Shorts:
        YT_CLIENT_SECRETS  – path to OAuth2 client_secrets.json
        YT_TITLE_PREFIX    – optional title prefix (default: "")
      TikTok:
        TIKTOK_SESSION_ID  – your TikTok sessionid cookie value

    At least one platform must be configured, or upload is skipped with a warning.
    """

    def __init__(self):
        self.youtube_secrets = os.environ.get('YT_CLIENT_SECRETS')
        self.yt_title_prefix = os.environ.get('YT_TITLE_PREFIX', '')
        self.tiktok_session = os.environ.get('TIKTOK_SESSION_ID')

    def _any_platform_configured(self) -> bool:
        return bool(self.youtube_secrets or self.tiktok_session)

    def upload_to_youtube(self, video_path: Path, title: str) -> bool:
        """Upload a video as a YouTube Short using the Data API v3."""
        try:
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaFileUpload
            from google_auth_oauthlib.flow import InstalledAppFlow
            import pickle

            SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
            token_path = Path(self.youtube_secrets).parent / 'yt_token.pickle'
            creds = None

            if token_path.exists():
                with open(token_path, 'rb') as f:
                    creds = pickle.load(f)

            if not creds or not creds.valid:
                flow = InstalledAppFlow.from_client_secrets_file(self.youtube_secrets, SCOPES)
                creds = flow.run_local_server(port=0)
                with open(token_path, 'wb') as f:
                    pickle.dump(creds, f)

            youtube = build('youtube', 'v3', credentials=creds)
            full_title = f"{self.yt_title_prefix}{title}"[:100]  # YT title limit

            request = youtube.videos().insert(
                part='snippet,status',
                body={
                    'snippet': {
                        'title': full_title,
                        'description': '#Shorts',
                        'tags': ['shorts', 'highlights'],
                        'categoryId': '22',
                    },
                    'status': {'privacyStatus': 'public'},
                },
                media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True),
            )
            response = request.execute()
            video_id = response.get('id', '?')
            logger.info(f"YouTube upload successful: https://youtube.com/shorts/{video_id}")
            return True

        except ImportError:
            logger.error("YouTube upload requires: pip install google-auth google-auth-oauthlib google-api-python-client")
            return False
        except Exception as e:
            logger.error(f"YouTube upload failed for {video_path.name}: {e}")
            return False

    def upload_to_tiktok(self, video_path: Path, title: str) -> bool:
        """Upload a video to TikTok using tiktok-uploader."""
        try:
            from tiktok_uploader.upload import upload_video

            result = upload_video(
                filename=str(video_path),
                description=title[:150],
                cookies=self.tiktok_session,
            )
            logger.info(f"TikTok upload successful: {video_path.name}")
            return bool(result)

        except ImportError:
            logger.error("TikTok upload requires: pip install tiktok-uploader")
            return False
        except Exception as e:
            logger.error(f"TikTok upload failed for {video_path.name}: {e}")
            return False

    def upload(self, video_path: Path, platforms: List[str]) -> dict:
        """
        Upload a video to each requested platform.

        Args:
            video_path: Path to the exported short.
            platforms:  List of platform names, e.g. ['youtube', 'tiktok'].

        Returns:
            dict mapping platform -> True/False success.
        """
        if not self._any_platform_configured():
            console.print(
                "[yellow]⚠ No social platforms configured. "
                "Set YT_CLIENT_SECRETS or TIKTOK_SESSION_ID to enable posting.[/yellow]"
            )
            return {}

        title = video_path.stem.replace('_short', '').replace('_', ' ').title()
        results = {}

        for platform in platforms:
            p = platform.lower()
            if p == 'youtube':
                if not self.youtube_secrets:
                    console.print("[yellow]⚠ YouTube: YT_CLIENT_SECRETS not set — skipped[/yellow]")
                    results['youtube'] = False
                else:
                    console.print(f"[cyan]↑ Uploading to YouTube Shorts: {video_path.name}[/cyan]")
                    results['youtube'] = self.upload_to_youtube(video_path, title)
                    status = "[green]✓ YouTube OK[/green]" if results['youtube'] else "[red]✗ YouTube FAILED[/red]"
                    console.print(status)

            elif p == 'tiktok':
                if not self.tiktok_session:
                    console.print("[yellow]⚠ TikTok: TIKTOK_SESSION_ID not set — skipped[/yellow]")
                    results['tiktok'] = False
                else:
                    console.print(f"[cyan]↑ Uploading to TikTok: {video_path.name}[/cyan]")
                    results['tiktok'] = self.upload_to_tiktok(video_path, title)
                    status = "[green]✓ TikTok OK[/green]" if results['tiktok'] else "[red]✗ TikTok FAILED[/red]"
                    console.print(status)

            else:
                console.print(f"[yellow]⚠ Unknown platform '{platform}' — skipped[/yellow]")

        return results


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Convert highlight clips to vertical shorts format with approval workflow',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s -i ./highlights -o ./shorts
  %(prog)s -i ./videos -o ./output --subtitles
  %(prog)s -i ./clips -o ./exports --auto (skip approval, auto-approve all)
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        type=str,
        default='./input',
        help='Input directory containing highlight clips (default: ./input)'
    )
    
    parser.add_argument(
        '-o', '--output',
        type=str,
        default='./output',
        help='Output directory for approved shorts (default: ./output)'
    )
    
    parser.add_argument(
        '--subtitles',
        action='store_true',
        help='Enable subtitle overlay (looks for .srt files matching video names)'
    )
    
    parser.add_argument(
        '--auto',
        action='store_true',
        help='Auto-approve all clips (skip approval workflow)'
    )
    
    parser.add_argument(
        '--keep-temp',
        action='store_true',
        help='Keep temporary preview files after export'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    parser.add_argument(
        '--post',
        action='store_true',
        help='Upload approved clips to social platforms after export'
    )

    parser.add_argument(
        '--platforms',
        type=str,
        default='youtube,tiktok',
        help='Comma-separated list of platforms to post to (default: youtube,tiktok)'
    )

    return parser.parse_args()


def find_subtitle_files(input_dir: Path) -> dict:
    """Find subtitle files (.srt) matching video names in input directory."""
    subtitles = {}
    
    for srt_file in input_dir.glob('*.srt'):
        base_name = srt_file.stem
        subtitles[base_name] = srt_file
    
    return subtitles


def main():
    """Main entry point."""
    args = parse_arguments()
    
    # Set verbose logging if requested
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Print banner
    console.print(Panel.fit(
        "[bold cyan]Highlight Shorts[/bold cyan] - Video to Shorts Converter",
        border_style="cyan"
    ))
    
    # Initialize processor
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    
    processor = VideoProcessor(input_dir, output_dir)
    
    # Check FFmpeg
    console.print("\n[bold]Checking dependencies...[/bold]")
    if not processor.check_ffmpeg():
        console.print("[red]Error: FFmpeg not found![/red]")
        console.print("Please install FFmpeg: https://ffmpeg.org/download.html")
        sys.exit(1)
    console.print("[green]✓ FFmpeg is installed[/green]")
    
    # Setup directories
    try:
        processor.setup_directories()
    except Exception as e:
        console.print(f"[red]Error creating directories: {e}[/red]")
        sys.exit(1)
    
    # Get video files
    try:
        video_files = processor.get_video_files()
    except FileNotFoundError as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)
    
    if not video_files:
        console.print(f"[yellow]No video files found in {input_dir}[/yellow]")
        console.print(f"Supported formats: {', '.join(SUPPORTED_FORMATS)}")
        sys.exit(0)
    
    console.print(f"[green]✓ Found {len(video_files)} video file(s)[/green]")
    for vf in video_files:
        console.print(f"  • {vf.name}")
    
    # Find subtitle files if enabled
    subtitle_files = {}
    if args.subtitles:
        subtitle_files = find_subtitle_files(input_dir)
        if subtitle_files:
            console.print(f"[green]✓ Found {len(subtitle_files)} subtitle file(s)[/green]")
    
    # Initialize approval workflow
    workflow = ApprovalWorkflow(processor)
    
    # Process videos
    if args.auto:
        # Auto-approve mode - process all without approval
        console.print("\n[yellow]Auto-approve mode: Processing all clips...[/yellow]")
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Processing...", total=len(video_files))
            
            for video_file in video_files:
                preview_path = processor.temp_dir / f"preview_{video_file.stem}.mp4"
                subtitle_file = subtitle_files.get(video_file.stem)
                
                try:
                    processor.convert_to_shorts(
                        video_file,
                        preview_path,
                        add_subtitles=args.subtitles,
                        subtitle_file=subtitle_file
                    )
                    workflow.approved_clips.append((video_file, preview_path))
                except Exception as e:
                    logger.error(f"Error processing {video_file.name}: {e}")
                    console.print(f"[red]Error: {video_file.name} - {e}[/red]")
                
                progress.advance(task)
    else:
        # Interactive approval mode
        console.print("\n[bold]Starting approval workflow...[/bold]")
        console.print("Each clip will be processed and shown for approval.\n")
        workflow.run_workflow(video_files, add_subtitles=args.subtitles, 
                              subtitle_files=subtitle_files)
    
    # Export approved clips
    console.print()
    exported = workflow.export_approved(final_output=not args.keep_temp)
    
    # Post to social platforms if requested
    if args.post and exported:
        platforms = [p.strip() for p in args.platforms.split(',') if p.strip()]
        console.print(f"\n[bold]Posting to: {', '.join(platforms)}...[/bold]")
        uploader = SocialUploader()
        post_results: dict = {}
        for clip_path in exported:
            results = uploader.upload(clip_path, platforms)
            post_results[clip_path.name] = results

        # Brief upload summary
        success_count = sum(
            1 for r in post_results.values() for v in r.values() if v
        )
        total_attempts = sum(len(r) for r in post_results.values())
        console.print(
            f"[green]Upload summary: {success_count}/{total_attempts} successful[/green]"
        )

    # Summary
    console.print(Panel.fit(
        f"[bold]Processing Complete![/bold]\n\n"
        f"Total clips: {len(video_files)}\n"
        f"[green]Approved: {len(workflow.approved_clips)}[/green]\n"
        f"[red]Rejected: {len(workflow.rejected_clips)}[/red]\n"
        f"Exported to: {output_dir}",
        border_style="green"
    ))
    
    # Cleanup temp files if not keeping
    if not args.keep_temp and processor.temp_dir.exists():
        try:
            shutil.rmtree(processor.temp_dir)
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.warning(f"Could not clean up temp files: {e}")
    
    console.print("\n[cyan]Done! Check your output folder.[/cyan]")


if __name__ == '__main__':
    main()