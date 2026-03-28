/**
 * Prompt cache + triage classifier for Discord messages.
 * 
 * Flow:
 * 1. Message arrives → hash content (normalized)
 * 2. Check cache: exact match or high-similarity → return cached action plan
 * 3. No cache → llama3.2 classifies intent(s), extracts action items
 * 4. Cache the result (TTL-based, sliding window)
 * 5. Route each action item to appropriate agent/queue
 * 
 * Caching minimizes API costs — cached hits = $0, use local model only.
 */

import db from './db.js';
import crypto from 'crypto';

// Hash for exact-match caching
function hashPrompt(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 32);
}

// Normalize text for similarity comparison
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500); // first 500 chars for fingerprint
}

// Initialize cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    original_prompt TEXT NOT NULL,
    normalized_fingerprint TEXT NOT NULL,
    action_plan TEXT NOT NULL, -- JSON: { intents: [...], actions: [...], routing: [...] }
    hit_count INTEGER NOT NULL DEFAULT 1,
    last_used TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cache_hash ON prompt_cache(hash);
  CREATE INDEX IF NOT EXISTS idx_cache_fingerprint ON prompt_cache(normalized_fingerprint);
  CREATE INDEX IF NOT EXISTS idx_cache_last_used ON prompt_cache(last_used);
`);

// Cleanup old cache entries (keep last 30 days, or top 1000 by hits)
export function pruneCache(maxAgeDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');
  
  // Keep top 1000 by hit_count even if old
  const topHashes = db.prepare(`
    SELECT hash FROM prompt_cache ORDER BY hit_count DESC LIMIT 1000
  `).all().map(r => r.hash);
  
  if (topHashes.length > 0) {
    const placeholders = topHashes.map(() => '?').join(',');
    db.prepare(`
      DELETE FROM prompt_cache 
      WHERE last_used < ? AND hash NOT IN (${placeholders})
    `).run(cutoffStr, ...topHashes);
  } else {
    db.prepare(`DELETE FROM prompt_cache WHERE last_used < ?`).run(cutoffStr);
  }
}

/**
 * Check cache for exact match or near-similar prompt.
 * @param {string} prompt
 * @returns {object|null} cached action plan or null
 */
export function checkCache(prompt) {
  const hash = hashPrompt(prompt);
  const fingerprint = normalize(prompt);
  
  // Exact match first
  const exact = db.prepare(`
    SELECT * FROM prompt_cache WHERE hash = ?
  `).get(hash);
  
  if (exact) {
    db.prepare(`
      UPDATE prompt_cache SET hit_count = hit_count + 1, last_used = datetime('now') WHERE id = ?
    `).run(exact.id);
    return {
      hit: true,
      type: 'exact',
      actionPlan: JSON.parse(exact.action_plan),
      cachedAt: exact.created_at,
      hitCount: exact.hit_count + 1,
    };
  }
  
  // Similar match (fingerprint overlap for long prompts)
  if (fingerprint.length > 50) {
    const similar = db.prepare(`
      SELECT * FROM prompt_cache 
      WHERE normalized_fingerprint LIKE ?
      ORDER BY hit_count DESC, last_used DESC
      LIMIT 1
    `).get('%' + fingerprint.slice(0, 50) + '%');
    
    if (similar) {
      // Verify similarity with a quick local check? For now, treat as soft hit
      db.prepare(`
        UPDATE prompt_cache SET hit_count = hit_count + 1, last_used = datetime('now') WHERE id = ?
      `).run(similar.id);
      return {
        hit: true,
        type: 'similar',
        actionPlan: JSON.parse(similar.action_plan),
        cachedAt: similar.created_at,
        hitCount: similar.hit_count + 1,
        similarityNote: 'Matched on prompt fingerprint',
      };
    }
  }
  
  return { hit: false };
}

/**
 * Store action plan in cache.
 */
export function storeCache(prompt, actionPlan) {
  const hash = hashPrompt(prompt);
  const fingerprint = normalize(prompt);
  const planJson = JSON.stringify(actionPlan);
  
  try {
    db.prepare(`
      INSERT INTO prompt_cache (hash, original_prompt, normalized_fingerprint, action_plan)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET
        action_plan = excluded.action_plan,
        last_used = datetime('now'),
        hit_count = hit_count + 1
    `).run(hash, prompt.slice(0, 2000), fingerprint, planJson);
    return true;
  } catch (e) {
    console.error('[TriageCache] Failed to store:', e.message);
    return false;
  }
}

/**
 * Get cache stats.
 */
export function getCacheStats() {
  const total = db.prepare(`SELECT COUNT(*) as c FROM prompt_cache`).get().c;
  const hits = db.prepare(`SELECT SUM(hit_count) as h FROM prompt_cache`).get().h || 0;
  const recent = db.prepare(`
    SELECT COUNT(*) as c FROM prompt_cache WHERE last_used > datetime('now', '-24 hours')
  `).get().c;
  return { total, hits, last24h: recent };
}
