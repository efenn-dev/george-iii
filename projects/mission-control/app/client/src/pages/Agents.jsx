import React, { useMemo, useState } from 'react';

const AGENTS = [
  { id: 'george', name: 'George III', emoji: '👑', model: 'claude-opus-4-6', role: 'Orchestrator & Leader', color: '#a855f7' },
  { id: 'coding', name: 'Coder', emoji: '⚡', model: 'gpt-5.4', role: 'Coding & Automation', color: '#60a5fa' },
  { id: 'research', name: 'Scribe', emoji: '📚', model: 'kimi-k2.5:cloud', role: 'Research & Writing', color: '#34d399' },
  { id: 'qa', name: 'QA Bot', emoji: '🤖', model: 'automated', role: 'Quality Gate', color: '#94a3b8' },
];

const PIPELINE_STAGES = [
  { id: 'discover', label: 'Discover', agent: 'research', color: '#8b5cf6' },
  { id: 'curate', label: 'Curate', agent: 'george', color: '#f59e0b' },
  { id: 'optimize', label: 'Optimize', agent: 'coding', color: '#60a5fa' },
  { id: 'listing', label: 'Listing', agent: 'research', color: '#34d399' },
  { id: 'publish', label: 'Publish', agent: null, color: '#f97316' },
  { id: 'promote', label: 'Promote', agent: 'research', color: '#ec4899' },
  { id: 'monitor', label: 'Monitor', agent: 'george', color: '#14b8a6' },
];

const PACKS = [
  { id: 9, theme: 'Space Cats', designs: 11, status: 'live', agent: null },
  { id: 14, theme: 'Shaka Jesus', designs: 6, status: 'ready', agent: 'master_e' },
  { id: 12, theme: 'Tropical Vibes', designs: 7, status: 'ready', agent: 'master_e' },
  { id: 13, theme: 'Funny AI Art', designs: 8, status: 'ready', agent: 'master_e' },
  { id: 10, theme: 'Stoner/420', designs: 5, status: 'ready', agent: 'master_e' },
  { id: 11, theme: 'Space Astronaut', designs: 3, status: 'ready', agent: 'master_e' },
  { id: 15, theme: 'Badass/Edgy', designs: 7, status: 'ready', agent: 'master_e' },
  { id: 3, theme: 'Texas Pride', designs: 6, status: 'ready', agent: 'master_e' },
  { id: 4, theme: 'Christmas Holiday', designs: 6, status: 'ready', agent: 'master_e' },
  { id: 5, theme: 'Pop Art Animals', designs: 9, status: 'ready', agent: 'master_e' },
  { id: 6, theme: 'Humor Stickers', designs: 4, status: 'needs_curation', agent: 'master_e' },
  { id: 7, theme: 'Social Humor OG', designs: 5, status: 'ready', agent: 'master_e' },
  { id: 8, theme: 'Most Excellent Cars', designs: 4, status: 'ready', agent: 'master_e' },
];

const AGENT_MAP = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent]));
const STATUS_ORDER = { live: 0, ready: 1, needs_curation: 2 };
const STATUS_META = {
  live: { label: 'LIVE', color: '#22c55e', glow: 'rgba(34, 197, 94, 0.18)' },
  ready: { label: 'Ready to list', color: '#facc15', glow: 'rgba(250, 204, 21, 0.18)' },
  needs_curation: { label: 'Needs curation', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.18)' },
};
const OWNER_META = {
  master_e: { label: 'Master E', color: '#f97316' },
};

export default function Agents() {
  const [sortDirection, setSortDirection] = useState('asc');

  const sortedPacks = useMemo(() => {
    return [...PACKS].sort((a, b) => {
      const statusCompare = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusCompare !== 0) {
        return sortDirection === 'asc' ? statusCompare : -statusCompare;
      }
      return a.id - b.id;
    });
  }, [sortDirection]);

  const toggleSort = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="page" style={styles.page}>
      <style>{responsiveStyles}</style>
      <div className="page-header" style={styles.pageHeader}>
        <div>
          <h1 className="page-title">🤖 Agents & Pipeline</h1>
          <p style={styles.pageSubtitle}>
            Fleet hierarchy, Etsy production flow, and current pack readiness in one view.
          </p>
        </div>
      </div>

      <section className="card" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Section A</div>
            <h2 style={styles.sectionTitle}>Agent Org Chart</h2>
          </div>
          <div style={styles.legendPill}>
            <span style={styles.activeDot} /> All systems active
          </div>
        </div>

        <div style={styles.orgChart}>
          <div style={styles.orgTopRow}>
            <OrgAgentCard agent={AGENT_MAP.george} />
          </div>

          <div className="org-connector" style={styles.orgConnectorWrap}>
            <div style={styles.orgConnectorVertical} />
            <div style={styles.orgConnectorHorizontal} />
          </div>

          <div className="org-branch-row" style={styles.orgBranchRow}>
            <OrgAgentCard agent={AGENT_MAP.coding} />
            <OrgAgentCard agent={AGENT_MAP.research} />
          </div>

          <div className="org-connector" style={styles.orgConnectorWrapBottom}>
            <div style={styles.orgBottomArms}>
              <div style={styles.orgBottomArmLeft} />
              <div style={styles.orgBottomArmRight} />
            </div>
            <div style={styles.orgConnectorVerticalBottom} />
          </div>

          <div style={styles.orgBottomRow}>
            <OrgAgentCard agent={AGENT_MAP.qa} />
          </div>
        </div>
      </section>

      <section className="card" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Section B</div>
            <h2 style={styles.sectionTitle}>Etsy Pipeline Board</h2>
          </div>
          <div style={styles.pipelineMeta}>{PIPELINE_STAGES.length} stages · {PACKS.length} packs tracked</div>
        </div>

        <div style={styles.pipelineGrid}>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} style={{ ...styles.stageCard, borderTopColor: stage.color }}>
              <div style={styles.stageLabel}>{stage.label}</div>
              <div style={styles.stageAgentWrap}>
                {stage.agent ? (
                  <AgentBadge agent={AGENT_MAP[stage.agent]} />
                ) : (
                  <span style={styles.unassignedBadge}>Human step</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableTitle}>Current Packs</h3>
            <p style={styles.tableSubtitle}>Sorted by status to surface what is live, ready, or still needs curation.</p>
          </div>
          <button className="btn-ghost btn-sm" onClick={toggleSort}>
            Sort status {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Pack</th>
                <th style={styles.th}>Theme</th>
                <th style={styles.thButtonWrap}>
                  <button type="button" onClick={toggleSort} style={styles.sortButton}>
                    Status {sortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </th>
                <th style={styles.th}>Agent</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedPacks.map((pack) => {
                const status = STATUS_META[pack.status];
                const owner = pack.agent ? OWNER_META[pack.agent] : null;
                const isLive = pack.status === 'live';

                return (
                  <tr key={pack.id} style={styles.tr}>
                    <td style={styles.td}>#{pack.id}</td>
                    <td style={styles.td}>
                      <div style={styles.themeCell}>
                        <div style={styles.themeName}>{pack.theme}</div>
                        <div style={styles.designMeta}>{pack.designs} designs</div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          color: status.color,
                          background: status.glow,
                          borderColor: `${status.color}55`,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {owner ? (
                        <span style={{ ...styles.ownerBadge, borderColor: `${owner.color}55`, color: owner.color }}>
                          {owner.label}
                        </span>
                      ) : (
                        <span style={styles.emptyOwner}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <button className="btn-ghost btn-sm">
                        {isLive ? 'View on Etsy' : 'Upload'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OrgAgentCard({ agent }) {
  return (
    <div style={{ ...styles.orgCard, boxShadow: `inset 0 0 0 1px ${agent.color}33` }}>
      <div style={styles.orgCardHeader}>
        <div style={{ ...styles.orgEmojiWrap, background: `${agent.color}18`, color: agent.color }}>
          <span style={styles.orgEmoji}>{agent.emoji}</span>
        </div>
        <span style={styles.activeDot} />
      </div>
      <div style={styles.orgName}>{agent.name}</div>
      <div style={styles.orgModel}>{agent.model}</div>
      <div style={styles.orgRole}>{agent.role}</div>
    </div>
  );
}

function AgentBadge({ agent }) {
  return (
    <span style={{ ...styles.agentBadge, borderColor: `${agent.color}55`, color: agent.color }}>
      <span>{agent.emoji}</span>
      <span>{agent.name}</span>
    </span>
  );
}

const responsiveStyles = `
  @media (max-width: 760px) {
    .org-branch-row {
      grid-template-columns: 1fr !important;
      max-width: 280px !important;
      gap: 16px !important;
    }

    .org-connector {
      display: none !important;
    }
  }
`;

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  pageHeader: {
    alignItems: 'flex-start',
  },
  pageSubtitle: {
    margin: '8px 0 0',
    color: 'var(--text-muted)',
    fontSize: 14,
    maxWidth: 720,
  },
  sectionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 6,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
  },
  legendPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.14)',
    flexShrink: 0,
  },
  orgChart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    width: '100%',
  },
  orgTopRow: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  orgBranchRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(220px, 280px))',
    gap: 40,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 680,
  },
  orgBottomRow: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  orgConnectorWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 520,
    height: 44,
  },
  orgConnectorVertical: {
    position: 'absolute',
    left: '50%',
    top: 0,
    transform: 'translateX(-50%)',
    width: 0,
    height: 20,
    borderLeft: '2px solid var(--border)',
  },
  orgConnectorHorizontal: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: 20,
    height: 20,
    borderTop: '2px solid var(--border)',
    borderLeft: '2px solid var(--border)',
    borderRight: '2px solid var(--border)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  orgConnectorWrapBottom: {
    position: 'relative',
    width: '100%',
    maxWidth: 520,
    height: 52,
  },
  orgBottomArms: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: 0,
    height: 24,
  },
  orgBottomArmLeft: {
    position: 'absolute',
    left: '25%',
    width: '25%',
    height: 24,
    borderRight: '2px solid var(--border)',
    borderBottom: '2px solid var(--border)',
    borderBottomRightRadius: 16,
  },
  orgBottomArmRight: {
    position: 'absolute',
    right: '25%',
    width: '25%',
    height: 24,
    borderLeft: '2px solid var(--border)',
    borderBottom: '2px solid var(--border)',
    borderBottomLeftRadius: 16,
  },
  orgConnectorVerticalBottom: {
    position: 'absolute',
    left: '50%',
    top: 24,
    transform: 'translateX(-50%)',
    width: 0,
    height: 28,
    borderLeft: '2px solid var(--border)',
  },
  orgCard: {
    width: 'min(100%, 280px)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
    border: '1px solid var(--border)',
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  orgCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orgEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgEmoji: {
    fontSize: 24,
    lineHeight: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: 700,
  },
  orgModel: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  orgRole: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  pipelineMeta: {
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  stageCard: {
    border: '1px solid var(--border)',
    borderTopWidth: 4,
    background: 'var(--surface2)',
    borderRadius: 14,
    padding: 14,
    minHeight: 102,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  stageLabel: {
    fontWeight: 700,
    fontSize: 15,
  },
  stageAgentWrap: {
    marginTop: 'auto',
  },
  agentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
    fontSize: 12,
    fontWeight: 600,
  },
  unassignedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px dashed var(--border)',
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  tableTitle: {
    margin: 0,
    fontSize: 18,
  },
  tableSubtitle: {
    margin: '6px 0 0',
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  tableWrap: {
    width: '100%',
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 14,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 720,
    background: 'var(--surface)',
  },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: 12,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  },
  thButtonWrap: {
    textAlign: 'left',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.02)',
  },
  sortButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: 0,
    cursor: 'pointer',
  },
  tr: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '14px 16px',
    fontSize: 14,
    verticalAlign: 'middle',
  },
  themeCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  themeName: {
    fontWeight: 600,
  },
  designMeta: {
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 700,
  },
  ownerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid',
    background: 'rgba(255,255,255,0.02)',
    fontSize: 12,
    fontWeight: 600,
  },
  emptyOwner: {
    color: 'var(--text-muted)',
  },
};
