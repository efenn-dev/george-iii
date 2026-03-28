import express from 'express';
import cors from 'cors';
import agentsRouter from './routes/agents.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import runsRouter from './routes/runs.js';
import costsRouter from './routes/costs.js';
import cronRouter from './routes/cron.js';
import systemRouter from './routes/system.js';
import shortsbotRouter from './routes/shortsbot.js';

// Initialize DB (side effect — creates tables and seeds data)
import './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/agents', agentsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/runs', runsRouter);
app.use('/api/costs', costsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/system', systemRouter);
app.use('/api/shortsbot', shortsbotRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Mission Control API running on http://localhost:${PORT}`);
});
