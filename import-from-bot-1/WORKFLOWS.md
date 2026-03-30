# WORKFLOWS.md

**Operational Documentation for AI Agent Framework**

---

## Table of Contents

1. [Agent Orchestration Workflow](#1-agent-orchestration-workflow)
2. [Etsy Shop Pipeline](#2-etsy-shop-pipeline)
3. [Video Shorts Workflow](#3-video-shorts-workflow)
4. [Emergency Procedures](#4-emergency-procedures)
5. [Daily Operations](#5-daily-operations)

---

## 1. Agent Orchestration Workflow

### Overview

The system uses a "captain and crew" model where one orchestrator delegates to specialized agents.

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER E (Human)                        │
│                      Final Approval                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 GEORGE III (Orchestrator)                   │
│              Model: Claude Opus (anthropic)                 │
│              Role: Strategy, planning, delegation           │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   CODER     │  │   SCRIBE    │  │   QA BOT    │
│  (GPT-5.4)  │  │(Kimi/Ollama)│  │ (Automated) │
│ Programming │  │   Writing   │  │  Quality    │
│   Scripts   │  │  Research   │  │   Gate      │
└─────────────┘  └─────────────┘  └─────────────┘
```

### When to Delegate

| Task Type | Delegate To | Cost |
|-----------|-------------|------|
| Coding (Python, JS, SQL) | Coder | ~$0.19 |
| Research, writing, SEO | Scribe | **FREE** |
| Strategy, orchestration | George III | ~$0.50-2.00 |
| Quality check | QA Bot | **FREE** |

### Delegation Pattern

1. **George III** receives task from Master E
2. **Analyzes** task complexity and required skills
3. **Delegates** to appropriate agent with clear spec
4. **Reviews** output before presenting to Master E
5. **QA Bot** gates all external-facing work

---

## 2. Etsy Shop Pipeline

### The 7-Stage Pipeline

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│DISCOVER │───▶│ CURATE  │───▶│ OPTIMIZE│───▶│ LISTING │
│ (Scribe)│    │(Master E│    │ (Coder) │    │(Scribe) │
└─────────┘    │+ George)│    └─────────┘    └─────────┘
               └─────────┘         │              │
                                    │              ▼
                              ┌─────────┐    ┌─────────┐
                              │  ZIPs   │◀───│  Paste  │
                              │ Ready   │    │ Listing │
                              └─────────┘    └────┬────┘
                                                  │
┌─────────┐    ┌─────────┐    ┌─────────┐        │
│ MONITOR │◀───│ PROMOTE │◀───│ PUBLISH │◀───────┘
│(George + │    │(Scribe) │    │(Master E│
│ Coder)  │    └─────────┘    └─────────┘
└─────────┘
```

### Stage Details

#### Stage 1: DISCOVER (Scribe)
- Research trending niches on Etsy
- Identify seasonal opportunities
- Analyze competitor pricing and tags
- **Output:** Niche report with recommended pack themes

#### Stage 2: CURATE (Master E + George)
- Scan design library for matching assets
- Master E reviews and picks designs
- George packages into preliminary packs
- **Output:** Curated pack folder in OneDrive

#### Stage 3: OPTIMIZE (Coder)
- Run `optimize-packs.py`
- Resize PNGs to 2500px max
- Split into ZIPs under 20MB
- Add README-LICENSE.txt
- **Output:** Upload-ready ZIPs in `ready-to-upload/`

#### Stage 4: LISTING (Scribe + George)
- Scribe writes SEO-optimized title (max 140 chars)
- Scribe generates 13 tags
- Scribe writes product description
- George reviews and finalizes
- **Output:** Listing template ready to paste

#### Stage 5: PUBLISH (Master E)
- Upload ZIPs to Etsy listing
- Copy-paste title, tags, description
- Add listing photos (mockups + preview)
- Set price and publish
- **Output:** Live listing

#### Stage 6: PROMOTE (Scribe)
- Write Pinterest pin descriptions
- Draft social media posts
- **Output:** Marketing copy

#### Stage 7: MONITOR (George + Coder)
- Track views, favorites, sales per listing
- Identify top performers
- Create new packs in winning niches
- **Output:** Data-driven decisions

### Key Scripts

```powershell
# Build all packs from source folders
.\pack-builder.ps1

# Optimize and ZIP packs
python optimize-packs.py

# Desktop shortcut for optimization
OPTIMIZE-PACKS.bat
```

---

## 3. Video Shorts Workflow

### Overview

Converts landscape video clips to vertical 9:16 Shorts format with Discord approval.

### Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Source     │────▶│  Process    │────▶│   Discord   │
│   Clip      │     │  (FFmpeg)   │     │  Approval   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼────┐           ┌────▼────┐
    │  ✅ ✅   │           │  ❌ ❌   │
    │ Approve │           │  Reject  │
    └────┬────┘           └─────────┘
         │
    ┌────▼────────────┐
    │   YouTube       │
    │   TikTok        │
    │   Instagram     │
    └─────────────────┘
```

### Video Processing

The blur background effect:
1. Scales and blurs a copy to fill 1080×1920 frame
2. Places original (scaled to 1080px wide) centered on top
3. Fills vertical frame without cropping action

### Commands

```powershell
# Basic usage
python main.py --input .\clips\video.mp4 --title "My Short"

# Skip approval (testing)
python main.py --input .\clips\video.mp4 --title "Test" --skip-approval

# No blur background
python main.py --input .\clips\video.mp4 --title "My Short" --no-blur-bg

# Web dashboard
python ui_server.py
# Then open http://localhost:8888
```

---

## 4. Emergency Procedures

### Circuit Breaker System

The system has a three-tier emergency stop:

| Level | Trigger | Action | Recovery |
|-------|---------|--------|----------|
| **PAUSE** | Manual command | Finish current task, then stop | `RESUME-GEORGE.bat` |
| **STOP** | Manual or 3 loop detects | Immediate halt | `RESUME-GEORGE.bat` |
| **Force Reset** | Desktop shortcut | Kill process, clear session | Manual restart |

### Emergency Commands

```powershell
# Check status
.\loop-breaker.ps1

# Emergency kill
.\loop-breaker.ps1 -ForceReset

# Resume after kill
.\loop-breaker.ps1 -Resume
```

### Discord Emergency

Type in #snapi-george:
- `"george stop"` → Immediate halt
- `"george pause"` → Finish task, then halt
- `"george resume"` → Resume operations
- `"george status"` → Report current activity

### Desktop Shortcuts

| File | Action |
|------|--------|
| `STOP-GEORGE.bat` | 🔴 Emergency kill + reset |
| `RESUME-GEORGE.bat` | 🟢 Resume operations |
| `GEORGE-STATUS.bat` | 🔍 Health check |

---

## 5. Daily Operations

### Morning (5 min)

```
1. Check CIRCUIT_BREAKER.md — should say "status: RUN"
2. Check Discord for overnight messages
3. Review Mission Control kanban for new tasks
```

### Heartbeat (every 30 min)

```
1. Check ops-log.json for errors
2. Check gateway health (auto via watchdog)
3. If nothing urgent → NO_REPLY (silent)
```

### Evening (5 min)

```
1. Update MEMORY.md with significant events
2. Check Etsy shop for new orders/favorites
3. Queue tomorrow's priorities in kanban
```

### Weekly (30 min)

```
1. Review all agent costs
2. Clean up old logs
3. Archive completed tasks
4. Plan next week's pack launches
```

---

## Task Templates

### Creating a New Etsy Pack

```markdown
## New Pack: [THEME]

**Designs needed:** X
**Source folder:** D:\Pictures\[folder]
**Target niche:** [audience]
**Seasonal urgency:** [date or none]

### Tasks
- [ ] CURATE: Select designs from source folder
- [ ] OPTIMIZE: Run optimize-packs.py
- [ ] LISTING: Generate title/tags/description
- [ ] PUBLISH: Create Etsy listing
- [ ] PROMOTE: Write social copy

### Assigned to
- Scribe: SEO research, listing copy
- Coder: Pack optimization
- Master E: Final approval + publish
```

### Creating a New Video

```markdown
## Video: [TITLE]

**Source clip:** [path]
**Target platforms:** YouTube / TikTok / Instagram
**Duration limit:** 60s / 30s / custom
**Blur background:** Yes / No

### Tasks
- [ ] Submit to processing queue
- [ ] Discord approval
- [ ] Upload to platforms
- [ ] Schedule/cross-post

### Assigned to
- Coder: FFmpeg processing
- George III: Discord approval monitoring
- Master E: React ✅/❌ on Discord
```

---

## File Locations Quick Reference

| What | Where |
|------|-------|
| Agent config | `AGENTS.md`, `SOUL.md` |
| Daily logs | `memory/YYYY-MM-DD.md` |
| Long-term memory | `MEMORY.md` |
| Emergency stop | `CIRCUIT_BREAKER.md` |
| Etsy templates | `etsy-shop/listings/` |
| Video scripts | `shorts-bot/` |
| Dashboard | `projects/mission-control/` |
| Watchdog logs | `gateway-watchdog.log` |

---

*Workflows v1.0 | George III 👑*
