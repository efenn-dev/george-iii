import { Router } from 'express';
import { enqueue, getJobs, getJob, cancelJob, getQueueStats } from '../batchQueue.js';
import { getRateLimitStatus } from '../rateLimiter.js';

const router = Router();

// GET /api/queue/stats — queue counts + rate limit status
router.get('/stats', (req, res) => {
  res.json({
    queue: getQueueStats(),
    rateLimit: getRateLimitStatus(),
  });
});

// GET /api/queue — list jobs (optional ?status= filter)
router.get('/', (req, res) => {
  const { status, limit } = req.query;
  const jobs = getJobs(status || null, parseInt(limit) || 50);
  res.json(jobs);
});

// GET /api/queue/:id — single job
router.get('/:id', (req, res) => {
  const job = getJob(parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// POST /api/queue — enqueue a new job
router.post('/', (req, res) => {
  const { type, model, payload, priority } = req.body;
  if (!payload) return res.status(400).json({ error: 'payload is required' });
  
  const id = enqueue({ type, model, payload, priority });
  res.status(201).json({ id, queued: true });
});

// DELETE /api/queue/:id — cancel a pending job
router.delete('/:id', (req, res) => {
  cancelJob(parseInt(req.params.id));
  res.json({ cancelled: true });
});

// GET /api/queue/ratelimit/status — just rate limit info
router.get('/ratelimit/status', (req, res) => {
  res.json(getRateLimitStatus());
});

export default router;
