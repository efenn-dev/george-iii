import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { timeAgo } from '../shared/time.js';
import StatusBadge from '../shared/StatusBadge.jsx';

function useSystemStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch('/api/system/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => setStatus(data))
      .catch(() => setStatus(null));
    const t = setInterval(() => {
      fetch('/api/system/status')
        .then(r => r.ok ? r.json() : null)
        .then(data => setStatus(data))
        .catch(() => setStatus(null));
    }, 30000);
    return () => clearInterval(t);
  }, []);
  return status;
}

const DOMAIN_EMOJI = { content: '🎬', trading: '📈', dev: '💻', merch: '🛍️', diy: '🔧' };
const STATUS_COLOR = {
  backlog: 'var(--text-muted)',
  in_progress: 'var(--info)',
  done: 'var(--success)',
  archived: 'var(--border)',
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [costs, setCosts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const sysStatus = useSystemStatus();

  const fetchData = () => {
    Promise.all([api.getProjects(), api.getCostSummary(), api.getRuns(5)])
      .then(([p, c, r]) => { setProjects(p); setCosts(c); setRuns(r); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const totalCost = costs.reduce((s, c) => s + c.total_cost, 0);
  const activeAgents = runs.filter(r => r.status === 'running').length;
  const successRate = runs.length
    ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100)
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🎛️ Dashboard</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* System Status */}
      <SystemStatusCard status={sysStatus} />

      {/* Summary strip */}
      <div style={styles.summaryStrip}>
        <StatCard label="Projects" value={projects.length} icon="📁" />
        <StatCard label="Total Cost (all time)" value={`$${totalCost.toFixed(4)}`} icon="💵" />
        <StatCard label="Active Runs" value={activeAgents} icon="⚡" />
        <StatCard label="Success Rate (last 5 runs)" value={`${successRate}%`} icon="✅" />
      </div>

      {/* Project cards */}
      <h2 style={styles.sectionTitle}>Projects</h2>
      <div style={styles.projectGrid}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} />
        ))}
        {projects.length === 0 && <div className="empty">No projects yet.</div>}
      </div>

      {/* Recent runs */}
      <h2 style={styles.sectionTitle}>Recent Runs</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {runs.length === 0
          ? <div className="empty">No runs yet.</div>
          : (
            <table>
              <thead>
                <tr style={styles.thead}>
                  <th>Agent</th><th>Status</th><th>Duration</th><th>Tokens</th><th>Cost</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={{ fontWeight: 600 }}>{r.agent_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td>{r.tokens_in + r.tokens_out}</td>
                    <td>${(r.cost_usd || 0).toFixed(4)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{timeAgo(r.ran_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

function SystemStatusCard({ status }) {
  const ssStyles = {
    card: {
      display: 'flex', alignItems: 'center', gap: 24,
      padding: '14px 20px', marginBottom: 24,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, flexWrap: 'wrap',
    },
    label: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 },
    indicator: (online) => ({
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: online ? '#34d399' : '#f87171',
    }),
    dot: (online) => ({
      width: 7, height: 7, borderRadius: '50%',
      background: online ? '#34d399' : '#f87171',
      boxShadow: online ? '0 0 6px #34d399' : 'none',
    }),
    item: { display: 'flex', flexDirection: 'column' },
    modelText: { fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'monospace' },
    loadingText: { fontSize: 12, color: 'var(--text-muted)' },
    title: { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 },
  };

  if (!status) {
    return (
      <div style={ssStyles.card}>
        <span style={ssStyles.title}>🖥️ System Status</span>
        <div style={ssStyles.item}>
          <div style={ssStyles.label}>Gateway</div>
          <div style={ssStyles.indicator(false)}><div style={ssStyles.dot(false)} />Unavailable</div>
        </div>
        <div style={ssStyles.item}>
          <div style={ssStyles.label}>Ollama</div>
          <div style={ssStyles.indicator(false)}><div style={ssStyles.dot(false)} />Unavailable</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>Unable to reach server</div>
      </div>
    );
  }

  const gatewayOnline = status.gateway?.online ?? false;
  const ollamaOnline = status.ollama?.online ?? false;

  return (
    <div style={ssStyles.card}>
      <span style={ssStyles.title}>🖥️ System Status</span>

      <div style={ssStyles.item}>
        <div style={ssStyles.label}>Gateway</div>
        <div style={ssStyles.indicator(gatewayOnline)}>
          <div style={ssStyles.dot(gatewayOnline)} />
          {gatewayOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div style={ssStyles.item}>
        <div style={ssStyles.label}>Ollama</div>
        <div style={ssStyles.indicator(ollamaOnline)}>
          <div style={ssStyles.dot(ollamaOnline)} />
          {ollamaOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div style={ssStyles.item}>
        <div style={ssStyles.label}>Active Model</div>
        <div style={ssStyles.modelText}>
          {status.activeModel || '—'}
        </div>
      </div>

      {status.checkedAt && (
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          Updated {new Date(status.checkedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card" style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ProjectCard({ project: p }) {
  const { taskCounts: t } = p;
  const total = (t.backlog || 0) + (t.in_progress || 0) + (t.done || 0);
  const donePercent = total > 0 ? Math.round(((t.done || 0) / total) * 100) : 0;

  return (
    <div className="card" style={styles.projectCard}>
      <div style={styles.projectHeader}>
        <span style={styles.domainEmoji}>{DOMAIN_EMOJI[p.domain] || '📦'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {p.domain} · {p.status}
          </div>
        </div>
      </div>
      <div style={styles.taskRow}>
        {['backlog', 'in_progress', 'done', 'archived'].map(s => (
          <div key={s} style={styles.taskStat}>
            <span style={{ color: STATUS_COLOR[s], fontWeight: 700, fontSize: 18 }}>{t[s] || 0}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'capitalize' }}>
              {s.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${donePercent}%` }} title={`${donePercent}% done`} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{donePercent}% complete</div>
    </div>
  );
}

const styles = {
  summaryStrip: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 },
  statCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 20 },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: 700 },
  statLabel: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 },
  projectGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 32 },
  projectCard: { display: 'flex', flexDirection: 'column', gap: 12 },
  projectHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  domainEmoji: { fontSize: 28 },
  taskRow: { display: 'flex', gap: 16 },
  taskStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  progressBar: { height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--success)', borderRadius: 2, transition: 'width 0.3s' },
  thead: { background: 'var(--surface2)' },
  tr: { borderBottom: '1px solid var(--border)' },
};
