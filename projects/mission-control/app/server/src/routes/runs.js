import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET runs — recent first, optional limit
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const agent = req.query.agent;
  const runs = agent
    ? db.prepare('SELECT * FROM runs WHERE agent_name = ? ORDER BY ran_at DESC LIMIT ?').all(agent, limit)
    : db.prepare('SELECT * FROM runs ORDER BY ran_at DESC LIMIT ?').all(limit);
  res.json(runs);
});

// GET single run
router.get('/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Not found' });
  res.json(run);
});

// POST create run
router.post('/', (req, res) => {
  const { agent_name, job_id, status, duration_ms, tokens_in, tokens_out, cost_usd, summary } = req.body;
  if (!agent_name) return res.status(400).json({ error: 'agent_name is required' });
  const result = db.prepare(`
    INSERT INTO runs (agent_name, job_id, status, duration_ms, tokens_in, tokens_out, cost_usd, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(agent_name, job_id || null, status || 'running', duration_ms || null, tokens_in || 0, tokens_out || 0, cost_usd || 0, summary || null);
  res.status(201).json(db.prepare('SELECT * FROM runs WHERE id = ?').get(result.lastInsertRowid));
});

// PUT update run (e.g. mark complete)
router.put('/:id', (req, res) => {
  const { status, duration_ms, tokens_in, tokens_out, cost_usd, summary } = req.body;
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Not found' });
  db.prepare(`
    UPDATE runs SET status=?, duration_ms=?, tokens_in=?, tokens_out=?, cost_usd=?, summary=? WHERE id=?
  `).run(
    status ?? run.status,
    duration_ms ?? run.duration_ms,
    tokens_in ?? run.tokens_in,
    tokens_out ?? run.tokens_out,
    cost_usd ?? run.cost_usd,
    summary ?? run.summary,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id));
});

export default router;
