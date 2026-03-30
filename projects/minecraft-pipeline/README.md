# Minecraft Recording & YouTube Pipeline

Automated pipeline for recording Minecraft gameplay, syncing multi-device captures, detecting highlights, assembling branded videos, generating captions and thumbnails, drafting metadata, and preparing uploads to YouTube.

## Project Structure

```text
minecraft-pipeline/
├── config/
│   ├── pipeline_config.yaml
│   └── client_secrets.json
├── scripts/
│   ├── 01_auto_record.py
│   ├── 02_collect_sync.py
│   ├── 03_highlight_detect.py
│   ├── 04_assemble_brand.py
│   ├── 05_caption.py
│   ├── 06_thumbnail.py
│   ├── 07_metadata.py
│   ├── 08_upload.py
│   └── run_pipeline.py
├── assets/
│   ├── intro.mp4
│   ├── outro.mp4
│   ├── logo.png
│   ├── overlay.png
│   └── fonts/
│       └── Montserrat-Bold.ttf
├── raw/
│   ├── pc/
│   └── device/
├── processed/
│   ├── synced/
│   ├── highlights/
│   ├── branded/
│   ├── captioned/
│   └── final/
├── thumbnails/
├── metadata/
├── logs/
└── requirements.txt
```

## Prerequisites

- Windows 10/11
- Python 3.10+
- OBS Studio 28+ with WebSocket enabled
- FFmpeg and ffprobe available on PATH
- Google Cloud OAuth client for YouTube uploads
- OpenAI API key if using AI metadata generation

## Install Dependencies

```bash
pip install -r requirements.txt
```

Equivalent install command from the playbook:

```bash
pip install obsws-python psutil watchdog "scenedetect[opencv]" openai-whisper moviepy Pillow google-api-python-client google-auth-oauthlib pyacoustid scipy pyyaml openai
```

## Configuration

1. Edit `config/pipeline_config.yaml`
2. Set your OBS WebSocket password for the primary PC
3. Set child device OBS settings if used
4. Place Google OAuth credentials at `config/client_secrets.json`
5. Add branding assets:
   - `assets/intro.mp4`
   - `assets/outro.mp4`
   - `assets/logo.png`
   - `assets/overlay.png`
   - `assets/fonts/Montserrat-Bold.ttf`

## Stage Usage

Run from the `scripts/` directory.

### Stage 1: Auto recording

```bash
python 01_auto_record.py
```

### Stage 2: Collect and sync

```bash
python 02_collect_sync.py
python 02_collect_sync.py --method ntp_timestamp
```

### Stage 3: Highlight detection

```bash
python 03_highlight_detect.py
python 03_highlight_detect.py --threshold 30 --max-highlights 10
```

### Stage 4: Assembly and branding

```bash
python 04_assemble_brand.py
```

### Stage 5: Captioning

```bash
python 05_caption.py
python 05_caption.py --model medium --no-burn-in
```

### Stage 6: Thumbnail generation

```bash
python 06_thumbnail.py --title "We Found DIAMONDS!" --episode 14
```

### Stage 7: Metadata drafting

```bash
python 07_metadata.py
python 07_metadata.py --provider template
```

### Stage 8: Upload

```bash
python 08_upload.py
python 08_upload.py --privacy unlisted
python 08_upload.py --dry-run
```

## Orchestrator

Run the full batch pipeline:

```bash
python run_pipeline.py --full
```

Run an individual stage:

```bash
python run_pipeline.py --stage 3
```

Run a stage range:

```bash
python run_pipeline.py --stage 4-8
```

Preview without executing:

```bash
python run_pipeline.py --full --dry-run
```

Enable child-safe mode:

```bash
python run_pipeline.py --full --child-safe
```

## Child Safety Defaults

- Child webcam capture disabled by default
- Child voice recording disabled by default
- Upload privacy defaults to `unlisted`
- Parent review required before publishing
- Transcript content filtering enabled

## Output Locations

- Synced clips: `processed/synced/`
- Highlight clips: `processed/highlights/`
- Branded video: `processed/branded/`
- Captioned video: `processed/captioned/`
- Final upload artifacts: `metadata/`, `thumbnails/`
- Logs: `logs/`

## Notes

- This project was generated from the pipeline playbook.
- No dependencies were installed and no scripts were executed.
- Empty working directories include `.gitkeep` placeholders.
