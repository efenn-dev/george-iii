import { Router } from 'express';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const router = Router();

const GATEWAY_URL = 'http://127.0.0.1:18789';
const OLLAMA_URL = 'http://localhost:11434';
const CIRCUIT_BREAKER_PATH = 'C:\\Users\\efenn\\.openclaw\\workspace\\CIRCUIT_BREAKER.md';
const WEEKLY_BACKUP_SCRIPT = 'C:\\Users\\efenn\\.openclaw\\workspace\\weekly-backup.ps1';

const TASKS = {
  watchdog: 'OpenClaw-Gateway-Watchdog',
  loopBreaker: 'OpenClaw-Loop-Breaker',
  weeklyBackup: 'OpenClaw-Weekly-Backup',
};

async function fetchJsonWithTimeout(url, timeoutMs = 3000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  } catch {
    return null;
  }
}

function runPowerShell(command) {
  return execSync(`powershell -NoProfile -Command "${command}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getScheduledTaskStatus(taskName) {
  try {
    const raw = runPowerShell(`$task = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction Stop; $task | Select-Object State,Settings | ConvertTo-Json -Depth 4`);
    const parsed = JSON.parse(raw);
    const state = String(parsed?.State || '').toLowerCase();
    const enabled = parsed?.Settings?.Enabled !== false;
    return {
      status: enabled ? 'running' : 'stopped',
      state,
      enabled,
      taskName,
    };
  } catch {
    return {
      status: 'stopped',
      state: 'unknown',
      enabled: false,
      taskName,
    };
  }
}

function setScheduledTaskEnabled(taskName, enabled) {
  const action = enabled ? 'Enable-ScheduledTask' : 'Disable-ScheduledTask';
  runPowerShell(`${action} -TaskName '${taskName}' | Out-Null`);
  return getScheduledTaskStatus(taskName);
}

function readCircuitBreakerStatus() {
  try {
    if (!existsSync(CIRCUIT_BREAKER_PATH)) return 'RUN';
    const content = readFileSync(CIRCUIT_BREAKER_PATH, 'utf8');
    const match = content.match(/^status:\s*(RUN|STOP|PAUSE)\s*$/im);
    return match?.[1] || 'RUN';
  } catch {
    return 'RUN';
  }
}

function writeCircuitBreakerStatus(status) {
  const nextStatus = String(status || '').toUpperCase();
  if (!['RUN', 'STOP', 'PAUSE'].includes(nextStatus)) {
    throw new Error('Invalid circuit breaker status');
  }

  const content = existsSync(CIRCUIT_BREAKER_PATH)
    ? readFileSync(CIRCUIT_BREAKER_PATH, 'utf8')
    : 'status: RUN\n';

  const updated = /^status:\s*(RUN|STOP|PAUSE)\s*$/im.test(content)
    ? content.replace(/^status:\s*(RUN|STOP|PAUSE)\s*$/im, `status: ${nextStatus}`)
    : `status: ${nextStatus}\n${content}`;

  writeFileSync(CIRCUIT_BREAKER_PATH, updated, 'utf8');
  return nextStatus;
}

function getDiskSpace() {
  try {
    const raw = runPowerShell("Get-PSDrive C,D | Select-Object Name,Free,Used | ConvertTo-Json");
    const parsed = JSON.parse(raw);
    const drives = Array.isArray(parsed) ? parsed : [parsed];
    const result = {};

    for (const drive of drives) {
      if (!drive?.Name) continue;
      const name = String(drive.Name).toLowerCase();
      const free = Number(drive.Free || 0);
      const used = Number(drive.Used || 0);
      result[name] = {
        freeGB: Number((free / 1024 / 1024 / 1024).toFixed(1)),
        usedGB: Number((used / 1024 / 1024 / 1024).toFixed(1)),
      };
    }

    return result;
  } catch {
    return {};
  }
}

function formatUptime() {
  try {
    const raw = runPowerShell("(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')");
    const bootTime = new Date(raw);
    if (Number.isNaN(bootTime.getTime())) return 'Unknown';
    const elapsedMs = Date.now() - bootTime.getTime();
    const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  } catch {
    return 'Unknown';
  }
}

function getBackupScriptStatus() {
  return {
    exists: existsSync(WEEKLY_BACKUP_SCRIPT),
    path: WEEKLY_BACKUP_SCRIPT,
  };
}

// GET /api/system/status — full system health check
router.get('/status', async (req, res) => {
  const [gatewayHealth, ollamaVersion] = await Promise.all([
    fetchJsonWithTimeout(`${GATEWAY_URL}/health`, 3000),
    fetchJsonWithTimeout(`${OLLAMA_URL}/api/version`, 3000),
  ]);

  const watchdog = getScheduledTaskStatus(TASKS.watchdog);
  const loopBreaker = getScheduledTaskStatus(TASKS.loopBreaker);
  const weeklyBackup = getScheduledTaskStatus(TASKS.weeklyBackup);
  const circuitStatus = readCircuitBreakerStatus();
  const diskSpace = getDiskSpace();
  const uptime = formatUptime();

  res.json({
    gateway: {
      status: gatewayHealth ? 'online' : 'offline',
      online: Boolean(gatewayHealth),
      url: GATEWAY_URL,
    },
    missionControl: {
      status: 'online',
      online: true,
    },
    ollama: {
      status: ollamaVersion ? 'online' : 'offline',
      online: Boolean(ollamaVersion),
      version: ollamaVersion?.version || 'Unavailable',
    },
    watchdog,
    loopBreaker,
    weeklyBackup,
    circuitBreaker: {
      status: circuitStatus,
    },
    diskSpace: {
      c: diskSpace.c || null,
      d: diskSpace.d || null,
    },
    uptime,
    activeModel: ollamaVersion?.version || null,
    checkedAt: new Date().toISOString(),
    backupScript: getBackupScriptStatus(),
  });
});

// POST /api/system/watchdog — enable/disable watchdog
router.post('/watchdog', (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const task = setScheduledTaskEnabled(TASKS.watchdog, enabled);
    res.json({ ok: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update watchdog task' });
  }
});

// POST /api/system/loop-breaker — enable/disable loop breaker
router.post('/loop-breaker', (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const task = setScheduledTaskEnabled(TASKS.loopBreaker, enabled);
    res.json({ ok: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update loop breaker task' });
  }
});

// POST /api/system/weekly-backup — enable/disable weekly backup task
router.post('/weekly-backup', (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const task = setScheduledTaskEnabled(TASKS.weeklyBackup, enabled);
    res.json({ ok: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update weekly backup task' });
  }
});

// POST /api/system/circuit-breaker — set circuit breaker status
router.post('/circuit-breaker', (req, res) => {
  try {
    const status = writeCircuitBreakerStatus(req.body?.status);
    res.json({ ok: true, circuitBreaker: { status } });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update circuit breaker' });
  }
});

// POST /api/system/backup-now — trigger immediate backup
router.post('/backup-now', (req, res) => {
  try {
    if (!existsSync(WEEKLY_BACKUP_SCRIPT)) {
      return res.status(404).json({ error: 'weekly-backup.ps1 not found' });
    }

    runPowerShell(`& '${WEEKLY_BACKUP_SCRIPT}'`);
    return res.json({ ok: true, message: 'Backup completed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to trigger backup' });
  }
});

export default router;
