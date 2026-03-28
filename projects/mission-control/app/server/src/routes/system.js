import { Router } from 'express';

const router = Router();

const GATEWAY_URL = 'http://localhost:18789';
const GATEWAY_TOKEN = 'fe75000e609853e742e2202938fcf9ea76f3b41d66ead4ba';
const OLLAMA_URL = 'http://localhost:11434';

// GET /api/system/status — check gateway, ollama, and current model
router.get('/status', async (req, res) => {
  const results = await Promise.allSettled([
    // Check gateway
    fetch(`${GATEWAY_URL}/health`, {
      headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    }),
    // Check Ollama
    fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    }),
  ]);

  const [gatewayResult, ollamaResult] = results;

  // Gateway status
  let gateway = { online: false };
  if (gatewayResult.status === 'fulfilled' && gatewayResult.value.ok) {
    try {
      const body = await gatewayResult.value.json();
      gateway = { online: true, ...body };
    } catch {
      gateway = { online: true };
    }
  }

  // Ollama status + model list
  let ollama = { online: false, models: [] };
  let activeModel = null;
  if (ollamaResult.status === 'fulfilled' && ollamaResult.value.ok) {
    try {
      const body = await ollamaResult.value.json();
      const models = body.models || [];
      ollama = { online: true, models: models.map(m => m.name) };
      // Pick first model as "active" (most recently used)
      activeModel = models.length > 0 ? models[0].name : null;
    } catch {
      ollama = { online: true, models: [] };
    }
  }

  res.json({
    gateway,
    ollama,
    activeModel,
    checkedAt: new Date().toISOString(),
  });
});

export default router;
