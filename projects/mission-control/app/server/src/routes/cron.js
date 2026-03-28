import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

const router = Router();

const CRON_DIR = join(os.homedir(), '.openclaw', 'cron');
const JOBS_FILE = join(CRON_DIR, 'jobs.json');
const RUNS_DIR = join(CRON_DIR, 'runs');

function readJobs() {
  if (!existsSync(JOBS_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(JOBS_FILE, 'utf8'));
    return data.jobs || [];
  } catch {
    return [];
  }
}

function readRuns(jobId) {
  const runFile = join(RUNS_DIR, `${jobId}.jsonl`);
  if (!existsSync(runFile)) return [];
  try {
    return readFileSync(runFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .filter(r => r.action === 'finished') // only completed runs
      .reverse() // newest first
      .slice(0, 50);
  } catch {
    return [];
  }
}

function buildJobState(job, runs) {
  const lastRun = runs[0] || null;
  const nextRunAtMs = lastRun?.nextRunAtMs || null;
  return {
    ...job,
    state: {
      lastRun: lastRun ? {
        status: lastRun.status || 'ok',
        startedAtMs: lastRun.runAtMs,
        ranAtMs: lastRun.ts,
        durationMs: lastRun.durationMs,
        summary: lastRun.summary,
        error: lastRun.error,
      } : null,
      nextRunAtMs,
      runCount: runs.length,
    },
  };
}

// GET /api/cron/jobs — return all jobs from cron store
router.get('/jobs', (req, res) => {
  try {
    const rawJobs = readJobs();
    // Attach last-run state from runs files
    const jobs = rawJobs.map(job => {
      const runs = readRuns(job.id);
      return buildJobState(job, runs);
    });
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: `Failed to read cron jobs: ${err.message}` });
  }
});

// GET /api/cron/jobs/:id/runs — return run history for a job
router.get('/jobs/:id/runs', (req, res) => {
  try {
    const runs = readRuns(req.params.id);
    res.json({ runs });
  } catch (err) {
    res.status(500).json({ error: `Failed to read run history: ${err.message}` });
  }
});

// POST /api/cron/jobs/:id/run — trigger a job via openclaw CLI
router.post('/jobs/:id/run', async (req, res) => {
  try {
    const { execSync } = await import('child_process');
    execSync(`openclaw cron run ${req.params.id}`, { timeout: 5000 });
    res.json({ ok: true, queued: true });
  } catch (err) {
    res.status(500).json({ error: `Failed to run job: ${err.message}` });
  }
});

export default router;
