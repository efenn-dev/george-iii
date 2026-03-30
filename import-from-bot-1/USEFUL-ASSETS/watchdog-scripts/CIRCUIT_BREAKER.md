# CIRCUIT_BREAKER.md Template
# Copy to your workspace root and update status as needed

# 🛡️ CIRCUIT BREAKER

## Current Status

```
status: RUN
```

---

## Emergency Controls

Create these desktop shortcuts for emergency control:

| File | Action |
|------|--------|
| `STOP-AGENT.bat` | 🔴 Immediately kills agent, resets session, sets STOP |
| `RESUME-AGENT.bat` | 🟢 Sets breaker back to RUN |
| `AGENT-STATUS.bat` | 🔍 Checks health and breaker status |

---

## PowerShell Commands

```powershell
# Check status
.\loop-breaker.ps1

# Emergency kill
.\loop-breaker.ps1 -ForceReset

# Resume after kill
.\loop-breaker.ps1 -Resume
```

---

## Status Values

| Status | Meaning |
|--------|---------|
| `RUN` | Normal operation |
| `STOP` | Full halt, wait for resume |
| `PAUSE` | Finish current task, then halt |

---

## Recent Halts

| Time | Reason | Resolution |
|------|--------|-----------|
| — | No halts yet | — |

