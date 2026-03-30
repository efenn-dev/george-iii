"""
08_upload.py â€” YouTube Upload with Resumable Upload Support
===========================================================
Authenticates via OAuth 2.0, uploads the final video with
metadata from Stage 7, sets the custom thumbnail from Stage 6,
and handles retries with exponential backoff.

Usage:
    python 08_upload.py
    python 08_upload.py --privacy unlisted
"""

import json
import time
import yaml
import logging
import argparse
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/upload.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
MAX_RETRIES = 5

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def authenticate(client_secrets_path: str) -> object:
    """
    Authenticate with YouTube via OAuth 2.0.
    Stores token for reuse to avoid re-authentication.
    """
    token_path = Path(client_secrets_path).parent / "youtube_token.json"
    creds = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                client_secrets_path, SCOPES
            )
            creds = flow.run_local_server(port=8080)

        token_path.write_text(creds.to_json(), encoding="utf-8")
        log.info("Authentication successful â€” token saved")

    return build("youtube", "v3", credentials=creds)

def upload_video(youtube, video_path: str, metadata: dict) -> str:
    """
    Upload video to YouTube with resumable upload.
    Returns the video ID on success.
    """
    body = {
        "snippet": {
            "title": metadata["title"],
            "description": metadata["description"],
            "tags": metadata.get("tags", []),
            "categoryId": metadata.get("category_id", "20"),
            "defaultLanguage": metadata.get("language", "en"),
            "defaultAudioLanguage": metadata.get("language", "en")
        },
        "status": {
            "privacyStatus": metadata.get("privacy_status", "unlisted"),
            "madeForKids": metadata.get("made_for_kids", False),
            "selfDeclaredMadeForKids": metadata.get("made_for_kids", False),
            "notifySubscribers": metadata.get("notify_subscribers", False)
        }
    }

    media = MediaFileUpload(
        video_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media
    )

    log.info(f"Uploading: {video_path}")
    log.info(f"  Title: {metadata['title']}")
    log.info(f"  Privacy: {metadata.get('privacy_status', 'unlisted')}")

    response = None
    retry_count = 0

    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                log.info(f"  Upload progress: {progress}%")
        except HttpError as e:
            if e.resp.status in [500, 502, 503, 504]:
                retry_count += 1
                if retry_count > MAX_RETRIES:
                    log.error("Max retries exceeded!")
                    raise
                wait = 2 ** retry_count
                log.warning(
                    f"Server error {e.resp.status}, "
                    f"retrying in {wait}s... ({retry_count}/{MAX_RETRIES})"
                )
                time.sleep(wait)
            else:
                raise

    video_id = response["id"]
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    log.info("Upload SUCCESS!")
    log.info(f"  Video ID: {video_id}")
    log.info(f"  URL: {video_url}")

    return video_id

def set_thumbnail(youtube, video_id: str, thumbnail_path: str) -> bool:
    """Upload custom thumbnail for the video."""
    try:
        media = MediaFileUpload(thumbnail_path, mimetype="image/jpeg")
        youtube.thumbnails().set(
            videoId=video_id,
            media_body=media
        ).execute()
        log.info(f"Thumbnail set for video {video_id}")
        return True
    except HttpError as e:
        log.error(f"Thumbnail upload failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Upload to YouTube")
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml")
    parser.add_argument("--privacy", default=None,
                        choices=["private", "unlisted", "public"])
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate everything without uploading")
    args = parser.parse_args()

    config = load_config(args.config)
    yt_cfg = config["youtube"]

    meta_dir = Path(config["paths"]["metadata"])
    meta_file = meta_dir / "metadata.json"
    if not meta_file.exists():
        log.error("metadata.json not found! Run metadata stage first.")
        return

    with open(meta_file, encoding="utf-8") as f:
        metadata = json.load(f)

    if args.privacy:
        metadata["privacy_status"] = args.privacy

    captioned_dir = Path(config["paths"]["captioned"])
    video_files = sorted(captioned_dir.glob("captioned_final*.mp4"))
    if not video_files:
        log.error("No captioned video found!")
        return
    video_path = str(video_files[-1])

    thumb_dir = Path(config["paths"]["thumbnails"])
    thumb_files = sorted(thumb_dir.glob("thumbnail_*.jpg"))
    thumb_path = str(thumb_files[-1]) if thumb_files else None

    if args.dry_run:
        log.info("=== DRY RUN â€” No upload will occur ===")
        log.info(f"Video: {video_path}")
        log.info(f"Title: {metadata['title']}")
        log.info(f"Privacy: {metadata['privacy_status']}")
        log.info(f"Thumbnail: {thumb_path or 'None'}")
        log.info(f"Tags: {metadata.get('tags', [])}")
        return

    youtube = authenticate(yt_cfg["client_secrets"])
    video_id = upload_video(youtube, video_path, metadata)

    if thumb_path:
        set_thumbnail(youtube, video_id, thumb_path)

    result = {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": metadata["title"],
        "privacy": metadata["privacy_status"],
        "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%S")
    }
    result_file = meta_dir / "upload_result.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    log.info(f"Upload result saved: {result_file}")

if __name__ == "__main__":
    main()




