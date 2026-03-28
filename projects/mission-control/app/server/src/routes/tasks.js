import { Router } from 'express';
import db from '../db.js';
import { runQaBot } from '../qaBot.js';

const router = Router();

const WORKFLOW_ORDER = ['backlog', 'assigned', 'in_progress', 'in_review', 'qa_passed', 'approved', 'done', 'archived'];
const VISIBLE_WORKFLOW_COLUMNS = ['backlog', 'assigned', 'in_progress', 'in_review', 'approved', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const QA_STATUSES = ['pending', 'in_review', 'passed', 'failed', 'skipped'];
const ASSIGNED_AGENTS = ['george', 'coding', 'research', 'scribe'];

function parseWorkflowLog(value) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyWorkflowLog(entries) {
  return JSON.stringify(entries);
}

function appendWorkflowLog(task, { status, agent = null, note = null }) {
  const entries = parseWorkflowLog(task.workflow_log);
  entries.push({
    status,
    agent,
    timestamp: new Date().toISOString(),
    note,
  });
  return stringifyWorkflowLog(entries);
}

function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function serializeTask(task) {
  if (!task) return task;
  return {
    ...task,
    approved: Boolean(task.approved),
  };
}

function validateStatus(status) {
  return ['backlog', 'assigned', 'in_progress', 'in_review', 'qa_passed', 'needs_fix', 'approved', 'done', 'archived'].includes(status);
}

function nextWorkflowStatus(status) {
  const map = {
    backlog: 'assigned',
    assigned: 'in_progress',
    in_progress: 'in_review',
    needs_fix: 'in_review',
    qa_passed: 'approved',
    approved: 'done',
    done: 'archived',
  };
  return map[status] || null;
}

function workflowColumnForStatus(status) {
  switch (status) {
    case 'needs_fix':
      return 'in_progress';
    case 'qa_passed':
      return 'approved';
    case 'archived':
      return 'done';
    default:
      return status;
  }
}

function updateTask(id, changes) {
  const fields = Object.keys(changes);
  const values = Object.values(changes);
  if (!fields.length) return getTask(id);

  const setClause = fields.map(field => `${field} = ?`).join(', ');
  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...values, id);
  return getTask(id);
}

function moveTaskToStatus(task, status, { agent = null, note = null, qaStatus, qaNotes, approved } = {}) {
  const workflowLog = appendWorkflowLog(task, { status, agent, note });
  return updateTask(task.id, {
    status,
    workflow_log: workflowLog,
    ...(qaStatus !== undefined ? { qa_status: qaStatus } : {}),
    ...(qaNotes !== undefined ? { qa_notes: qaNotes } : {}),
    ...(approved !== undefined ? { approved: approved ? 1 : 0 } : {}),
  });
}

// GET workflow board — grouped for kanban view
router.get('/workflow', (req, res) => {
  const { project_id } = req.query;
  const rows = project_id
    ? db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(project_id)
    : db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();

  const grouped = Object.fromEntries(VISIBLE_WORKFLOW_COLUMNS.map(status => [status, []]));
  for (const row of rows) {
    const column = workflowColumnForStatus(row.status);
    if (grouped[column]) grouped[column].push(serializeTask(row));
  }

  res.json(grouped);
});

// GET tasks — optionally filter by project_id
router.get('/', (req, res) => {
  const { project_id } = req.query;
  const tasks = project_id
    ? db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(project_id)
    : db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks.map(serializeTask));
});

// GET single task
router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(serializeTask(task));
});

// POST create task
router.post('/', (req, res) => {
  const {
    project_id,
    title,
    description,
    status,
    source,
    assigned_agent,
    priority,
    qa_status,
    qa_notes,
    approved,
  } = req.body;

  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  if (status && !validateStatus(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (qa_status && !QA_STATUSES.includes(qa_status)) return res.status(400).json({ error: 'Invalid qa_status' });

  const finalStatus = status || (assigned_agent ? 'assigned' : 'backlog');
  const workflowLog = stringifyWorkflowLog([
    {
      status: finalStatus,
      agent: assigned_agent || null,
      timestamp: new Date().toISOString(),
      note: 'Task created',
    },
  ]);

  const result = db.prepare(`
    INSERT INTO tasks (
      project_id, title, description, status, source, assigned_agent,
      priority, qa_status, qa_notes, approved, workflow_log
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project_id,
    title,
    description || null,
    finalStatus,
    source || 'manual',
    assigned_agent || null,
    priority || 'medium',
    qa_status || 'pending',
    qa_notes || null,
    approved ? 1 : 0,
    workflowLog,
  );

  res.status(201).json(serializeTask(getTask(result.lastInsertRowid)));
});

// POST assign task to an agent
router.post('/:id/assign', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const { agent, note } = req.body || {};
  if (!agent) return res.status(400).json({ error: 'agent is required' });
  if (!ASSIGNED_AGENTS.includes(agent)) return res.status(400).json({ error: 'Invalid agent' });

  const assignedTask = updateTask(task.id, {
    assigned_agent: agent,
    status: task.status === 'backlog' ? 'assigned' : task.status,
    workflow_log: appendWorkflowLog(task, {
      status: task.status === 'backlog' ? 'assigned' : task.status,
      agent,
      note: note || `Assigned to ${agent}`,
    }),
  });

  res.json(serializeTask(assignedTask));
});

// POST move task through workflow
router.post('/:id/transition', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const { status, note, agent } = req.body || {};
  const targetStatus = status || nextWorkflowStatus(task.status);

  if (!targetStatus || !validateStatus(targetStatus)) {
    return res.status(400).json({ error: 'No valid next workflow stage found' });
  }

  if ((targetStatus === 'assigned' || targetStatus === 'in_progress' || targetStatus === 'in_review') && !task.assigned_agent && !agent) {
    return res.status(400).json({ error: 'Assign an agent before moving this task forward' });
  }

  const actingAgent = agent || task.assigned_agent || null;
  let updated = moveTaskToStatus(task, targetStatus, {
    agent: actingAgent,
    note: note || `Moved to ${targetStatus}`,
    qaStatus: targetStatus === 'in_review' ? 'in_review' : undefined,
    approved: targetStatus === 'approved' ? true : undefined,
  });

  if (targetStatus === 'in_review') {
    updated = runQaBot(task.id);
  }

  res.json(serializeTask(updated));
});

// POST submit QA review manually
router.post('/:id/qa', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const { status, notes, skipped } = req.body || {};
  if (!status && !skipped) return res.status(400).json({ error: 'status is required (pass/fail) unless skipped=true' });

  let nextStatus = task.status;
  let qaStatus = task.qa_status;
  let note = notes || null;

  if (skipped) {
    qaStatus = 'skipped';
    nextStatus = 'qa_passed';
    note = note || 'QA review skipped.';
  } else if (status === 'pass' || status === 'passed') {
    qaStatus = 'passed';
    nextStatus = 'qa_passed';
    note = note || 'QA review passed.';
  } else if (status === 'fail' || status === 'failed') {
    qaStatus = 'failed';
    nextStatus = 'needs_fix';
    note = note || 'QA review failed.';
  } else {
    return res.status(400).json({ error: 'status must be pass or fail' });
  }

  const updated = moveTaskToStatus(task, nextStatus, {
    agent: 'qa-bot',
    note,
    qaStatus,
    qaNotes: note,
    approved: false,
  });

  res.json(serializeTask(updated));
});

// POST final approval
router.post('/:id/approve', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const { approved = true, note } = req.body || {};
  const yes = approved === true || approved === 1 || approved === '1';
  const updated = moveTaskToStatus(task, yes ? 'approved' : 'needs_fix', {
    agent: 'master-e',
    note: note || (yes ? 'Approved by Master E' : 'Approval denied by Master E'),
    approved: yes,
    qaNotes: note || task.qa_notes,
  });

  res.json(serializeTask(updated));
});

// PUT update task (including status moves)
router.put('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const {
    title,
    description,
    status,
    source,
    project_id,
    assigned_agent,
    priority,
    qa_status,
    qa_notes,
    approved,
  } = req.body;

  if (status !== undefined && !validateStatus(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority !== undefined && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (qa_status !== undefined && !QA_STATUSES.includes(qa_status)) return res.status(400).json({ error: 'Invalid qa_status' });

  let workflowLog = task.workflow_log;
  if (status !== undefined && status !== task.status) {
    workflowLog = appendWorkflowLog(task, {
      status,
      agent: assigned_agent ?? task.assigned_agent ?? null,
      note: `Status updated to ${status}`,
    });
  }

  db.prepare(`
    UPDATE tasks
    SET project_id=?, title=?, description=?, status=?, source=?, assigned_agent=?, priority=?, qa_status=?, qa_notes=?, approved=?, workflow_log=?
    WHERE id=?
  `).run(
    project_id ?? task.project_id,
    title ?? task.title,
    description ?? task.description,
    status ?? task.status,
    source ?? task.source,
    assigned_agent ?? task.assigned_agent,
    priority ?? task.priority,
    qa_status ?? task.qa_status,
    qa_notes ?? task.qa_notes,
    approved !== undefined ? (approved ? 1 : 0) : task.approved,
    workflowLog,
    req.params.id,
  );

  let updated = getTask(req.params.id);
  if (status === 'in_review' && task.status !== 'in_review') {
    updated = runQaBot(req.params.id);
  }

  res.json(serializeTask(updated));
});

// DELETE task
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
