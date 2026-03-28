import React, { useEffect, useState, useCallback } from 'react';
import { timeAgo, timeUntil, formatMs } from '../shared/time.js';
import StatusBadge, { StatusBadgeDark } from '../shared/StatusBadge.jsx';

const BASE = '/api';

async function apiRequest(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function scheduleLabel(schedule) {
  if (!schedule) return '—';
  if (schedule.kind === 'every') {
    return `every ${formatMs(schedule.everyMs)}`;
  }
  if (schedule.kind === 'cron') {
    return schedule.expr || 'cron';
  }
  if (schedule.kind === 'once') {
    return `once at ${new Date(schedule.atMs).toLocaleTimeString()}`;
  }
  return JSON.stringify(schedule);
}

export default function CronJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runningIds, setRunningIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [runs, setRuns] = useState({});
  const [runsLoading, setRunsLoading] = useState({});
  // Per-job error states instead of alert()
  const [jobErrors, setJobErrors] = useState({});

  const loadJobs = useCallback(async () => {
    try {
      const data = await apiRequest('GET', '/cron/jobs');
      // gateway may return array or { jobs: [...] }
      setJobs(data.jobs || (Array.isArray(data) ? data : []));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 15000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  async function handleRunNow(jobId) {
    setRunningIds(prev => new Set([...prev, jobId]));
    // Clear any previous error for this job
    setJobErrors(prev => ({ ...prev, [jobId]: null }));
    try {
      await apiRequest('POST', `/cron/jobs/${jobId}/run`);
      setTimeout(loadJobs, 2000); // refresh after a moment
    } catch (err) {
      setJobErrors(prev => ({ ...prev, [jobId]: err.message }));
    } finally {
      setRunningIds(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  }

  async function handleExpand(jobId) {
    if (expandedId === jobId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(jobId);
    if (!runs[jobId]) {
      setRunsLoading(prev => ({ ...prev, [jobId]: true }));
      try {
        const data = await apiRequest('GET', `/cron/jobs/${jobId}/runs`);
        setRuns(prev => ({ ...prev, [jobId]: data.runs || (Array.isArray(data) ? data : []) }));
      } catch {
        setRuns(prev => ({ ...prev, [jobId]: [] }));
      } finally {
        setRunsLoading(prev => ({ ...prev, [jobId]: false }));
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⏱️ Cron Jobs</h1>
        <button
          onClick={loadJobs}
          style={styles.refreshBtn}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading cron jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="empty">No cron jobs found.</div>
      ) : (
        <div style={styles.jobList}>
          {jobs.map(job => {
            const lastRun = job.state?.lastRun;
            const nextRunAtMs = job.state?.nextRunAtMs;
            const isExpanded = expandedId === job.id;
            const jobError = jobErrors[job.id];

            return (
              <div key={job.id} className="card" style={styles.jobCard}>
                {/* Header row */}
                <div style={styles.jobHeader}>
                  <div style={styles.jobInfo}>
                    <div style={styles.jobName}>{job.name || job.id}</div>
                    <div style={styles.jobMeta}>
                      <span style={styles.scheduleTag}>{scheduleLabel(job.schedule)}</span>
                      {job.sessionTarget && (
                        <span style={styles.metaChip}>{job.sessionTarget}</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.jobStatus}>
                    {/* Enabled status indicator (no cursor affordance since it's not clickable) */}
                    <div 
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: job.enabled ? '#34d399' : '#f87171',
                      }} 
                      title={job.enabled ? 'Enabled' : 'Disabled'} 
                    />

                    {/* Last run status */}
                    {lastRun && <StatusBadgeDark status={lastRun.status} />}

                    {/* Run Now button */}
                    <button
                      onClick={() => handleRunNow(job.id)}
                      disabled={runningIds.has(job.id)}
                      style={{
                        ...styles.runBtn,
                        opacity: runningIds.has(job.id) ? 0.5 : 1,
                      }}
                    >
                      {runningIds.has(job.id) ? '⏳ Running...' : '▶ Run Now'}
                    </button>

                    {/* Expand toggle */}
                    <button
                      onClick={() => handleExpand(job.id)}
                      style={styles.expandBtn}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Per-job error message */}
                {jobError && (
                  <div style={styles.jobError}>
                    ⚠️ {jobError}
                  </div>
                )}

                {/* Stats row */}
                <div style={styles.statsRow}>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>Last Run</span>
                    <span style={styles.statValue}>{timeAgo(lastRun?.startedAtMs || lastRun?.ranAtMs)}</span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>Next Run</span>
                    <span style={styles.statValue}>{timeUntil(nextRunAtMs)}</span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>Duration</span>
                    <span style={styles.statValue}>{formatMs(lastRun?.durationMs)}</span>
                  </div>
                  <div style={styles.statItem}>
                    <span style={styles.statLabel}>Job ID</span>
                    <span style={{ ...styles.statValue, fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                      {job.id?.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                {/* Expanded run history */}
                {isExpanded && (
                  <div style={styles.runsPanel}>
                    <div style={styles.runsPanelTitle}>Run History</div>
                    {runsLoading[job.id] ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Loading...</div>
                    ) : (runs[job.id] || []).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>No runs yet.</div>
                    ) : (
                      <table style={styles.runsTable}>
                        <thead>
                          <tr>
                            <th style={styles.rth}>Status</th>
                            <th style={styles.rth}>Started</th>
                            <th style={styles.rth}>Duration</th>
                            <th style={styles.rth}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(runs[job.id] || []).slice(0, 20).map((run, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={styles.rtd}><StatusBadgeDark status={run.status} /></td>
                              <td style={styles.rtd}>{timeAgo(run.startedAtMs || run.ranAtMs)}</td>
                              <td style={styles.rtd}>{formatMs(run.durationMs)}</td>
                              <td style={{ ...styles.rtd, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {run.error || run.summary || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  jobList: { display: 'flex', flexDirection: 'column', gap: 12 },
  jobCard: { display: 'flex', flexDirection: 'column', gap: 12 },
  jobHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  jobInfo: { display: 'flex', flexDirection: 'column', gap: 4 },
  jobName: { fontWeight: 700, fontSize: 15, color: 'var(--text)' },
  jobMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  scheduleTag: {
    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
    background: 'rgba(108,99,255,0.12)', padding: '2px 8px', borderRadius: 999,
  },
  metaChip: {
    fontSize: 11, color: 'var(--text-muted)',
    background: 'var(--surface2)', padding: '2px 8px', borderRadius: 999,
  },
  jobStatus: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  runBtn: {
    padding: '5px 12px', borderRadius: 6, border: 'none',
    background: 'var(--accent)', color: '#fff', fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
  },
  expandBtn: {
    padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
    cursor: 'pointer',
  },
  errorBanner: {
    background: 'rgba(248,113,113,0.1)', color: '#f87171',
    border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8,
    padding: '10px 16px', fontSize: 13, marginBottom: 16,
  },
  // Per-job error state (dark theme compatible)
  jobError: {
    background: 'rgba(248,113,113,0.1)', 
    color: '#f87171',
    border: '1px solid rgba(248,113,113,0.3)', 
    borderRadius: 6,
    padding: '8px 12px', 
    fontSize: 12,
    marginTop: -4,
  },
  statsRow: {
    display: 'flex', gap: 24,
    paddingTop: 8, borderTop: '1px solid var(--border)',
  },
  statItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' },
  statValue: { fontSize: 13, fontWeight: 600 },
  runsPanel: { paddingTop: 8, borderTop: '1px solid var(--border)' },
  runsPanelTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 },
  runsTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  rth: { padding: '6px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 },
  rtd: { padding: '6px 10px' },
};
