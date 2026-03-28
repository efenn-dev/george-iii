import { Router } from 'express';
import { checkCache, storeCache, getCacheStats, pruneCache } from '../triageCache.js';
import { triage, executeRouting, INTENTS, AGENT_ROUTES } from '../triageClassifier.js';
import { enqueue } from '../batchQueue.js';

const router = Router();

// GET /api/triage/cache/stats
router.get('/cache/stats', (req, res) => {
  res.json(getCacheStats());
});

// POST /api/triage/cache/prune
router.post('/cache/prune', (req, res) => {
  const { maxAgeDays } = req.body;
  pruneCache(maxAgeDays);
  res.json({ pruned: true, stats: getCacheStats() });
});

// POST /api/triage — Main intake endpoint
router.post('/', async (req, res) => {
  const { prompt, source = 'discord', skipCache = false, context = {} } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  
  const startTime = Date.now();
  
  try {
    // Step 1: Check cache
    let cacheResult = null;
    if (!skipCache) {
      cacheResult = checkCache(prompt);
      if (cacheResult.hit) {
        // Cache hit — return immediately with routing
        const routing = await executeRouting(cacheResult.actionPlan, prompt, source);
        return res.json({
          cached: true,
          cacheType: cacheResult.type,
          cacheHitCount: cacheResult.hitCount,
          cachedAt: cacheResult.cachedAt,
          actionPlan: cacheResult.actionPlan,
          routing,
          durationMs: Date.now() - startTime,
          costUsd: 0, // Cache hit = $0
        });
      }
    }
    
    // Step 2: Classify with llama3.2 (cheap, local)
    const plan = await triage(prompt, context);
    
    // Step 3: Store in cache (if classifiable)
    if (plan.canCache) {
      storeCache(prompt, plan);
    }
    
    // Step 4: Execute routing
    const routing = await executeRouting(plan, prompt, source);
    
    // Step 5: Auto-queue batch items
    for (const route of routing) {
      if (route.route === 'batch_queue' || route.route === 'llm_local') {
        const jobId = enqueue({
          type: 'llm',
          model: 'llama3.2',
          payload: {
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: route.action.description || prompt }
            ],
            maxTokens: 512,
          },
          priority: plan.priority,
        });
        route.queuedJobId = jobId;
      }
    }
    
    res.json({
      cached: false,
      actionPlan: plan,
      routing,
      durationMs: Date.now() - startTime,
      costUsd: plan.processing.costUsd,
      processing: plan.processing,
    });
    
  } catch (err) {
    res.status(500).json({
      error: err.message,
      fallback: true,
      note: 'Error in triage pipeline — route to Claude Sonnet for safety',
      routing: [{
        route: 'claude_sonnet',
        status: 'fallback',
        error: err.message,
      }],
    });
  }
});

// POST /api/triage/batch — Handle multiple items from one message
router.post('/batch', async (req, res) => {
  const { items, source = 'discord' } = req.body;
  
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  
  const results = [];
  for (const item of items) {
    // Process each item through triage
    const plan = await triage(item, {});
    const routing = await executeRouting(plan, item, source);
    
    results.push({
      item: item.slice(0, 100),
      actionPlan: plan,
      routing,
    });
  }
  
  res.json({
    processed: results.length,
    results,
  });
});

// GET /api/triage/intents — List available intents
router.get('/intents', (req, res) => {
  res.json({
    intents: INTENTS,
    routes: AGENT_ROUTES,
  });
});

export default router;
