# Config Changelog — Revert Reference
*Document all config changes so we can roll back if needed.*

---

## 2026-03-28 — Batch Processing Cost Optimization

### Change 1: Task Queue Cron — Switch from GPT-5.4 to Kimi
**Before:** model: openai/gpt-5.4
**After:** model: ollama/kimi-k2.5:cloud
**Job ID:** 27b855b5-4220-44a2-9230-188cd0bcc483
**Reason:** Simple task assignment doesn't need expensive model
**Savings:** ~$7/month
**Revert:** Update cron job model back to openai/gpt-5.4

### Change 2: Security Scan — Keep GPT-5.4 (no change)
**Reason:** Security scan needs reliable command execution, worth the $0.20/week

### Change 3: Heartbeat — Reduce to HEARTBEAT.md check only
**Before:** 30 min heartbeat on Opus (main session)
**After:** Heartbeat still runs but HEARTBEAT.md is minimal (just circuit breaker check)
**Reason:** Each heartbeat processes full Opus context. Keep it lightweight.
**Revert:** Add more checks back to HEARTBEAT.md

---

## How to Revert Any Change
1. Find the change in this file
2. Follow the "Revert" instructions
3. For cron jobs: use `openclaw cron list` to find job ID, then update via cron tool
4. For config: `openclaw config set <path> <old-value>`
5. For files: check git history: `git log --oneline` then `git checkout <hash> -- <file>`
