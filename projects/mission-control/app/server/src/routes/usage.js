import { Router } from 'express';
import db from '../db.js';
import { getRateLimitStatus } from '../rateLimiter.js';

const router = Router();

// GET /api/usage/by-model
// Aggregates call counts, tokens, and costs across all model sources
router.get('/by-model', (req, res) => {
  // --- Claude API calls (from runs table, seeded + real) ---
  const agentRuns = db.prepare(`
    SELECT 
      agent_name,
      COUNT(*) as call_count,
      SUM(tokens_in) as tokens_in,
      SUM(tokens_out) as tokens_out,
      SUM(cost_usd) as cost_usd,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
      MAX(ran_at) as last_used
    FROM runs
    GROUP BY agent_name
    ORDER BY call_count DESC
  `).all();

  // --- Local model calls (from batch_queue) ---
  const localCalls = db.prepare(`
    SELECT
      model,
      COUNT(*) as call_count,
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as errors,
      MAX(updated_at) as last_used
    FROM batch_queue
    GROUP BY model
    ORDER BY call_count DESC
  `).all();

  // --- Triage cache hits (from prompt_cache) ---
  let cacheStats = { total: 0, hits: 0, last24h: 0 };
  try {
    cacheStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(hit_count) as hits,
        COUNT(CASE WHEN last_used > datetime('now', '-24 hours') THEN 1 END) as last24h
      FROM prompt_cache
    `).get() || cacheStats;
  } catch {} // Table might not exist yet

  // --- Rate limit window ---
  const rateLimit = getRateLimitStatus();

  // --- Aggregate into unified model list ---
  const models = [];

  // Claude sonnet (main model) — from agent runs attributed to known agents
  // In a real setup these would be tagged with actual model IDs
  // We use agent model assignments to infer
  const agentModels = db.prepare(`SELECT name, model FROM agents`).all();
  const agentModelMap = Object.fromEntries(agentModels.map(a => [a.name, a.model]));

  for (const run of agentRuns) {
    const model = agentModelMap[run.agent_name] || 'claude-sonnet-4';
    const existing = models.find(m => m.modelId === model && m.source === 'anthropic');
    if (existing) {
      existing.callCount += run.call_count;
      existing.tokensIn += run.tokens_in || 0;
      existing.tokensOut += run.tokens_out || 0;
      existing.costUsd += run.cost_usd || 0;
      existing.successes += run.successes || 0;
      existing.errors += run.errors || 0;
      existing.agents.push(run.agent_name);
      if (run.last_used > existing.lastUsed) existing.lastUsed = run.last_used;
    } else {
      models.push({
        modelId: model,
        displayName: formatModelName(model),
        source: 'anthropic',
        backend: '☁️ Cloud',
        callCount: run.call_count,
        tokensIn: run.tokens_in || 0,
        tokensOut: run.tokens_out || 0,
        costUsd: run.cost_usd || 0,
        successes: run.successes || 0,
        errors: run.errors || 0,
        agents: [run.agent_name],
        lastUsed: run.last_used,
        costPer1kTokens: run.cost_usd && run.tokens_in ? (run.cost_usd / ((run.tokens_in + run.tokens_out) / 1000)) : null,
      });
    }
  }

  // Local model calls from batch queue
  for (const local of localCalls) {
    models.push({
      modelId: resolveOllamaModelId(local.model),
      displayName: formatLocalModelName(local.model),
      source: 'ollama',
      backend: '🖥️ Local',
      callCount: local.call_count,
      tokensIn: 0, // Ollama doesn't reliably report per-job yet
      tokensOut: 0,
      costUsd: 0,
      successes: local.successes || 0,
      errors: local.errors || 0,
      agents: ['BatchQueue'],
      lastUsed: local.last_used,
      costPer1kTokens: 0,
    });
  }

  // Triage cache as a virtual "model" (shows savings)
  if (cacheStats.total > 0) {
    models.push({
      modelId: 'prompt-cache',
      displayName: 'Prompt Cache',
      source: 'cache',
      backend: '💾 Cache',
      callCount: cacheStats.hits || 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      successes: cacheStats.hits || 0,
      errors: 0,
      agents: ['TriageRouter'],
      lastUsed: null,
      costPer1kTokens: 0,
      note: `${cacheStats.total} unique prompts cached`,
    });
  }

  // Totals
  const totals = models.reduce((acc, m) => {
    acc.callCount += m.callCount;
    acc.tokensIn += m.tokensIn;
    acc.tokensOut += m.tokensOut;
    acc.costUsd += m.costUsd;
    return acc;
  }, { callCount: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 });

  res.json({
    models,
    totals,
    rateLimit: {
      current: rateLimit.current,
      limits: rateLimit.limits,
      headroom: rateLimit.headroom,
      windowSeconds: rateLimit.windowSeconds,
    },
    updatedAt: new Date().toISOString(),
  });
});

function formatModelName(model) {
  const map = {
    'claude-sonnet-4': 'Claude Sonnet 4',
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-haiku-4-5': 'Claude Haiku 4.5',
    'claude-opus-4': 'Claude Opus 4',
    'claude-haiku-4': 'Claude Haiku 4',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
  };
  return map[model] || model;
}

function formatLocalModelName(model) {
  const map = {
    'llama3.2': 'Llama 3.2 (3B)',
    'llama3.3': 'Llama 3.3 (70B)',
    'glm-4.7-flash': 'GLM-4.7 Flash (30B)',
    'glm': 'GLM-4.7 Flash',
    'local': 'Local Model',
  };
  return map[model] || model;
}

function resolveOllamaModelId(model) {
  const lower = (model || '').toLowerCase();
  if (lower.includes('llama3.2')) return 'llama3.2:latest';
  if (lower.includes('llama3.3')) return 'llama3.3:latest';
  if (lower.includes('glm')) return 'glm-4.7-flash:latest';
  return lower;
}

export default router;
