# Mission Control — Agent Development Hub

## Vision
A web app that serves as the central dashboard for managing, developing, and deploying AI agents.
Think: GitHub + task manager + agent console, purpose-built for Emmitt's workflow.

## Core Features (MVP)

### 1. Agent Registry
- List all active/defined agents with status, last run, cost
- Create new agent definitions (name, purpose, model, tools, schedule)
- Edit agent prompts and configs inline

### 2. Project Boards
- Kanban-style boards per project domain (Content, Trading, Dev, Merch, DIY)
- Cards created from Discord briefs or manually
- Status: Backlog → In Progress → Done → Archived

### 3. Run Monitor
- Live feed of agent runs (cron jobs, manual triggers)
- Per-run: model used, tokens, cost, duration, output summary
- Error log with retry button

### 4. Idea Pipeline
- Capture from Discord #ideas-inbox automatically
- Categorize and assign to project board
- Mark as actioned/deferred/dropped

### 5. Cost Tracker
- Daily/weekly/monthly API cost breakdown
- Per-agent cost attribution
- Budget alerts

## Tech Stack (proposed)
- **Frontend:** React + Vite (fast, lightweight)
- **Backend:** Node.js + Express (fits OpenClaw ecosystem)
- **DB:** SQLite (local, zero-infra, portable)
- **Auth:** Single-user, token-based (no need for multi-user complexity yet)
- **Discord integration:** Reads from OpenClaw state/cron API

## Phase 1 (Build Now)
- [ ] Project scaffold (React + Vite frontend, Express backend)
- [ ] SQLite schema (agents, projects, tasks, runs, costs)
- [ ] Agent Registry page (list + basic CRUD)
- [ ] Run Monitor page (pull from cron runs)
- [ ] Basic dashboard (project summary cards)

## Phase 2
- [ ] Discord brief ingestion (poll #ideas-inbox, create task cards)
- [ ] Cost tracking with charts
- [ ] Agent builder UI (edit prompts, schedules, tools)

## Phase 3
- [ ] Video pipeline integration (content briefs → editing queue)
- [ ] Trading bot management panel
- [ ] Mobile-friendly PWA

## Location
C:\Users\efenn\.openclaw\workspace\projects\mission-control\
