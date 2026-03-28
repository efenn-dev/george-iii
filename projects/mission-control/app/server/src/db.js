// Uses Node.js 24+ built-in SQLite (node:sqlite) — no native addon required
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'mission-control.db');

const WORKFLOW_STATUSES = ['backlog', 'assigned', 'in_progress', 'in_review', 'qa_passed', 'needs_fix', 'approved', 'done', 'archived'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const QA_STATUSES = ['pending', 'in_review', 'passed', 'failed', 'skipped'];

const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeWorkflowLog(task) {
  const existing = safeJsonParse(task.workflow_log, []);
  if (Array.isArray(existing) && existing.length > 0) return JSON.stringify(existing);
  return JSON.stringify([
    {
      status: task.status || 'backlog',
      agent: task.assigned_agent || null,
      timestamp: task.created_at || nowSql(),
      note: 'Imported from legacy task schema',
    },
  ]);
}

function taskTableSql(tableName = 'tasks') {
  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN (${WORKFLOW_STATUSES.map(s => `'${s}'`).join(',')})),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('discord','manual')),
      assigned_agent TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN (${PRIORITIES.map(p => `'${p}'`).join(',')})),
      qa_status TEXT NOT NULL DEFAULT 'pending' CHECK(qa_status IN (${QA_STATUSES.map(s => `'${s}'`).join(',')})),
      qa_notes TEXT,
      approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0, 1)),
      workflow_log TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;
}

function ensureTaskSchema() {
  const existingTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get();

  if (!existingTable) {
    db.exec(taskTableSql());
    return;
  }

  const columns = db.prepare(`PRAGMA table_info(tasks)`).all();
  const columnNames = new Set(columns.map(c => c.name));
  const tableSql = existingTable.sql || '';

  const hasColumns = ['assigned_agent', 'priority', 'qa_status', 'qa_notes', 'approved', 'workflow_log'].every(name => columnNames.has(name));
  const hasWorkflowConstraint = tableSql.includes(`'assigned'`) && tableSql.includes(`'qa_passed'`) && tableSql.includes(`'needs_fix'`) && tableSql.includes(`'approved'`);

  if (hasColumns && hasWorkflowConstraint) return;

  const legacyName = `tasks_legacy_${Date.now()}`;
  const rows = db.prepare('SELECT * FROM tasks').all();

  db.exec('BEGIN');
  try {
    db.exec(`ALTER TABLE tasks RENAME TO ${legacyName}`);
    db.exec(taskTableSql());

    const insertTask = db.prepare(`
      INSERT INTO tasks (
        id, project_id, title, description, status, source, assigned_agent,
        priority, qa_status, qa_notes, approved, workflow_log, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      const migratedStatus = WORKFLOW_STATUSES.includes(row.status) ? row.status : (row.status === 'in_progress' ? 'in_progress' : row.status === 'done' ? 'done' : row.status === 'archived' ? 'archived' : 'backlog');
      const priority = PRIORITIES.includes(row.priority) ? row.priority : 'medium';
      const qaStatus = QA_STATUSES.includes(row.qa_status) ? row.qa_status : 'pending';
      const approved = row.approved ? 1 : 0;
      const migrated = {
        ...row,
        status: migratedStatus,
        assigned_agent: row.assigned_agent || null,
        priority,
        qa_status: qaStatus,
        qa_notes: row.qa_notes || null,
        approved,
        workflow_log: normalizeWorkflowLog({ ...row, status: migratedStatus }),
        created_at: row.created_at || nowSql(),
      };

      insertTask.run(
        migrated.id,
        migrated.project_id,
        migrated.title,
        migrated.description || null,
        migrated.status,
        migrated.source || 'manual',
        migrated.assigned_agent,
        migrated.priority,
        migrated.qa_status,
        migrated.qa_notes,
        migrated.approved,
        migrated.workflow_log,
        migrated.created_at,
      );
    }

    db.exec(`DROP TABLE ${legacyName}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    purpose TEXT,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4',
    prompt TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT NOT NULL CHECK(domain IN ('content','trading','dev','merch','diy')),
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    job_id TEXT,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','success','error')),
    duration_ms INTEGER,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    summary TEXT,
    ran_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0
  );
`);

ensureTaskSchema();

// Seed demo data if empty
const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get().c;
if (agentCount === 0) {
  const insertAgent = db.prepare(`INSERT INTO agents (name, purpose, model, prompt, enabled) VALUES (?, ?, ?, ?, ?)`);
  insertAgent.run('ContentBot', 'Generate blog posts and social content', 'claude-sonnet-4', 'You are a content creation assistant...', 1);
  insertAgent.run('TradingBot', 'Analyze market data and produce signals', 'claude-sonnet-4', 'You are a trading analysis assistant...', 1);
  insertAgent.run('DevBot', 'Review code and suggest improvements', 'claude-sonnet-4', 'You are a senior software engineer...', 0);

  const insertProject = db.prepare(`INSERT INTO projects (name, domain, status) VALUES (?, ?, ?)`);
  const p1 = insertProject.run('YouTube Shorts Pipeline', 'content', 'active').lastInsertRowid;
  const p2 = insertProject.run('Algo Trading v2', 'trading', 'active').lastInsertRowid;
  const p3 = insertProject.run('Mission Control', 'dev', 'active').lastInsertRowid;

  const insertTask = db.prepare(`
    INSERT INTO tasks (
      project_id, title, description, status, source, assigned_agent,
      priority, qa_status, workflow_log
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seedTask = (projectId, title, description, status, source, assignedAgent = null, priority = 'medium') => {
    const workflowLog = JSON.stringify([
      { status, agent: assignedAgent, timestamp: nowSql(), note: 'Seeded demo task' },
    ]);
    insertTask.run(projectId, title, description, status, source, assignedAgent, priority, status === 'done' ? 'passed' : 'pending', workflowLog);
  };

  seedTask(p1, 'Script 10 short ideas', 'Generate video concepts for this week', 'done', 'discord', 'scribe', 'medium');
  seedTask(p1, 'Edit footage batch 3', 'Cut and color grade batch 3', 'in_progress', 'manual', 'coding', 'high');
  seedTask(p1, 'Thumbnail A/B test', 'Test two thumbnail styles', 'backlog', 'manual', null, 'medium');
  seedTask(p2, 'Backtest RSI strategy', 'Run 6-month backtest', 'done', 'manual', 'coding', 'high');
  seedTask(p2, 'Integrate new data feed', 'Switch to faster feed provider', 'in_progress', 'manual', 'coding', 'urgent');
  seedTask(p2, 'Deploy paper trading', 'Live test on paper account', 'backlog', 'discord', null, 'high');
  seedTask(p3, 'Phase 1 scaffold', 'Build core UI and API', 'in_progress', 'manual', 'george', 'high');
  seedTask(p3, 'Phase 2 Discord ingestion', 'Auto-pull tasks from Discord', 'backlog', 'manual', null, 'medium');

  const now = new Date();
  const ago = (h) => new Date(now - h * 3600000).toISOString().replace('T', ' ').slice(0, 19);

  const insertRun = db.prepare(`INSERT INTO runs (agent_name, job_id, status, duration_ms, tokens_in, tokens_out, cost_usd, summary, ran_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertRun.run('ContentBot', 'cron-001', 'success', 4200, 1200, 800, 0.0042, 'Generated 5 content ideas for YouTube', ago(2));
  insertRun.run('TradingBot', 'cron-002', 'success', 6100, 3400, 1200, 0.0198, 'Market analysis complete — no signals', ago(4));
  insertRun.run('ContentBot', 'cron-003', 'error', 800, 200, 0, 0.0008, 'Rate limit hit, retrying next cycle', ago(6));
  insertRun.run('DevBot', 'cron-004', 'success', 9800, 5600, 2200, 0.0380, 'Code review for 3 PRs complete', ago(26));
  insertRun.run('TradingBot', 'cron-005', 'success', 5500, 2800, 900, 0.0162, 'Buy signal generated for ETH', ago(28));

  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const insertCost = db.prepare(`INSERT INTO costs (date, agent_name, tokens_in, tokens_out, cost_usd) VALUES (?, ?, ?, ?, ?)`);
  insertCost.run(today, 'ContentBot', 8400, 5600, 0.0294);
  insertCost.run(today, 'TradingBot', 12000, 4200, 0.0720);
  insertCost.run(yesterday, 'ContentBot', 7200, 4800, 0.0252);
  insertCost.run(yesterday, 'TradingBot', 10800, 3600, 0.0648);
  insertCost.run(yesterday, 'DevBot', 4400, 1800, 0.0308);
}

export { WORKFLOW_STATUSES, PRIORITIES, QA_STATUSES };
export default db;
