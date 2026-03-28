import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/index.js';
import { timeAgo } from '../shared/time.js';
import StatusBadge from '../shared/StatusBadge.jsx';

export default function Runs() {
  const [runs, setRuns] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [r, c] = await Promise.all([api.getRuns(100), api.getCostSummary()]);
      setRuns(r);
      setCosts(c);
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const agents = [...new Set(runs.map(r => r.agent_name))];
  const filtered = filter === 'all' ? runs : runs.filter(r => r.agent_name === filter);

  const totalCost = costs.reduce((s, c) => s + c.total_cost, 0);
  const totalTokens = costs.reduce((s, c) => s + c.total_tokens_in + c.total_tokens_out, 0);

  if (loading) return <div className="loading">Loading runs...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📊 Run Monitor</h1>
        <button
          className="btn-ghost btn-sm"
          onClick={fetchData}
          disabled={refreshing}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Cost summary */}
      <div style={styles.costGrid}>
        {costs.map(c => (
          <div key={c.agent_name} className="card" style={styles.costCard}>
            <div style={styles.costAgent}>{c.agent_name}</div>
            <div style={styles.costValue}>${c.total_cost.toFixed(4)}</div>
            <div style={styles.costSub}>{(c.total_tokens_in + c.total_tokens_out).toLocaleString()} tokens</div>
          </div>
        ))}
        <div className="card" style={{ ...styles.costCard, borderColor: 'var(--accent)' }}>
          <div style={styles.costAgent}>All Agents</div>
          <div style={{ ...styles.costValue, color: 'var(--accent)' }}>${totalCost.toFixed(4)}</div>
          <div style={styles.costSub}>{totalTokens.toLocaleString()} tokens total</div>
        </div>
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        <button
          className={filter === 'all' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
          onClick={() => setFilter('all')}
        >All</button>
        {agents.map(a => (
          <button
            key={a}
            className={filter === a ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setFilter(a)}
          >{a}</button>
        ))}
      </div>

      {/* Runs table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty">No runs found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Job ID</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Tokens In</th>
                <th>Tokens Out</th>
                <th>Cost</th>
                <th>Summary</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.agent_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.job_id || '—'}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td>{(r.tokens_in || 0).toLocaleString()}</td>
                  <td>{(r.tokens_out || 0).toLocaleString()}</td>
                  <td>${(r.cost_usd || 0).toFixed(4)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {r.summary ? (
                      <div className="tooltip-container">
                        {r.summary}
                        <div className="tooltip">{r.summary}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(r.ran_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  costGrid: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  costCard: { minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 },
  costAgent: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' },
  costValue: { fontSize: 22, fontWeight: 700 },
  costSub: { fontSize: 11, color: 'var(--text-muted)' },
  filterRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
};
