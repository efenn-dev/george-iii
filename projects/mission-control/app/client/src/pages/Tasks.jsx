import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/index.js';
import StatusBadge from '../shared/StatusBadge.jsx';

const COLUMNS = ['backlog', 'assigned', 'in_progress', 'in_review', 'approved', 'done'];
const COLUMN_LABELS = {
  backlog: 'Backlog',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  in_review: 'In Review',
  approved: 'Approved',
  done: 'Done',
};
const COLUMN_COLORS = {
  backlog: 'var(--text-muted)',
  assigned: 'var(--warning)',
  in_progress: 'var(--info)',
  in_review: 'var(--warning)',
  approved: 'var(--success)',
  done: 'var(--accent)',
};
const DOMAIN_EMOJI = { content: '🎬', trading: '📈', dev: '💻', merch: '🛍️', diy: '🔧' };
const AGENT_META = {
  george: { label: '👑 George', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  coding: { label: '⚡ Coder', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  research: { label: '📚 Scribe', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  scribe: { label: '📚 Scribe', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
};
const PRIORITY_COLORS = {
  low: '#94a3b8',
  medium: '#56b4f5',
  high: '#f5a623',
  urgent: '#ff5c5c',
};
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['backlog', 'assigned', 'in_progress', 'in_review', 'qa_passed', 'needs_fix', 'approved', 'done', 'archived'];

const EMPTY_TASK = {
  title: '',
  description: '',
  status: 'backlog',
  source: 'manual',
  assigned_agent: '',
  priority: 'medium',
};

export default function Tasks() {
  const [projects, setProjects] = useState([]);
  const [workflow, setWorkflow] = useState(createEmptyWorkflow());
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [error, setError] = useState('');
  const selectedProjectRef = useRef(null);

  const loadBoard = async (projectId, keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const board = await api.getTaskWorkflow(projectId);
      setWorkflow({ ...createEmptyWorkflow(), ...board });
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const p = await api.getProjects();
    setProjects(p);
    if (p.length > 0) {
      const pid = selectedProject || p[0].id;
      setSelectedProject(pid);
      selectedProjectRef.current = pid;
      await loadBoard(pid, true);
    } else {
      setWorkflow(createEmptyWorkflow());
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      if (selectedProjectRef.current) {
        loadBoard(selectedProjectRef.current, true).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const switchProject = async (pid) => {
    setSelectedProject(pid);
    selectedProjectRef.current = pid;
    await loadBoard(pid);
  };

  const allTasks = useMemo(() => Object.values(workflow).flat(), [workflow]);

  const openAdd = (status = 'backlog') => {
    setForm({ ...EMPTY_TASK, status });
    setError('');
    setModal('add');
  };

  const openEdit = (task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      source: task.source,
      assigned_agent: task.assigned_agent || '',
      priority: task.priority || 'medium',
    });
    setError('');
    setModal(task);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        assigned_agent: form.assigned_agent || null,
      };
      if (modal === 'add') {
        await api.createTask({ ...payload, project_id: selectedProject });
      } else {
        await api.updateTask(modal.id, payload);
      }
      setModal(null);
      await loadBoard(selectedProject, true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await api.deleteTask(task.id);
    await loadBoard(selectedProject, true);
  };

  const withBusyTask = async (taskId, action) => {
    setBusyTaskId(taskId);
    try {
      await action();
      await loadBoard(selectedProject, true);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleAssign = async (task, agent) => {
    await withBusyTask(task.id, () => api.assignTask(task.id, { agent }));
  };

  const handleAdvance = async (task) => {
    await withBusyTask(task.id, () => api.transitionTask(task.id, {}));
  };

  const handleApprove = async (task, approved = true) => {
    await withBusyTask(task.id, () => api.approveTask(task.id, { approved }));
  };

  const currentProject = projects.find(p => p.id === selectedProject);

  if (loading && projects.length === 0) return <div className="loading">Loading kanban...</div>;

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">📋 Agent Workflow Kanban</h1>
          <div style={styles.subTitle}>
            {currentProject ? `${DOMAIN_EMOJI[currentProject.domain]} ${currentProject.name}` : 'Pick a project to start moving work.'}
          </div>
        </div>
        <button className="btn-primary" onClick={() => openAdd()} disabled={!selectedProject}>
          + New Task
        </button>
      </div>

      <div style={styles.projectTabs}>
        {projects.map(p => (
          <button
            key={p.id}
            className={selectedProject === p.id ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => switchProject(p.id)}
          >
            {DOMAIN_EMOJI[p.domain]} {p.name}
          </button>
        ))}
      </div>

      <div style={styles.boardScroller}>
        <div style={styles.kanban}>
          {COLUMNS.map(status => {
            const col = workflow[status] || [];
            return (
              <div key={status} style={styles.column}>
                <div style={styles.colHeader}>
                  <div>
                    <div style={{ color: COLUMN_COLORS[status], fontWeight: 700 }}>{COLUMN_LABELS[status]}</div>
                    <div style={styles.colHint}>{columnHint(status)}</div>
                  </div>
                  <span style={styles.colCount}>{col.length}</span>
                  <button style={styles.addBtn} onClick={() => openAdd(defaultTaskStatusForColumn(status))} title={`Add to ${COLUMN_LABELS[status]}`}>+</button>
                </div>
                <div style={styles.colBody}>
                  {col.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      busy={busyTaskId === task.id}
                      onEdit={() => openEdit(task)}
                      onDelete={() => handleDelete(task)}
                      onAssign={handleAssign}
                      onAdvance={handleAdvance}
                      onApprove={handleApprove}
                    />
                  ))}
                  {col.length === 0 && <div style={styles.emptyCol}>No tasks</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal === 'add' ? 'New Kanban Task' : 'Edit Task'}</div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Task title"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What needs doing?"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    <option value="manual">Manual</option>
                    <option value="discord">Discord</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Assigned Agent</label>
                  <select value={form.assigned_agent} onChange={e => setForm(f => ({ ...f, assigned_agent: e.target.value }))}>
                    <option value="">Unassigned</option>
                    <option value="george">👑 George</option>
                    <option value="coding">⚡ Coder</option>
                    <option value="research">📚 Scribe</option>
                    <option value="scribe">📚 Scribe</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{labelize(p)}</option>)}
                  </select>
                </div>
              </div>
              {error && <div className="error-msg">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && projects.length > 0 && allTasks.length === 0 && (
        <div className="empty">No tasks in this project yet.</div>
      )}
    </div>
  );
}

function TaskCard({ task, busy, onEdit, onDelete, onAssign, onAdvance, onApprove }) {
  const actions = getTaskActions(task, onAdvance, onApprove);
  const agent = AGENT_META[task.assigned_agent];
  const lastChanged = getLastStatusChange(task.workflow_log);

  return (
    <div style={styles.taskCard} className="card">
      <div style={styles.taskHeader}>
        <div style={{ flex: 1 }}>
          <div style={styles.taskTitle}>{task.title}</div>
          <div style={styles.metaRow}>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.qa_status || 'pending'} size="small" />
            {task.status === 'needs_fix' && <StatusBadge status="needs_fix" size="small" />}
            {task.status === 'qa_passed' && !task.approved && <StatusBadge status="pending_approval" size="small" />}
          </div>
        </div>
        <div style={styles.headerButtons}>
          <button className="btn-ghost btn-sm" onClick={onEdit} title="Edit" disabled={busy}>✏️</button>
          <button className="btn-danger btn-sm" onClick={onDelete} title="Delete" disabled={busy}>🗑️</button>
        </div>
      </div>

      {task.description && (
        <div className="line-clamp-3" style={styles.taskDesc}>{task.description}</div>
      )}

      <div style={styles.taskMetaBlock}>
        <AgentBadge agent={task.assigned_agent} />
        <span style={styles.lastChange}>Last change: {lastChanged ? formatTimestamp(lastChanged.timestamp) : '—'}</span>
      </div>

      {task.qa_notes && (
        <div style={styles.qaNotes}>{task.qa_notes}</div>
      )}

      <div style={styles.actionBlock}>
        {!task.assigned_agent && task.status === 'backlog' && (
          <div style={styles.assignRow}>
            {['george', 'coding', 'research'].map(agentKey => (
              <button key={agentKey} className="btn-ghost btn-sm" onClick={() => onAssign(task, agentKey)} disabled={busy}>
                {AGENT_META[agentKey].label}
              </button>
            ))}
          </div>
        )}

        {actions.map(action => (
          <button
            key={action.label}
            className={action.variant === 'primary' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => action.onClick(task)}
            disabled={busy}
          >
            {busy ? 'Working...' : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getTaskActions(task, onAdvance, onApprove) {
  const actions = [];

  if (task.status === 'assigned') {
    actions.push({ label: '▶ Start Work', variant: 'primary', onClick: onAdvance });
  }
  if (task.status === 'in_progress' || task.status === 'needs_fix') {
    actions.push({ label: '🧪 Send to QA', variant: 'primary', onClick: onAdvance });
  }
  if (task.status === 'qa_passed') {
    actions.push({ label: '👑 Approve', variant: 'primary', onClick: (t) => onApprove(t, true) });
    actions.push({ label: '↩ Needs Fix', variant: 'ghost', onClick: (t) => onApprove(t, false) });
  }
  if (task.status === 'approved') {
    actions.push({ label: '✅ Mark Done', variant: 'primary', onClick: onAdvance });
  }
  if (task.status === 'done') {
    actions.push({ label: '📦 Archive', variant: 'ghost', onClick: onAdvance });
  }
  if (task.status === 'backlog' && task.assigned_agent) {
    actions.push({ label: 'Claim Task', variant: 'primary', onClick: onAdvance });
  }

  return actions;
}

function AgentBadge({ agent }) {
  if (!agent) {
    return <span style={styles.unassignedBadge}>Unassigned</span>;
  }
  const meta = AGENT_META[agent] || { label: agent, color: 'var(--text-muted)', bg: 'var(--surface2)' };
  return (
    <span style={{ ...styles.agentBadge, color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority = 'medium' }) {
  return (
    <span style={styles.priorityBadge}>
      <span style={{ ...styles.priorityDot, background: PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium }} />
      {labelize(priority)}
    </span>
  );
}

function getLastStatusChange(workflowLog) {
  try {
    const parsed = workflowLog ? JSON.parse(workflowLog) : [];
    return Array.isArray(parsed) && parsed.length ? parsed[parsed.length - 1] : null;
  } catch {
    return null;
  }
}

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function labelize(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function createEmptyWorkflow() {
  return {
    backlog: [],
    assigned: [],
    in_progress: [],
    in_review: [],
    approved: [],
    done: [],
  };
}

function defaultTaskStatusForColumn(column) {
  if (column === 'approved') return 'qa_passed';
  return column;
}

function columnHint(column) {
  return {
    backlog: 'Unassigned ideas',
    assigned: 'Claimed, not started',
    in_progress: 'Active work + fixes',
    in_review: 'QA bot checking',
    approved: 'QA passed / approved',
    done: 'Completed + archived',
  }[column];
}

const styles = {
  subTitle: { color: 'var(--text-muted)', marginTop: 6 },
  projectTabs: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  boardScroller: { overflowX: 'auto', paddingBottom: 8 },
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(280px, 1fr))',
    gap: 14,
    alignItems: 'start',
    minWidth: 1760,
  },
  column: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 160,
  },
  colHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
  },
  colHint: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  colCount: {
    background: 'var(--border)',
    color: 'var(--text-muted)',
    borderRadius: '10px',
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 'auto',
  },
  addBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 18,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  colBody: { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 },
  emptyCol: { color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '18px 0' },
  taskCard: { padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  taskHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerButtons: { display: 'flex', gap: 4 },
  taskTitle: { fontWeight: 700, fontSize: 13, lineHeight: 1.4 },
  metaRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  taskDesc: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 },
  taskMetaBlock: { display: 'flex', flexDirection: 'column', gap: 8 },
  agentBadge: { display: 'inline-flex', width: 'fit-content', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  unassignedBadge: { display: 'inline-flex', width: 'fit-content', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--text-muted)' },
  priorityBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  priorityDot: { width: 8, height: 8, borderRadius: '50%' },
  lastChange: { fontSize: 11, color: 'var(--text-muted)' },
  qaNotes: { fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 },
  actionBlock: { display: 'flex', flexDirection: 'column', gap: 8 },
  assignRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
};

