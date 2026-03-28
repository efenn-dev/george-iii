import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all projects with task counts
router.get('/', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();
  const result = projects.map(p => {
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status
    `).all(p.id);
    const taskCounts = { backlog: 0, in_progress: 0, done: 0, archived: 0 };
    counts.forEach(r => { taskCounts[r.status] = r.count; });
    return { ...p, taskCounts };
  });
  res.json(result);
});

// GET single project
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

// POST create project
router.post('/', (req, res) => {
  const { name, domain, status } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'name and domain are required' });
  const result = db.prepare(`
    INSERT INTO projects (name, domain, status) VALUES (?, ?, ?)
  `).run(name, domain, status || 'active');
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

// PUT update project
router.put('/:id', (req, res) => {
  const { name, domain, status } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE projects SET name=?, domain=?, status=? WHERE id=?').run(
    name ?? project.name,
    domain ?? project.domain,
    status ?? project.status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// DELETE project
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
