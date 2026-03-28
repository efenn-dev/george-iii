/**
 * Batch processing queue backed by SQLite.
 * 
 * Jobs are added when rate limits are hit or tasks are explicitly batched.
 * A worker loop drains the queue, routing:
 *   - model=claude-* → Anthropic (respects rate limiter)
 *   - model=local/llama* → Ollama llama3.3:latest
 *   - model=local/glm* → Ollama glm-4.7-flash:latest
 * 
 * Job schema: { id, type, model, payload (JSON), status, priority, attempts, result, error, created_at, updated_at }
 */

import db from './db.js';
import { checkRateLimit, recordRequest } from './rateLimiter.js';

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL_MAP = {
  'claude': 'anthropic',
  'llama': 'ollama',
  'glm': 'ollama',
  'local': 'ollama',
};

const OLLAMA_MODEL_MAP = {
  'llama3.2': 'llama3.2:latest',
  'llama3.3': 'llama3.3:latest',
  'glm-4.7-flash': 'glm-4.7-flash:latest',
  'glm': 'glm-4.7-flash:latest',
  'llama': 'llama3.2:latest',  // Default to fast model
  'local': 'llama3.2:latest',   // Default to fast model
};

// Initialize queue table
db.exec(`
  CREATE TABLE IF NOT EXISTS batch_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'llm',
    model TEXT NOT NULL DEFAULT 'llama3.3',
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','cancelled')),
    priority INTEGER NOT NULL DEFAULT 5,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/**
 * Add a job to the batch queue.
 * 
 * Default model is llama3.2:latest (1.9GB, fast on CPU).
 * glm-4.7-flash and llama3.3 are too slow on this hardware.
 * 
 * @param {{ type?: string, model?: string, payload: object, priority?: number }} opts
 * @returns {number} job id
 */
export function enqueue({ type = 'llm', model = 'llama3.2', payload, priority = 5 }) {
  const stmt = db.prepare(`
    INSERT INTO batch_queue (type, model, payload, priority)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(type, model, JSON.stringify(payload), priority);
  return result.lastInsertRowid;
}

/**
 * Get all jobs (optionally filter by status).
 */
export function getJobs(status = null, limit = 50) {
  if (status) {
    return db.prepare(`SELECT * FROM batch_queue WHERE status = ? ORDER BY priority ASC, created_at ASC LIMIT ?`).all(status, limit);
  }
  return db.prepare(`SELECT * FROM batch_queue ORDER BY created_at DESC LIMIT ?`).all(limit);
}

/**
 * Get a single job by id.
 */
export function getJob(id) {
  return db.prepare(`SELECT * FROM batch_queue WHERE id = ?`).get(id);
}

/**
 * Cancel a pending job.
 */
export function cancelJob(id) {
  db.prepare(`UPDATE batch_queue SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = 'pending'`).run(id);
}

/**
 * Determine the backend for a model string.
 */
function resolveBackend(model) {
  const lower = model.toLowerCase();
  if (lower.startsWith('claude') || lower.startsWith('anthropic')) return 'anthropic';
  return 'ollama';
}

/**
 * Resolve the Ollama model name from a shorthand.
 */
function resolveOllamaModel(model) {
  const lower = model.toLowerCase();
  for (const [key, val] of Object.entries(OLLAMA_MODEL_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'llama3.3:latest';
}

/**
 * Run a job against Ollama.
 */
async function runOllamaJob(job) {
  const payload = JSON.parse(job.payload);
  const ollamaModel = resolveOllamaModel(job.model);
  
  const messages = payload.messages || [
    { role: 'user', content: payload.prompt || 'No prompt provided.' }
  ];

  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
      options: {
        temperature: payload.temperature ?? 0.7,
        num_predict: payload.maxTokens ?? 1024,
      },
    }),
    signal: AbortSignal.timeout(300_000), // 5 min timeout (GLM cold-load on CPU can be slow)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return {
    model: ollamaModel,
    backend: 'ollama',
    content: data.message?.content || '',
    tokensIn: data.prompt_eval_count || 0,
    tokensOut: data.eval_count || 0,
  };
}

/**
 * Run a single job. Returns result or throws.
 */
async function processJob(job) {
  const backend = resolveBackend(job.model);
  
  if (backend === 'anthropic') {
    // Check rate limit before sending to Claude
    const payload = JSON.parse(job.payload);
    const estimatedIn = payload.estimatedInputTokens || 1000;
    const estimatedOut = payload.estimatedOutputTokens || 500;
    
    const check = checkRateLimit(estimatedIn, estimatedOut);
    if (!check.allowed) {
      // Don't fail — just defer by re-queuing (caller should retry later)
      throw new Error(`RATE_LIMITED: ${check.reason}`);
    }
    
    // For now, Claude jobs in the queue call the OpenClaw gateway or could be
    // routed to Anthropic directly. Placeholder — record and return a deferred result.
    // In a full implementation, this would call the Anthropic API directly.
    recordRequest(estimatedIn, estimatedOut);
    throw new Error('Claude batch jobs require direct API integration — use Ollama models for batch queue.');
  }
  
  return runOllamaJob(job);
}

// --- Worker loop ---
let workerRunning = false;
let workerInterval = null;

async function tick() {
  if (workerRunning) return;
  
  // Pick the next pending job (highest priority = lowest number, then oldest)
  const job = db.prepare(`
    SELECT * FROM batch_queue 
    WHERE status = 'pending' AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC 
    LIMIT 1
  `).get();
  
  if (!job) return;
  
  workerRunning = true;
  
  // Mark as running
  db.prepare(`UPDATE batch_queue SET status = 'running', attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?`).run(job.id);
  
  try {
    const result = await processJob(job);
    db.prepare(`UPDATE batch_queue SET status = 'done', result = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(result), job.id);
    console.log(`[BatchQueue] Job #${job.id} (${job.type}/${job.model}) completed.`);
  } catch (err) {
    const isRateLimit = err.message.startsWith('RATE_LIMITED');
    const newAttempts = job.attempts + 1;
    const isFinal = newAttempts >= job.max_attempts;
    
    if (isRateLimit) {
      // Requeue as pending for next tick
      db.prepare(`UPDATE batch_queue SET status = 'pending', attempts = ?, error = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(newAttempts, err.message, job.id);
      console.log(`[BatchQueue] Job #${job.id} rate-limited, will retry.`);
    } else {
      db.prepare(`UPDATE batch_queue SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(isFinal ? 'failed' : 'pending', err.message, job.id);
      console.error(`[BatchQueue] Job #${job.id} error (attempt ${newAttempts}/${job.max_attempts}): ${err.message}`);
    }
  } finally {
    workerRunning = false;
  }
}

/**
 * Start the background worker (polls every 5 seconds).
 */
export function startWorker(intervalMs = 5000) {
  if (workerInterval) return;
  workerInterval = setInterval(tick, intervalMs);
  console.log('[BatchQueue] Worker started (interval: ' + intervalMs + 'ms)');
}

/**
 * Stop the background worker.
 */
export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

export function getQueueStats() {
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count FROM batch_queue GROUP BY status
  `).all();
  
  const out = { pending: 0, running: 0, done: 0, failed: 0, cancelled: 0 };
  for (const row of stats) {
    out[row.status] = row.count;
  }
  out.total = Object.values(out).reduce((a, b) => a + b, 0);
  return out;
}
