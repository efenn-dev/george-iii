import React, { useState } from 'react';

function getSections() { return [
  {
    id: 'emergency',
    emoji: '🚨',
    title: 'Emergency Controls',
    alwaysOpen: true,
    intro: 'Fastest path to stop, resume, and sanity-check the system when something looks wrong.',
    content: (
      <>
        <div style={styles.kvList}>
          <RunbookItem
            label="STOP-GEORGE.bat"
            description="Emergency kill: stops agent, resets session, sets circuit breaker to STOP"
          />
          <RunbookItem
            label="RESUME-GEORGE.bat"
            description="Resume operations after emergency stop"
          />
          <RunbookItem
            label="GEORGE-STATUS.bat"
            description="Quick health check (gateway + mission control + loop detection)"
          />
          <RunbookItem
            label="OPTIMIZE-PACKS.bat"
            description="Resize and split Etsy packs under 20MB Etsy limit"
          />
        </div>
        <CodeBlock path="C:\\Users\\efenn\\OneDrive\\Desktop\\" />
      </>
    ),
  },
  {
    id: 'infrastructure',
    emoji: '🔧',
    title: 'Infrastructure',
    intro: 'Core local services, watchdogs, and the manual circuit breaker location.',
    content: (
      <>
        <div style={styles.kvList}>
          <LinkItem label="Gateway Dashboard" href="http://127.0.0.1:18789/" />
          <LinkItem label="Mission Control" href="http://localhost:5173/" />
          <LinkItem label="Mission Control API" href="http://localhost:3001/api/" />
          <LinkItem label="Ollama" href="http://localhost:11434/" />
          <RunbookItem label="Gateway Watchdog" description="Runs every 2 min (silent VBS), auto-restarts gateway + MC" />
          <RunbookItem label="Loop Breaker" description="Runs every 3 min (silent VBS), detects stuck loops" />
          <RunbookItem label="Circuit Breaker" description="Edit status: RUN / STOP / PAUSE" />
        </div>
        <CodeBlock path="C:\\Users\\efenn\\.openclaw\\workspace\\CIRCUIT_BREAKER.md" />
      </>
    ),
  },
  {
    id: 'agents',
    emoji: '🤖',
    title: 'Agent Fleet',
    intro: 'Who does what, which model they run, and where each workspace lives.',
    content: (
      <div style={styles.agentGrid}>
        <AgentCard
          name="George III (main)"
          model="anthropic/claude-opus-4-6"
          role="Orchestrator"
          workspace="~/.openclaw/workspace"
        />
        <AgentCard
          name="Coder (coding)"
          model="openai/gpt-5.4"
          role="All programming tasks"
          workspace="~/.openclaw/workspace-coding"
        />
        <AgentCard
          name="Scribe (research)"
          model="ollama/kimi-k2.5:cloud"
          role="Writing & research (FREE)"
          workspace="~/.openclaw/workspace-research"
        />
        <AgentCard
          name="QA Bot"
          model="automated"
          role="Quality gate before approval"
        />
      </div>
    ),
  },
  {
    id: 'business',
    emoji: '💰',
    title: 'Business Links',
    intro: 'Primary storefront and brand presence links.',
    content: (
      <div style={styles.kvList}>
        <LinkItem label="Etsy Shop" href="https://swagnuggets.etsy.com" />
        <LinkItem label="Fiverr" href="https://www.fiverr.com/emmittfennessey" />
        <LinkItem label="Substack" href="https://substack.com/@swagnuggets" />
        <LinkItem label="Pinterest" href="https://pinterest.com/swagnuggets" />
        <LinkItem label="GitHub" href="https://github.com/[username]/george-iii" />
      </div>
    ),
  },
  {
    id: 'files',
    emoji: '📁',
    title: 'Key Files & Templates',
    intro: 'Fast-reference paths for gigs, listings, portfolio assets, and changelogs.',
    content: (
      <div style={styles.fileList}>
        <FileItem label="Fiverr Gig Templates" path="workspace/fiverr-gigs/emmittfennessey-gigs.md" />
        <FileItem label="Fiverr Fulfillment Specs" path="workspace/fiverr-gigs/fulfillment-specs.md" />
        <FileItem label="Fiverr Quick Responses" path="workspace/fiverr-gigs/quick-responses.md" />
        <FileItem label="Fiverr Portfolio HTML" path="workspace/fiverr-gigs/portfolio/portfolio-viewer.html" />
        <FileItem label="SEO Audit Tool" path="workspace/fiverr-gigs/tools/seo-audit-tool/audit.py" />
        <FileItem label="SEO Audit Template" path="workspace/fiverr-gigs/seo-audit-template.md" />
        <FileItem label="Blog Post Template" path="workspace/fiverr-gigs/blog-post-template.md" />
        <FileItem label="Etsy Listing Templates" path="workspace/etsy-shop/listings/listing-templates.md" />
        <FileItem label="Etsy SEO Cheatsheet" path="workspace/etsy-shop/listings/etsy-seo-cheatsheet.md" />
        <FileItem label="Pinterest Pins" path="workspace/pinterest/" />
        <FileItem label="Substack Posts" path="workspace/substack/posts/" />
        <FileItem label="Config Changelog" path="workspace/config-changelog.md" />
      </div>
    ),
  },
  {
    id: 'cron',
    emoji: '⏰',
    title: 'Cron Jobs (Automated)',
    intro: 'Recurring automations, schedule cadence, primary model, and intended output.',
    content: (
      <div style={styles.timeline}>
        <TimelineItem title="Task Queue Poll" schedule="Every 30 min" owner="Kimi (free)" detail="Auto-assigns kanban tasks" />
        <TimelineItem title="Weekly Substack Post" schedule="Monday 8 AM" owner="Kimi (free)" detail="Generates blog post" />
        <TimelineItem title="Fiverr Content Stockpile" schedule="Wed/Sat 6 AM" owner="Kimi (free)" detail="Pre-writes blog inventory" />
        <TimelineItem title="Pinterest Pins" schedule="Tue/Thu/Sat 9 AM" owner="Kimi (free)" detail="Generates pin descriptions" />
        <TimelineItem title="Security Scan" schedule="Sunday 3 AM" owner="GPT-5.4 (~$0.20)" detail="Full environment audit" />
      </div>
    ),
  },
  {
    id: 'processes',
    emoji: '📋',
    title: 'Processes',
    intro: 'Operational playbooks for Fiverr, Etsy, and emergency shutdown.',
    content: (
      <div style={styles.processGrid}>
        <ProcessCard
          title="FIVERR ORDER FULFILLMENT"
          steps={[
            'Order comes in → Master E forwards buyer answers to George (Discord)',
            'George delegates → Scribe generates deliverable (free via Kimi)',
            'George reviews → checks quality against fulfillment-specs.md',
            'Master E reviews → final check, downloads file',
            'Master E delivers → uploads to Fiverr, hits Deliver',
          ]}
        />
        <ProcessCard
          title="ETSY NEW PACK PIPELINE"
          steps={[
            'Discover (Scribe) → Research trending niches',
            'Curate (Master E) → Pick designs in OneDrive folders',
            'Optimize (Script) → Run OPTIMIZE-PACKS.bat',
            'Listing (Scribe) → Write title, tags, description',
            'Publish (Master E) → Upload to Etsy',
            'Promote (Scribe) → Pinterest pins + Substack mention',
          ]}
        />
        <ProcessCard
          title="EMERGENCY STOP"
          steps={[
            'Double-click STOP-GEORGE.bat on Desktop',
            'Or edit CIRCUIT_BREAKER.md → set status: STOP',
            'To resume: RESUME-GEORGE.bat or set status: RUN',
          ]}
        />
      </div>
    ),
  },
  {
    id: 'costs',
    emoji: '💵',
    title: 'Cost Reference',
    intro: 'Rough usage economics for strategy, coding, research, and recurring automation.',
    content: (
      <div style={styles.costGrid}>
        <CostCard title="George III (Opus)" price="~$15/MTok in, $75/MTok out" note="Use for strategy/chat only" />
        <CostCard title="Coder (GPT-5.4)" price="~$0.05–$0.20 per task" note="Coding only" />
        <CostCard title="Scribe (Kimi local)" price="FREE" note="All writing, research, content" />
        <CostCard title="Automation crons" price="~$0.80/month total" note="Background upkeep" />
        <CostCard title="Fiverr SEO audit order" price="$45" note="Covers ~2 days of API costs" />
      </div>
    ),
  },
]; }

export default function Runbook() {
  const sections = getSections();
  const [openSections, setOpenSections] = useState({});

  function toggleSection(id, alwaysOpen) {
    if (alwaysOpen) return;
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="page">
      <div className="page-header" style={styles.pageHeader}>
        <div>
          <h1 className="page-title">📖 Runbook</h1>
          <p style={styles.subtitle}>
            Mission Control knowledge base for emergency actions, infrastructure, agents, automations, and business ops.
          </p>
        </div>
      </div>

      <div style={styles.stack}>
        {sections.map(section => {
          const isOpen = section.alwaysOpen || !!openSections[section.id];

          return (
            <section key={section.id} className="card" style={styles.sectionCard}>
              <button
                type="button"
                onClick={() => toggleSection(section.id, section.alwaysOpen)}
                style={{
                  ...styles.sectionHeader,
                  cursor: section.alwaysOpen ? 'default' : 'pointer',
                }}
                aria-expanded={isOpen}
              >
                <div style={styles.sectionHeaderLeft}>
                  <div style={styles.sectionTitleRow}>
                    <span style={styles.sectionEmoji}>{section.emoji}</span>
                    <span style={styles.sectionTitle}>{section.title}</span>
                    {section.alwaysOpen && <span style={styles.lockBadge}>Pinned</span>}
                  </div>
                  <p style={styles.sectionIntro}>{section.intro}</p>
                </div>
                {!section.alwaysOpen && (
                  <span style={styles.chevron}>{isOpen ? '−' : '+'}</span>
                )}
              </button>

              {isOpen && <div style={styles.sectionBody}>{section.content}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RunbookItem({ label, description }) {
  return (
    <div style={styles.kvRow}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={styles.kvValue}>{description}</div>
    </div>
  );
}

function LinkItem({ label, href }) {
  return (
    <div style={styles.kvRow}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={styles.kvValue}>
        <a href={href} target="_blank" rel="noreferrer" style={styles.link}>
          {href}
        </a>
      </div>
    </div>
  );
}

function FileItem({ label, path }) {
  return (
    <div style={styles.fileCard}>
      <div style={styles.fileLabel}>{label}</div>
      <CodeBlock path={path} compact />
    </div>
  );
}

function AgentCard({ name, model, role, workspace }) {
  return (
    <div style={styles.agentCard}>
      <div style={styles.agentName}>{name}</div>
      <div style={styles.agentRole}>{role}</div>
      <div style={styles.agentMeta}>
        <span style={styles.metaLabel}>Model</span>
        <code style={styles.inlineCode}>{model}</code>
      </div>
      {workspace && (
        <div style={styles.agentMetaColumn}>
          <span style={styles.metaLabel}>Workspace</span>
          <CodeBlock path={workspace} compact />
        </div>
      )}
    </div>
  );
}

function TimelineItem({ title, schedule, owner, detail }) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineDot} />
      <div style={styles.timelineContent}>
        <div style={styles.timelineTitle}>{title}</div>
        <div style={styles.timelineMeta}>{schedule} · {owner}</div>
        <div style={styles.timelineDetail}>{detail}</div>
      </div>
    </div>
  );
}

function ProcessCard({ title, steps }) {
  return (
    <div style={styles.processCard}>
      <div style={styles.processTitle}>{title}</div>
      <ol style={styles.processList}>
        {steps.map(step => (
          <li key={step} style={styles.processStep}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

function CostCard({ title, price, note }) {
  return (
    <div style={styles.costCard}>
      <div style={styles.costTitle}>{title}</div>
      <div style={styles.costPrice}>{price}</div>
      <div style={styles.costNote}>{note}</div>
    </div>
  );
}

function CodeBlock({ path, compact = false }) {
  return (
    <pre style={{ ...styles.codeBlock, ...(compact ? styles.codeBlockCompact : null) }}>
      <code>{path}</code>
    </pre>
  );
}

const styles = {
  pageHeader: {
    alignItems: 'flex-start',
  },
  subtitle: {
    marginTop: 6,
    color: 'var(--text-muted)',
    maxWidth: 760,
    fontSize: 13,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
  },
  sectionHeader: {
    width: '100%',
    background: 'transparent',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '18px 20px',
    textAlign: 'left',
  },
  sectionHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  sectionIntro: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  lockBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent)',
    background: 'rgba(108,99,255,0.14)',
    border: '1px solid rgba(108,99,255,0.24)',
    borderRadius: 999,
    padding: '2px 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  chevron: {
    minWidth: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
    fontSize: 20,
    lineHeight: 1,
  },
  sectionBody: {
    borderTop: '1px solid var(--border)',
    padding: 20,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(0,0,0,0.04) 100%)',
  },
  kvList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  kvRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 240px) 1fr',
    gap: 14,
    alignItems: 'start',
    padding: '12px 14px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  kvLabel: {
    fontWeight: 700,
    color: 'var(--text)',
  },
  kvValue: {
    color: 'var(--text-muted)',
  },
  link: {
    wordBreak: 'break-all',
  },
  codeBlock: {
    marginTop: 14,
    padding: '12px 14px',
    borderRadius: 10,
    background: '#11141d',
    border: '1px solid var(--border)',
    color: '#c7cbda',
    fontSize: 12,
    overflowX: 'auto',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  codeBlockCompact: {
    marginTop: 8,
    marginBottom: 0,
    padding: '10px 12px',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },
  agentCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  agentName: {
    fontWeight: 700,
    fontSize: 15,
  },
  agentRole: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  agentMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  agentMetaColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    fontWeight: 700,
  },
  inlineCode: {
    background: '#11141d',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    padding: '6px 8px',
    borderRadius: 8,
    fontSize: 12,
    width: 'fit-content',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  },
  fileList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  fileCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
  },
  fileLabel: {
    fontWeight: 700,
    marginBottom: 6,
  },
  timeline: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    paddingLeft: 10,
  },
  timelineItem: {
    display: 'grid',
    gridTemplateColumns: '16px 1fr',
    gap: 12,
    alignItems: 'start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    marginTop: 5,
    background: 'var(--accent)',
    boxShadow: '0 0 0 4px rgba(108,99,255,0.12)',
  },
  timelineContent: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
  },
  timelineTitle: {
    fontWeight: 700,
  },
  timelineMeta: {
    color: 'var(--accent)',
    fontSize: 12,
    marginTop: 4,
  },
  timelineDetail: {
    color: 'var(--text-muted)',
    marginTop: 6,
    fontSize: 13,
  },
  processGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
  },
  processCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
  },
  processTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--accent)',
    letterSpacing: '0.05em',
    marginBottom: 10,
  },
  processList: {
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  processStep: {
    color: 'var(--text)',
  },
  costGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  costCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  costTitle: {
    fontWeight: 700,
  },
  costPrice: {
    color: 'var(--accent)',
    fontSize: 18,
    fontWeight: 700,
  },
  costNote: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
};
