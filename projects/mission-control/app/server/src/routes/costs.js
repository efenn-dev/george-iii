import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET costs — group by date and agent
router.get('/', (req, res) => {
  const { agent, days } = req.query;
  let query = 'SELECT * FROM costs';
  const params = [];
  const conditions = [];
  if (agent) { conditions.push('agent_name = ?'); params.push(agent); }
  if (days) { conditions.push("date >= date('now', ?)"); params.push(`-${days} days`); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

// GET summary — total by agent
router.get('/summary', (req, res) => {
  const summary = db.prepare(`
    SELECT agent_name,
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(cost_usd) as total_cost
    FROM costs GROUP BY agent_name ORDER BY total_cost DESC
  `).all();
  res.json(summary);
});

// POST record cost
router.post('/', (req, res) => {
  const { date, agent_name, tokens_in, tokens_out, cost_usd } = req.body;
  if (!agent_name) return res.status(400).json({ error: 'agent_name is required' });
  const result = db.prepare(`
    INSERT INTO costs (date, agent_name, tokens_in, tokens_out, cost_usd)
    VALUES (?, ?, ?, ?, ?)
  `).run(date || new Date().toISOString().slice(0, 10), agent_name, tokens_in || 0, tokens_out || 0, cost_usd || 0);
  res.status(201).json(db.prepare('SELECT * FROM costs WHERE id = ?').get(result.lastInsertRowid));
});

export default router;
