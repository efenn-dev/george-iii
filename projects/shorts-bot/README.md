# Shorts Bot

A video processing pipeline that converts highlight clips to vertical shorts format (9:16) and uploads them to social platforms.

## Overview

This tool takes video clips, converts them to 1080x1920 vertical format suitable for YouTube Shorts and TikTok, and handles an approval workflow before posting.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

3. Install FFmpeg:
- **Windows**: Download from https://ffmpeg.org/download.html and add to PATH
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

## Usage

### Process clips from the clips folder:
```bash
python main.py --input clips/ --output output/
```

### Auto-approve all clips (skip approval):
```bash
python main.py --input clips/ --auto
```

### Upload to social platforms after processing:
```bash
python main.py --input clips/ --post --platforms youtube,tiktok
```

### Enable subtitles (looks for matching .srt files):
```bash
python main.py --input clips/ --subtitles
```

## CLI Options

| Flag | Description |
|------|-------------|
| `-i, --input` | Input directory or file (default: ./input) |
| `-o, --output` | Output directory (default: ./output) |
| `--subtitles` | Enable subtitle overlay |
| `--auto` | Auto-approve all clips (skip workflow) |
| `--post` | Upload to social platforms after export |
| `--platforms` | Comma-separated platforms: youtube,tiktok |
| `--keep-temp` | Keep temporary preview files |
| `-v, --verbose` | Enable verbose logging |

## Workflow

1. Drop video files into the `clips/` folder
2. Run the processor with desired options
3. Review each clip (or use `--auto` to skip)
4. Approved clips are exported to `output/`
5. If `--post` is set, uploads to configured platforms

## Supported Video Formats

- .mp4
- .mov
- .avi
- .mkv
- .webm
- .m4v
- .flv

## Environment Variables

| Variable | Description |
|----------|-------------|
| `YT_CLIENT_SECRETS` | Path to YouTube OAuth2 credentials JSON |
| `YT_TITLE_PREFIX` | Optional prefix for video titles |
| `TIKTOK_SESSION_ID` | TikTok session cookie for uploads |

## API Integration

The Shorts Bot integrates with Mission Control for web-based management:
- Upload videos via the web UI
- Monitor processing queue
- View status and history

See the Mission Control Shorts Bot page for the web interface.
