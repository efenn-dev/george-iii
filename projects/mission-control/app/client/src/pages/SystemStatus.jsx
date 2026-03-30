import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';

const REFRESH_MS = 15000;
const STATUS_COLORS = {
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  gray: '#6b7280',
};

export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await api.getSystemStatus();
      setStatus(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load system status');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(() => loadStatus({ silent: true }), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadStatus]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  const runAction = useCallback(async (key, action, successMessage) => {
    setBusy(prev => ({ ...prev, [key]: true }));
    setError('');
    try {
      await action();
      setMessage(successMessage);
      await loadStatus({ silent: true });
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  }, [loadStatus]);

  const resourceCards = useMemo(() => {
    if (!status?.diskSpace) return [];
    return ['c', 'd']
      .map(drive => {
        const info = status.diskSpace?.[drive];
        if (!info) return null;
        const used = Number(info.usedGB || 0);
        const free = Number(info.freeGB || 0);
        const total = used + free;
        const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
        return { drive: drive.toUpperCase(), used, free, total, usedPercent };
      })
      .filter(Boolean);
  }, [status]);

  if (loading) return <div className="loading">Loading system status...</div>;

  return (
    <div className="page">
      <div className="page-header" style={styles.pageHeader}>
        <div>
          <h1 className="page-title">⚙️ System Status</h1>
          <div style={styles.subtleText}>Live monitoring and controls · refreshes every 15 seconds</div>
        </div>
        <button className="btn-ghost" onClick={() => loadStatus()} disabled={busy.refresh}>
          🔄 Refresh Now
        </button>
      </div>

      {message && <div style={styles.successBanner}>✅ {message}</div>}
      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      <section style={styles.section}>
        <div style={styles.grid4}>
          <ServiceCard
            title="Gateway"
            dotColor={status?.gateway?.status === 'online' ? STATUS_COLORS.green : STATUS_COLORS.red}
            statusText={status?.gateway?.status === 'online' ? 'Online' : 'Offline'}
            details={status?.gateway?.url || 'http://127.0.0.1:18789'}
          />
          <ServiceCard
            title="Ollama"
            dotColor={status?.ollama?.status === 'online' ? STATUS_COLORS.green : STATUS_COLORS.red}
            statusText={status?.ollama?.status === 'online' ? 'Online' : 'Offline'}
            details={status?.ollama?.version ? `Version ${status.ollama.version}` : 'Unavailable'}
          />
          <ServiceCard
            title="Mission Control"
            dotColor={STATUS_COLORS.green}
            statusText="Online"
            details="UI currently active"
          />
          <ServiceCard
            title="Circuit Breaker"
            dotColor={getCircuitColor(status?.circuitBreaker?.status)}
            statusText={status?.circuitBreaker?.status || 'Unknown'}
            details="Safety control state"
            footer={
              <div style={styles.inlineButtons}>
                {['RUN', 'PAUSE', 'STOP'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => runAction(`circuit-${mode}`, () => api.setCircuitBreaker({ status: mode }), `Circuit breaker set to ${mode}`)}
                    disabled={Boolean(busy[`circuit-${mode}`])}
                    style={{
                      ...styles.modeButton,
                      ...modeButtonStyle(mode, status?.circuitBreaker?.status === mode),
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            }
          />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Scheduled Tasks</div>
        <div style={styles.grid3}>
          <TaskCard
            title="Gateway Watchdog"
            schedule="Every 2 min"
            task={status?.watchdog}
            onToggle={() => runAction('watchdog', () => api.setWatchdog({ enabled: !(status?.watchdog?.enabled) }), `Gateway Watchdog ${status?.watchdog?.enabled ? 'disabled' : 'enabled'}`)}
            busy={busy.watchdog}
          />
          <TaskCard
            title="Loop Breaker"
            schedule="Every 3 min"
            task={status?.loopBreaker}
            onToggle={() => runAction('loop-breaker', () => api.setLoopBreaker({ enabled: !(status?.loopBreaker?.enabled) }), `Loop Breaker ${status?.loopBreaker?.enabled ? 'disabled' : 'enabled'}`)}
            busy={busy['loop-breaker']}
          />
          <TaskCard
            title="Weekly Backup"
            schedule="Saturdays 4 AM"
            task={status?.weeklyBackup}
            onToggle={() => runAction('weekly-backup', () => api.setWeeklyBackup({ enabled: !(status?.weeklyBackup?.enabled) }), `Weekly Backup ${status?.weeklyBackup?.enabled ? 'disabled' : 'enabled'}`)}
            busy={busy['weekly-backup']}
          />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>System Resources</div>
        <div style={styles.resourcesGrid}>
          <div className="card" style={styles.resourceCard}>
            <div style={styles.cardTitle}>Disk Space</div>
            <div style={styles.resourceStack}>
              {resourceCards.length === 0 && <div style={styles.subtleText}>Disk information unavailable.</div>}
              {resourceCards.map(item => (
                <div key={item.drive} style={styles.diskRow}>
                  <div style={styles.diskHeaderRow}>
                    <span style={styles.diskLabel}>{item.drive}: Drive</span>
                    <span style={styles.subtleText}>{item.usedPercent}% used</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${item.usedPercent}%` }} />
                  </div>
                  <div style={styles.diskMeta}>
                    <span>{item.used.toFixed(1)} GB used</span>
                    <span>{item.free.toFixed(1)} GB free</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={styles.resourceCard}>
            <div style={styles.cardTitle}>System Uptime</div>
            <div style={styles.uptimeValue}>{status?.uptime || 'Unknown'}</div>
            <div style={styles.subtleText}>Time since last OS boot</div>
            <div style={{ ...styles.subtleText, marginTop: 12 }}>
              Last checked {status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : '—'}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Quick Actions</div>
        <div style={styles.quickActionsGrid}>
          <div className="card" style={styles.actionCard}>
            <div style={styles.cardTitle}>Backup</div>
            <div style={styles.subtleText}>Run the weekly backup script immediately.</div>
            <button
              className="btn-primary"
              style={styles.actionButton}
              onClick={() => runAction('backup-now', () => api.triggerBackup(), 'Backup triggered successfully')}
              disabled={busy['backup-now']}
            >
              {busy['backup-now'] ? 'Running Backup...' : 'Trigger Backup Now'}
            </button>
          </div>

          <div className="card" style={styles.actionCard}>
            <div style={styles.cardTitle}>Circuit Breaker Controls</div>
            <div style={styles.subtleText}>Set the global execution mode directly.</div>
            <div style={{ ...styles.inlineButtons, marginTop: 14 }}>
              {['RUN', 'PAUSE', 'STOP'].map(mode => (
                <button
                  key={`quick-${mode}`}
                  onClick={() => runAction(`quick-${mode}`, () => api.setCircuitBreaker({ status: mode }), `Circuit breaker set to ${mode}`)}
                  disabled={Boolean(busy[`quick-${mode}`])}
                  style={{
                    ...styles.quickModeButton,
                    ...modeButtonStyle(mode, status?.circuitBreaker?.status === mode),
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ title, dotColor, statusText, details, footer }) {
  return (
    <div className="card" style={styles.serviceCard}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.statusRow}>
        <span style={{ ...styles.statusDot, background: dotColor, boxShadow: `0 0 10px ${dotColor}33` }} />
        <span style={styles.statusText}>{statusText}</span>
      </div>
      <div style={styles.subtleText}>{details}</div>
      {footer ? <div style={{ marginTop: 14 }}>{footer}</div> : null}
    </div>
  );
}

function TaskCard({ title, schedule, task, onToggle, busy }) {
  const enabled = Boolean(task?.enabled);
  const stateText = enabled ? 'Running' : 'Disabled';
  return (
    <div className="card" style={styles.taskCard}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.subtleText}>{schedule}</div>
      <div style={styles.taskStatusRow}>
        <span style={{ ...styles.statusDot, background: enabled ? STATUS_COLORS.green : STATUS_COLORS.gray }} />
        <span style={styles.statusText}>{stateText}</span>
      </div>
      <div style={styles.taskMeta}>{task?.taskName || 'Task unavailable'}</div>
      <button
        onClick={onToggle}
        disabled={busy}
        style={{
          ...styles.toggleButton,
          background: enabled ? STATUS_COLORS.green : 'var(--surface2)',
          color: enabled ? '#08130f' : 'var(--text)',
          border: `1px solid ${enabled ? STATUS_COLORS.green : 'var(--border)'}`,
        }}
      >
        {busy ? 'Updating...' : enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function getCircuitColor(status) {
  if (status === 'RUN') return STATUS_COLORS.green;
  if (status === 'PAUSE') return STATUS_COLORS.yellow;
  if (status === 'STOP') return STATUS_COLORS.red;
  return STATUS_COLORS.gray;
}

function modeButtonStyle(mode, active) {
  const baseColor = mode === 'RUN'
    ? STATUS_COLORS.green
    : mode === 'PAUSE'
      ? STATUS_COLORS.yellow
      : STATUS_COLORS.red;

  return {
    background: active ? baseColor : 'transparent',
    color: active ? '#111827' : baseColor,
    border: `1px solid ${baseColor}`,
  };
}

const styles = {
  pageHeader: {
    alignItems: 'flex-start',
    gap: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 16,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
  },
  resourcesGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 2fr) minmax(220px, 1fr)',
    gap: 16,
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  serviceCard: {
    minHeight: 164,
    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
  },
  taskCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
  },
  resourceCard: {
    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
  },
  actionCard: {
    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 8,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  taskStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontWeight: 600,
    color: 'var(--text)',
  },
  subtleText: {
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  taskMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  toggleButton: {
    marginTop: 'auto',
    width: 78,
    padding: '8px 0',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  inlineButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeButton: {
    padding: '7px 12px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
  },
  quickModeButton: {
    minWidth: 92,
    padding: '10px 14px',
    borderRadius: 8,
    fontWeight: 700,
  },
  resourceStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  diskRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  diskHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  diskLabel: {
    fontWeight: 700,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), #34d399)',
  },
  diskMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  uptimeValue: {
    fontSize: 32,
    fontWeight: 800,
    color: 'var(--text)',
    margin: '10px 0 4px',
  },
  actionButton: {
    marginTop: 14,
    width: '100%',
    padding: '10px 14px',
  },
  successBanner: {
    background: 'rgba(52, 211, 153, 0.12)',
    border: '1px solid rgba(52, 211, 153, 0.28)',
    color: STATUS_COLORS.green,
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: 13,
  },
  errorBanner: {
    background: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.28)',
    color: STATUS_COLORS.red,
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: 13,
  },
};
