import React from 'react';

/**
 * StatusBadge - A reusable component for displaying status badges
 */
export default function StatusBadge({ status, size = 'normal', uppercase = true }) {
  const map = {
    success: 'badge-success',
    error: 'badge-error',
    running: 'badge-info',
    ok: 'badge-success',
    timeout: 'badge-warning',
    pending_approval: 'badge-warning',
    processing: 'badge-info',
    uploaded: 'badge-success',
    failed: 'badge-error',
    backlog: 'badge-muted',
    assigned: 'badge-warning',
    in_progress: 'badge-info',
    in_review: 'badge-warning',
    qa_passed: 'badge-success',
    needs_fix: 'badge-error',
    approved: 'badge-success',
    done: 'badge-success',
    archived: 'badge-muted',
    pending: 'badge-warning',
    passed: 'badge-success',
    skipped: 'badge-muted',
  };

  const sizeClass = size === 'small' ? 'badge-sm' : '';
  const badgeClass = `badge ${map[status] || 'badge-muted'} ${sizeClass}`;
  const label = uppercase ? status?.replace(/_/g, ' ').toUpperCase() : status?.replace(/_/g, ' ');

  return <span className={badgeClass}>{label}</span>;
}

export function AgentStatusBadge({ enabled }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: enabled ? 'rgba(61,214,140,0.15)' : 'rgba(148,163,184,0.15)',
      color: enabled ? '#3dd68c' : '#94a3b8',
      letterSpacing: '0.03em',
    }}>
      {enabled ? 'enabled' : 'disabled'}
    </span>
  );
}

export function StatusBadgeDark({ status }) {
  const map = {
    ok: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'ok' },
    success: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'ok' },
    error: { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: 'error' },
    running: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: 'running' },
    timeout: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'timeout' },
  };
  const style = map[status] || { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: status || '—' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      letterSpacing: '0.03em',
    }}>
      {style.label}
    </span>
  );
}
