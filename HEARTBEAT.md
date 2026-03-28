# Heartbeat Checks

1. Read `CIRCUIT_BREAKER.md` — if status is `STOP` or `PAUSE`, obey immediately
2. Check `ops-log.json` — look for repeated failures or loops (3+ same error in a row = halt)
