# George III — AI Agent Framework 👑

An autonomous AI agent system built on [OpenClaw](https://openclaw.ai) that runs businesses, delegates tasks, and manages itself with minimal human input.

Built by [@swagnugget](https://github.com/swagnugget) and his agent George III.

## What Is This?

George III is a multi-agent AI system that:
- **Orchestrates** a fleet of specialized AI agents (Coder, Scribe, QA Bot)
- **Runs businesses** autonomously (Etsy digital download shop, Fiverr freelancing)
- **Manages itself** with crash protection, auto-restart, and circuit breakers
- **Tracks everything** through a custom Mission Control dashboard

## Agent Fleet

| Agent | Model | Role |
|-------|-------|------|
| 👑 George III | Claude Opus | Orchestrator — strategy, planning, delegation |
| ⚡ Coder | GPT-5.4 | All coding, scripts, apps, debugging |
| 📚 Scribe | Kimi K2.5 (local) | Research, writing, content — FREE |
| 🤖 QA Bot | Automated | Quality gate before human approval |

## Features

### 🛡️ Self-Healing Infrastructure
- **Gateway Watchdog** — auto-restarts OpenClaw gateway every 2 minutes if down
- **Loop Breaker** — detects and kills infinite loops, resets stuck sessions
- **Circuit Breaker** — one-click emergency stop via desktop shortcut
- **Mission Control Server** — auto-restart on crash

### 📋 Mission Control (Web Dashboard)
A React + Express + SQLite app featuring:
- **Kanban Board** — 6-column workflow (Backlog → Assigned → In Progress → In Review → Approved → Done)
- **Agent Org Chart** — visual hierarchy of the agent fleet
- **Etsy Pipeline** — 7-stage product launch workflow
- **QA Bot** — automated quality checks before human approval
- **System Controls** — circuit breaker UI, gateway management, logs

### 💰 Business Automation
- **Etsy Shop** — automated pack building, listing templates, SEO optimization
- **Fiverr Freelancing** — 5 gig templates, fulfillment specs, portfolio samples
- **Task Queue** — cron job polls kanban every 30 min, auto-assigns work to agents

## Quick Start

### Prerequisites
- [Node.js 24+](https://nodejs.org)
- [OpenClaw](https://openclaw.ai) — `npm i -g openclaw && openclaw setup`
- API keys for at least one provider (Anthropic, OpenAI, or Ollama for free local)

### Install
```bash
git clone https://github.com/swagnugget/george-iii.git
cd george-iii

# Copy to your OpenClaw workspace
cp -r * ~/.openclaw/workspace/

# Create your personal files (not included for privacy)
cp USER.md.example USER.md    # Edit with your info
cp MEMORY.md.example MEMORY.md  # Start fresh

# Set up Mission Control
cd projects/mission-control/app/server && npm install
cd ../client && npm install
```

### Configure Agents
```bash
# Main agent (you)
openclaw agents list

# Add coding agent
openclaw agents add coding --workspace ~/.openclaw/workspace-coding --model openai/gpt-5.4

# Add research agent  
openclaw agents add research --workspace ~/.openclaw/workspace-research --model ollama/kimi-k2.5:cloud
```

### Run
```bash
# Start the gateway
openclaw gateway start

# Start Mission Control
cd projects/mission-control/app/server && node src/index.js &
cd ../client && npx vite dev &

# Install watchdog (Windows)
# Run gateway-watchdog.ps1 setup section or register as scheduled task
```

## File Structure

```
├── AGENTS.md              # Agent behavior rules
├── SOUL.md                # Personality and vibe
├── IDENTITY.md            # Name, emoji, creature type
├── HEARTBEAT.md           # Heartbeat check config
├── CIRCUIT_BREAKER.md     # Emergency stop system
├── loop-breaker.ps1       # Anti-loop crash protection
├── gateway-watchdog.ps1   # Auto-restart watchdog
├── ops-logger.ps1         # Operations logging
├── etsy-shop/
│   ├── BUSINESS_PLAN.md   # Etsy business strategy
│   ├── PIPELINE.md        # Agent workflow pipeline
│   ├── LAUNCH_NOW.md      # Step-by-step launch guide
│   ├── optimize-packs.py  # PNG optimizer for 20MB limit
│   ├── pack-builder.ps1   # Auto-build design packs
│   └── listings/          # SEO-optimized listing templates
├── fiverr-gigs/
│   ├── emmittfennessey-gigs.md  # 5 complete gig templates
│   ├── fulfillment-specs.md     # What to deliver per tier
│   └── portfolio/               # Sample portfolio pieces + HTML viewer
├── projects/
│   └── mission-control/         # React + Express dashboard app
│       └── app/
│           ├── server/          # Express API + SQLite + QA Bot
│           └── client/          # React + Vite frontend
└── shorts-bot/                  # Video automation tool
```

## Desktop Shortcuts (Windows)

| File | Action |
|------|--------|
| `STOP-GEORGE.bat` | 🔴 Emergency kill — stops agent, resets session |
| `RESUME-GEORGE.bat` | 🟢 Resume operations |
| `GEORGE-STATUS.bat` | 🔍 Health check |
| `OPTIMIZE-PACKS.bat` | 📦 Resize and split Etsy packs under 20MB |

## How It Works

```
You (Discord) → George III (Opus) → Delegates to:
                                     ├── ⚡ Coder (GPT-5.4) → Code tasks
                                     ├── 📚 Scribe (Kimi) → Writing tasks (FREE)
                                     └── 🤖 QA Bot → Quality check
                                          └── You approve → Done
```

## Cost Structure

| Component | Cost |
|-----------|------|
| George III (Opus) | ~$15/MTok input, $75/MTok output |
| Coder (GPT-5.4) | ~$0.19 per task |
| Scribe (Kimi local) | **FREE** |
| QA Bot | **FREE** (automated) |
| Etsy listings | $0.20 each |
| Fiverr | Free to list, 20% commission on sales |

**Strategy:** Delegate everything possible to Scribe (free). Use Opus only for orchestration. One $45 Fiverr order covers a full day of API costs.

## License

MIT — use it, modify it, build on it. Just don't blame George if he gets too autonomous. 👑

## Credits

- Built with [OpenClaw](https://openclaw.ai)
- Agent models: [Anthropic Claude](https://anthropic.com), [OpenAI](https://openai.com), [Ollama](https://ollama.ai)
- The royal lineage: George I (gone), George II (gone), **George III** (long may he reign)
