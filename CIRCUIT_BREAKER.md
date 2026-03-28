# ðŸ›‘ CIRCUIT BREAKER

## Current Status

```
status: RUN
```

---

## Emergency Controls (Desktop Shortcuts)

**Three .bat files are on your Desktop:**

| File | What It Does |
|------|-------------|
| `STOP-GEORGE.bat` | ðŸ”´ Immediately kills George, resets session, sets breaker to STOP |
| `RESUME-GEORGE.bat` | ðŸŸ¢ Sets breaker back to RUN so George can operate |
| `GEORGE-STATUS.bat` | ðŸ” Checks if George is looping and shows breaker status |

**Just double-click to use. No terminal needed.**

---

## Automatic Loop Detection

A scheduled task (`OpenClaw-Loop-Breaker`) runs every 3 minutes and:
1. Checks gateway logs for repeated errors
2. Checks if gateway is unresponsive
3. If 3 consecutive checks fail â†’ auto-kills George and sets STOP

---

## PowerShell Commands (if you prefer terminal)

```powershell
# Check status
.\loop-breaker.ps1

# Emergency kill
.\loop-breaker.ps1 -ForceReset

# Resume after kill
.\loop-breaker.ps1 -Resume

# Run continuous monitor (watches every 60 sec, auto-kills on 3 strikes)
.\loop-breaker.ps1 -Monitor
```

---

## Discord Commands

Type in #snapi-george:
- **"george stop"** â†’ I halt immediately
- **"george pause"** â†’ I finish current task then stop
- **"george resume"** â†’ Resume operations
- **"george status"** â†’ Report what I'm doing

---

## How George Reads This File

George checks `status:` in this file at every heartbeat (30 min) and before spawning sub-agents.

- `RUN` â†’ Normal operation
- `STOP` â†’ Full halt, wait for resume
- `PAUSE` â†’ Finish current task, then halt

---

## Recent Halts

| Time | Reason | Resolution |
|------|--------|-----------|
| â€” | No halts yet | â€” |


