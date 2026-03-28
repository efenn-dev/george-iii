"""uploaders/tiktok.py - TikTok Content Posting API v2 stub.

TODO: Full implementation requires:
  1. Register a TikTok developer app at https://developers.tiktok.com/
  2. Enable the "Content Posting API" product for your app.
  3. Complete OAuth2 or Client Credentials flow to obtain an access token.
  4. Store the access token in .env as TIKTOK_ACCESS_TOKEN.
  5. Replace the stub below with actual API calls using the TikTok
     Content Posting API v2 endpoints:
       - POST https://open.tiktokapis.com/v2/post/publish/video/init/
         (initialize upload, get upload_url + publish_id)
       - PUT <upload_url> with the video file bytes
       - POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
         (poll for processing status)
  6. Required scopes: video.publish (may require app review for production).

Reference: https://developers.tiktok.com/doc/content-posting-api-get-started
"""

from pathlib import Path


def upload(video_path: Path | str, title: str) -> str:
    """Upload a video to TikTok.

    Args:
        video_path: Path to the video file to upload.
        title:      Caption / title for the TikTok post.

    Returns:
        URL of the uploaded TikTok post.

    Raises:
        NotImplementedError: Always — this uploader is not yet implemented.
    """
    raise NotImplementedError(
        "TikTok uploader is not yet implemented.\n\n"
        "Setup steps:\n"
        "  1. Create a TikTok developer account at https://developers.tiktok.com/\n"
        "  2. Create an app and enable the 'Content Posting API' product.\n"
        "  3. Complete the OAuth2 flow to obtain an access token.\n"
        "  4. Add TIKTOK_ACCESS_TOKEN=<your_token> to your .env file.\n"
        "  5. Implement the upload logic in uploaders/tiktok.py using the\n"
        "     TikTok Content Posting API v2 (see module docstring for endpoints).\n"
        "  6. Note: Production posting may require app review by TikTok."
    )
