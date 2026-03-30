# Shorts Bot
*Video automation tool for YouTube Shorts, TikTok, and Instagram Reels.*

---

## Overview

Converts landscape video clips to vertical 9:16 format with a beautiful blur-background effect, then uploads to social platforms with Discord approval.

## Features

- **FFmpeg processing** — converts any video to 1080×1920 (9:16)
- **Blur background** — fills vertical frame without cropping action
- **Discord approval** — posts video, waits for ✅/❌ reaction
- **YouTube upload** — OAuth2-based upload to YouTube Shorts
- **Web dashboard** — job queue, status monitoring, submission form

---

## Setup

### 1. Install FFmpeg

**Windows (winget):**
```powershell
winget install Gyan.FFmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit .env with your values:
# - Discord bot token
# - Discord channel ID
# - Discord authorized user ID
# - YouTube client secrets path
```

### 4. Discord Bot Setup

1. Go to https://discord.com/developers/applications
2. Create application → Bot → Add Bot → Copy Token
3. Enable "Message Content Intent"
4. Generate OAuth2 URL with permissions:
   - Send Messages, Attach Files, Add Reactions, Read Message History
5. Invite bot to your server
6. Copy channel ID and your user ID (enable Developer Mode)

### 5. YouTube API Setup

1. Go to https://console.cloud.google.com/
2. Create project → Enable "YouTube Data API v3"
3. Create OAuth credentials (Desktop app)
4. Download JSON → save as `client_secrets.json`
5. First run opens browser for authorization

---

## Usage

### Web Dashboard (Recommended)

```bash
python ui_server.py
```

Open http://localhost:8888

Features:
- Submit new jobs
- View job queue
- Monitor system status
- Clear completed jobs

### Command Line

```bash
# Basic usage
python main.py --input ./clips/video.mp4 --title "My Short"

# With all options
python main.py \
  --input ./clips/video.mp4 \
  --title "Epic Moment" \
  --description "Check this out! #gaming" \
  --platforms youtube \
  --platforms tiktok

# Skip Discord approval (for testing)
python main.py --input ./clips/video.mp4 --title "Test" --skip-approval

# No blur background
python main.py --input ./clips/video.mp4 --title "My Short" --no-blur-bg

# Limit duration
python main.py --input ./clips/long.mp4 --title "Quick" --max-duration 30
```

---

## Project Structure

```
shorts-bot/
├── main.py              # CLI entry point
├── processor.py         # FFmpeg video processing
├── discord_bot.py       # Discord approval bot
├── ui_server.py         # Web dashboard server
├── uploaders/
│   ├── youtube.py       # YouTube Data API v3
│   ├── tiktok.py        # TikTok stub
│   └── instagram.py     # Instagram stub
├── config.py            # Config loader
├── requirements.txt
├── .env.example         # Environment template
├── clips/               # Drop source videos here
└── output/              # Processed videos saved here
```

---

## How It Works

### Video Processing (processor.py)

For landscape videos (16:9):
1. Scales and blurs a copy to fill 1080×1920 frame
2. Places original (scaled to 1080px wide) centered on top
3. Result: full vertical frame with content visible

For portrait videos (9:16 or taller):
- Scales to 1080px wide
- Pads top/bottom with black if needed

### Discord Workflow (discord_bot.py)

1. Post video with embed showing:
   - Title, description
   - File size, duration
   - Target platforms
2. React with ✅ and ❌
3. Wait for authorized user reaction (24h timeout)
4. On approval → proceed to upload
5. On rejection → skip and clean up

### YouTube Upload (uploaders/youtube.py)

1. OAuth2 authorization (browser on first run)
2. Token saved to `token.json` for future runs
3. Uploads as unlisted by default
4. Returns video URL on success

---

## Configuration Reference

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Discord bot token | Yes |
| `DISCORD_CHANNEL_ID` | Channel for approvals | Yes |
| `DISCORD_AUTHORIZED_USER_ID` | Who can approve | Yes |
| `YOUTUBE_CLIENT_SECRETS_FILE` | Path to OAuth JSON | Yes |
| `TIKTOK_ACCESS_TOKEN` | TikTok token (optional) | No |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram token (optional) | No |
| `INSTAGRAM_USER_ID` | Instagram user ID (optional) | No |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ffmpeg not found` | Install FFmpeg, add to PATH |
| `DISCORD_BOT_TOKEN is not set` | Fill in `.env` file |
| `client_secrets.json not found` | Download from Google Cloud Console |
| Bot posts but no upload | Check that YOU react ✅ (authorized user) |
| YouTube opens browser | Normal — OAuth first-time setup |
| `HttpError 403` | Add yourself as test user in Google Cloud |

---

## Platform-Specific Notes

### YouTube
- Free tier: 10,000 units/day
- Each upload costs ~1600 units
- ~6 uploads/day limit on free tier
- Apply for production to increase limits

### TikTok
- Not yet implemented
- See `uploaders/tiktok.py` for API instructions

### Instagram
- Not yet implemented
- See `uploaders/instagram.py` for Graph API instructions

---

*Shorts Bot v1.0 | FFmpeg-powered video automation*
