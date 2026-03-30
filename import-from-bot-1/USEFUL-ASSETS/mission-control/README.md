# Mission Control — Agent Dashboard

*React + Express + SQLite dashboard for managing AI agents and tasks.*

---

## Overview

A web application that serves as the central hub for managing, developing, and deploying AI agents. Think: GitHub + task manager + agent console.

## Core Features

### 1. Agent Registry
- List all active agents with status, last run, cost
- Create/edit agent definitions (name, purpose, model, tools)
- View per-agent cost attribution

### 2. Project Boards
- Kanban-style boards per domain (Content, Trading, Dev, Merch, DIY)
- Cards created from Discord briefs or manually
- Status: Backlog → In Progress → Done → Archived

### 3. Run Monitor
- Live feed of agent runs (cron jobs, manual triggers)
- Per-run: model used, tokens, cost, duration, output summary
- Error log with retry capability

### 4. Cost Tracker
- Daily/weekly/monthly API cost breakdown
- Per-agent cost attribution
- Budget alerts

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | SQLite (zero-infra, portable) |
| Auth | Single-user token-based |

---

## Quick Start

### Install Dependencies

```bash
cd app/server && npm install
cd ../client && npm install
```

### Configure Environment

```bash
# In app/server, create .env:
PORT=3001
DB_PATH=./mission-control.db
```

### Run Development Servers

```bash
# Terminal 1: Backend
cd app/server && npm run dev

# Terminal 2: Frontend  
cd app/client && npm run dev
```

Open http://localhost:5173 (or whatever Vite assigns)

---

## Project Structure

```
mission-control/
├── app/
│   ├── server/          # Express API + SQLite
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   └── db.js
│   │   └── package.json
│   └── client/          # React + Vite
│       ├── src/
│       ├── public/
│       └── package.json
├── SPEC.md              # Original spec document
└── README.md            # This file
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Create new agent |
| `/api/agents/:id` | GET | Get agent details |
| `/api/agents/:id` | PUT | Update agent |
| `/api/tasks` | GET | List all tasks |
| `/api/tasks` | POST | Create task |
| `/api/tasks/:id` | PUT | Update task status |
| `/api/runs` | GET | List agent runs |
| `/api/costs` | GET | Cost breakdown |
| `/api/health` | GET | Server health check |

---

## Database Schema (SQLite)

### agents
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT,
  purpose TEXT,
  status TEXT,
  last_run DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### tasks
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog',
  agent_id INTEGER,
  project TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### runs
```sql
CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER,
  task_id INTEGER,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost REAL,
  duration_ms INTEGER,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Frontend Structure

```
client/src/
├── components/          # Reusable UI components
├── pages/               # Route pages
│   ├── Dashboard.jsx
│   ├── Agents.jsx
│   ├── Tasks.jsx
│   └── Costs.jsx
├── hooks/               # Custom React hooks
├── utils/               # Helper functions
└── App.jsx              # Main app component
```

---

## Building for Production

```bash
# Build frontend
cd app/client && npm run build

# The built files go to app/server/public/
# Then just run the server:
cd app/server && npm start
```

---

## Integration with OpenClaw

The dashboard can read from OpenClaw's state:
- Poll cron jobs for run history
- Read agent definitions from workspace
- Display real-time session status

---

## Roadmap

### Phase 1 (MVP)
- [x] Project scaffold
- [ ] SQLite schema
- [ ] Agent Registry page
- [ ] Basic Kanban board
- [ ] Run Monitor

### Phase 2
- [ ] Discord brief ingestion
- [ ] Cost tracking with charts
- [ ] Agent builder UI

### Phase 3
- [ ] Video pipeline integration
- [ ] Trading bot panel
- [ ] Mobile PWA

---

*Mission Control v0.1 | Dashboard for AI Agent Management*
