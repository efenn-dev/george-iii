import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all agents
router.get('/', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  res.json(agents);
});

// GET single agent
router.get('/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent);
});

// POST create agent
router.post('/', (req, res) => {
  const { name, purpose, model, prompt, enabled } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = db.prepare(`
      INSERT INTO agents (name, purpose, model, prompt, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, purpose || null, model || 'claude-sonnet-4', prompt || null, enabled !== undefined ? (enabled ? 1 : 0) : 1);
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(agent);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Agent name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update agent
router.put('/:id', (req, res) => {
  const { name, purpose, model, prompt, enabled } = req.body;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  try {
    db.prepare(`
      UPDATE agents SET name=?, purpose=?, model=?, prompt=?, enabled=? WHERE id=?
    `).run(
      name ?? agent.name,
      purpose ?? agent.purpose,
      model ?? agent.model,
      prompt ?? agent.prompt,
      enabled !== undefined ? (enabled ? 1 : 0) : agent.enabled,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Agent name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE agent
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
