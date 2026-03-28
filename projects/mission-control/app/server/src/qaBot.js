import db from './db.js';

const QA_CHECK_WORK_STATUSES = new Set(['assigned', 'in_progress', 'needs_fix', 'qa_passed', 'approved', 'done']);

function parseWorkflowLog(value) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushLogEntry(log, entry) {
  return JSON.stringify([
    ...log,
    {
      status: entry.status,
      agent: entry.agent || null,
      timestamp: entry.timestamp || new Date().toISOString(),
      note: entry.note || null,
    },
  ]);
}

export function runQaBot(taskId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const workflowLog = parseWorkflowLog(task.workflow_log);
  const failures = [];

  if (!task.description || !task.description.trim()) {
    failures.push('Description is required before QA.');
  }
  if (!task.assigned_agent || !task.assigned_agent.trim()) {
    failures.push('Assigned agent is required before QA.');
  }
  if (!workflowLog.some(entry => QA_CHECK_WORK_STATUSES.has(entry.status))) {
    failures.push('Workflow log does not show any work in progress yet.');
  }

  const qaPassed = failures.length === 0;
  const qaNotes = qaPassed
    ? 'QA bot passed: description, assignee, and workflow history all look valid.'
    : failures.join(' ');
  const nextStatus = qaPassed ? 'qa_passed' : 'needs_fix';
  const qaStatus = qaPassed ? 'passed' : 'failed';
  const nextWorkflowLog = pushLogEntry(workflowLog, {
    status: nextStatus,
    agent: 'qa-bot',
    note: qaPassed ? 'Automated QA passed.' : `Automated QA failed. ${qaNotes}`,
  });

  db.prepare(`
    UPDATE tasks
    SET status = ?, qa_status = ?, qa_notes = ?, workflow_log = ?
    WHERE id = ?
  `).run(nextStatus, qaStatus, qaNotes, nextWorkflowLog, taskId);

  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}
