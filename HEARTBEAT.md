# Heartbeat Checks

1. Read `CIRCUIT_BREAKER.md` — if status is `STOP` or `PAUSE`, obey immediately
2. Check `ops-log.json` — look for repeated failures or loops (3+ same error in a row = halt)

## Agent Monitor System

When you receive `AGENT_HEARTBEAT_PING` event:
- Update `agent-monitor/state.json` with current timestamp and status
- This keeps the "alive" signal fresh

When you receive `AGENT_WATCHDOG_CHECK` message:
- Check `agent-monitor/state.json` for last heartbeat
- If no heartbeat in last 10 minutes → send alert to Master E
- If heartbeat is recent → silent (no action needed)

### State Tracking Format

```json
{
  "lastHeartbeat": "2026-03-29T22:00:00.000Z",
  "status": "online|offline|error",
  "sessionKey": "agent:main:discord:channel:..."
}
```
