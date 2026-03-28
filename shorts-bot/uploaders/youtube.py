"""uploaders/youtube.py - Upload videos to YouTube via the YouTube Data API v3.

OAuth2 flow is used. On first run the user is prompted to authorize in a browser.
The token is saved to token.json for subsequent runs.
"""

import os
import json
from pathlib import Path
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

from config import config


SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_FILE = Path(__file__).parent.parent / "token.json"
API_SERVICE_NAME = "youtube"
API_VERSION = "v3"
SHORTS_TAG = "#Shorts"


def _get_credentials() -> Credentials:
    """Load saved credentials or run OAuth2 flow to obtain new ones.

    Credentials are persisted in token.json next to this project's root.

    Returns:
        Valid Google OAuth2 Credentials.

    Raises:
        FileNotFoundError: If the client secrets file is not found.
    """
    config.require_youtube()

    creds: Optional[Credentials] = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("[youtube] Refreshing expired access token ...")
            creds.refresh(Request())
        else:
            print("[youtube] Starting OAuth2 authorization flow ...")
            print("          A browser window will open. Log in and grant access.")
            flow = InstalledAppFlow.from_client_secrets_file(
                config.YOUTUBE_CLIENT_SECRETS_FILE, SCOPES
            )
            creds = flow.run_local_server(port=0)

        TOKEN_FILE.write_text(creds.to_json())
        print(f"[youtube] Credentials saved to {TOKEN_FILE}")

    return creds


def upload(
    video_path: Path | str,
    title: str,
    description: str = "",
    tags: list[str] | None = None,
    privacy: str = "unlisted",
) -> str:
    """Upload a video file to YouTube.

    Appends #Shorts to the description automatically so YouTube recognises
    the video as a Short.

    Args:
        video_path:  Path to the video file to upload.
        title:       Video title (max 100 characters).
        description: Video description. #Shorts is appended automatically.
        tags:        Optional list of tag strings.
        privacy:     Privacy status: "public", "unlisted", or "private".
                     Defaults to "unlisted" so you can review before publishing.

    Returns:
        The full YouTube URL (https://youtu.be/<id>) of the uploaded video.

    Raises:
        FileNotFoundError: If the video file does not exist.
        HttpError:         If the YouTube API returns an error.
        RuntimeError:      If the upload fails for any other reason.
    """
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    if tags is None:
        tags = []

    # Always include #Shorts in description so YouTube classifies it correctly
    full_description = description.strip()
    if SHORTS_TAG not in full_description:
        full_description = (full_description + f"\n\n{SHORTS_TAG}").strip()

    creds = _get_credentials()
    youtube = build(API_SERVICE_NAME, API_VERSION, credentials=creds)

    body = {
        "snippet": {
            "title": title[:100],  # YouTube title limit
            "description": full_description,
            "tags": tags,
            "categoryId": "22",  # People & Blogs — a common category for Shorts
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        str(video_path),
        mimetype="video/mp4",
        resumable=True,
        chunksize=8 * 1024 * 1024,  # 8 MB chunks
    )

    print(f"[youtube] Uploading '{video_path.name}' as '{privacy}' ...")
    request = youtube.videos().insert(
        part=",".join(body.keys()),
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                print(f"[youtube] Upload progress: {pct}%", end="\r")
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504):
                # Transient server error — retry
                print(f"[youtube] Transient error {e.resp.status}, retrying ...")
                continue
            raise

    video_id = response.get("id")
    if not video_id:
        raise RuntimeError(
            f"YouTube upload succeeded but no video ID was returned.\nResponse: {response}"
        )

    url = f"https://youtu.be/{video_id}"
    print(f"\n[youtube] Upload complete: {url}")
    return url
