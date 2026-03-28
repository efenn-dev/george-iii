/**
 * Shared time utility functions
 */

/**
 * Format a date as a relative "time ago" string
 * @param {string|number|Date} dt - The date/time to format
 * @returns {string} Formatted time ago string
 */
export function timeAgo(dt) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt + (dt.includes?.('Z') ? '' : 'Z')).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Format milliseconds as a duration string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
export function formatMs(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Format time until a future date
 * @param {string|number|Date} ts - The target timestamp
 * @returns {string} Formatted time until string
 */
export function timeUntil(ts) {
  if (!ts) return '—';
  const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const diff = ms - Date.now();
  if (diff <= 0) return 'now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}
