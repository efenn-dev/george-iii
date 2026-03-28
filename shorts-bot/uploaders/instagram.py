"""uploaders/instagram.py - Instagram Graph API Reels upload stub.

TODO: Full implementation requires:
  1. A Facebook Developer account at https://developers.facebook.com/
  2. A Facebook App with "Instagram Graph API" added.
  3. An Instagram Professional (Business or Creator) account connected
     to a Facebook Page.
  4. Generate a long-lived User Access Token with these permissions:
       - instagram_basic
       - instagram_content_publish
       - pages_read_engagement
  5. Store values in .env:
       INSTAGRAM_ACCESS_TOKEN=<long_lived_token>
       INSTAGRAM_USER_ID=<numeric_instagram_user_id>
  6. Reels upload is a two-step process:
       Step 1 — Create a container:
         POST https://graph.facebook.com/v18.0/{user-id}/media
           Fields: media_type=REELS, video_url=<public_url>, caption, share_to_feed
         NOTE: The video must be publicly accessible via URL. You must host it
               somewhere (e.g. S3, Cloudflare R2) before passing it to Instagram.
       Step 2 — Publish the container:
         POST https://graph.facebook.com/v18.0/{user-id}/media_publish
           Fields: creation_id=<container_id>
  7. Poll GET /v18.0/{container-id}?fields=status_code until FINISHED.

Reference: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
"""

from pathlib import Path


def upload(video_path: Path | str, caption: str) -> str:
    """Upload a video as an Instagram Reel.

    Args:
        video_path: Path to the video file to upload.
        caption:    Caption for the Instagram Reel.

    Returns:
        URL of the published Instagram Reel.

    Raises:
        NotImplementedError: Always — this uploader is not yet implemented.
    """
    raise NotImplementedError(
        "Instagram uploader is not yet implemented.\n\n"
        "Setup steps:\n"
        "  1. Create a Facebook Developer account: https://developers.facebook.com/\n"
        "  2. Create a Facebook App and add the Instagram Graph API product.\n"
        "  3. Connect an Instagram Professional account to a Facebook Page.\n"
        "  4. Generate a long-lived User Access Token with instagram_content_publish scope.\n"
        "  5. Add to your .env file:\n"
        "       INSTAGRAM_ACCESS_TOKEN=<your_token>\n"
        "       INSTAGRAM_USER_ID=<numeric_instagram_user_id>\n"
        "  6. Note: Instagram Reels API requires the video be hosted at a public URL\n"
        "     before upload. You must host the file yourself (e.g. S3 or similar).\n"
        "  7. Implement the two-step container + publish flow in uploaders/instagram.py.\n"
        "  See module docstring for full API endpoint details."
    )
