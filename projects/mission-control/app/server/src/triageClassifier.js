/**
 * Triage classifier using llama3.2 to:
 * 1. Classify message intent (what does the user want?)
 * 2. Extract action items (what needs to be done?)
 * 3. Route to appropriate destination (which agent/handler?)
 * 
 * Output: { intents: [...], actions: [...], routing: [...], estimatedTokens: number }
 */

const OLLAMA_BASE = 'http://localhost:11434';

// Classification taxonomy
const INTENTS = [
  'create_task',        // Add to Mission Control tasks
  'create_agent',       // Build a new agent
  'run_code',           // Execute code, scripts
  'search_web',         // Web search
  'summarize',          // Summarize content
  'classify_items',     // Break list into items
  'ask_question',       // Information retrieval
  'urgent_request',     // Immediate attention needed
  'batch_process',      // Background/async work
  'review_approve',     // Review content for approval
];

const AGENT_ROUTES = {
  'create_task': 'mission_control',      // Local API
  'create_agent': 'mission_control',   // Local API
  'run_code': 'coding_agent',          // Could be me (George) or OpenClaw
  'search_web': 'web_agent',           // OpenClaw with web tools
  'summarize': 'llm_local',            // llama3.2
  'classify_items': 'llm_local',       // llama3.2
  'ask_question': 'claude_haiku',      // Cheap, fast
  'urgent_request': 'claude_sonnet',   // Full capability
  'batch_process': 'batch_queue',      // Queue to llama3.2
  'review_approve': 'claude_haiku',    // Fast review
};

// System prompt for triage
const TRIAGE_PROMPT = `You are a message intake router. Analyze the user's request and output a JSON action plan.

Input: A Discord message from the user.

Output format (JSON only, no markdown):
{
  "intents": ["intent1", "intent2"],  // One or more from: ${INTENTS.join(', ')}
  "actions": [
    { "type": "intent", "description": "what to do", "data": {} }
  ],
  "routing": ["route1", "route2"],    // One or more: mission_control, claude_haiku, claude_sonnet, llm_local, batch_queue, urgent
  "priority": 1-5,                      // 1=urgent, 5=batch
  "estimatedTokens": number,            // Rough estimate for cost tracking
  "canCache": boolean,                  // Is this likely to be repeated?
  "needsContext": boolean               // Does this need conversation history?
}

Rules:
- If message contains multiple items ("1. Fix X 2. Check Y 3. Update Z"), classify each as separate action
- Urgent keywords: "now", "urgent", "asap", "down", "broken", "error", "crash"
- Batch keywords: "later", "when you can", "background", "sometime"
- Create task = anything needing tracking in Mission Control
- Create agent = mentions of "build agent", "new agent", "setup"
- Code execution = file paths, code blocks, "run", "execute", "test"

Examples:
Input: "Add task: review the new PR"
Output: {"intents":["create_task"],"actions":[{"type":"create_task","description":"Create task: review new PR","data":{"title":"Review new PR","domain":"dev"}}],"routing":["mission_control"],"priority":3,"estimatedTokens":200,"canCache":true,"needsContext":false}

Input: "URGENT: the server is down!"
Output: {"intents":["urgent_request"],"actions":[{"type":"urgent_request","description":"Server down - immediate attention"}],"routing":["urgent","claude_sonnet"],"priority":1,"estimatedTokens":150,"canCache":false,"needsContext":false}

Now classify this message:`;

/**
 * Call llama3.2 via Ollama for triage classification.
 */
async function classifyWithLlama(prompt) {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:latest',
      messages: [
        { role: 'system', content: TRIAGE_PROMPT },
        { role: 'user', content: prompt.slice(0, 2000) }
      ],
      stream: false,
      options: {
        temperature: 0.1,  // Low temp for consistent classification
        num_predict: 512,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in classifier response');
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      tokensIn: data.prompt_eval_count || 0,
      tokensOut: data.eval_count || 0,
      model: 'llama3.2:latest',
    };
  } catch (e) {
    throw new Error(`Failed to parse classifier JSON: ${e.message}`);
  }
}

/**
 * Main entry: triage a prompt.
 * Returns action plan with routing decisions.
 */
export async function triage(prompt, context = {}) {
  const startTime = Date.now();
  
  try {
    const classification = await classifyWithLlama(prompt);
    
    // Validate and normalize
    const plan = {
      intents: classification.intents || ['ask_question'],
      actions: classification.actions || [{ type: 'ask_question', description: 'General query' }],
      routing: classification.routing || ['claude_haiku'],
      priority: classification.priority || 3,
      estimatedTokens: classification.estimatedTokens || 500,
      canCache: classification.canCache ?? true,
      needsContext: classification.needsContext ?? false,
      processing: {
        model: classification.model,
        durationMs: Date.now() - startTime,
        tokensIn: classification.tokensIn,
        tokensOut: classification.tokensOut,
        costUsd: 0, // Local model = $0
      },
    };
    
    return plan;
  } catch (err) {
    // Fallback on error: assume simple question, route to Haiku
    return {
      intents: ['ask_question'],
      actions: [{ type: 'ask_question', description: 'Fallback route due to classifier error' }],
      routing: ['claude_haiku'],
      priority: 3,
      estimatedTokens: 500,
      canCache: true,
      needsContext: false,
      processing: {
        model: 'fallback',
        durationMs: Date.now() - startTime,
        error: err.message,
      },
      fallback: true,
    };
  }
}

/**
 * Execute routing decision — enqueue or return immediate.
 */
export async function executeRouting(plan, originalPrompt, source = 'discord') {
  const results = [];
  
  for (const action of plan.actions) {
    const route = plan.routing[0]; // Primary route
    
    switch (route) {
      case 'mission_control':
        // Create task via local API
        results.push({
          route,
          status: 'enqueued',
          note: 'Task created in Mission Control',
          action,
        });
        break;
        
      case 'batch_queue':
        // Add to batch queue for async processing
        results.push({
          route,
          status: 'enqueued',
          note: 'Queued for background processing',
          action,
        });
        break;
        
      case 'claude_haiku':
      case 'claude_sonnet':
      case 'urgent':
        // These require actual Claude calls — mark for upstream handling
        results.push({
          route,
          status: 'needs_claude',
          note: `Route to ${route}`,
          action,
          estimatedTokens: plan.estimatedTokens,
        });
        break;
        
      case 'llm_local':
        // Process immediately with local model
        results.push({
          route,
          status: 'can_local',
          note: 'Process with llama3.2',
          action,
        });
        break;
        
      default:
        results.push({
          route,
          status: 'unknown_route',
          note: 'No handler for this route',
          action,
        });
    }
  }
  
  return results;
}

export { INTENTS, AGENT_ROUTES };
