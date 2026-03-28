# Building an AI Agent Army: My Setup for Autonomous Business Operations

*A technical but accessible breakdown of the multi-agent system that runs my Etsy shop, Fiverr gigs, and content pipeline — with actual code examples.*

---

## The Problem With Solo AI

Most people using AI for business are doing it wrong. They're copy-pasting into ChatGPT, copying the output, pasting it somewhere else. One tool, one task, manual handoffs.

That's fine for one-off tasks. But when you're running multiple businesses, you need something more robust. You need a system.

This is the setup I've built over the past 6 months. It's not perfect. It breaks sometimes. But it's already handling more workload than I could manage manually, and it's getting smarter every week.

## The Architecture

I run three primary agents, each optimized for different types of work:

### George III — The Orchestrator
- **Model:** Claude 4 (Anthropic)
- **Role:** Strategy, task decomposition, quality control
- **Responsibilities:** Break down complex goals into sub-tasks, assign work to other agents, review outputs, handle edge cases
- **Why this model:** Claude's context window and reasoning ability make it ideal for orchestration. It can hold complex multi-step plans and adapt when things go wrong.

### Coder — The Implementation Specialist
- **Model:** GPT-5.4 (OpenAI)
- **Role:** Code generation, API integrations, structured outputs
- **Responsibilities:** Write scripts, build tools, integrate with external APIs, generate formatted data
- **Why this model:** GPT-5.4 excels at producing working code on the first try. When I need a Python script that actually runs, I go here.

### Scribe — The Volume Worker
- **Model:** Llama 3.3:70b (local, via Ollama)
- **Role:** Bulk text generation, research, low-cost tasks
- **Responsibilities:** SEO research, content outlines, tag generation, data processing
- **Why this model:** It's free (after hardware cost), fast, and good enough for tasks that don't require cutting-edge reasoning. Plus, no rate limits.

## Mission Control: The Dashboard

The agents communicate through a React/Vite frontend I call Mission Control. Here's what it looks like:

```
┌─────────────────────────────────────────────────────────────┐
│ Mission Control v2.1                    🟢 George III       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ACTIVE QUEUE                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Task: Generate 20 Etsy listings                         │ │
│ │ Status: In Progress (Scribe: 15/20 complete)           │ │
│ │ Assigned: Scribe → Coder → George III                  │ │
│ │ ETA: 8 minutes                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ PENDING                                                     │
│ • SEO audit for client-shop-47                             │
│ • Weekly content calendar generation                       │
│ • Reddit post for r/passiveincome                          │
│                                                             │
│ COMPLETED (Last 24h)                                        │
│ ✅ Etsy listing renewal cycle (50 listings)                │
│ ✅ Blog post: "Etsy SEO Secrets" (this one)                 │
│ ✅ Fiverr gig optimization                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Real-time task status across all agents
- Automatic handoff between agents (Scribe finishes research → Coder formats output → George III reviews)
- Error logging and retry logic
- Resource monitoring (API usage, token counts, compute load)

## How Tasks Flow Through the System

Let's walk through a real example: Creating a batch of Etsy listings.

**Step 1: Initiation (George III)**
```
User input: "Create 20 retro gaming themed Etsy listings"

George III decomposes:
1. Research trending retro gaming keywords (assign to Scribe)
2. Generate design concepts and prompts (assign to Coder)
3. Create optimized titles and tags (assign to Scribe)
4. Compile final listing data (assign to Coder)
5. Review and approve (George III)
```

**Step 2: Research (Scribe)**
Scrape Etsy search suggestions, analyze competitor tags, identify keyword gaps. Outputs a structured JSON file with keyword data.

**Step 3: Concept Generation (Coder)**
Take the keyword data and generate:
- Design concepts (descriptions for image generation)
- Listing titles (optimized for search)
- 13 tags per listing
- Product descriptions

Output: Complete listing templates.

**Step 4: Review (George III)**
Check for:
- Duplicate or near-duplicate tags
- Title truncation issues
- Brand voice consistency
- Policy compliance (no trademarked terms, etc.)

If issues found: Loop back to Coder with specific feedback.

**Step 5: Delivery**
Final listings export to CSV for bulk upload to Etsy. Mission Control marks task complete and logs metrics (time taken, tokens used, success/failure).

## The Resilience Layer

Here's where it gets interesting. Agents fail. APIs go down. Context windows fill up.

**Circuit Breakers**
If an agent fails the same task 3 times, the system:
1. Pauses the task
2. Alerts me (Discord notification)
3. Suggests alternative approaches
4. Prevents cascade failures (doesn't retry indefinitely and burn API credits)

**Auto-Restart**
Every morning at 6 AM, the system:
- Checks agent health
- Restarts any stale sessions
- Clears old task logs
- Runs a diagnostic task ("Summarize yesterday's operations")

**Fallback Strategy**
If OpenAI is down: Route coding tasks to local Llama models (lower quality, but functional).
If Claude hits rate limits: Queue strategic tasks for later, route tactical tasks to GPT.
If Ollama crashes: Cache critical text generation requests, retry with exponential backoff.

## The Code (Simplified)

Here's a simplified version of the task orchestrator:

```python
class TaskOrchestrator:
    def __init__(self):
        self.agents = {
            'george': Claude4Agent(),
            'coder': GPT54Agent(),
            'scribe': Llama33Agent()
        }
        self.queue = TaskQueue()
        
    def process_task(self, task):
        """Route task to appropriate agent with fallback logic."""
        agent = self.select_agent(task)
        
        try:
            result = agent.execute(task)
            return self.validate_and_forward(task, result)
        except RateLimitError:
            # Fallback to local model
            return self.agents['scribe'].execute(task)
        except Exception as e:
            # Log and alert
            self.log_error(task, e)
            return {'status': 'failed', 'error': str(e)}
    
    def select_agent(self, task):
        """Choose best agent for task type."""
        if task['type'] == 'strategy':
            return self.agents['george']
        elif task['type'] == 'code':
            return self.agents['coder']
        elif task['type'] == 'bulk_text':
            return self.agents['scribe']
```

**Real implementation is messier.** Error handling, state persistence, agent communication protocols — there's a lot of duct tape holding this together. But it works.

## Current Capabilities

What the system handles autonomously:

- **Etsy operations:** Daily listing renewals, keyword research, seasonal content planning
- **Fiverr fulfillment:** SEO audit generation, content writing, deliverable formatting
- **Content pipeline:** Substack post drafting, social media scheduling, Reddit engagement
- **Research:** Competitor analysis, trend monitoring, pricing optimization

**Still manual:**
- Final quality review on client deliverables
- Complex strategic decisions
- Customer communication (for now)
- Anything requiring subjective judgment

## What's Next

**Memory improvements** — Right now, each session starts fresh. I want persistent memory so agents remember past decisions and learn from outcomes.

**Self-healing** — Currently, I fix most issues manually. The goal is agents that can diagnose and fix their own problems.

**Multi-modal** — Adding image analysis (Claude can do this now) and audio processing for broader capabilities.

**Client portal** — A self-service dashboard where Fiverr clients can check project status, request revisions, and download deliverables without my involvement.

## The Reality Check

This system isn't magic. It's a collection of tools, scripts, and API calls held together by Python and optimism.

It breaks. Last week, Scribe generated 500 lines of "SEO research" that was just the word "gaming" repeated with increasing enthusiasm. I had to filter that output manually.

It costs money. Claude and GPT-5.4 aren't free. I spend $80-120/month on API calls. But compared to hiring a VA or doing the work myself? It's a bargain.

It's not truly autonomous. I check in multiple times per day. I approve major decisions. I handle the exceptions.

But here's what is true: This system lets me operate at a scale that would be impossible solo. Multiple income streams, consistent content output, ongoing client work — all manageable for one human with a laptop and some clever automation.

## Should You Build This?

Honestly? Probably not yet.

If you're just starting, use ChatGPT or Claude directly. Learn what works. Build your business first.

Once you have:
- Recurring tasks that follow predictable patterns
- Volume that exceeds your manual capacity
- The technical skills (or willingness to learn) to maintain a system

Then consider building something like this.

**The full code is on GitHub:** github.com/emmittfennessey/mission-control

It's messy. It's undocumented in places. But it's real, and it runs my businesses. Fork it, break it, improve it. That's the whole point.

---

## TL;DR

- Three-agent system: George III (Claude 4) for strategy, Coder (GPT-5.4) for implementation, Scribe (local Llama) for volume
- Mission Control dashboard coordinates tasks, handles handoffs, and monitors health
- Circuit breakers and auto-restart prevent cascade failures and credit burn
- Not magic — still requires human oversight — but enables scale impossible solo
- Full code available on GitHub

---

**See this system in action:** Follow my Fiverr work at **emmittfennessey** — AI-assisted services, human-quality results

**Check out the Etsy shop:** [swagnuggets.etsy.com](https://swagnuggets.etsy.com) — Products created and optimized by this very system

**GitHub repo:** github.com/emmittfennessey/mission-control

---

**Tags:** AI agents, automation, entrepreneurship, coding, productivity, multi-agent systems, business automation