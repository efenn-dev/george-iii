/**
 * Token-bucket rate limiter for Anthropic claude-sonnet-4-6
 * Limits: 50 RPM, 30k input TPM, 8k output TPM
 * 
 * Uses a sliding window (per-minute buckets) tracked in memory.
 * Overflow is queued to SQLite via batchQueue.js.
 */

const LIMITS = {
  requestsPerMinute: 50,
  inputTokensPerMinute: 30_000,
  outputTokensPerMinute: 8_000,
};

// Sliding window — store timestamps + token counts per request in the last 60s
const window = [];

function pruneWindow() {
  const cutoff = Date.now() - 60_000;
  while (window.length > 0 && window[0].ts < cutoff) {
    window.shift();
  }
}

function getWindowTotals() {
  pruneWindow();
  return window.reduce(
    (acc, entry) => {
      acc.requests += 1;
      acc.inputTokens += entry.inputTokens;
      acc.outputTokens += entry.outputTokens;
      return acc;
    },
    { requests: 0, inputTokens: 0, outputTokens: 0 }
  );
}

/**
 * Check if a request with the given estimated token counts would exceed limits.
 * @param {number} estimatedInputTokens
 * @param {number} estimatedOutputTokens
 * @returns {{ allowed: boolean, reason?: string, totals: object }}
 */
export function checkRateLimit(estimatedInputTokens = 0, estimatedOutputTokens = 0) {
  const totals = getWindowTotals();

  if (totals.requests >= LIMITS.requestsPerMinute) {
    return {
      allowed: false,
      reason: `RPM limit reached (${totals.requests}/${LIMITS.requestsPerMinute} requests/min)`,
      totals,
    };
  }

  if (totals.inputTokens + estimatedInputTokens > LIMITS.inputTokensPerMinute) {
    return {
      allowed: false,
      reason: `Input token limit would be exceeded (${totals.inputTokens + estimatedInputTokens}/${LIMITS.inputTokensPerMinute} input tokens/min)`,
      totals,
    };
  }

  if (totals.outputTokens + estimatedOutputTokens > LIMITS.outputTokensPerMinute) {
    return {
      allowed: false,
      reason: `Output token limit would be exceeded (${totals.outputTokens + estimatedOutputTokens}/${LIMITS.outputTokensPerMinute} output tokens/min)`,
      totals,
    };
  }

  return { allowed: true, totals };
}

/**
 * Record a completed request in the sliding window.
 * @param {number} inputTokens
 * @param {number} outputTokens
 */
export function recordRequest(inputTokens = 0, outputTokens = 0) {
  pruneWindow();
  window.push({ ts: Date.now(), inputTokens, outputTokens });
}

/**
 * Get current rate limit status (for dashboard/API).
 */
export function getRateLimitStatus() {
  const totals = getWindowTotals();
  return {
    limits: LIMITS,
    current: totals,
    headroom: {
      requests: LIMITS.requestsPerMinute - totals.requests,
      inputTokens: LIMITS.inputTokensPerMinute - totals.inputTokens,
      outputTokens: LIMITS.outputTokensPerMinute - totals.outputTokens,
    },
    windowSeconds: 60,
    updatedAt: new Date().toISOString(),
  };
}

export { LIMITS };
