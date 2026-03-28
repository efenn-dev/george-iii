# 🎬 Shorts Bot

A Python CLI tool that converts video clips into vertical 9:16 Shorts format and posts them to YouTube Shorts (and optionally TikTok and Instagram Reels), with a Discord approval step in between.

---

## Features

- **FFmpeg processing** — converts any video to 1080×1920 (9:16) with a beautiful blur-background effect for landscape clips
- **Discord approval** — posts the processed video to a Discord channel, waits for a ✅ or ❌ reaction from an authorized user
- **YouTube upload** — uploads to YouTube Shorts via OAuth2, defaults to unlisted so you can review first
- **TikTok / Instagram stubs** — structure is in place; implementation guide is in each file
- **Web Dashboard** — modern dark-themed UI for managing jobs, viewing status, and submitting new clips

---

## Requirements

- Python 3.11+
- FFmpeg (installed and on your PATH)
- A Discord bot token
- A Google Cloud project with YouTube Data API v3 enabled

---

## 1. Install FFmpeg (Windows)

**Option A — winget (recommended):**
```powershell
winget install Gyan.FFmpeg
```
Then restart your terminal.

**Option B — manual:**
1. Download a Windows build from https://ffmpeg.org/download.html (e.g. the `ffmpeg-release-essentials.zip` from gyan.dev).
2. Extract it somewhere permanent (e.g. `C:\ffmpeg`).
3. Add `C:\ffmpeg\bin` to your system `PATH`:
   - Win + R → `sysdm.cpl` → Advanced → Environment Variables → edit `Path` → New → `C:\ffmpeg\bin`.
4. Open a new terminal and run `ffmpeg -version` to verify.

---

## 2. Install Python Dependencies

```powershell
pip install -r requirements.txt
```

---

## 3. Discord Bot Setup

1. Go to https://discord.com/developers/applications and create a new application.
2. Click **Bot** → **Add Bot** → copy the **Token**.
3. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent**
4. Generate an invite URL:
   - Go to **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Attach Files`, `Add Reactions`, `Read Message History`, `Embed Links`
5. Open the generated URL, select your server, and authorize.
6. In Discord, enable **Developer Mode** (User Settings → Advanced).
7. Right-click the channel you want to use → **Copy Channel ID** → save as `DISCORD_CHANNEL_ID`.
8. Right-click your own username → **Copy User ID** → save as `DISCORD_AUTHORIZED_USER_ID`.

---

## 4. YouTube API Setup

1. Go to https://console.cloud.google.com/ and create (or select) a project.
2. Enable the **YouTube Data API v3**:
   - APIs & Services → Library → search "YouTube Data API v3" → Enable.
3. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → **Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Download the JSON file and save it in the project folder as `client_secrets.json`.
4. On first run, a browser window will open for you to log in and authorize the app.
   The token is saved automatically to `token.json` for future runs.

> **Note:** New OAuth apps start in "testing" mode. Add yourself as a test user under  
> APIs & Services → OAuth consent screen → Test users. You can apply for "production" verification  
> later if needed.

---

## 5. TikTok & Instagram Setup

These platforms are stubbed out. Running with `--platforms tiktok` or `--platforms instagram` will print clear setup instructions. See:
- `uploaders/tiktok.py` — TikTok Content Posting API v2 instructions
- `uploaders/instagram.py` — Instagram Graph API Reels instructions

---

## 6. Configure `.env`

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in your values. Every variable is documented with instructions.

```env
DISCORD_BOT_TOKEN=your_token_here
DISCORD_CHANNEL_ID=123456789012345678
DISCORD_AUTHORIZED_USER_ID=987654321098765432
YOUTUBE_CLIENT_SECRETS_FILE=client_secrets.json
```

---

## 7. Usage

### Option A: Web Dashboard (Recommended)

Launch the web UI for a user-friendly experience:

```powershell
# Start the dashboard server
python ui_server.py
```

Then open your browser to: **http://localhost:8888**

The dashboard provides:
- **System Status** — Live indicators for Discord bot, FFmpeg, and configuration
- **Job Queue** — View all jobs with their current status (queued/processing/completed/failed)
- **Submit Job** — Form to queue new videos with options for platforms, blur effects, and duration
- **Activity Log** — Recent events and upload results
- **Auto-refresh** — Status updates every 10 seconds

### Option B: Command Line

#### Basic — process + Discord approval + YouTube upload

```powershell
python main.py --input .\clips\highlight.mp4 --title "Epic Moment"
```

#### With description and multiple platforms

```powershell
python main.py `
  --input .\clips\highlight.mp4 `
  --title "Epic Moment" `
  --description "Check this out! #gaming #highlight" `
  --platforms youtube `
  --platforms tiktok
```

#### Skip Discord approval (upload directly — good for testing)

```powershell
python main.py --input .\clips\clip.mp4 --title "Test Upload" --skip-approval
```

#### Disable blur background (plain center crop)

```powershell
python main.py --input .\clips\clip.mp4 --title "My Short" --no-blur-bg
```

#### Limit clip to 30 seconds

```powershell
python main.py --input .\clips\long_clip.mp4 --title "Quick Highlight" --max-duration 30
```

---

## CLI Reference

```
python main.py [OPTIONS]

  --input PATH           Path to the input video clip. (required)
  --title TEXT           Title for the video post. (required)
  --description TEXT     Optional description for the video post.
  --platforms CHOICE     Platforms to upload to. Choices: youtube, tiktok, instagram.
                         Can be specified multiple times. Default: youtube.
  --no-blur-bg           Disable blur background effect for landscape clips.
  --max-duration INT     Maximum clip length in seconds. Default: 60.
  --skip-approval        Skip Discord approval and upload directly.
  --help                 Show this message and exit.
```

---

## Project Structure

```
shorts-bot/
├── main.py              # CLI entry point (click)
├── processor.py         # FFmpeg video processing (9:16 conversion)
├── discord_bot.py       # Discord approval bot
├── ui_server.py         # HTTP server for web dashboard
├── ui/
│   ├── index.html       # Dashboard HTML
│   ├── style.css        # Dark theme styles
│   └── app.js           # Dashboard JavaScript
├── data/                # Job queue and activity logs (created automatically)
│   ├── jobs.json        # Job status and history
│   ├── activity.json    # Activity log
│   └── status.json      # System status
├── uploaders/
│   ├── __init__.py
│   ├── youtube.py       # YouTube Data API v3 uploader
│   ├── tiktok.py        # TikTok stub (not yet implemented)
│   └── instagram.py     # Instagram Reels stub (not yet implemented)
├── config.py            # Config loader from .env
├── requirements.txt
├── .env.example         # Documented example environment file
├── clips/               # Drop your source clips here
└── output/              # Processed 9:16 videos are saved here
```

---

## Dashboard Features

The web dashboard (`http://localhost:8888`) provides:

### System Status Cards
- **Discord Bot** — Shows if the bot is online/offline
- **FFmpeg** — Checks if FFmpeg is available on PATH
- **Configuration** — Verifies `.env` file exists
- **Job Summary** — Live counts of queued, processing, completed, and failed jobs

### Job Queue Table
- View all jobs with ID, title, platforms, status, timestamps
- Status badges: Queued 🔵, Processing 🟡, Completed 🟢, Failed 🔴
- Clear completed/failed jobs with one click

### Submit New Job Form
- File path selector
- Title and description fields
- Platform checkboxes (YouTube, TikTok, Instagram)
- Max duration slider
- Blur background toggle
- Skip Discord approval toggle

### Activity Log
- Chronological list of recent events
- Success, error, info, and warning indicators
- Timestamps for each entry

---

## How the Blur Background Works

When your source clip is landscape (e.g. 16:9 gaming footage), Shorts Bot:
1. Scales and blurs a copy of the video to fill the 1080×1920 frame.
2. Places the original (scaled to 1080px wide) centered on top.

This fills the vertical frame without cropping any of the action — and it looks great.

To disable it, use `--no-blur-bg` (falls back to a simple center crop).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ffmpeg not found` | Install FFmpeg and add it to PATH (see step 1) |
| `DISCORD_BOT_TOKEN is not set` | Fill in `.env` (see step 6) |
| `client_secrets.json not found` | Download from Google Cloud Console (see step 4) |
| Bot posts video but no upload happens | Make sure you react with ✅ as the authorized user within 24h |
| YouTube upload opens a browser | That's normal — OAuth2 first-time authorization. |
| `HttpError 403 insufficientPermissions` | Add yourself as a test user in Google Cloud Console |
| Dashboard shows "Disconnected" | Make sure `ui_server.py` is running |
| Jobs not showing in dashboard | Check that `data/jobs.json` exists and is writable |

---

## Dashboard API Endpoints

When the UI server is running, these endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the dashboard HTML |
| `/api/status` | GET | Returns system status, job counts, cron jobs |
| `/api/jobs` | GET | Returns all jobs |
| `/api/activity` | GET | Returns recent activity log |
| `/api/submit` | POST | Submit a new job (JSON body) |
| `/api/jobs/clear` | POST | Clear completed/failed jobs |
