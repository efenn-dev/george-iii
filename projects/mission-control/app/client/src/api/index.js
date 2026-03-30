const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Agents
  getAgents: () => request('GET', '/agents'),
  createAgent: (data) => request('POST', '/agents', data),
  updateAgent: (id, data) => request('PUT', `/agents/${id}`, data),
  deleteAgent: (id) => request('DELETE', `/agents/${id}`),

  // Projects
  getProjects: () => request('GET', '/projects'),
  createProject: (data) => request('POST', '/projects', data),
  updateProject: (id, data) => request('PUT', `/projects/${id}`, data),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),

  // Tasks / Kanban
  getTasks: (projectId) => request('GET', `/tasks${projectId ? `?project_id=${projectId}` : ''}`),
  getTaskWorkflow: (projectId) => request('GET', `/tasks/workflow${projectId ? `?project_id=${projectId}` : ''}`),
  createTask: (data) => request('POST', '/tasks', data),
  updateTask: (id, data) => request('PUT', `/tasks/${id}`, data),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),
  assignTask: (id, data) => request('POST', `/tasks/${id}/assign`, data),
  transitionTask: (id, data) => request('POST', `/tasks/${id}/transition`, data),
  reviewTaskQa: (id, data) => request('POST', `/tasks/${id}/qa`, data),
  approveTask: (id, data) => request('POST', `/tasks/${id}/approve`, data),

  // Runs
  getRuns: (limit = 50) => request('GET', `/runs?limit=${limit}`),

  // Costs
  getCostSummary: () => request('GET', '/costs/summary'),
  getCosts: (days = 7) => request('GET', `/costs?days=${days}`),

  // System
  getSystemStatus: () => request('GET', '/system/status'),
  setWatchdog: (data) => request('POST', '/system/watchdog', data),
  setLoopBreaker: (data) => request('POST', '/system/loop-breaker', data),
  setWeeklyBackup: (data) => request('POST', '/system/weekly-backup', data),
  setCircuitBreaker: (data) => request('POST', '/system/circuit-breaker', data),
  triggerBackup: () => request('POST', '/system/backup-now'),
};
