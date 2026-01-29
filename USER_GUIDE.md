# @oneringai/agents - Complete User Guide

**Version:** 0.2.0
**Last Updated:** 2026-01-29

A comprehensive guide to using all features of the @oneringai/agents library.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Basic Text Generation](#basic-text-generation)
4. [Connectors & Authentication](#connectors--authentication)
5. [Agent Features](#agent-features)
6. [Session Persistence](#session-persistence)
7. [Universal Agent](#universal-agent)
8. [Task Agents](#task-agents) **ENHANCED**
   - Task Priorities
   - Fulfillment Criteria
   - PlanExecutor Internals
   - Advanced Configuration
9. [Context Management](#context-management) **ENHANCED**
   - Strategy Deep Dive (Proactive, Aggressive, Lazy, Rolling Window, Adaptive)
   - Custom Strategies
   - Token Estimation
   - Lifecycle Hooks
10. [Tools & Function Calling](#tools--function-calling)
11. [Dynamic Tool Management](#dynamic-tool-management)
12. [MCP (Model Context Protocol)](#mcp-model-context-protocol) **NEW**
13. [Multimodal (Vision)](#multimodal-vision)
14. [Audio (TTS/STT)](#audio-ttsstt) **NEW**
15. [Image Generation](#image-generation) **NEW**
16. [Video Generation](#video-generation) **NEW**
17. [Web Search](#web-search) **NEW**
18. [Streaming](#streaming)
19. [External API Integration](#external-api-integration) **NEW**
20. [OAuth for External APIs](#oauth-for-external-apis)
21. [Model Registry](#model-registry)
22. [Advanced Features](#advanced-features)
23. [Production Deployment](#production-deployment)

---

## Getting Started

### Installation

```bash
npm install @oneringai/agents
```

### Environment Setup

Create a `.env` file in your project root:

```env
# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GROQ_API_KEY=...

# Optional: OAuth encryption key for external APIs
OAUTH_ENCRYPTION_KEY=your-32-byte-hex-key
```

### First Agent

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// 1. Create a connector (authentication)
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// 2. Create an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// 3. Run the agent
const response = await agent.run('What is the capital of France?');
console.log(response.output_text);
// Output: "The capital of France is Paris."
```

---

## Core Concepts

### Connector-First Architecture

The library uses a **Connector-First Architecture** where **Connectors** are the single source of truth for authentication.

```
User Code → Connector Registry → Agent → Provider → LLM
```

**Key Benefits:**
- **One auth system** for both AI providers AND external APIs
- **Multiple keys per vendor** (e.g., `openai-main`, `openai-backup`)
- **Named connectors** for easy reference
- **No API key management in agent code**

### The Three Core Classes

1. **Connector** - Manages authentication
2. **Agent** - Orchestrates LLM interactions
3. **Vendor** - Enum of supported AI providers

---

## Basic Text Generation

### Simple Question/Answer

```typescript
import { Connector, Agent, Vendor } from '@oneringai/agents';

// Setup
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
});

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-opus-4-5-20251101',
});

// Ask a question
const response = await agent.run('Explain quantum computing in simple terms.');
console.log(response.output_text);
```

### Multi-Turn Conversations

Agents maintain conversation history automatically:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// First turn
await agent.run('My favorite color is blue.');

// Second turn (agent remembers)
const response = await agent.run('What is my favorite color?');
console.log(response.output_text);
// Output: "Your favorite color is blue."
```

### Configuration Options

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',

  // Optional settings
  temperature: 0.7,          // Randomness (0.0 - 1.0)
  maxIterations: 10,         // Max tool calling rounds
  maxOutputTokens: 2000,     // Max response length

  instructions: `You are a helpful assistant.
                 Always be concise and professional.`,
});
```

### Runtime Configuration

Change settings during execution:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Change model
agent.setModel('gpt-4-turbo');

// Change temperature
agent.setTemperature(0.9);

// Get current settings
console.log(agent.getTemperature()); // 0.9
```

---

## Connectors & Authentication

### Creating Connectors

```typescript
import { Connector, Vendor } from '@oneringai/agents';

// API Key Authentication
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// With custom base URL
Connector.create({
  name: 'openai-custom',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
  baseURL: 'https://custom-proxy.example.com/v1',
});

// With vendor-specific options
Connector.create({
  name: 'anthropic',
  vendor: Vendor.Anthropic,
  auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY! },
  options: {
    defaultHeaders: {
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  },
});
```

### Multiple Keys Per Vendor

Use different keys for different purposes:

```typescript
// Main production key
Connector.create({
  name: 'openai-main',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_MAIN! },
});

// Backup key
Connector.create({
  name: 'openai-backup',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_KEY_BACKUP! },
});

// Use main key
const agent1 = Agent.create({ connector: 'openai-main', model: 'gpt-4' });

// Use backup key
const agent2 = Agent.create({ connector: 'openai-backup', model: 'gpt-4' });
```

### Managing Connectors

```typescript
// Check if connector exists
if (Connector.has('openai')) {
  console.log('OpenAI connector configured');
}

// Get a connector
const connector = Connector.get('openai');
console.log(connector.vendor); // 'openai'

// List all connectors
const names = Connector.list();
console.log(names); // ['openai', 'anthropic', 'google']

// Clear all (useful for testing)
Connector.clear();
```

### Supported Vendors

```typescript
import { Vendor } from '@oneringai/agents';

Vendor.OpenAI        // OpenAI (GPT-4, GPT-5, o3-mini)
Vendor.Anthropic     // Anthropic (Claude)
Vendor.Google        // Google AI (Gemini)
Vendor.GoogleVertex  // Google Vertex AI
Vendor.Groq          // Groq (ultra-fast inference)
Vendor.Together      // Together AI
Vendor.Grok          // xAI (Grok)
Vendor.DeepSeek      // DeepSeek
Vendor.Mistral       // Mistral AI
Vendor.Perplexity    // Perplexity
Vendor.Ollama        // Ollama (local models)
Vendor.Custom        // Custom OpenAI-compatible endpoints
```

---

## Agent Features

### Instructions (System Prompt)

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  instructions: `You are a Python programming expert.

                 Rules:
                 - Always provide working code examples
                 - Use type hints
                 - Include docstrings
                 - Follow PEP 8 style guide`,
});

const response = await agent.run('How do I read a CSV file?');
// Agent will provide Python code with all the rules applied
```

### Control Methods

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Pause execution
agent.pause();

// Resume execution
agent.resume();

// Cancel current execution
agent.cancel();

// Check status
if (agent.isRunning()) {
  console.log('Agent is processing...');
}

if (agent.isPaused()) {
  console.log('Agent is paused');
}
```

### Metrics & Audit Trail

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

await agent.run('Hello!');

// Get execution metrics
const metrics = agent.getMetrics();
console.log(metrics.totalCalls);        // 1
console.log(metrics.totalTokens);       // 150
console.log(metrics.averageLatency);    // 1200ms

// Get audit trail
const audit = agent.getAuditTrail();
audit.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.type} - ${entry.message}`);
});
```

### Cleanup

```typescript
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

// Register cleanup callback
agent.onCleanup(() => {
  console.log('Cleaning up resources...');
});

// Destroy agent
agent.destroy();
```

---

## Session Persistence

Save and resume agent conversations across restarts. Available for **all agent types** (Agent, TaskAgent, UniversalAgent).

### Quick Start

```typescript
import { Agent, FileSessionStorage } from '@oneringai/agents';

// Create agent with session support
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
    autoSaveIntervalMs: 30000,  // Auto-save every 30s
  },
});

await agent.run('Remember: my name is Alice');
const sessionId = agent.getSessionId();
console.log('Session ID:', sessionId);

// Later... resume from session
const resumed = await Agent.resume(sessionId, {
  storage: new FileSessionStorage({ directory: './sessions' }),
});

await resumed.run('What is my name?');
// Output: "Your name is Alice."
```

### Storage Backends

#### In-Memory Storage (Testing)

```typescript
import { Agent, InMemorySessionStorage } from '@oneringai/agents';

const storage = new InMemorySessionStorage();

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: { storage },
});
```

**Use case:** Testing, development
**Pros:** Fast, no file I/O
**Cons:** Lost on restart

#### File Storage (Production)

```typescript
import { Agent, FileSessionStorage } from '@oneringai/agents';

const storage = new FileSessionStorage({
  directory: './sessions',
  // Optional: custom serialization
  serialize: (session) => JSON.stringify(session, null, 2),
  deserialize: (data) => JSON.parse(data),
});

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: { storage },
});
```

**Use case:** Production, persistence required
**Pros:** Survives restarts, human-readable JSON
**Cons:** File I/O overhead

#### Custom Storage

Implement `ISessionStorage` interface:

```typescript
import { ISessionStorage, Session, SessionSummary } from '@oneringai/agents';

class DatabaseSessionStorage implements ISessionStorage {
  async save(session: Session): Promise<void> {
    // Save to database
  }

  async load(sessionId: string): Promise<Session | null> {
    // Load from database
  }

  async delete(sessionId: string): Promise<void> {
    // Delete from database
  }

  async exists(sessionId: string): Promise<boolean> {
    // Check existence
  }

  async list(filter?: SessionFilter): Promise<SessionSummary[]> {
    // List sessions with optional filtering
  }
}
```

### Session Management

#### Manual Save/Load

```typescript
import { SessionManager, FileSessionStorage } from '@oneringai/agents';

const sessionManager = new SessionManager({
  storage: new FileSessionStorage({ directory: './sessions' }),
});

// Create session
const session = sessionManager.create('agent', {
  name: 'Customer Support Bot',
  tags: ['support', 'production'],
});

// Modify session data
session.customData = { userId: '123', context: 'billing' };

// Save manually
await sessionManager.save(session);

// Load later
const loaded = await sessionManager.load(session.id);
```

#### Auto-Save

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
    autoSaveIntervalMs: 30000,  // Save every 30 seconds
  },
});

// Session auto-saved after each interaction
await agent.run('Hello');
// ... auto-save triggered

await agent.run('How are you?');
// ... auto-save triggered
```

#### List Sessions

```typescript
const sessionManager = new SessionManager({
  storage: new FileSessionStorage({ directory: './sessions' }),
});

// List all sessions
const all = await sessionManager.list();

// Filter by agent type
const agentSessions = await sessionManager.list({ agentType: 'agent' });

// Filter by metadata
const productionSessions = await sessionManager.list({
  metadata: { tags: ['production'] },
});

for (const summary of productionSessions) {
  console.log(`${summary.id}: ${summary.metadata.name}`);
  console.log(`  Created: ${new Date(summary.createdAt)}`);
  console.log(`  Messages: ${summary.metrics.totalMessages}`);
}
```

### Session Structure

```typescript
interface Session {
  id: string;
  agentType: string;
  createdAt: number;
  lastAccessedAt: number;

  // Metadata
  metadata: {
    name?: string;
    description?: string;
    tags?: string[];
    [key: string]: unknown;
  };

  // Conversation history
  history: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: any[];
      timestamp: number;
    }>;
    totalMessages: number;
  };

  // Memory (for TaskAgent)
  memory?: {
    entries: Array<{
      key: string;
      value: unknown;
      scope: string;
      createdAt: number;
    }>;
  };

  // Plan (for TaskAgent/UniversalAgent)
  plan?: {
    goal: string;
    tasks: Task[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  };

  // Metrics
  metrics: {
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    toolCallCount: number;
  };

  // Custom data
  customData?: Record<string, unknown>;
}
```

### Best Practices

#### 1. Use Meaningful Session IDs

```typescript
// Bad: random IDs
const session1 = sessionManager.create('agent');

// Good: descriptive IDs
const session = sessionManager.create('agent', {
  name: 'Support Chat - User 12345',
  tags: ['support', 'user-12345'],
});
```

#### 2. Clean Up Old Sessions

```typescript
const sessions = await sessionManager.list();
const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

for (const session of sessions) {
  if (session.lastAccessedAt < oneWeekAgo) {
    await sessionManager.delete(session.id);
    console.log(`Deleted old session: ${session.id}`);
  }
}
```

#### 3. Handle Resume Errors

```typescript
try {
  const agent = await Agent.resume(sessionId, {
    storage: new FileSessionStorage({ directory: './sessions' }),
  });
  // Use resumed agent
} catch (error) {
  console.error('Failed to resume session:', error);
  // Fall back to new session
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
  });
}
```

#### 4. Use Custom Data for Context

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
  },
});

// Store custom context
const session = await sessionManager.load(agent.getSessionId()!);
if (session) {
  session.customData = {
    userId: '12345',
    preferences: { language: 'en', theme: 'dark' },
    context: { lastTopic: 'billing' },
  };
  await sessionManager.save(session);
}
```

### Usage with TaskAgent

```typescript
import { TaskAgent, FileSessionStorage } from '@oneringai/agents';

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

await agent.start({
  goal: 'Check weather for multiple cities',
  tasks: [
    { name: 'check_sf', description: 'Check SF weather' },
    { name: 'check_ny', description: 'Check NY weather' },
  ],
});

// Session includes plan, memory, and task execution state
const sessionId = agent.getSessionId();

// Resume after restart
const resumed = await TaskAgent.resume(sessionId, {
  storage: new FileSessionStorage({ directory: './sessions' }),
});
// Continues from where it left off
```

---

## Universal Agent

A **unified agent** that combines interactive chat, planning, and task execution in one powerful interface.

### Overview

UniversalAgent seamlessly transitions between three modes:
- **Interactive** - Direct conversation, immediate tool execution
- **Planning** - Creates multi-step plans for complex tasks
- **Executing** - Runs tasks from plan, allows user intervention

### Quick Start

```typescript
import { UniversalAgent, FileSessionStorage } from '@oneringai/agents';

const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
  planning: {
    enabled: true,
    autoDetect: true,        // LLM detects complex tasks
    requireApproval: true,   // Ask before executing
  },
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

const response = await agent.chat('Check weather in Paris and email me');
console.log(response.text);
console.log('Mode:', response.mode);       // 'planning'
console.log('Plan:', response.plan);        // Multi-step plan
console.log('Status:', response.planStatus); // 'pending_approval'
```

### Modes

#### Interactive Mode

Direct conversation, single-turn or simple tasks:

```typescript
const response = await agent.chat('What is 2 + 2?');
// Mode: 'interactive'
// Text: "The answer is 4."
```

**Triggers:**
- Simple questions
- Single tool calls
- Quick calculations
- Direct information requests

#### Planning Mode

Creates multi-step plans for complex tasks:

```typescript
const response = await agent.chat(
  'Research competitors, analyze pricing, and create a report'
);
// Mode: 'planning'
// Plan: { tasks: [...], status: 'pending_approval' }
```

**Triggers:**
- User explicitly requests planning
- LLM detects task requires multiple steps
- Task has dependencies
- User says "let's plan this"

**Plan Structure:**
```typescript
interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  lastUpdatedAt: number;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dependsOn?: string[];  // Task IDs
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
}
```

#### Executing Mode

Runs tasks from plan:

```typescript
// After plan approval
const response = await agent.chat('yes, proceed');
// Mode: 'executing'
// Progress: { completed: 1, total: 3, current: {...} }
```

**Features:**
- Step-by-step execution
- Progress tracking
- User intervention support
- Dynamic plan modification
- Pause/resume capability

### Mode Transitions

```
interactive ←→ planning ←→ executing
```

Automatic transitions based on:
1. **User input patterns**
   - "yes" / "approved" → executing
   - "no" / "cancel" → back to interactive
   - "what's the status?" → report progress (stay in mode)

2. **Task complexity**
   - LLM detects complex task → planning
   - Simple question during execution → handle inline (stay in executing)

3. **Plan lifecycle**
   - Plan completed → interactive
   - Plan rejected → planning (to refine)

4. **User control**
   - User says "stop" / "cancel" → interactive
   - User modifies plan → planning

### Configuration

#### Auto-Detection

```typescript
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tools...],
  planning: {
    enabled: true,
    autoDetect: true,  // LLM decides when to plan
  },
});

// Complex task → auto-enters planning mode
await agent.chat('Build a website, deploy it, and setup monitoring');
```

#### Manual Planning

```typescript
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tools...],
  planning: {
    enabled: true,
    autoDetect: false,  // User must explicitly request
  },
});

// Stays in interactive unless user says "plan this"
await agent.chat('Build a website');  // Interactive mode
await agent.chat('Let\'s plan this: Build a website');  // Planning mode
```

#### Approval Settings

```typescript
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  planning: {
    requireApproval: true,  // Always ask before executing
  },
});

// Change at runtime
agent.setAutoApproval(false);  // Require approval
agent.setAutoApproval(true);   // Auto-execute (dangerous!)
```

### Chat Response

```typescript
interface UniversalResponse {
  text: string;              // Human-readable response
  mode: AgentMode;           // Current mode
  plan?: Plan;               // Plan (if created/modified)
  planStatus?: string;       // 'pending_approval' | 'executing' | 'completed'
  taskProgress?: {           // Progress (if executing)
    completed: number;
    total: number;
    current?: Task;
    failed: number;
    skipped: number;
  };
  toolCalls?: ToolCallResult[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  needsUserAction?: boolean;
  userActionType?: 'approve_plan' | 'provide_input' | 'clarify';
}
```

### Streaming

```typescript
for await (const event of agent.stream('Complex task here')) {
  switch (event.type) {
    case 'text:delta':
      process.stdout.write(event.delta);
      break;

    case 'mode:changed':
      console.log(`\nMode: ${event.from} → ${event.to}`);
      break;

    case 'plan:created':
      console.log('\nPlan created:', event.plan);
      break;

    case 'plan:awaiting_approval':
      console.log('\n[Approval required]');
      break;

    case 'task:started':
      console.log(`\nStarting: ${event.task.name}`);
      break;

    case 'task:completed':
      console.log(`✓ Completed: ${event.task.name}`);
      break;

    case 'execution:done':
      console.log(`\nAll tasks completed!`);
      break;
  }
}
```

### State Introspection

```typescript
// Current mode
const mode = agent.getMode();  // 'interactive' | 'planning' | 'executing'

// Current plan
const plan = agent.getPlan();
if (plan) {
  console.log('Goal:', plan.goal);
  console.log('Tasks:', plan.tasks.length);
  console.log('Status:', plan.status);
}

// Execution progress
const progress = agent.getProgress();
if (progress) {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
  if (progress.current) {
    console.log('Current task:', progress.current.name);
  }
}

// Tool management
agent.toolManager.disable('risky_tool');
agent.toolManager.enable('safe_tool');
```

### Plan Modification

Users can modify plans during planning or execution:

```typescript
// Agent creates plan
const response1 = await agent.chat('Do A, B, C');
// Plan created with tasks A, B, C

// User modifies
const response2 = await agent.chat('Actually, skip B and add D after A');
// Plan updated: A → D → C

// LLM detects modification intent and uses internal meta-tool
```

**Supported modifications:**
- Add task
- Remove task
- Skip task
- Reorder tasks
- Update task description

### Pause and Resume

```typescript
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

// Start executing
await agent.chat('Do tasks A, B, C');
await agent.chat('yes, proceed');

// Pause
agent.pause();

// Resume later (even after restart)
const sessionId = agent.getSessionId();
const resumed = await UniversalAgent.resume(sessionId, {
  storage: new FileSessionStorage({ directory: './sessions' }),
});

resumed.resume();
// Continues from where it left off
```

### Intent Analysis

UniversalAgent analyzes user input to detect intent:

```typescript
// Approval intents
'yes' | 'approved' | 'go ahead' | 'proceed' | 'do it'
→ Approve plan and execute

// Rejection intents
'no' | 'cancel' | 'stop' | 'don\'t do that'
→ Reject plan, return to interactive

// Status queries
'status?' | 'what\'s happening?' | 'progress?'
→ Report current state

// Modification intents
'add task X' | 'skip task Y' | 'change task Z'
→ Modify plan

// Interrupts
'stop' | 'pause' | 'wait'
→ Pause execution
```

### Best Practices

#### 1. Always Use Sessions

```typescript
// Good
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  session: {
    storage: new FileSessionStorage({ directory: './sessions' }),
    autoSave: true,
  },
});

// Bad - loses state on restart
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  // No session config
});
```

#### 2. Handle Approval Requests

```typescript
const response = await agent.chat(input);

if (response.needsUserAction && response.userActionType === 'approve_plan') {
  // Show plan to user
  console.log('Plan:', response.plan);

  // Get user input
  const userApproval = await getUserInput('Approve? (yes/no): ');

  // Send approval
  await agent.chat(userApproval);
}
```

#### 3. Monitor Progress

```typescript
for await (const event of agent.stream(input)) {
  if (event.type === 'task:completed') {
    logProgress(event.task);
    notifyUser(`Completed: ${event.task.name}`);
  }

  if (event.type === 'task:failed') {
    alertUser(`Failed: ${event.task.name} - ${event.error}`);
    // Optionally pause or cancel
  }
}
```

#### 4. Use Planning for Complex Tasks

```typescript
// Simple - stay in interactive
await agent.chat('What is 2+2?');

// Complex - use planning
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  planning: {
    enabled: true,
    autoDetect: true,
  },
});

await agent.chat('Research 10 companies, analyze financials, create report');
// Auto-enters planning mode
```

#### 5. Disable Risky Tools During Execution

```typescript
const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [safeTool, riskyTool],
});

// Before executing
agent.toolManager.disable('risky_tool');

// Execute
await agent.chat('yes, proceed');

// Re-enable after
agent.toolManager.enable('risky_tool');
```

---

## Task Agents

TaskAgents are **autonomous agents** that execute complex, multi-step plans with full control over execution order, priorities, and fulfillment criteria. They represent the most powerful way to build sophisticated AI workflows.

### Core Capabilities

- **Working Memory** - Indexed key-value store with scopes and priorities
- **Context Management** - Automatic handling via configurable strategies
- **Task Priorities** - Control execution order with priority levels
- **Fulfillment Criteria** - Define exactly when a task is considered complete
- **External Dependencies** - Wait for webhooks, polling, manual input, schedules
- **State Persistence** - Resume after crashes, restarts, or long waits
- **Tool Idempotency** - Prevent duplicate side effects with caching
- **Lifecycle Hooks** - Intercept and customize execution at every stage
- **Dynamic Plans** - Modify plans during execution with safety validation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        TaskAgent                             │
│  - Orchestrates plan execution                              │
│  - Manages working memory                                   │
│  - Handles context management                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  PlanExecutor   │ │ WorkingMemory   │ │ ContextManager  │
│  - Task queue   │ │ - Scoped store  │ │ - Token mgmt    │
│  - Dependencies │ │ - Eviction      │ │ - Compaction    │
│  - Priorities   │ │ - Persistence   │ │ - Strategies    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Basic Task Agent

```typescript
import { Connector, TaskAgent, Vendor } from '@oneringai/agents';

// Setup
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create TaskAgent
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool],
});

// Execute a plan
const handle = await agent.start({
  goal: 'Check weather and notify user',
  tasks: [
    {
      name: 'fetch_weather',
      description: 'Get current weather for San Francisco',
    },
    {
      name: 'send_notification',
      description: 'Email the user with weather info',
      dependsOn: ['fetch_weather'], // Run after fetch_weather completes
    },
  ],
});

// Wait for completion
const result = await handle.wait();
console.log(`Status: ${result.status}`);
console.log(`Completed ${result.metrics.completedTasks}/${result.metrics.totalTasks} tasks`);
```

### Complete Task Configuration

Every task supports a rich set of configuration options:

```typescript
interface TaskConfig {
  // Identity
  id?: string;               // Auto-generated if not provided
  name: string;              // Required: human-readable name
  description: string;       // Required: what the task should accomplish

  // Execution Control
  dependsOn?: string[];      // Task IDs/names that must complete first
  priority?: TaskPriority;   // 'low' | 'normal' | 'high' | 'critical'

  // Fulfillment
  fulfillmentCriteria?: FulfillmentCriteria;  // When is the task "done"?

  // Conditions
  condition?: TaskCondition; // Skip task based on memory values

  // Parallelism
  execution?: {
    parallel?: boolean;      // Can run in parallel with others
    exclusive?: boolean;     // Must run alone (no other parallel tasks)
  };

  // External Dependencies
  externalDependency?: ExternalDependency;  // Webhook, poll, manual, scheduled

  // Retry & Timeout
  retryConfig?: {
    maxRetries: number;      // Max retry attempts (default: 3)
    retryDelayMs: number;    // Delay between retries (default: 1000)
    backoffMultiplier?: number;  // Exponential backoff (default: 2)
  };
  timeoutMs?: number;        // Task timeout (default: 300000 = 5 min)

  // Metadata
  metadata?: Record<string, unknown>;  // Custom data for hooks/tracking
}
```

### Task Dependencies

#### Sequential Tasks

```typescript
await agent.start({
  goal: 'Process order',
  tasks: [
    { name: 'validate', description: 'Validate order' },
    { name: 'charge', description: 'Charge payment', dependsOn: ['validate'] },
    { name: 'fulfill', description: 'Ship order', dependsOn: ['charge'] },
    { name: 'notify', description: 'Send confirmation', dependsOn: ['fulfill'] },
  ],
});
```

#### Parallel Tasks

```typescript
await agent.start({
  goal: 'Gather data',
  concurrency: { maxParallelTasks: 3, strategy: 'fifo' },
  tasks: [
    { name: 'fetch_users', description: 'Get users', execution: { parallel: true } },
    { name: 'fetch_orders', description: 'Get orders', execution: { parallel: true } },
    { name: 'fetch_products', description: 'Get products', execution: { parallel: true } },
    {
      name: 'combine',
      description: 'Combine all data',
      dependsOn: ['fetch_users', 'fetch_orders', 'fetch_products'],
    },
  ],
});
```

#### Conditional Tasks

Tasks can be conditionally skipped based on memory values:

```typescript
await agent.start({
  goal: 'Process with approval',
  tasks: [
    { name: 'check_amount', description: 'Check transaction amount' },
    {
      name: 'require_approval',
      description: 'Get manager approval',
      dependsOn: ['check_amount'],
      condition: {
        memoryKey: 'transaction.amount',
        operator: 'greaterThan',
        value: 10000,
        onFalse: 'skip', // Skip if amount <= $10,000
      },
    },
    {
      name: 'process',
      description: 'Process transaction',
      dependsOn: ['require_approval'],
    },
  ],
});
```

**Available Condition Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{ memoryKey: 'status', operator: 'equals', value: 'approved' }` |
| `notEquals` | Not equal | `{ memoryKey: 'status', operator: 'notEquals', value: 'rejected' }` |
| `greaterThan` | Greater than (numbers) | `{ memoryKey: 'amount', operator: 'greaterThan', value: 1000 }` |
| `lessThan` | Less than (numbers) | `{ memoryKey: 'count', operator: 'lessThan', value: 5 }` |
| `contains` | String/array contains | `{ memoryKey: 'tags', operator: 'contains', value: 'urgent' }` |
| `exists` | Key exists in memory | `{ memoryKey: 'user.session', operator: 'exists' }` |
| `notExists` | Key doesn't exist | `{ memoryKey: 'error', operator: 'notExists' }` |
| `truthy` | Value is truthy | `{ memoryKey: 'isEnabled', operator: 'truthy' }` |
| `falsy` | Value is falsy | `{ memoryKey: 'isDisabled', operator: 'falsy' }` |

**Condition Actions (`onFalse`):**
- `'skip'` - Skip the task, mark as `skipped` status
- `'fail'` - Fail the task, may halt execution
- `'wait'` - Wait and re-evaluate condition later

---

### Task Priorities

Priorities control the execution order when multiple tasks are ready to run. This is crucial for optimizing workflows and ensuring critical tasks complete first.

#### Priority Levels

```typescript
type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

// Priority values (higher = executed first)
// critical: 4
// high: 3
// normal: 2 (default)
// low: 1
```

#### Using Priorities

```typescript
await agent.start({
  goal: 'Process customer requests',
  tasks: [
    // Critical: Security-related, always first
    {
      name: 'validate_auth',
      description: 'Validate authentication token',
      priority: 'critical',
    },

    // High: Customer-facing, important
    {
      name: 'fetch_customer',
      description: 'Fetch customer data',
      priority: 'high',
      dependsOn: ['validate_auth'],
    },

    // Normal: Standard processing
    {
      name: 'update_analytics',
      description: 'Update analytics dashboard',
      priority: 'normal',  // Default
      dependsOn: ['validate_auth'],
    },

    // Low: Can wait, background work
    {
      name: 'cleanup_temp',
      description: 'Clean up temporary files',
      priority: 'low',
    },
  ],
});
```

#### Priority + Dependencies

Priorities work **within** dependency constraints:

```typescript
await agent.start({
  goal: 'Multi-stage pipeline',
  tasks: [
    // Stage 1: All can run, ordered by priority
    { name: 'critical_check', priority: 'critical' },  // Runs 1st
    { name: 'normal_fetch', priority: 'normal' },      // Runs 2nd
    { name: 'low_log', priority: 'low' },              // Runs 3rd

    // Stage 2: Only runs after Stage 1, then by priority
    {
      name: 'high_process',
      priority: 'high',
      dependsOn: ['critical_check', 'normal_fetch'],
    },  // Runs 4th

    {
      name: 'low_archive',
      priority: 'low',
      dependsOn: ['critical_check'],
    },  // Runs 5th (after critical_check, low priority)
  ],
});
```

#### Parallel Execution with Priorities

When running parallel tasks, priority determines which tasks start first:

```typescript
await agent.start({
  goal: 'Parallel data fetch',
  concurrency: { maxParallelTasks: 2, strategy: 'priority' },  // Priority-based selection
  tasks: [
    { name: 'vip_users', priority: 'critical', execution: { parallel: true } },
    { name: 'regular_users', priority: 'normal', execution: { parallel: true } },
    { name: 'archived_users', priority: 'low', execution: { parallel: true } },
  ],
});

// With maxParallelTasks: 2:
// Round 1: vip_users (critical) + regular_users (normal)
// Round 2: archived_users (low) after one completes
```

**Concurrency Strategies:**
- `'priority'` - Higher priority tasks selected first
- `'fifo'` - First-in-first-out (order defined)
- `'lifo'` - Last-in-first-out

---

### Fulfillment Criteria

Fulfillment criteria define exactly when a task is considered "complete". This provides fine-grained control over task success validation.

#### Default Behavior

By default, a task is fulfilled when:
1. The agent produces a non-error response
2. No exception is thrown during execution

#### Custom Fulfillment Criteria

```typescript
interface FulfillmentCriteria {
  // What to check
  type: 'memory' | 'tool_result' | 'output_contains' | 'custom';

  // Memory-based fulfillment
  memoryKey?: string;           // Key must exist in memory
  memoryValue?: unknown;        // Key must have this value
  memoryOperator?: ConditionOperator;  // Comparison operator

  // Tool result-based fulfillment
  toolName?: string;            // This tool must have been called
  toolResultContains?: string;  // Tool result must contain this
  toolResultPath?: string;      // JSON path in result to check
  toolResultValue?: unknown;    // Expected value at path

  // Output-based fulfillment
  outputContains?: string[];    // Agent output must contain these strings

  // Custom validation function
  customValidator?: (context: TaskExecutionContext) => boolean | Promise<boolean>;

  // Retry behavior
  retryOnUnfulfilled?: boolean;  // Retry if criteria not met (default: true)
  maxFulfillmentRetries?: number;  // Max retries for fulfillment (default: 3)
}
```

#### Memory-Based Fulfillment

Task completes only when specific data is stored in memory:

```typescript
{
  name: 'fetch_user',
  description: 'Fetch user profile from API',
  fulfillmentCriteria: {
    type: 'memory',
    memoryKey: 'user.profile',  // Must store data at this key
  },
}

// More specific: value must match
{
  name: 'verify_email',
  description: 'Verify user email',
  fulfillmentCriteria: {
    type: 'memory',
    memoryKey: 'email.verified',
    memoryValue: true,
  },
}

// With operator
{
  name: 'collect_responses',
  description: 'Collect at least 5 survey responses',
  fulfillmentCriteria: {
    type: 'memory',
    memoryKey: 'responses.count',
    memoryOperator: 'greaterThan',
    memoryValue: 4,  // > 4 means >= 5
  },
}
```

#### Tool Result-Based Fulfillment

Task completes only when a specific tool is called with expected results:

```typescript
{
  name: 'send_email',
  description: 'Send confirmation email to user',
  fulfillmentCriteria: {
    type: 'tool_result',
    toolName: 'send_email',
    toolResultPath: 'status',
    toolResultValue: 'sent',
  },
}

// Check for specific content in result
{
  name: 'search_database',
  description: 'Search for matching records',
  fulfillmentCriteria: {
    type: 'tool_result',
    toolName: 'db_query',
    toolResultContains: 'found',  // Result string contains "found"
  },
}
```

#### Output-Based Fulfillment

Task completes only when the agent's response contains specific content:

```typescript
{
  name: 'explain_result',
  description: 'Explain the analysis results to the user',
  fulfillmentCriteria: {
    type: 'output_contains',
    outputContains: ['summary', 'recommendation'],
    // Agent must mention both "summary" and "recommendation"
  },
}
```

#### Custom Fulfillment Validator

For complex validation logic, use a custom function:

```typescript
{
  name: 'complex_validation',
  description: 'Perform complex multi-step validation',
  fulfillmentCriteria: {
    type: 'custom',
    customValidator: async (context) => {
      // Access memory
      const data = await context.memory.get('validation.data');
      if (!data) return false;

      // Check multiple conditions
      const hasAllFields = data.name && data.email && data.phone;
      const isValidEmail = data.email?.includes('@');
      const hasConsent = data.consent === true;

      // Log validation result
      if (!hasAllFields || !isValidEmail || !hasConsent) {
        console.log('Validation failed:', { hasAllFields, isValidEmail, hasConsent });
        return false;
      }

      // Check tool was called
      const toolCalls = context.getToolCalls();
      const validationToolCalled = toolCalls.some(
        tc => tc.name === 'validate_user' && tc.result?.valid === true
      );

      return validationToolCalled;
    },
    retryOnUnfulfilled: true,
    maxFulfillmentRetries: 5,
  },
}
```

#### Combining Fulfillment with Retry

```typescript
import { TASK_DEFAULTS } from '@oneringai/agents';

{
  name: 'reliable_api_call',
  description: 'Call external API with reliability guarantees',

  // Retry configuration
  retryConfig: {
    maxRetries: TASK_DEFAULTS.MAX_RETRIES,  // 3
    retryDelayMs: TASK_DEFAULTS.RETRY_DELAY_MS,  // 1000
    backoffMultiplier: 2,  // Exponential backoff
  },

  // Fulfillment criteria
  fulfillmentCriteria: {
    type: 'memory',
    memoryKey: 'api.response',
    memoryOperator: 'exists',
    retryOnUnfulfilled: true,
    maxFulfillmentRetries: 3,  // Additional retries if criteria not met
  },

  // Timeout
  timeoutMs: 30000,  // 30 second timeout per attempt
}
```

#### Real-World Example: E-Commerce Order

```typescript
await agent.start({
  goal: 'Process e-commerce order #12345',
  tasks: [
    {
      name: 'validate_order',
      description: 'Validate order details and inventory',
      priority: 'critical',
      fulfillmentCriteria: {
        type: 'memory',
        memoryKey: 'order.validated',
        memoryValue: true,
      },
    },
    {
      name: 'charge_payment',
      description: 'Charge customer payment method',
      priority: 'critical',
      dependsOn: ['validate_order'],
      fulfillmentCriteria: {
        type: 'tool_result',
        toolName: 'stripe_charge',
        toolResultPath: 'status',
        toolResultValue: 'succeeded',
      },
      retryConfig: { maxRetries: 3, retryDelayMs: 2000 },
    },
    {
      name: 'reserve_inventory',
      description: 'Reserve items in warehouse',
      priority: 'high',
      dependsOn: ['charge_payment'],
      fulfillmentCriteria: {
        type: 'memory',
        memoryKey: 'inventory.reserved',
        memoryOperator: 'truthy',
      },
    },
    {
      name: 'create_shipment',
      description: 'Create shipping label and schedule pickup',
      priority: 'high',
      dependsOn: ['reserve_inventory'],
      fulfillmentCriteria: {
        type: 'custom',
        customValidator: async (ctx) => {
          const shipment = await ctx.memory.get('shipment.details');
          return shipment?.trackingNumber && shipment?.labelUrl;
        },
      },
    },
    {
      name: 'send_confirmation',
      description: 'Email order confirmation to customer',
      priority: 'normal',
      dependsOn: ['create_shipment'],
      fulfillmentCriteria: {
        type: 'tool_result',
        toolName: 'send_email',
        toolResultPath: 'delivered',
        toolResultValue: true,
      },
    },
    {
      name: 'update_analytics',
      description: 'Update sales analytics',
      priority: 'low',
      dependsOn: ['charge_payment'],
      // No fulfillment criteria - default behavior
    },
  ],
});
```

---

### Working Memory

TaskAgents have indexed working memory that the agent can use to store and retrieve data:

```typescript
// The agent automatically has access to memory tools:
// - memory_store(key, description, value, options?)
// - memory_retrieve(key)
// - memory_delete(key)
// - memory_list()

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [apiTool],
  memoryConfig: {
    maxSizeBytes: 1024 * 1024, // 1MB limit
    softLimitPercent: 80,       // Warn at 80%
  },
});

await agent.start({
  goal: 'Fetch and analyze user data',
  tasks: [
    {
      name: 'fetch_user',
      description: 'Fetch user profile from API and store in memory as "user.profile"',
    },
    {
      name: 'analyze',
      description: 'Retrieve "user.profile" from memory and analyze behavior patterns',
      dependsOn: ['fetch_user'],
    },
  ],
});

// Agent will automatically:
// 1. Call API in first task
// 2. Store result: memory_store('user.profile', 'User profile data', profileData)
// 3. Retrieve in second task: memory_retrieve('user.profile')
// 4. Analyze the retrieved data
```

#### Memory Scopes

Memory entries can have different lifecycle scopes:

```typescript
// Session-scoped memory (default - cleared when agent ends)
memory_store({
  key: 'temp.calculation',
  description: 'Intermediate result',
  value: 12345,
  scope: 'session',
});

// Plan-scoped memory (kept for entire plan execution)
memory_store({
  key: 'plan.config',
  description: 'Configuration for this plan',
  value: { timeout: 30000 },
  scope: 'plan',
});

// Persistent memory (never auto-cleaned)
memory_store({
  key: 'user.session',
  description: 'Session token',
  value: 'token-xyz',
  scope: 'persistent',
});

// Task-scoped memory (auto-cleaned when specific tasks complete)
memory_store({
  key: 'task.intermediate',
  description: 'Data needed only by specific tasks',
  value: { step: 1 },
  neededForTasks: ['task-id-1', 'task-id-2'], // Auto-cleaned when both complete
});
```

#### Memory Priority & Pinning

Control eviction behavior when memory is full:

```typescript
// Priority levels: 'low' | 'normal' | 'high' | 'critical'
// Lower priority entries are evicted first
memory_store({
  key: 'cache.results',
  description: 'Cached API results',
  value: cachedData,
  priority: 'low', // Evict first when memory is full
});

memory_store({
  key: 'user.credentials',
  description: 'Authentication credentials',
  value: credentials,
  priority: 'critical', // Never evicted (unless pinned=false)
});

// Pinned entries are NEVER evicted, regardless of priority
memory_store({
  key: 'system.config',
  description: 'Critical system configuration',
  value: config,
  pinned: true, // Never evicted
});
```

#### Programmatic Memory Access

```typescript
import { WorkingMemory, forTasks, forPlan } from '@oneringai/agents';

// Create working memory instance
const memory = new WorkingMemory(storage, config);

// Store with full options
await memory.set('user.profile', 'User profile data', userData, {
  scope: { type: 'task', taskIds: ['fetch-user', 'process-user'] },
  priority: 'high',
  pinned: false,
});

// Factory functions for common patterns
const taskEntry = forTasks('temp.data', 'Temporary data', value, ['task-1', 'task-2']);
const planEntry = forPlan('plan.state', 'Plan state', planState, { priority: 'high' });

// Retrieve data
const profile = await memory.get('user.profile');

// Update scope dynamically
await memory.updateScope('temp.data', { type: 'plan' });
await memory.addTasksToScope('temp.data', ['task-3']); // Add more tasks

// Eviction control
await memory.evict(5, 'lru');  // Evict 5 entries using LRU strategy
await memory.evict(3, 'size'); // Evict 3 largest entries

// Cleanup
memory.destroy(); // Remove all listeners
```

#### Eviction Strategies

When memory reaches capacity, entries are evicted based on:

1. **Pinned status** - Pinned entries are never evicted
2. **Priority** - Lower priority evicted first (`low` → `normal` → `high` → `critical`)
3. **Strategy** - Either LRU (least recently used) or size-based (largest first)

```typescript
// LRU eviction (default) - evicts least recently accessed entries
await memory.evict(5, 'lru');

// Size-based eviction - evicts largest entries first
await memory.evict(5, 'size');
```

#### Scope Utilities

```typescript
import {
  scopeEquals,
  scopeMatches,
  isSimpleScope,
  isTaskAwareScope,
  isTerminalMemoryStatus,
} from '@oneringai/agents';

// Check if scopes are exactly equal
scopeEquals('session', 'session'); // true
scopeEquals(
  { type: 'task', taskIds: ['a', 'b'] },
  { type: 'task', taskIds: ['b', 'a'] }
); // true (order-independent)

// Check if entry scope matches a filter
scopeMatches({ type: 'task', taskIds: ['a'] }, { type: 'task', taskIds: [] }); // true (type match)
scopeMatches('persistent', 'persistent'); // true

// Type guards
isSimpleScope('session'); // true
isTaskAwareScope({ type: 'task', taskIds: [] }); // true
```

### Hierarchical Memory (Research Pattern)

For complex research tasks, use the **hierarchical memory pattern** to progressively refine data from raw inputs to final findings. This pattern is especially useful when doing web research, data analysis, or any task where you need to preserve key insights while allowing raw data to be evicted.

#### Memory Tiers

The library provides three memory tiers with automatic priority assignment:

| Tier | Priority | Key Prefix | Purpose |
|------|----------|------------|---------|
| **raw** | `low` | `raw.` | Temporary raw data (full API responses, scraped pages) |
| **summary** | `normal` | `summary.` | Condensed summaries derived from raw data |
| **findings** | `high` | `findings.` | Final insights and conclusions |

```typescript
import { WorkingMemory, MemoryTier, TIER_PRIORITIES, getTierFromKey } from '@oneringai/agents';

const memory = new WorkingMemory(storage, config);

// Store raw data (low priority - evicted first)
await memory.storeRaw(
  'search.results',
  'Google search results for AI trends',
  { results: [...fullSearchResults] }
);
// Stored as: raw.search.results with priority: 'low'

// Store summary derived from raw data
await memory.storeSummary(
  'search.summary',
  'Key points from AI trends search',
  ['Point 1: ...', 'Point 2: ...'],
  'raw.search.results'  // Reference to source
);
// Stored as: summary.search.summary with priority: 'normal'

// Store final findings (high priority - kept longest)
await memory.storeFindings(
  'ai.trends.2026',
  'Final findings on AI trends for 2026',
  { mainTrends: [...], conclusions: '...' },
  ['summary.search.summary'],  // Derived from
  { pinned: true }  // Optional: never evict
);
// Stored as: findings.ai.trends.2026 with priority: 'high'
```

#### Tier Utilities

```typescript
import {
  getTierFromKey,
  addTierPrefix,
  stripTierPrefix,
  TIER_PRIORITIES,
} from '@oneringai/agents';

// Get tier from a key
getTierFromKey('raw.search.results');      // 'raw'
getTierFromKey('summary.analysis');         // 'summary'
getTierFromKey('findings.report');          // 'findings'
getTierFromKey('user.profile');             // 'none' (no tier prefix)

// Add tier prefix
addTierPrefix('data', 'raw');              // 'raw.data'
addTierPrefix('report', 'findings');        // 'findings.report'

// Strip tier prefix
stripTierPrefix('raw.search.results');      // 'search.results'
stripTierPrefix('user.profile');            // 'user.profile' (unchanged)

// Get priority for tier
TIER_PRIORITIES.raw;       // 'low'
TIER_PRIORITIES.summary;   // 'normal'
TIER_PRIORITIES.findings;  // 'high'
```

#### Cleanup Raw Data

After creating summaries or findings, clean up the raw data to free memory:

```typescript
// Automatic cleanup of raw data after summary is created
await memory.cleanupRawData('summary.search.summary');
// Deletes all raw.* entries that this summary was derived from

// Or manually clean up a specific tier
const rawEntries = await memory.getByTier('raw');
for (const entry of rawEntries) {
  await memory.delete(entry.key);
}
```

#### Get Entries by Tier

```typescript
// Get all entries in a specific tier
const rawEntries = await memory.getByTier('raw');
const summaries = await memory.getByTier('summary');
const findings = await memory.getByTier('findings');

// Get tier statistics
const stats = await memory.getTierStats();
console.log(stats);
// {
//   raw: { count: 5, totalSize: 50000 },
//   summary: { count: 3, totalSize: 5000 },
//   findings: { count: 2, totalSize: 2000 },
//   none: { count: 10, totalSize: 10000 }
// }
```

#### Promote Entries Between Tiers

```typescript
// Promote an entry to a higher tier (changes key prefix and priority)
await memory.promote('raw.important.data', 'findings');
// Entry is now at: findings.important.data with priority: 'high'
```

#### Research Workflow Example

Here's a complete research workflow using hierarchical memory:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  taskType: 'research',  // Enables research-optimized prompts
  tools: [webSearch, webScrape],
});

await agent.start({
  goal: 'Research current AI agent frameworks and write a comparison report',
  tasks: [
    {
      name: 'search_frameworks',
      description: `
        Search for AI agent frameworks.
        For EACH search result, immediately store raw results:
        memory_store({ key: "raw.search.frameworks", tier: "raw", ... })
        Then create a summary:
        memory_store({ key: "summary.frameworks.overview", tier: "summary", derivedFrom: ["raw.search.frameworks"], ... })
      `,
    },
    {
      name: 'analyze_results',
      description: `
        Retrieve summaries from memory with memory_list() and memory_retrieve().
        Create final findings:
        memory_store({ key: "findings.framework.comparison", tier: "findings", ... })
      `,
      dependsOn: ['search_frameworks'],
    },
    {
      name: 'write_report',
      description: `
        Retrieve findings and write the final comparison report.
        Findings are preserved even if context is compacted.
      `,
      dependsOn: ['analyze_results'],
    },
  ],
});
```

### External Dependencies

TaskAgents can wait for external events before continuing:

#### Webhook

```typescript
const agent = TaskAgent.create({ connector: 'openai', model: 'gpt-4', tools: [] });

const handle = await agent.start({
  goal: 'Process with approval',
  tasks: [
    { name: 'request_approval', description: 'Send approval request email' },
    {
      name: 'wait_approval',
      description: 'Wait for manager to approve',
      dependsOn: ['request_approval'],
      externalDependency: {
        type: 'webhook',
        webhookId: 'approval-123',
        timeoutMs: 86400000, // 24 hours
        state: 'waiting',
      },
    },
    {
      name: 'process',
      description: 'Process after approval',
      dependsOn: ['wait_approval'],
    },
  ],
});

// Agent will pause at wait_approval task

// Later, when webhook is called:
await agent.triggerExternal('approval-123', { approved: true, managerName: 'Alice' });

// Agent resumes and completes remaining tasks
```

#### Polling

Polling uses exponential backoff to reduce load on external services:

```typescript
{
  name: 'wait_for_job',
  description: 'Wait for batch job to complete',
  externalDependency: {
    type: 'poll',
    pollConfig: {
      toolName: 'check_job_status',
      toolArgs: { jobId: 'job-456' },
      intervalMs: 30000,  // Initial interval (30 seconds)
      maxAttempts: 60,    // Max attempts before timeout
    },
    state: 'waiting',
  },
}
```

**Exponential Backoff Behavior:**
- First poll at `intervalMs`
- Subsequent polls increase delay with exponential backoff
- Maximum delay capped at `4 × intervalMs` (e.g., 2 minutes for 30s interval)
- Small jitter (±10%) added to prevent thundering herd
- Polling can be cancelled mid-wait via `stopWaiting()`

#### Manual Input

```typescript
{
  name: 'manual_review',
  description: 'Requires human review of document',
  externalDependency: {
    type: 'manual',
    manualDescription: 'Please review document.pdf and approve or reject',
    state: 'waiting',
  },
}

// Later:
await agent.completeTaskManually(taskId, {
  approved: true,
  comments: 'Looks good!',
});
```

#### Scheduled

```typescript
{
  name: 'send_reminder',
  description: 'Send reminder at scheduled time',
  externalDependency: {
    type: 'scheduled',
    scheduledTime: Date.now() + 3600000, // 1 hour from now
    state: 'waiting',
  },
}
```

### Plan Updates

Dynamically modify plans during execution with safety validations:

```typescript
import { PlanUpdateOptions } from '@oneringai/agents';

// Update plan with validation options
await agent.updatePlan({
  addTasks: [
    { name: 'new_task', description: 'Newly added task' },
  ],
  removeTasks: ['old_task'],
  updateTasks: [
    { id: 'existing_task', description: 'Updated description' },
  ],
}, {
  allowRemoveActiveTasks: false,  // Default: false - throws if removing in_progress tasks
  validateCycles: true,           // Default: true - throws if update creates dependency cycle
});
```

**PlanUpdateOptions:**

```typescript
interface PlanUpdateOptions {
  /** Allow removing in_progress tasks. Default: false */
  allowRemoveActiveTasks?: boolean;

  /** Validate no dependency cycles after update. Default: true */
  validateCycles?: boolean;
}
```

**Safety Features:**
- **Active task protection** - Cannot remove tasks that are currently `in_progress` unless explicitly allowed
- **Cycle detection** - Updates that would create dependency cycles are rejected
- **Atomic updates** - Either all changes succeed or none are applied

```typescript
// This throws: "Cannot remove active tasks: processing_task"
await agent.updatePlan({
  removeTasks: ['processing_task'],  // Task is in_progress
});

// Explicitly allow it
await agent.updatePlan({
  removeTasks: ['processing_task'],
}, {
  allowRemoveActiveTasks: true,
});
```

### Tool Idempotency

Prevent duplicate side effects when tools are called multiple times:

```typescript
import { ToolFunction } from '@oneringai/agents';

// Cacheable tool (results can be cached)
const getWeatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    return { temp: 72, location: args.location };
  },
  idempotency: {
    cacheable: true, // Results can be cached based on arguments
  },
};

// Non-cacheable tool with custom cache key
const sendEmailTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  execute: async (args) => {
    // Send email
    return { sent: true, messageId: 'msg-123' };
  },
  idempotency: {
    cacheable: true,  // Enable caching
    keyFn: (args) => `email:${args.to}:${args.subject}`, // Custom cache key
    ttlMs: 3600000, // Cache for 1 hour
  },
};

// If agent calls sendEmailTool twice with same args within 1 hour:
// - First call: Email sent
// - Second call: Returns cached result, no duplicate email
```

**Idempotency Options:**

```typescript
interface ToolIdempotency {
  /** If true, tool results can be cached based on arguments. Default: false */
  cacheable?: boolean;

  /** @deprecated Use 'cacheable' instead. Will be removed in a future version. */
  safe?: boolean;

  /** Custom function to generate cache key from arguments */
  keyFn?: (args: Record<string, unknown>) => string;

  /** Time-to-live for cached results in milliseconds */
  ttlMs?: number;
}
```

> **Note:** The `safe` field is deprecated. Use `cacheable` instead. Both fields work, but `cacheable` takes precedence if both are specified.

### Persistence & Resume

TaskAgents can persist their state and resume after crashes:

```typescript
import { TaskAgent, createAgentStorage } from '@oneringai/agents';

// Custom file-based storage
class FileAgentStorage {
  async save(agentId: string, state: any) {
    await fs.writeFile(`./agents/${agentId}.json`, JSON.stringify(state));
  }

  async load(agentId: string) {
    const data = await fs.readFile(`./agents/${agentId}.json`, 'utf-8');
    return JSON.parse(data);
  }
}

// Create agent with persistent storage
const storage = new FileAgentStorage();

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [apiTool],
  storage,
});

// Start long-running workflow
const handle = await agent.start({
  goal: 'Multi-day workflow',
  tasks: [
    { name: 'step1', description: 'First step' },
    {
      name: 'wait_approval',
      description: 'Wait for approval',
      externalDependency: { type: 'webhook', webhookId: 'approval-123', state: 'waiting' },
    },
    { name: 'step2', description: 'Second step', dependsOn: ['wait_approval'] },
  ],
});

// Agent suspends at webhook...
// App crashes or restarts...

// Resume later
const resumedAgent = await TaskAgent.resume(handle.agentId, {
  storage,
  tools: [apiTool], // Must provide tools again
});

// Trigger webhook
await resumedAgent.triggerExternal('approval-123', { approved: true });

// Agent continues from where it left off
```

**Tool Validation on Resume:**

When resuming, TaskAgent validates that provided tools match the saved state:

```typescript
const resumed = await TaskAgent.resume(agentId, {
  storage,
  tools: [toolA, toolB], // Different from saved state
});

// Console warnings if tools don't match:
// [TaskAgent.resume] Warning: Missing tools from saved state: tool_c, tool_d.
//   Tasks requiring these tools may fail.
// [TaskAgent.resume] Info: New tools not in saved state: tool_b
```

Resume succeeds even with mismatched tools, but warnings help identify potential issues.

### Hooks

Customize TaskAgent behavior with hooks:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],

  hooks: {
    onStart: async (agent, plan) => {
      console.log(`Starting plan: ${plan.goal}`);
    },

    beforeTask: async (task, context) => {
      console.log(`Starting task: ${task.name}`);

      // Can skip tasks
      if (task.name === 'optional' && !process.env.ENABLE_OPTIONAL) {
        return 'skip';
      }
    },

    afterTask: async (task, result) => {
      console.log(`Completed task: ${task.name}`);
      // Log to external system
      await auditLog.record({ task: task.name, result });
    },

    beforeTool: async (tool, args) => {
      console.log(`Calling tool: ${tool.definition.function.name}`);
      // Can modify args
      return args;
    },

    afterTool: async (tool, args, result) => {
      console.log(`Tool returned: ${JSON.stringify(result)}`);
      // Can modify result
      return result;
    },

    onError: async (error, context) => {
      console.error(`Error in ${context.phase}:`, error);

      // Retry logic
      if (context.task?.attempts < 3) {
        return 'retry';
      }

      return 'fail';
    },

    onComplete: async (result) => {
      console.log(`Plan complete: ${result.status}`);
      // Send notification
      await notificationService.send('Plan completed!');
    },
  },
});
```

### Events

Monitor TaskAgent execution with events:

```typescript
const agent = TaskAgent.create({ connector: 'openai', model: 'gpt-4', tools: [] });

// Task events
agent.on('task:start', ({ task }) => {
  console.log(`▶️ Starting: ${task.name}`);
});

agent.on('task:complete', ({ task, result }) => {
  console.log(`✅ Completed: ${task.name}`);
});

agent.on('task:failed', ({ task, error }) => {
  console.error(`❌ Failed: ${task.name} - ${error.message}`);
});

agent.on('task:waiting', ({ task, dependency }) => {
  console.log(`⏸️ Waiting: ${task.name} on ${dependency.type}`);
});

// Plan events
agent.on('plan:updated', ({ plan }) => {
  console.log('Plan updated');
});

// Memory events
agent.on('memory:stored', ({ key, description }) => {
  console.log(`💾 Stored: ${key} - ${description}`);
});

agent.on('memory:limit_warning', ({ utilization }) => {
  console.warn(`⚠️ Memory at ${utilization}%`);
});

// Agent events
agent.on('agent:suspended', ({ reason }) => {
  console.log(`⏸️ Suspended: ${reason}`);
});

agent.on('agent:resumed', () => {
  console.log('▶️ Resumed');
});

agent.on('agent:completed', ({ result }) => {
  console.log(`🎉 Complete: ${result.status}`);
});
```

### PlanExecutor Internals

Understanding how the PlanExecutor works helps you build more efficient workflows.

#### Execution Loop

```
┌────────────────────────────────────────────────────────────┐
│                     PlanExecutor Loop                       │
├────────────────────────────────────────────────────────────┤
│  1. Check for ready tasks (dependencies met, not blocked)  │
│  2. Sort by priority (critical → high → normal → low)      │
│  3. Execute tasks (respect concurrency limits)             │
│  4. Check fulfillment criteria                             │
│  5. Update task status and dependencies                    │
│  6. Handle failures (retry, skip, or fail plan)            │
│  7. Clean up task-scoped memory entries                    │
│  8. Repeat until all tasks complete or plan fails          │
└────────────────────────────────────────────────────────────┘
```

#### Task State Machine

```
                    ┌──────────┐
                    │ pending  │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌──────────┐  ┌───────────┐  ┌──────────┐
    │  waiting │  │in_progress│  │  skipped │
    └────┬─────┘  └─────┬─────┘  └──────────┘
         │              │
         │   ┌──────────┼──────────┐
         │   │          │          │
         ▼   ▼          ▼          ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │in_progress│  │completed │  │  failed  │
    └──────────┘  └──────────┘  └──────────┘
```

#### Configuration Constants

```typescript
import {
  TASK_DEFAULTS,
  CONTEXT_DEFAULTS,
  MEMORY_DEFAULTS,
  HISTORY_DEFAULTS,
} from '@oneringai/agents';

// Task execution defaults
console.log(TASK_DEFAULTS);
// {
//   TIMEOUT_MS: 300_000,      // 5 minutes per task
//   MAX_RETRIES: 3,           // Retry failed tasks 3 times
//   RETRY_DELAY_MS: 1_000,    // 1 second between retries
//   MAX_CONSECUTIVE_ERRORS: 3, // Fail plan after 3 consecutive errors
// }

// Context management defaults
console.log(CONTEXT_DEFAULTS);
// {
//   MAX_TOKENS: 128_000,      // Default context window
//   RESPONSE_RESERVE: 0.15,   // Reserve 15% for response
//   COMPACTION_THRESHOLD: 0.75, // Compact at 75%
//   HARD_LIMIT: 0.90,         // Must compact before 90%
// }

// Memory defaults
console.log(MEMORY_DEFAULTS);
// {
//   MAX_SIZE_BYTES: 1_048_576, // 1MB
//   SOFT_LIMIT_PERCENT: 80,    // Warn at 80%
// }

// History defaults
console.log(HISTORY_DEFAULTS);
// {
//   MAX_ENTRIES: 1000,        // Max conversation turns
//   TRUNCATE_AT: 800,         // Truncate when exceeding
// }
```

### Advanced Plan Configuration

```typescript
await agent.start({
  // Plan identity
  goal: 'Complete complex workflow',
  metadata: {
    requestId: 'req-12345',
    userId: 'user-789',
    environment: 'production',
  },

  // Execution control
  concurrency: {
    maxParallelTasks: 3,     // Run up to 3 tasks in parallel
    strategy: 'priority',    // priority | fifo | lifo
  },

  // Error handling
  errorHandling: {
    maxConsecutiveErrors: 3,  // Fail plan after N consecutive errors
    onTaskFailure: 'continue', // continue | skip_dependent | fail_plan
    retryStrategy: 'exponential', // fixed | exponential | none
  },

  // Timeout configuration
  timeoutConfig: {
    planTimeoutMs: 3600000,   // 1 hour max for entire plan
    taskTimeoutMs: 300000,    // 5 minutes per task (default)
    idleTimeoutMs: 60000,     // Fail if idle for 1 minute
  },

  // Context management
  contextConfig: {
    strategy: 'adaptive',
    maxContextTokens: 128000,
    compactionThreshold: 0.75,
  },

  // Memory configuration
  memoryConfig: {
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    softLimitPercent: 80,
    evictionStrategy: 'lru',  // lru | size | priority
  },

  // Task definitions
  tasks: [
    // ... task configurations
  ],
});
```

### Debugging TaskAgents

```typescript
// Enable verbose logging
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  debug: {
    logLevel: 'verbose',      // silent | error | warn | info | verbose
    logToolCalls: true,
    logMemoryOps: true,
    logContextBudget: true,
  },
});

// Get detailed execution state
const state = agent.getState();
console.log('Plan status:', state.plan.status);
console.log('Current task:', state.currentTask?.name);
console.log('Completed tasks:', state.completedTasks.map(t => t.name));
console.log('Failed tasks:', state.failedTasks.map(t => t.name));
console.log('Memory entries:', state.memory.length);
console.log('Context usage:', state.contextUsage);

// Inspect task execution history
const history = agent.getExecutionHistory();
history.forEach(entry => {
  console.log(`[${entry.timestamp}] ${entry.taskName}: ${entry.event}`);
  if (entry.details) console.log('  Details:', entry.details);
});

// Force compaction for testing
await agent.forceCompaction('Testing compaction behavior');

// Get memory dump
const memoryDump = await agent.dumpMemory();
console.log('Memory contents:', JSON.stringify(memoryDump, null, 2));
```

### Best Practices for TaskAgents

#### 1. Design Tasks with Clear Boundaries

```typescript
// BAD: Vague, multi-purpose task
{
  name: 'process_data',
  description: 'Process all the data and do stuff with it',
}

// GOOD: Clear, single-responsibility tasks
{
  name: 'fetch_user_data',
  description: 'Fetch user profile from /api/users/:id and store in memory as user.profile',
  fulfillmentCriteria: { type: 'memory', memoryKey: 'user.profile' },
}
```

#### 2. Use Priorities Strategically

```typescript
// Critical: Security, validation, must-not-fail
// High: Customer-facing, time-sensitive
// Normal: Standard business logic
// Low: Analytics, cleanup, nice-to-have

await agent.start({
  tasks: [
    { name: 'validate_auth', priority: 'critical' },  // Always first
    { name: 'charge_card', priority: 'critical' },    // Money matters
    { name: 'send_receipt', priority: 'high' },       // Customer expects it
    { name: 'update_inventory', priority: 'normal' }, // Important but can wait
    { name: 'log_analytics', priority: 'low' },       // Background work
  ],
});
```

#### 3. Set Appropriate Timeouts

```typescript
{
  // API call: short timeout
  name: 'fetch_api',
  timeoutMs: 30000,  // 30 seconds

  // LLM analysis: medium timeout
  name: 'analyze_data',
  timeoutMs: 120000,  // 2 minutes

  // External process: long timeout
  name: 'generate_report',
  timeoutMs: 600000,  // 10 minutes
}
```

#### 4. Use Memory Scopes Correctly

```typescript
// Task-scoped: Temporary data for specific tasks
await memory.set('temp.calculation', 'Intermediate result', value, {
  scope: { type: 'task', taskIds: ['calculate', 'validate'] },
  priority: 'normal',
});

// Plan-scoped: Shared across all tasks in this plan
await memory.set('plan.config', 'Plan configuration', config, {
  scope: { type: 'plan' },
  priority: 'high',
});

// Persistent: Survives plan completion (for multi-session state)
await memory.set('user.preferences', 'User preferences', prefs, {
  scope: { type: 'persistent' },
  priority: 'critical',
  pinned: true,
});
```

#### 5. Handle External Dependencies Gracefully

```typescript
{
  name: 'wait_for_payment',
  externalDependency: {
    type: 'webhook',
    webhookId: `payment-${orderId}`,
    timeoutMs: 86400000,  // 24 hours
    state: 'waiting',
  },
  // Define what happens on timeout
  onTimeout: 'skip',  // or 'fail' or 'retry'

  // Alternative: fallback task
  fallbackTask: 'send_payment_reminder',
}
```

#### 6. Monitor in Production

```typescript
// Set up comprehensive monitoring
agent.on('task:complete', async ({ task, result, duration }) => {
  await metrics.histogram('task.duration', duration, { task: task.name });
  await metrics.increment('task.completed', { task: task.name });
});

agent.on('task:failed', async ({ task, error, retryCount }) => {
  await metrics.increment('task.failed', { task: task.name });
  if (retryCount >= 3) {
    await alerts.error(`Task ${task.name} failed after ${retryCount} retries`);
  }
});

agent.on('memory:evicted', async ({ keys, reason }) => {
  await metrics.increment('memory.eviction', { count: keys.length, reason });
});

agent.on('agent:completed', async ({ result, metrics: planMetrics }) => {
  await monitoring.record({
    planId: result.planId,
    status: result.status,
    duration: planMetrics.totalDuration,
    tasksCompleted: planMetrics.completedTasks,
    tasksFailed: planMetrics.failedTasks,
    tokensUsed: planMetrics.totalTokens,
  });
});
```

---

## Context Management

The library includes a **powerful, universal context management system** that automatically handles the complexity of managing LLM context windows across all agent types. This section covers everything from basic automatic management to advanced custom strategies.

### AgentContext - The Unified API (NEW)

**AgentContext** is the "swiss army knife" for agent state management. It provides a single, unified facade that composes all context-related managers:

```typescript
import { AgentContext } from '@oneringai/agents';

// Create a context instance
const ctx = AgentContext.create({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  tools: [weatherTool, searchTool],
  memory: {
    maxSizeBytes: 1024 * 1024, // 1MB
  },
  cache: {
    enabled: true,
    ttlMs: 3600000, // 1 hour
  },
  strategy: 'adaptive', // Compaction strategy
});

// Add messages
ctx.addMessage('user', 'What is the weather in Paris?');
ctx.addMessage('assistant', 'Let me check that for you.');

// Execute tools (with automatic caching)
const result = await ctx.executeTool('get_weather', { location: 'Paris' });

// Access composed managers directly
ctx.tools.disable('risky_tool');         // ToolManager
await ctx.memory.set('key', 'desc', val); // WorkingMemory
ctx.permissions.allowlistAdd('safe_tool'); // ToolPermissionManager
const stats = ctx.cache.getStats();       // IdempotencyCache

// Prepare context for LLM call
const prepared = await ctx.prepare();
console.log(`Tokens: ${prepared.budget.used}/${prepared.budget.total}`);
console.log(`Status: ${prepared.budget.status}`); // 'ok', 'warning', 'critical'

// Get comprehensive metrics
const metrics = await ctx.getMetrics();
console.log(metrics.historyMessageCount);
console.log(metrics.memoryStats.utilizationPercent);
console.log(metrics.cacheStats.hits);
```

#### AgentContext Components

AgentContext composes these existing managers (DRY - no duplication!):

| Component | Access | Purpose |
|-----------|--------|---------|
| **ToolManager** | `ctx.tools` | Tool registration, execution, circuit breakers |
| **WorkingMemory** | `ctx.memory` | Key-value store with scopes, priority, eviction |
| **IdempotencyCache** | `ctx.cache` | Tool result caching to prevent duplicates |
| **ToolPermissionManager** | `ctx.permissions` | Approval workflows, allowlists, blocklists |
| **History** | `ctx.getHistory()` | Built-in conversation tracking |

#### Using AgentContext with Agent

You can enable AgentContext-based tracking in the base Agent class:

```typescript
import { Agent, AgentContext } from '@oneringai/agents';

// Option 1: Pass config to auto-create AgentContext
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool],
  context: {
    strategy: 'adaptive',
    autoCompact: true,
    memory: { maxSizeBytes: 2 * 1024 * 1024 },
  },
});

// Agent automatically tracks messages and tool calls
await agent.run('What is the weather?');

// Access the context
const ctx = agent.context;
if (ctx) {
  const history = ctx.getHistory();
  const metrics = await ctx.getMetrics();
  console.log(`Messages: ${metrics.historyMessageCount}`);
}

// Option 2: Pass existing AgentContext instance
const sharedContext = AgentContext.create({ model: 'gpt-4' });
const agent1 = Agent.create({ connector: 'openai', model: 'gpt-4', context: sharedContext });
const agent2 = Agent.create({ connector: 'anthropic', model: 'claude', context: sharedContext });
// Both agents share the same context state
```

#### AgentContext Configuration

```typescript
interface AgentContextConfig {
  /** Model name (used for token limits) */
  model?: string;

  /** Max context tokens (overrides model default) */
  maxContextTokens?: number;

  /** System prompt */
  systemPrompt?: string;

  /** Instructions */
  instructions?: string;

  /** Tools to register */
  tools?: ToolFunction[];

  /** Tool permissions configuration */
  permissions?: AgentPermissionsConfig;

  /** Memory configuration */
  memory?: {
    storage?: IMemoryStorage;  // Custom backend
    maxSizeBytes?: number;     // Default: 1MB
    softLimitPercent?: number; // Default: 80%
  };

  /** Cache configuration */
  cache?: {
    enabled?: boolean;  // Default: true
    ttlMs?: number;     // Default: 3600000 (1 hour)
  };

  /** History configuration */
  history?: {
    maxMessages?: number;    // Default: 100
    preserveRecent?: number; // Default: 20
  };

  /** Compaction strategy */
  strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive';

  /** Response token reserve (0.0 - 1.0). Default: 0.15 */
  responseReserve?: number;

  /** Enable auto-compaction. Default: true */
  autoCompact?: boolean;
}
```

#### Session Persistence

AgentContext supports full state serialization:

```typescript
// Save state
const state = await ctx.getState();
// state contains: history, tool calls, permissions, plugin state

// Restore state (e.g., after app restart)
const ctx = AgentContext.create({ model: 'gpt-4' });
await ctx.restoreState(savedState);
// All history, permissions, and plugin state restored
```

#### Plugin System

Extend AgentContext with custom plugins:

```typescript
import { IContextPlugin, BaseContextPlugin, AgentContext } from '@oneringai/agents';

// Create a custom plugin
class MyPlugin extends BaseContextPlugin {
  readonly name = 'my-plugin';
  readonly priority = 5; // Lower = kept longer during compaction

  private data: string[] = [];

  async getComponent() {
    return {
      name: 'my-plugin',
      content: this.data.join('\n'),
      priority: this.priority,
      compactable: true,
    };
  }

  addData(item: string) {
    this.data.push(item);
  }

  // Optional: Custom compaction
  async compact(targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    const before = this.data.length;
    this.data = this.data.slice(-5); // Keep last 5
    return before - this.data.length;
  }
}

// Use the plugin
const ctx = AgentContext.create({ model: 'gpt-4' });
const plugin = new MyPlugin();
ctx.registerPlugin(plugin);
plugin.addData('Custom data');
```

#### Events

Monitor AgentContext activity:

```typescript
const ctx = AgentContext.create({ model: 'gpt-4' });

// History events
ctx.on('message:added', ({ message }) => {
  console.log(`New ${message.role} message`);
});

ctx.on('history:compacted', ({ removedCount }) => {
  console.log(`Removed ${removedCount} old messages`);
});

// Tool events
ctx.on('tool:executed', ({ record }) => {
  console.log(`${record.name}: ${record.durationMs}ms, cached: ${record.cached}`);
});

ctx.on('tool:cached', ({ name, args }) => {
  console.log(`Cache hit for ${name}`);
});

// Budget events
ctx.on('budget:warning', ({ budget }) => {
  console.log(`Context at ${budget.utilizationPercent}%`);
});

ctx.on('budget:critical', ({ budget }) => {
  console.log(`Critical: ${budget.utilizationPercent}% used!`);
});

// Compaction events
ctx.on('compacted', ({ log, tokensFreed }) => {
  console.log(`Freed ${tokensFreed} tokens`);
  log.forEach(entry => console.log(`  - ${entry}`));
});
```

#### Accessing Context in TaskAgent and UniversalAgent

TaskAgent and UniversalAgent use **AgentContext** directly with plugins for extended functionality:

```typescript
import { TaskAgent, UniversalAgent } from '@oneringai/agents';

// TaskAgent context access - uses AgentContext with PlanPlugin and MemoryPlugin
const taskAgent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
});

// Access AgentContext directly
taskAgent.context.addMessage('user', 'Hello');
const history = taskAgent.context.getHistory();
const prepared = await taskAgent.context.prepare();
const metrics = await taskAgent.context.getMetrics();

// Access WorkingMemory (managed separately in TaskAgent)
await taskAgent.memory.set('key', 'description', value);

// Access tools via context
taskAgent.context.tools.disable('tool_name');

// UniversalAgent context access - also uses AgentContext
const uniAgent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
});

uniAgent.context.addMessage('system', 'New instruction');
const uniMetrics = await uniAgent.context.getMetrics();
const mode = uniAgent.getMode();
```

**AgentContext API (used by TaskAgent and UniversalAgent):**
```typescript
// AgentContext provides unified context management:
ctx.addMessage(role, content);           // Add message to history
ctx.getHistory();                        // Get conversation history
ctx.prepare();                           // Prepare context for LLM call
ctx.getMetrics();                        // Get usage metrics
ctx.executeTool(name, args);             // Execute tool with caching
ctx.registerPlugin(plugin);              // Register context plugin
ctx.setCurrentInput(input);              // Set current task input

// Access composed managers:
ctx.tools;                               // ToolManager
ctx.memory;                              // WorkingMemory (if configured)
ctx.cache;                               // IdempotencyCache
ctx.permissions;                         // ToolPermissionManager
```

**Plugin System:**

TaskAgent and UniversalAgent use plugins to extend AgentContext:

```typescript
import { PlanPlugin, MemoryPlugin, BaseContextPlugin } from '@oneringai/agents';

// Built-in plugins:
// - PlanPlugin: Adds execution plan to context
// - MemoryPlugin: Adds working memory index to context
// - ToolOutputPlugin: Tracks recent tool outputs

// Custom plugin example:
class MyPlugin extends BaseContextPlugin {
  readonly name = 'my-plugin';
  readonly priority = 5;
  readonly compactable = true;

  async getComponent() {
    return {
      name: 'my-plugin',
      content: 'Custom context content',
      priority: 5,
      compactable: true,
    };
  }
}

ctx.registerPlugin(new MyPlugin());
```

---

### Why Context Management Matters

LLMs have fixed context windows (e.g., 128K tokens for GPT-4, 200K for Claude). As conversations grow, you must:
- **Track usage** to avoid hitting limits
- **Prioritize content** (instructions vs history vs memory)
- **Compact intelligently** when approaching limits
- **Preserve critical information** while freeing space

The context management system handles all of this automatically.

### Basic Context Management

Context management is **automatic** for TaskAgents:

```typescript
import { TaskAgent } from '@oneringai/agents';

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
  // Context management happens automatically!
});

// Agent will automatically:
// 1. Track context usage across all components
// 2. Compact when approaching limits (using the chosen strategy)
// 3. Evict low-priority memory entries when needed
// 4. Truncate long tool outputs
// 5. Summarize older conversation history
// 6. Emit events for monitoring
```

### Architecture Overview

The context management system consists of several layers:

```
┌─────────────────────────────────────────────────────┐
│                  ContextManager                      │
│  - Orchestrates preparation and compaction          │
│  - Manages strategy selection and switching         │
│  - Emits events for monitoring                      │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌──────────┐ ┌───────────────┐
│ Strategy│ │Compactors│ │Context Provider│
│ (when)  │ │ (how)    │ │ (what)         │
└─────────┘ └──────────┘ └───────────────┘

Strategy: Decides WHEN to compact (proactive, aggressive, lazy, etc.)
Compactors: Decides HOW to compact (truncate, summarize, evict)
Provider: Provides WHAT content goes into context
```

### Task Types and Priority Profiles

Different task types have different context management needs. The library automatically detects task types and applies optimized priority profiles.

#### Supported Task Types

| Task Type | Detection Keywords | Optimization |
|-----------|-------------------|--------------|
| **research** | "research", "search", "find information", "investigate" | Preserves tool outputs longer, summarizes conversation earlier |
| **coding** | "implement", "code", "program", "develop", "build", "fix bug" | Preserves code context, truncates verbose tool outputs |
| **analysis** | "analyze", "examine", "evaluate", "assess", "compare" | Balanced preservation of data and reasoning |
| **general** | (default) | Standard balanced priorities |

```typescript
import { TaskAgent, getTaskType } from '@oneringai/agents';

// Auto-detect task type from plan goal
const taskType = getTaskType({
  goal: 'Research AI frameworks and compare their features',
  tasks: [{ name: 'search', description: 'Search for frameworks' }],
});
console.log(taskType); // 'research'

// Explicit task type
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  taskType: 'research',  // Override auto-detection
});
```

#### Priority Profiles

Each task type has optimized priority profiles that control compaction order:

```typescript
import { PRIORITY_PROFILES } from '@oneringai/agents';

// Research profile: preserve tool outputs (search results), compact conversation
console.log(PRIORITY_PROFILES.research);
// {
//   conversation_history: 10,  // Compact first
//   tool_outputs: 5,           // Preserve longer (contains research data)
//   memory_index: 3,           // Preserve longest
// }

// Coding profile: preserve code context
console.log(PRIORITY_PROFILES.coding);
// {
//   conversation_history: 8,
//   tool_outputs: 10,          // Code output compacted first
//   memory_index: 5,
// }

// Analysis profile: balanced
console.log(PRIORITY_PROFILES.analysis);
// {
//   conversation_history: 7,
//   tool_outputs: 8,
//   memory_index: 5,
// }

// General profile (default)
console.log(PRIORITY_PROFILES.general);
// {
//   conversation_history: 6,
//   tool_outputs: 10,
//   memory_index: 8,
// }
```

**Lower priority number = kept longer during compaction.**

#### Research System Prompt

When `taskType: 'research'` is set, the agent receives specialized instructions:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  taskType: 'research',
});

// Agent automatically receives research-optimized system prompt:
// - Store findings immediately after each search
// - Use hierarchical memory (raw → summary → findings)
// - Preserve key data before context compaction
// - Cross-reference sources before synthesizing
```

The research prompt guides the LLM to:
1. **Store immediately** - Save key findings right after each search/scrape
2. **Use tiers** - Store raw data at low priority, summaries at normal, findings at high
3. **Preserve sources** - Always include source URLs in stored data
4. **Synthesize carefully** - Cross-reference findings before writing reports

#### Compaction Strategy by Task Type

Task types also influence which compaction strategy is used on components:

| Task Type | Conversation | Tool Outputs |
|-----------|--------------|--------------|
| **research** | `summarize` | `summarize` |
| **coding** | `truncate` | `truncate` |
| **analysis** | `summarize` | `truncate` |
| **general** | `truncate` | `truncate` |

### Manual Context Management

For advanced use cases, use **AgentContext** with plugins:

```typescript
import {
  AgentContext,
  PlanPlugin,
  MemoryPlugin,
  ApproximateTokenEstimator,
  TruncateCompactor,
  SummarizeCompactor,
  MemoryEvictionCompactor,
} from '@oneringai/agents';

// Create AgentContext with configuration
const ctx = AgentContext.create({
  model: 'gpt-4',
  systemPrompt: 'Your system instructions',
  maxContextTokens: 128000,    // Model's context window
  responseReserve: 0.15,       // Reserve 15% for response tokens
  autoCompact: true,           // Automatically compact when needed
  strategy: 'proactive',       // Compaction strategy
  history: {
    maxMessages: 50,           // Max messages before compaction
    preserveRecent: 10,        // Always preserve recent messages
  },
});

// Add plugins for extended functionality
const planPlugin = new PlanPlugin();
const memoryPlugin = new MemoryPlugin(workingMemory);

ctx.registerPlugin(planPlugin);
ctx.registerPlugin(memoryPlugin);

// Set the current task input
ctx.setCurrentInput('Current task description');

// Update plan through plugin
planPlugin.setPlan(yourPlan);

// Prepare context before each LLM call
const prepared = await ctx.prepare();
console.log(`Context: ${prepared.budget.used}/${prepared.budget.total} tokens`);
console.log(`Utilization: ${(prepared.budget.used / prepared.budget.total * 100).toFixed(1)}%`);

// Add messages to history
ctx.addMessage('user', 'Hello');
ctx.addMessage('assistant', 'Hi there!');

// Get conversation history
const history = ctx.getHistory();
```

### Compactors Deep Dive

Compactors determine **how** content is reduced during compaction. Each compactor handles components with a matching `strategy` metadata.

#### Available Compactors

| Compactor | Strategy | Priority | What It Does |
|-----------|----------|----------|--------------|
| **TruncateCompactor** | `truncate` | 10 | Removes content from the end |
| **MemoryEvictionCompactor** | `evict` | 8 | Evicts low-priority memory entries |
| **SummarizeCompactor** | `summarize` | 5 | Uses LLM to create intelligent summaries |

**Lower priority number = runs earlier** (summarize before truncate).

#### SummarizeCompactor (LLM-Based)

The `SummarizeCompactor` uses an LLM to intelligently summarize content, preserving key information while reducing token count.

```typescript
import { SummarizeCompactor, ApproximateTokenEstimator } from '@oneringai/agents';

const estimator = new ApproximateTokenEstimator();

// Create summarize compactor with LLM
const summarizeCompactor = new SummarizeCompactor(estimator, {
  textProvider: myTextProvider,     // Required: LLM for summarization
  model: 'gpt-4o-mini',             // Optional: model to use (default: same as agent)
  maxSummaryTokens: 500,            // Optional: max tokens for summary
  preserveStructure: true,          // Optional: keep headings/lists (default: true)
  fallbackToTruncate: true,         // Optional: truncate if LLM fails (default: true)
});

// Components with strategy: 'summarize' will use this compactor
const component = {
  name: 'conversation_history',
  content: longConversation,
  priority: 6,
  compactable: true,
  metadata: { strategy: 'summarize' },  // Uses SummarizeCompactor
};
```

**What SummarizeCompactor Preserves:**

For **conversation history**:
- Key decisions made
- Important facts discovered
- User preferences expressed
- Unresolved questions

For **tool outputs** (search/scrape results):
- Key findings relevant to the task
- Source URLs and main points
- Factual data (numbers, dates, names)
- Contradictions between sources

```typescript
// Example: Research task with summarization
const contextManager = new ContextManager(
  provider,
  {
    maxContextTokens: 128000,
    strategy: 'proactive',
  },
  [
    new SummarizeCompactor(estimator, { textProvider, fallbackToTruncate: true }),
    new TruncateCompactor(estimator),  // Fallback for non-summarizable content
    new MemoryEvictionCompactor(estimator),
  ],
  estimator
);
```

#### MemoryEvictionCompactor

Evicts low-priority memory entries based on the `avgEntrySize` metadata.

```typescript
import { MemoryEvictionCompactor } from '@oneringai/agents';

const evictionCompactor = new MemoryEvictionCompactor(estimator);

// Components with strategy: 'evict' will use this compactor
const memoryComponent = {
  name: 'memory_index',
  content: memoryIndex,
  priority: 8,
  compactable: true,
  metadata: {
    strategy: 'evict',
    avgEntrySize: 100,                    // Average tokens per entry
    evict: async (count) => { ... },      // Callback to evict entries
    getUpdatedContent: async () => { ... }, // Get content after eviction
  },
};
```

### Pre-Compaction Hooks

The `beforeCompaction` hook allows agents to save important data before compaction occurs. This is critical for research tasks where tool outputs may contain valuable information.

```typescript
import { ContextManager, ContextManagerHooks, BeforeCompactionContext } from '@oneringai/agents';

// Define hooks
const hooks: ContextManagerHooks = {
  beforeCompaction: async (context: BeforeCompactionContext) => {
    console.log(`Agent ${context.agentId}: Compaction starting`);
    console.log(`Current usage: ${context.currentBudget.used}/${context.currentBudget.total}`);
    console.log(`Need to free: ${context.estimatedTokensToFree} tokens`);
    console.log(`Strategy: ${context.strategy}`);
    console.log(`Components to compact: ${context.components.length}`);

    // Example: Save important tool outputs before they're compacted
    for (const component of context.components) {
      if (component.name === 'tool_outputs' && component.compactable) {
        // Extract key findings and save to memory
        await saveKeyFindings(component.content);
      }
    }
  },
};

// Apply hooks to context manager
const contextManager = new ContextManager(provider, config, compactors, estimator);
contextManager.setHooks(hooks);
contextManager.setAgentId('my-agent-123');
```

#### BeforeCompactionContext

The hook receives detailed context about the upcoming compaction:

```typescript
interface BeforeCompactionContext {
  /** Agent ID (set via setAgentId) */
  agentId: string;

  /** Current context budget */
  currentBudget: ContextBudget;

  /** Strategy being used ('proactive', 'aggressive', etc.) */
  strategy: string;

  /** Components about to be compacted */
  components: ReadonlyArray<IContextComponent>;

  /** Estimated tokens that need to be freed */
  estimatedTokensToFree: number;
}
```

#### Integration with TaskAgent

TaskAgent automatically integrates with pre-compaction hooks:

```typescript
const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  taskType: 'research',
  lifecycleHooks: {
    beforeCompaction: async (context) => {
      // Access working memory
      const memory = agent.context.memory;

      // Save important findings before compaction
      for (const component of context.components) {
        if (component.metadata?.strategy === 'summarize') {
          // Extract and preserve key data
          const summary = extractKeyPoints(component.content);
          await memory.storeFindings(
            'preserved.before.compaction',
            'Key findings saved before compaction',
            summary
          );
        }
      }
    },
  },
});
```

#### Error Handling in Hooks

Hooks are designed to be resilient - errors are logged but don't prevent compaction:

```typescript
const hooks = {
  beforeCompaction: async (context) => {
    // Even if this throws, compaction will continue
    throw new Error('Hook error');
  },
};

// Compaction proceeds, error is logged to console
```

### Context Strategies Deep Dive

The library provides **five built-in strategies**, each optimized for different use cases. Understanding how each works internally helps you choose the right one.

#### Strategy Comparison Table

| Strategy | Compact Threshold | Target Utilization | Best For | Overhead |
|----------|-------------------|-------------------|----------|----------|
| **Proactive** | 75% | 65% | General purpose | Medium |
| **Aggressive** | 60% | 45% | Long conversations | Higher |
| **Lazy** | 90% | 85% | Short tasks, high-context models | Low |
| **Rolling Window** | Never | N/A (fixed messages) | Real-time, streaming | Minimal |
| **Adaptive** | Dynamic | Dynamic | Production, varied workloads | Medium |

---

#### 1. Proactive Strategy (Default)

**When to use:** General-purpose agents, balanced workloads, most common scenarios.

**How it works internally:**
1. Monitors context utilization continuously
2. Triggers compaction when utilization exceeds 75%
3. Targets 65% utilization after compaction
4. Uses incremental reduction (50% base + 15% per round)
5. Maximum 3 compaction rounds per prepare cycle

```typescript
import { PROACTIVE_STRATEGY_DEFAULTS } from '@oneringai/agents';

// Default configuration values
console.log(PROACTIVE_STRATEGY_DEFAULTS);
// {
//   TARGET_UTILIZATION: 0.65,
//   BASE_REDUCTION_FACTOR: 0.50,
//   REDUCTION_STEP: 0.15,
//   MAX_ROUNDS: 3,
// }

// Using proactive strategy
const contextManager = new ContextManager(provider, {
  strategy: 'proactive',
  compactionThreshold: 0.75,  // Compact at 75% (default)
}, compactors, estimator);

// Proactive is predictable: you know compaction happens at 75%
// Good balance between context preservation and headroom
```

**Metrics tracked:**
```typescript
const metrics = contextManager.getStrategyMetrics();
// {
//   compactionCount: 5,
//   totalTokensFreed: 45000,
//   averageTokensFreed: 9000,
//   lastCompactionTime: 1706540400000,
// }
```

---

#### 2. Aggressive Strategy

**When to use:** Long-running agents, limited context models, conversations that grow rapidly.

**How it works internally:**
1. Triggers compaction earlier (60% threshold)
2. Targets much lower utilization (45%)
3. More aggressive reduction per round
4. Keeps maximum headroom for new content

```typescript
import { AGGRESSIVE_STRATEGY_DEFAULTS } from '@oneringai/agents';

console.log(AGGRESSIVE_STRATEGY_DEFAULTS);
// {
//   TARGET_UTILIZATION: 0.45,
//   THRESHOLD: 0.60,
//   BASE_REDUCTION_FACTOR: 0.40,
//   REDUCTION_STEP: 0.20,
//   MAX_ROUNDS: 4,
// }

const contextManager = new ContextManager(provider, {
  strategy: 'aggressive',
  strategyOptions: {
    threshold: 0.55,  // Even earlier (optional override)
    target: 0.40,     // Even lower target (optional override)
  },
}, compactors, estimator);

// Best for:
// - 24/7 support bots with long conversations
// - Research agents that accumulate lots of data
// - Models with smaller context windows (8K-32K)
```

**Trade-offs:**
- **Pro:** Maximum headroom, never hits limits
- **Pro:** Predictable memory usage
- **Con:** More frequent compaction = more LLM calls for summarization
- **Con:** May lose more context earlier than necessary

---

#### 3. Lazy Strategy

**When to use:** Short tasks, high-context models (128K+), when context preservation is critical.

**How it works internally:**
1. Delays compaction as long as possible (90% threshold)
2. Only compacts when absolutely necessary
3. Targets 85% utilization (minimal reduction)
4. Preserves maximum context for complex reasoning

```typescript
import { LAZY_STRATEGY_DEFAULTS } from '@oneringai/agents';

console.log(LAZY_STRATEGY_DEFAULTS);
// {
//   TARGET_UTILIZATION: 0.85,
//   THRESHOLD: 0.90,
//   BASE_REDUCTION_FACTOR: 0.10,
//   REDUCTION_STEP: 0.05,
//   MAX_ROUNDS: 2,
// }

const contextManager = new ContextManager(provider, {
  strategy: 'lazy',
}, compactors, estimator);

// Best for:
// - Code analysis requiring full file context
// - Complex reasoning tasks
// - Models with 128K+ context (GPT-4 Turbo, Claude)
// - Tasks that complete in < 20 turns
```

**Trade-offs:**
- **Pro:** Maximum context preservation
- **Pro:** Minimal compaction overhead
- **Con:** Risk of hitting hard limit if task runs long
- **Con:** Sudden compaction can be disruptive

---

#### 4. Rolling Window Strategy

**When to use:** Real-time agents, streaming conversations, chat interfaces.

**How it works internally:**
1. **Never triggers compaction** (returns `shouldCompact: false`)
2. Simply keeps the last N messages
3. Old messages are dropped (not summarized)
4. Zero compaction overhead

```typescript
import { ROLLING_WINDOW_DEFAULTS } from '@oneringai/agents';

console.log(ROLLING_WINDOW_DEFAULTS);
// {
//   MAX_MESSAGES: 20,
//   MAX_TOKENS_PER_COMPONENT: 10000,
// }

const contextManager = new ContextManager(provider, {
  strategy: 'rolling-window',
  strategyOptions: {
    maxMessages: 30,  // Keep last 30 messages
    maxTokensPerComponent: 15000,  // Cap per component
  },
}, compactors, estimator);

// Best for:
// - Customer service chatbots
// - Real-time assistants
// - When recent context matters most
// - High-throughput scenarios
```

**Implementation detail:**
```typescript
// The strategy handles windowing in prepareComponents()
async prepareComponents(components: IContextComponent[]): Promise<IContextComponent[]> {
  return components.map((component) => {
    if (Array.isArray(component.content)) {
      const maxMessages = this.options.maxMessages ?? 20;
      if (component.content.length > maxMessages) {
        return {
          ...component,
          content: component.content.slice(-maxMessages),
          metadata: {
            ...component.metadata,
            windowed: true,
            originalLength: component.content.length,
            keptLength: maxMessages,
          },
        };
      }
    }
    return component;
  });
}
```

**Trade-offs:**
- **Pro:** Zero compaction overhead
- **Pro:** Predictable memory usage
- **Pro:** Fastest performance
- **Con:** No long-term memory (older context lost)
- **Con:** Not suitable for tasks requiring full history

---

#### 5. Adaptive Strategy

**When to use:** Production systems, varied workloads, when you want automatic optimization.

**How it works internally:**
1. Monitors compaction frequency over time
2. Automatically switches between strategies based on load:
   - High compaction rate → switches to aggressive
   - Low compaction rate → switches to lazy
   - Moderate rate → stays proactive
3. Learns optimal thresholds from usage patterns

```typescript
import { ADAPTIVE_STRATEGY_DEFAULTS } from '@oneringai/agents';

console.log(ADAPTIVE_STRATEGY_DEFAULTS);
// {
//   LEARNING_WINDOW: 50,        // Track last 50 compactions
//   SWITCH_THRESHOLD: 5,        // Switch if > 5 compactions/min
//   HYSTERESIS_FACTOR: 0.2,     // Prevent rapid switching
//   MIN_SAMPLES: 10,            // Min samples before switching
// }

const contextManager = new ContextManager(provider, {
  strategy: 'adaptive',
  strategyOptions: {
    learningWindow: 100,   // Learn from more history
    switchThreshold: 3,    // Switch sooner
  },
}, compactors, estimator);

// Monitor automatic switching
contextManager.on('strategy_switched', ({ from, to, reason }) => {
  console.log(`Adaptive: ${from} → ${to}`);
  console.log(`Reason: ${reason}`);
  // Example: "Adaptive: proactive → aggressive"
  // Reason: "High compaction frequency (8/min > 5/min threshold)"
});
```

**Adaptive decision logic:**
```typescript
// Simplified internal logic
decideStrategy(metrics: AdaptiveMetrics): StrategyName {
  const compactionsPerMinute = metrics.recentCompactions / metrics.windowMinutes;

  if (compactionsPerMinute > this.switchThreshold) {
    return 'aggressive';  // Too many compactions, be more aggressive
  } else if (compactionsPerMinute < this.switchThreshold / 3) {
    return 'lazy';        // Few compactions, can be lazy
  }
  return 'proactive';     // Moderate load, stay balanced
}
```

**Trade-offs:**
- **Pro:** Self-optimizing for your workload
- **Pro:** Handles varying load patterns
- **Con:** Takes time to learn (min samples required)
- **Con:** More complex behavior to debug

---

### Creating Custom Strategies

For specialized use cases, implement `IContextStrategy`:

```typescript
import {
  IContextStrategy,
  IContextComponent,
  IContextCompactor,
  ITokenEstimator,
  ContextBudget,
  ContextManagerConfig,
  BaseCompactionStrategy,  // Use this for easier implementation
} from '@oneringai/agents';

// Option 1: Implement from scratch
class TimeBasedStrategy implements IContextStrategy {
  readonly name = 'time-based';

  shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;

    // More aggressive during peak hours
    const threshold = isBusinessHours ? 0.60 : 0.85;
    return budget.utilizationPercent > threshold * 100;
  }

  async prepareComponents(components: IContextComponent[]): Promise<IContextComponent[]> {
    return components; // No modification
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    // Your compaction logic
    const hour = new Date().getHours();
    const targetUtilization = hour >= 9 && hour <= 17 ? 0.45 : 0.75;

    // ... implement compaction
    return { components, log: ['Time-based compaction'], tokensFreed: 0 };
  }
}

// Option 2: Extend BaseCompactionStrategy (recommended)
// This gives you the template method pattern with shared logic
class PriorityAwareStrategy extends BaseCompactionStrategy {
  readonly name = 'priority-aware';

  shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean {
    // Check if high-priority content is at risk
    const highPriorityRatio = this.calculateHighPriorityRatio(budget);
    return budget.utilizationPercent > 70 && highPriorityRatio < 0.5;
  }

  calculateTargetSize(beforeSize: number, round: number): number {
    // Reduce by 30% each round, preserving high-priority content
    return Math.floor(beforeSize * (0.7 - round * 0.1));
  }

  getTargetUtilization(): number {
    return 0.55;
  }

  protected getMaxRounds(): number {
    return 4;
  }

  private calculateHighPriorityRatio(budget: ContextBudget): number {
    // Custom logic to assess high-priority content ratio
    return 0.6; // Example
  }
}

// Use your custom strategy
const contextManager = new ContextManager(
  provider,
  { strategy: 'custom' }, // Will be ignored, strategy instance used
  compactors,
  estimator,
  new PriorityAwareStrategy()  // Pass as 5th argument
);
```

### Runtime Strategy Switching

Switch strategies dynamically based on task requirements:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'proactive',
}, compactors, estimator);

// Phase 1: Quick exploration (use lazy)
contextManager.setStrategy('lazy');
await agent.run('Explore the codebase structure');

// Phase 2: Deep analysis (use proactive)
contextManager.setStrategy('proactive');
await agent.run('Analyze all error handling patterns');

// Phase 3: Long-running task (use aggressive)
contextManager.setStrategy('aggressive');
await agent.run('Refactor all 50 API endpoints');

// Phase 4: Production deployment (use adaptive)
contextManager.setStrategy('adaptive');
// Let it self-optimize for production traffic
```

### Token Estimation

The `ApproximateTokenEstimator` provides content-type-aware estimation:

```typescript
import { ApproximateTokenEstimator } from '@oneringai/agents';

const estimator = new ApproximateTokenEstimator();

// Basic estimation (mixed content assumed)
const tokens1 = estimator.estimateTokens('Hello, world!');

// Content-type-aware estimation for better accuracy
const codeTokens = estimator.estimateTokens(sourceCode, 'code');    // ~3 chars/token
const proseTokens = estimator.estimateTokens(essay, 'prose');       // ~4 chars/token
const mixedTokens = estimator.estimateTokens(readme, 'mixed');      // ~3.5 chars/token

// Estimate structured data
const dataTokens = estimator.estimateDataTokens({ users: [...], config: {...} });
```

**Why content type matters:**
- Code has more special characters and shorter words → fewer chars/token
- Prose has longer words and punctuation → more chars/token
- Accurate estimation prevents over/under-compaction

### Context Budget Monitoring

```typescript
// Get current budget snapshot
const budget = contextManager.getCurrentBudget();
if (budget) {
  console.log(`Total tokens: ${budget.total}`);
  console.log(`Used tokens: ${budget.used}`);
  console.log(`Available: ${budget.available}`);
  console.log(`Utilization: ${budget.utilizationPercent.toFixed(1)}%`);
  console.log(`Status: ${budget.status}`); // 'ok' | 'warning' | 'critical'
  console.log(`Reserved for response: ${budget.reservedForResponse}`);
}

// Comprehensive event monitoring
contextManager.on('budget_warning', ({ budget, threshold }) => {
  console.log(`Warning: Context at ${budget.utilizationPercent}% (threshold: ${threshold}%)`);
});

contextManager.on('budget_critical', ({ budget }) => {
  console.error(`CRITICAL: Context at ${budget.utilizationPercent}% - compaction required`);
});

contextManager.on('compacting', ({ reason, strategy, currentUsage }) => {
  console.log(`Compacting: ${reason}`);
  console.log(`Strategy: ${strategy}`);
  console.log(`Current usage: ${currentUsage} tokens`);
});

contextManager.on('compacted', ({ log, tokensFreed, newUsage, rounds }) => {
  console.log(`Compaction complete in ${rounds} rounds`);
  console.log(`Freed ${tokensFreed} tokens`);
  console.log(`New usage: ${newUsage} tokens`);
  log.forEach(entry => console.log(`  - ${entry}`));
});

// Strategy-specific metrics
const metrics = contextManager.getStrategyMetrics();
console.log('Strategy metrics:', metrics);
// {
//   compactionCount: 12,
//   totalTokensFreed: 156000,
//   averageTokensFreed: 13000,
//   lastCompactionTime: 1706540400000,
//   // Additional strategy-specific metrics...
// }
```

### Agent Lifecycle Hooks for Context

Use lifecycle hooks to integrate context management with your application:

```typescript
import { AgentLifecycleHooks } from '@oneringai/agents';

const hooks: AgentLifecycleHooks = {
  // Called before context is prepared for LLM call
  beforeContextPrepare: async (agentId) => {
    console.log(`[${agentId}] Preparing context...`);
    // Could switch strategy based on task type
  },

  // Called after compaction completes
  afterCompaction: async (log, tokensFreed) => {
    // Log to monitoring system
    await monitoring.record({
      event: 'context_compaction',
      tokensFreed,
      logEntries: log,
    });

    console.log(`Compaction freed ${tokensFreed} tokens`);
  },

  // Called before each tool execution
  beforeToolExecution: async (context) => {
    const budget = context.contextManager?.getCurrentBudget();
    if (budget && budget.utilizationPercent > 80) {
      console.warn(`High context usage before tool: ${budget.utilizationPercent}%`);
    }
  },

  // Called after tool execution
  afterToolExecution: async (result) => {
    // Could trigger compaction if tool output was large
    if (result.output && JSON.stringify(result.output).length > 10000) {
      console.log('Large tool output detected');
    }
  },

  // Error handling
  onError: async (error, context) => {
    if (context.phase === 'context_preparation') {
      console.error('Context preparation failed:', error);
      // Could fall back to aggressive strategy
    }
  },
};

// Apply hooks to agent
agent.setLifecycleHooks(hooks);
```

### Best Practices for Context Management

#### 1. Choose the Right Strategy

```typescript
// Short tasks, plenty of context → Lazy
const shortTask = TaskAgent.create({
  contextConfig: { strategy: 'lazy' },
});

// Long conversations → Aggressive
const chatBot = TaskAgent.create({
  contextConfig: { strategy: 'aggressive' },
});

// Production with varied load → Adaptive
const productionAgent = TaskAgent.create({
  contextConfig: { strategy: 'adaptive' },
});

// Real-time streaming → Rolling Window
const streamingAgent = TaskAgent.create({
  contextConfig: {
    strategy: 'rolling-window',
    strategyOptions: { maxMessages: 50 },
  },
});
```

#### 2. Monitor in Production

```typescript
// Set up comprehensive monitoring
contextManager.on('compacted', async ({ tokensFreed, newUsage }) => {
  await metrics.gauge('context.tokens_freed', tokensFreed);
  await metrics.gauge('context.usage', newUsage);
});

contextManager.on('strategy_switched', async ({ from, to, reason }) => {
  await metrics.increment('context.strategy_switch', { from, to });
  await alerts.info(`Context strategy: ${from} → ${to} (${reason})`);
});

contextManager.on('budget_critical', async ({ budget }) => {
  await alerts.warn(`Context critical: ${budget.utilizationPercent}%`);
});
```

#### 3. Use Content-Type Hints

```typescript
// When storing code in memory, hint the estimator
const codeTokens = estimator.estimateTokens(sourceCode, 'code');

// Store with accurate size tracking
await memory.set('source.code', 'Source code', sourceCode, {
  metadata: { contentType: 'code', estimatedTokens: codeTokens },
});
```

#### 4. Plan for Compaction

```typescript
// Structure data for efficient compaction
// BAD: Single large object
await memory.set('all.data', 'All data', hugeObject, { priority: 'normal' });

// GOOD: Split by importance
await memory.set('data.critical', 'Critical data', criticalPart, {
  priority: 'critical',
  pinned: true,
});
await memory.set('data.important', 'Important data', importantPart, {
  priority: 'high',
});
await memory.set('data.cache', 'Cached data', cachePart, {
  priority: 'low',  // Evicted first
});
```

---

## Tools & Function Calling

### Defining Tools

```typescript
import { ToolFunction } from '@oneringai/agents';

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name, e.g., "San Francisco"',
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature units',
          },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    // Your implementation
    const { location, units = 'fahrenheit' } = args;

    // Call weather API
    const temp = 72; // Example

    return {
      location,
      temperature: temp,
      units,
      conditions: 'sunny',
    };
  },
};
```

### Using Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, calculatorTool, searchTool],
});

const response = await agent.run('What is the weather in Paris?');

// Agent will:
// 1. Recognize it needs weather data
// 2. Call weatherTool with { location: "Paris" }
// 3. Receive result
// 4. Generate natural language response

console.log(response.output_text);
// "The current weather in Paris is 72°F and sunny."
```

### Tool Management

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],
});

// Add a tool
agent.addTool(newTool);

// Remove a tool
agent.removeTool('tool_name');

// Replace all tools
agent.setTools([tool1, tool2, tool3]);

// List available tools
const toolNames = agent.listTools();
console.log(toolNames); // ['get_weather', 'calculate', 'search']
```

### Tool Execution Context

Tools receive a context object with useful information:

```typescript
const myTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'Example tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    },
  },
  execute: async (args, context) => {
    // Context available for TaskAgent tools:
    if (context?.memory) {
      // Access working memory
      const data = await context.memory.retrieve('some_key');
    }

    if (context?.contextManager) {
      // Check context budget
      const budget = context.contextManager.getCurrentBudget();
      console.log(`Context: ${budget?.utilizationPercent}%`);
    }

    if (context?.idempotencyCache) {
      // Access cache stats
      const stats = context.idempotencyCache.getStats();
      console.log(`Cache hit rate: ${stats.hitRate}`);
    }

    return { result: 'done' };
  },
};
```

### Built-in Tools

#### Memory Tools (TaskAgent only)

```typescript
// These are automatically available to TaskAgent:

// Store data
memory_store({
  key: 'user.profile',
  description: 'User profile information',
  value: { name: 'Alice', email: 'alice@example.com' },
  scope: 'persistent',
});

// Retrieve data
const profile = memory_retrieve({ key: 'user.profile' });

// Delete data
memory_delete({ key: 'user.profile' });

// List all keys
const index = memory_list();
```

> **Note:** Memory tools require TaskAgent context. If called outside TaskAgent (e.g., in a regular Agent), they throw `ToolExecutionError` with message "Memory tools require TaskAgent context".

#### Context Inspection Tools (TaskAgent only)

```typescript
// Check context budget
const info = context_inspect();
// {
//   total_tokens: 128000,
//   used_tokens: 45000,
//   available_tokens: 63800,
//   utilization_percent: 41.2,
//   status: 'ok'
// }

// Detailed breakdown
const breakdown = context_breakdown();
// {
//   components: [
//     { name: 'conversation_history', tokens: 38000, percent: 84.4 },
//     { name: 'memory_index', tokens: 4500, percent: 10.0 },
//     { name: 'system_prompt', tokens: 2000, percent: 4.4 },
//   ]
// }

// Cache statistics
const stats = cache_stats();
// {
//   entries: 15,
//   hits: 23,
//   misses: 12,
//   hit_rate: 0.657,
//   effectiveness: 'high'
// }

// Memory statistics
const memory = memory_stats();
// {
//   entry_count: 8,
//   entries: [
//     { key: 'user.profile', description: 'User profile' },
//     { key: 'session.token', description: 'Auth token' },
//   ]
// }
```

### Code Execution Tool

```typescript
import { createExecuteJavaScriptTool } from '@oneringai/agents';

const jsTool = createExecuteJavaScriptTool();

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [jsTool],
});

const response = await agent.run('Calculate the sum of numbers from 1 to 100');

// Agent will:
// 1. Generate JavaScript code
// 2. Execute: executeJavaScript({ code: 'Array(100).fill(0).map((_, i) => i+1).reduce((a,b) => a+b)' })
// 3. Return result: 5050
```

### Developer Tools (Filesystem & Shell)

A comprehensive set of tools for file system operations and shell command execution, inspired by Claude Code. Perfect for building coding assistants, DevOps agents, or any agent that needs to interact with the local filesystem.

#### Quick Start

```typescript
import { developerTools } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: developerTools, // All 7 tools included
});

// Agent can now read, write, edit files, search, and run commands
await agent.run('Read the package.json and tell me the version');
```

#### Individual Tools

You can also import and configure tools individually:

```typescript
import {
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  createBashTool,
} from '@oneringai/agents';

// Create tools with custom configuration
const readFile = createReadFileTool({
  workingDirectory: '/path/to/project',
  maxFileSize: 5 * 1024 * 1024, // 5MB
});

const bash = createBashTool({
  workingDirectory: '/path/to/project',
  defaultTimeout: 60000, // 1 minute
  allowBackground: true,
});
```

#### Filesystem Tools

##### read_file

Read file contents with line numbers.

```typescript
read_file({
  file_path: '/path/to/file.ts',
  offset: 50,    // Start at line 50 (optional)
  limit: 100,    // Read 100 lines (optional)
});
// Returns: { success: true, content: "1\tconst x = 1;...", lines: 100 }
```

##### write_file

Create or overwrite files. Automatically creates parent directories.

```typescript
write_file({
  file_path: '/path/to/new/file.ts',
  content: 'export const hello = "world";',
});
// Returns: { success: true, created: true, bytesWritten: 29 }
```

##### edit_file

Surgical find-and-replace edits. Ensures uniqueness to prevent unintended changes.

```typescript
edit_file({
  file_path: '/path/to/file.ts',
  old_string: 'const x = 1;',
  new_string: 'const x = 42;',
  replace_all: false, // Fails if old_string is not unique (default)
});
// Returns: { success: true, replacements: 1 }
```

##### glob

Find files by pattern.

```typescript
glob({
  pattern: '**/*.ts',
  path: '/path/to/project', // Optional, defaults to cwd
});
// Returns: { success: true, files: ['src/index.ts', 'src/utils.ts', ...], count: 15 }
```

##### grep

Search file contents with regex.

```typescript
grep({
  pattern: 'function\\s+\\w+',
  path: '/path/to/project',
  type: 'ts',                      // Filter by file type
  output_mode: 'content',          // 'content', 'files_with_matches', 'count'
  case_insensitive: true,
  context_before: 2,               // Lines before match
  context_after: 2,                // Lines after match
});
// Returns: { success: true, matches: [...], filesMatched: 5, totalMatches: 23 }
```

##### list_directory

List directory contents with metadata.

```typescript
list_directory({
  path: '/path/to/project',
  recursive: true,
  filter: 'files',     // 'files' or 'directories'
  max_depth: 3,
});
// Returns: { success: true, entries: [...], count: 42 }
```

#### Shell Tool

##### bash

Execute shell commands with timeout and safety features.

```typescript
bash({
  command: 'npm install',
  timeout: 300000,        // 5 minutes
  description: 'Install dependencies',
  run_in_background: false,
});
// Returns: { success: true, stdout: '...', exitCode: 0, duration: 5234 }
```

**Safety Features:**
- Blocks dangerous commands (`rm -rf /`, fork bombs, etc.)
- Configurable timeout (default 2 min, max 10 min)
- Output truncation for large outputs
- Background execution support

**Blocked Commands:**
- `rm -rf /` and `rm -rf /*`
- Fork bombs (`:(){:|:&};:`)
- `/dev/sda` writes
- Dangerous git operations

#### Configuration Options

All filesystem tools share common configuration:

```typescript
interface FilesystemToolConfig {
  workingDirectory?: string;       // Base directory (default: cwd)
  allowedDirectories?: string[];   // Restrict to these directories
  blockedDirectories?: string[];   // Block access (default: node_modules, .git)
  maxFileSize?: number;            // Max read size (default: 10MB)
  maxResults?: number;             // Max results for glob/grep (default: 1000)
  followSymlinks?: boolean;        // Follow symlinks (default: false)
  excludeExtensions?: string[];    // Skip binary files
}
```

Shell tool configuration:

```typescript
interface ShellToolConfig {
  workingDirectory?: string;       // Working directory
  defaultTimeout?: number;         // Default timeout (default: 120000ms)
  maxTimeout?: number;             // Max timeout (default: 600000ms)
  maxOutputSize?: number;          // Max output size (default: 100KB)
  allowBackground?: boolean;       // Allow background execution (default: false)
  shell?: string;                  // Shell to use (default: /bin/bash)
  env?: Record<string, string>;    // Environment variables
}
```

#### Best Practices

1. **Use edit_file for code changes** - Never rewrite entire files; use surgical edits
2. **Prefer glob over bash find** - More efficient and safer
3. **Prefer grep over bash grep** - Better output formatting and safety
4. **Set working directory** - Restrict operations to project directory
5. **Configure blockedDirectories** - Prevent accidental access to sensitive directories

---

## Dynamic Tool Management

Control tools at runtime for all agent types. Enable, disable, organize, and select tools dynamically.

### Quick Start

```typescript
import { Agent } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, emailTool, databaseTool],
});

// Disable tool temporarily
agent.tools.disable('database_tool');

// Run without database access
await agent.run('Check weather and email me');

// Re-enable later
agent.tools.enable('database_tool');
```

### ToolManager API

Every agent has a `tools` property that returns a `ToolManager`:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],
});

// Access ToolManager
const toolManager = agent.tools;

// Register new tool
toolManager.register(tool3, {
  namespace: 'data',
  priority: 10,
  enabled: true,
});

// Unregister tool
toolManager.unregister('tool_name');

// Enable/disable
toolManager.enable('tool_name');
toolManager.disable('tool_name');

// Check if enabled
const isEnabled = toolManager.isEnabled('tool_name');

// List tools
const all = toolManager.list();           // All tools
const enabled = toolManager.listEnabled(); // Only enabled
```

### Tool Options

```typescript
interface ToolOptions {
  /** Namespace for organizing tools */
  namespace?: string;

  /** Priority for selection (higher = preferred) */
  priority?: number;

  /** Initial enabled state */
  enabled?: boolean;

  /** Condition function for context-aware enabling */
  condition?: (context: ToolSelectionContext) => boolean;

  /** Tool metadata */
  metadata?: Record<string, unknown>;
}
```

#### Namespaces

Organize tools by category:

```typescript
// Register tools with namespaces
agent.tools.register(weatherTool, { namespace: 'external-api' });
agent.tools.register(emailTool, { namespace: 'communication' });
agent.tools.register(databaseReadTool, { namespace: 'database' });
agent.tools.register(databaseWriteTool, { namespace: 'database' });

// Disable all database tools
for (const name of agent.tools.list()) {
  const tool = agent.tools.get(name);
  if (tool?.metadata?.namespace === 'database') {
    agent.tools.disable(name);
  }
}
```

#### Priority

Control tool selection order:

```typescript
agent.tools.register(primaryWeatherTool, {
  priority: 100,  // High priority
});

agent.tools.register(fallbackWeatherTool, {
  priority: 10,   // Low priority (fallback)
});

// LLM sees high-priority tools first
```

#### Conditions

Dynamic enabling based on context:

```typescript
agent.tools.register(adminTool, {
  condition: (context) => context.user?.role === 'admin',
});

// Tool only available when condition is met
const selected = agent.tools.selectForContext({
  user: { role: 'admin' },
});
```

### Context-Aware Selection

```typescript
interface ToolSelectionContext {
  /** Current agent mode */
  mode?: 'interactive' | 'planning' | 'executing';

  /** Current task name */
  taskName?: string;

  /** User role/permissions */
  user?: {
    role?: string;
    permissions?: string[];
  };

  /** Environment */
  environment?: 'development' | 'staging' | 'production';

  /** Custom context */
  [key: string]: unknown;
}
```

```typescript
// Select tools based on context
const tools = agent.tools.selectForContext({
  mode: 'executing',
  environment: 'production',
  user: { role: 'admin', permissions: ['write'] },
});

// Only tools matching context are selected
```

### State Persistence

Save and restore tool configuration:

```typescript
// Get current state
const state = agent.tools.getState();

// Save to file
await fs.writeFile('./tool-config.json', JSON.stringify(state));

// Later... load state
const savedState = JSON.parse(await fs.readFile('./tool-config.json', 'utf-8'));
agent.tools.loadState(savedState);

// All tool registrations, priorities, and enabled states restored
```

### Events

Listen to tool changes:

```typescript
agent.tools.on('tool:registered', ({ name, options }) => {
  console.log(`Tool registered: ${name}`);
});

agent.tools.on('tool:unregistered', ({ name }) => {
  console.log(`Tool unregistered: ${name}`);
});

agent.tools.on('tool:enabled', ({ name }) => {
  console.log(`Tool enabled: ${name}`);
});

agent.tools.on('tool:disabled', ({ name }) => {
  console.log(`Tool disabled: ${name}`);
});
```

### Advanced Patterns

#### Environment-Based Tools

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

agent.tools.register(debugTool, {
  enabled: isDevelopment,
  namespace: 'debug',
});

agent.tools.register(productionTool, {
  enabled: !isDevelopment,
  namespace: 'production',
});
```

#### Permission-Based Tools

```typescript
function createAgentWithPermissions(userRole: string) {
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
  });

  // Register all tools
  agent.tools.register(readTool, {
    namespace: 'data',
    priority: 100,
  });

  agent.tools.register(writeTool, {
    namespace: 'data',
    priority: 90,
    enabled: userRole === 'admin',  // Only for admins
  });

  agent.tools.register(deleteTool, {
    namespace: 'data',
    priority: 80,
    enabled: userRole === 'super-admin',  // Only for super admins
  });

  return agent;
}
```

#### Rate-Limited Tools

```typescript
class RateLimitedToolManager {
  private calls = new Map<string, number>();
  private limits = new Map<string, number>();

  constructor(private agent: Agent) {}

  registerWithLimit(tool: ToolFunction, limit: number) {
    this.agent.tools.register(tool);
    this.limits.set(tool.definition.function.name, limit);
    this.calls.set(tool.definition.function.name, 0);
  }

  async execute(name: string, args: unknown) {
    const count = this.calls.get(name) || 0;
    const limit = this.limits.get(name);

    if (limit && count >= limit) {
      throw new Error(`Rate limit exceeded for ${name}`);
    }

    this.calls.set(name, count + 1);
    return await this.agent.tools.get(name)?.execute(args);
  }
}
```

#### Dynamic Tool Loading

```typescript
class PluginManager {
  constructor(private agent: Agent) {}

  async loadPlugin(pluginPath: string) {
    const plugin = await import(pluginPath);

    for (const tool of plugin.tools) {
      this.agent.tools.register(tool, {
        namespace: plugin.name,
        metadata: { plugin: plugin.name, version: plugin.version },
      });
    }

    console.log(`Loaded plugin: ${plugin.name}`);
  }

  unloadPlugin(pluginName: string) {
    for (const name of this.agent.tools.list()) {
      const tool = this.agent.tools.get(name);
      if (tool?.metadata?.plugin === pluginName) {
        this.agent.tools.unregister(name);
      }
    }

    console.log(`Unloaded plugin: ${pluginName}`);
  }
}
```

### Usage with TaskAgent

```typescript
import { TaskAgent } from '@oneringai/agents';

const agent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2, tool3],
});

// Same ToolManager API
agent.tools.disable('risky_tool');

await agent.start({
  goal: 'Process data safely',
  tasks: [
    { name: 'read_data', description: 'Read from database' },
    { name: 'process', description: 'Process the data' },
  ],
});
```

### Usage with UniversalAgent

```typescript
import { UniversalAgent } from '@oneringai/agents';

const agent = UniversalAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [safeTools...],
});

// Disable tools during execution
agent.on('mode:changed', ({ from, to }) => {
  if (to === 'executing') {
    agent.toolManager.disable('destructive_tool');
  } else if (to === 'interactive') {
    agent.toolManager.enable('destructive_tool');
  }
});
```

### Backward Compatibility

The old API still works:

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [tool1, tool2],  // Still works!
});

// Old methods still work
agent.addTool(tool3);        // Still works!
agent.removeTool('tool1');   // Still works!
agent.setTools([newTools]);  // Still works!
agent.listTools();           // Still works!

// New API via .tools property
agent.tools.disable('tool2');  // NEW!
agent.tools.enable('tool2');   // NEW!
```

### Best Practices

#### 1. Use Namespaces for Organization

```typescript
// Good
agent.tools.register(githubTool, { namespace: 'github' });
agent.tools.register(slackTool, { namespace: 'slack' });
agent.tools.register(databaseTool, { namespace: 'database' });

// Bad
agent.tools.register(githubTool);  // Hard to organize later
```

#### 2. Set Priorities for Fallbacks

```typescript
// Good
agent.tools.register(primaryAPI, { priority: 100 });
agent.tools.register(fallbackAPI, { priority: 50 });

// Bad - no priority, random selection
agent.tools.register(primaryAPI);
agent.tools.register(fallbackAPI);
```

#### 3. Disable Destructive Tools by Default

```typescript
// Good
agent.tools.register(deleteTool, {
  enabled: false,  // Disabled by default
  namespace: 'destructive',
});

// Enable only when needed
function enableDestructiveMode() {
  agent.tools.enable('delete_tool');
}
```

#### 4. Use Conditions for Complex Logic

```typescript
// Good
agent.tools.register(adminTool, {
  condition: (ctx) => ctx.user?.role === 'admin' && ctx.environment === 'production',
});

// Bad - manual checking everywhere
if (user.role === 'admin') {
  agent.tools.enable('admin_tool');
} else {
  agent.tools.disable('admin_tool');
}
```

#### 5. Persist Tool State for Sessions

```typescript
// Save tool state with session
const toolState = agent.tools.getState();
session.customData = { ...session.customData, toolState };
await sessionManager.save(session);

// Restore tool state
const loaded = await sessionManager.load(sessionId);
if (loaded?.customData?.toolState) {
  agent.tools.loadState(loaded.customData.toolState);
}
```

### Circuit Breaker Protection

ToolManager includes built-in circuit breaker protection for each tool. When a tool fails repeatedly, the circuit breaker prevents further calls to avoid cascading failures.

```typescript
// Get circuit breaker states for all tools
const states = agent.tools.getCircuitBreakerStates();
// Returns: Map<toolName, { state: 'closed' | 'open' | 'half-open', failures: number, lastFailure: Date }>

for (const [toolName, state] of states) {
  console.log(`${toolName}: ${state.state} (${state.failures} failures)`);
}

// Get metrics for a specific tool
const metrics = agent.tools.getToolCircuitBreakerMetrics('risky_tool');
console.log(`Successes: ${metrics.successCount}, Failures: ${metrics.failureCount}`);

// Manually reset a circuit breaker
agent.tools.resetToolCircuitBreaker('risky_tool');
```

**Configure circuit breaker per tool:**

```typescript
agent.tools.setCircuitBreakerConfig('external_api', {
  failureThreshold: 3,     // Open after 3 failures
  successThreshold: 2,     // Close after 2 successes in half-open
  resetTimeoutMs: 60000,   // Try half-open after 60s
  windowMs: 300000,        // Track failures in 5 min window
});
```

**Circuit breaker states:**
- **Closed** (normal) - Tool executes normally
- **Open** (tripped) - Tool calls fail immediately without execution
- **Half-Open** (testing) - One call allowed to test recovery

### Tool Execution

ToolManager implements `IToolExecutor` for direct tool execution:

```typescript
// Execute tool directly (used internally by agentic loop)
const result = await agent.tools.execute('get_weather', { location: 'Paris' });

// Execute returns the tool's result or throws on error
```

---

## MCP (Model Context Protocol)

The Model Context Protocol (MCP) is an open standard that enables seamless integration between AI applications and external data sources and tools. The library provides a complete MCP client implementation with support for both local (stdio) and remote (HTTP/HTTPS) servers.

### Overview

MCP allows you to:
- **Discover tools automatically** from MCP servers
- **Connect to local servers** via stdio (process spawning)
- **Connect to remote servers** via HTTP/HTTPS (StreamableHTTP)
- **Manage multiple servers** simultaneously
- **Auto-reconnect** with exponential backoff
- **Namespace tools** to prevent conflicts
- **Session persistence** for stateful connections

### Quick Start

#### 1. Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk zod
```

#### 2. Connect to a Local MCP Server

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@oneringai/agents';

// Setup connector for LLM
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create MCP client for filesystem server
const client = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

// Connect to the server
await client.connect();
console.log(`Connected! Available tools: ${client.tools.length}`);

// Create agent and register MCP tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
client.registerTools(agent.tools);

// Agent can now use MCP tools
const response = await agent.run('List all TypeScript files in the current directory');
console.log(response.output_text);
```

#### 3. Connect to a Remote MCP Server

```typescript
// Create HTTP/HTTPS MCP client
const remoteClient = MCPRegistry.create({
  name: 'remote-api',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,
    headers: {
      'X-Client-Version': '1.0.0',
    },
    reconnection: {
      maxRetries: 5,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 30000,
    },
  },
});

await remoteClient.connect();
remoteClient.registerTools(agent.tools);
```

### Configuration File

Create `oneringai.config.json` to declare MCP servers:

```json
{
  "version": "1.0",
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "displayName": "Filesystem Server",
        "transport": "stdio",
        "transportConfig": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
        },
        "autoConnect": true,
        "toolNamespace": "mcp:fs",
        "permissions": {
          "defaultScope": "session",
          "defaultRiskLevel": "medium"
        }
      },
      {
        "name": "github",
        "displayName": "GitHub API",
        "transport": "https",
        "transportConfig": {
          "url": "https://mcp.example.com/github",
          "token": "${GITHUB_TOKEN}"
        },
        "autoConnect": false,
        "toolNamespace": "mcp:github"
      }
    ]
  }
}
```

Load and use the configuration:

```typescript
import { Config, MCPRegistry, Agent } from '@oneringai/agents';

// Load configuration
await Config.load('./oneringai.config.json');

// Create all MCP clients from config
const clients = MCPRegistry.createFromConfig(Config.getSection('mcp')!);

// Connect all servers with autoConnect enabled
await MCPRegistry.connectAll();

// Create agent and register tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
for (const client of clients) {
  if (client.isConnected()) {
    client.registerTools(agent.tools);
  }
}
```

### MCPRegistry API

The static registry manages all MCP client connections:

```typescript
// Create a client
const client = MCPRegistry.create({
  name: 'my-server',
  transport: 'stdio',
  transportConfig: { /* ... */ },
});

// Get a client
const client = MCPRegistry.get('my-server');

// Check if exists
if (MCPRegistry.has('my-server')) {
  // ...
}

// List all servers
const serverNames = MCPRegistry.list();

// Get server info
const info = MCPRegistry.getInfo('my-server');
// { name, state, connected, toolCount }

// Get all server info
const allInfo = MCPRegistry.getAllInfo();

// Lifecycle management
await MCPRegistry.connectAll();
await MCPRegistry.disconnectAll();
MCPRegistry.destroyAll();
```

### MCPClient API

Each client manages a connection to one MCP server:

#### Connection Management

```typescript
// Connect to server
await client.connect();

// Disconnect
await client.disconnect();

// Reconnect
await client.reconnect();

// Check connection status
const isConnected = client.isConnected();

// Ping server (health check)
const alive = await client.ping();
```

#### Tool Operations

```typescript
// List available tools
const tools = await client.listTools();
console.log(tools.map(t => `${t.name}: ${t.description}`));

// Call a tool directly
const result = await client.callTool('read_file', {
  path: './README.md'
});
console.log(result.content);

// Register tools with agent
client.registerTools(agent.tools);

// Unregister tools
client.unregisterTools(agent.tools);
```

#### Resource Operations

```typescript
// List available resources
const resources = await client.listResources();

// Read a resource
const content = await client.readResource('file:///path/to/file');
console.log(content.text);

// Subscribe to resource updates (if supported)
if (client.capabilities?.resources?.subscribe) {
  client.on('resource:updated', (uri) => {
    console.log(`Resource updated: ${uri}`);
  });

  await client.subscribeResource('file:///watch/this/file');
}

// Unsubscribe
await client.unsubscribeResource('file:///watch/this/file');
```

#### Prompt Operations

```typescript
// List available prompts
const prompts = await client.listPrompts();

// Get a prompt
const promptResult = await client.getPrompt('summarize', {
  length: 'short',
});

// Use prompt messages
for (const msg of promptResult.messages) {
  console.log(`${msg.role}: ${msg.content.text}`);
}
```

### Event Monitoring

Listen to connection and execution events:

```typescript
// Connection events
client.on('connected', () => {
  console.log('Connected to MCP server');
});

client.on('disconnected', () => {
  console.log('Disconnected from MCP server');
});

client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

client.on('failed', (error) => {
  console.error('Connection failed:', error);
});

// Tool execution events
client.on('tool:called', (name, args) => {
  console.log(`Tool called: ${name}`, args);
});

client.on('tool:result', (name, result) => {
  console.log(`Tool result: ${name}`, result);
});

// Resource events
client.on('resource:updated', (uri) => {
  console.log(`Resource updated: ${uri}`);
});

// Error events
client.on('error', (error) => {
  console.error('MCP error:', error);
});
```

### Transport Types

#### Stdio Transport

For local MCP servers (spawns a process):

```typescript
const client = MCPRegistry.create({
  name: 'local-server',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',                                    // or 'node', 'python', etc.
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
    env: {
      NODE_ENV: 'production',
      CUSTOM_VAR: 'value',
    },
    cwd: '/working/directory',                        // Optional working directory
  },
});
```

**Best for:**
- Local file system access
- Database connections (PostgreSQL, SQLite)
- Development and testing

#### HTTP/HTTPS Transport

For remote MCP servers (StreamableHTTP with SSE):

```typescript
const client = MCPRegistry.create({
  name: 'remote-server',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/api',
    token: process.env.MCP_TOKEN,                      // Bearer token
    headers: {
      'X-Client-Version': '1.0.0',
      'X-Custom-Header': 'value',
    },
    timeoutMs: 30000,                                  // Request timeout (default: 30000)
    sessionId: 'optional-session-id',                  // For reconnection
    reconnection: {
      maxReconnectionDelay: 30000,                     // Max delay between retries (default: 30000)
      initialReconnectionDelay: 1000,                  // Initial delay (default: 1000)
      reconnectionDelayGrowFactor: 1.5,                // Backoff factor (default: 1.5)
      maxRetries: 5,                                   // Max attempts (default: 2)
    },
  },
});
```

**Best for:**
- Cloud-hosted services
- Production deployments
- Team collaboration
- Remote API access

### Tool Namespacing

MCP tools are automatically namespaced to prevent conflicts:

```typescript
// Default namespace: mcp:{server-name}:{tool-name}
// Example: mcp:filesystem:read_file, mcp:github:create_issue

// Custom namespace
const client = MCPRegistry.create({
  name: 'fs',
  toolNamespace: 'files',
  // ...
});
// Tools: files:read_file, files:write_file, etc.

// Check registered tools
const toolNames = agent.listTools();
console.log(toolNames.filter(name => name.startsWith('mcp:')));
```

### Multi-Server Example

Connect to multiple MCP servers simultaneously:

```typescript
import { MCPRegistry, Agent, Connector, Vendor } from '@oneringai/agents';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create multiple clients
const fsClient = MCPRegistry.create({
  name: 'filesystem',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
});

const githubClient = MCPRegistry.create({
  name: 'github',
  transport: 'https',
  transportConfig: {
    url: 'https://mcp.example.com/github',
    token: process.env.GITHUB_TOKEN,
  },
});

const dbClient = MCPRegistry.create({
  name: 'postgres',
  transport: 'stdio',
  transportConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
});

// Connect all
await Promise.all([
  fsClient.connect(),
  githubClient.connect(),
  dbClient.connect(),
]);

// Create agent and register all tools
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
fsClient.registerTools(agent.tools);
githubClient.registerTools(agent.tools);
dbClient.registerTools(agent.tools);

console.log(`Total tools: ${agent.listTools().length}`);

// Agent can now use tools from all servers
await agent.run('Query the database, analyze files, and create a GitHub issue with the results');
```

### Available MCP Servers

Official MCP servers from [@modelcontextprotocol](https://github.com/modelcontextprotocol/servers):

- **@modelcontextprotocol/server-filesystem** - File system operations
- **@modelcontextprotocol/server-github** - GitHub API integration
- **@modelcontextprotocol/server-google-drive** - Google Drive access
- **@modelcontextprotocol/server-slack** - Slack workspace integration
- **@modelcontextprotocol/server-postgres** - PostgreSQL database access
- **@modelcontextprotocol/server-sqlite** - SQLite database access
- **@modelcontextprotocol/server-memory** - Simple in-memory key-value store
- **@modelcontextprotocol/server-brave-search** - Brave Search API
- **@modelcontextprotocol/server-fetch** - HTTP requests and web scraping

Community servers:
- Browse at [mcpservers.org](https://mcpservers.org/)
- [Awesome MCP Servers](https://github.com/wong2/awesome-mcp-servers)
- [Awesome MCP Servers (punkpeye)](https://github.com/punkpeye/awesome-mcp-servers)

### Error Handling

```typescript
import {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
} from '@oneringai/agents';

try {
  await client.connect();
} catch (error) {
  if (error instanceof MCPConnectionError) {
    console.error('Failed to connect:', error.message);
    // Retry or use fallback
  } else if (error instanceof MCPTimeoutError) {
    console.error('Connection timed out:', error.timeoutMs);
  } else if (error instanceof MCPToolError) {
    console.error('Tool execution failed:', error.toolName);
  } else if (error instanceof MCPProtocolError) {
    console.error('Protocol error:', error.message);
  }
}
```

### State Persistence

Save and restore MCP client state:

```typescript
// Get current state
const state = client.getState();
console.log(state);
// {
//   name: 'filesystem',
//   state: 'connected',
//   capabilities: {...},
//   subscribedResources: ['file:///watch'],
//   lastConnectedAt: 1234567890,
//   connectionAttempts: 0
// }

// Save to storage
await storage.save('mcp-state', state);

// Load and restore
const savedState = await storage.load('mcp-state');
const newClient = MCPRegistry.create(config);
newClient.loadState(savedState);
await newClient.connect(); // Resumes with saved subscriptions
```

### Best Practices

1. **Use Configuration Files** - Declare servers in `oneringai.config.json` for easier management
2. **Handle Reconnection** - Enable `autoReconnect` for production deployments
3. **Monitor Events** - Listen to connection events for observability
4. **Use Namespaces** - Set custom `toolNamespace` to organize tools clearly
5. **Error Handling** - Always wrap MCP operations in try/catch
6. **Clean Up** - Call `client.disconnect()` when done
7. **Health Checks** - Use `client.ping()` for monitoring
8. **Permission Control** - Set appropriate `defaultScope` for security

### Troubleshooting

#### Connection Issues

```typescript
// Enable detailed error logging
client.on('error', (error) => {
  console.error('MCP Error:', error);
  console.error('Stack:', error.stack);
});

// Check connection state
console.log('State:', client.state);
console.log('Connected:', client.isConnected());

// Manual reconnect
if (!client.isConnected()) {
  await client.reconnect();
}
```

#### Tool Discovery

```typescript
// List all discovered tools
const tools = await client.listTools();
console.log('Available tools:');
tools.forEach(tool => {
  console.log(`  ${tool.name}: ${tool.description}`);
  console.log('  Input schema:', JSON.stringify(tool.inputSchema, null, 2));
});

// Check server capabilities
console.log('Capabilities:', client.capabilities);
```

#### Debug Mode

```typescript
// Log all tool calls
client.on('tool:called', (name, args) => {
  console.log(`[DEBUG] Tool called: ${name}`);
  console.log('[DEBUG] Args:', JSON.stringify(args, null, 2));
});

client.on('tool:result', (name, result) => {
  console.log(`[DEBUG] Tool result: ${name}`);
  console.log('[DEBUG] Result:', JSON.stringify(result, null, 2));
});
```

### Advanced: Custom Transports

While stdio and HTTP/HTTPS cover most use cases, you can implement custom transports by creating a class that implements the SDK's `Transport` interface:

```typescript
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

class CustomTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  async start(): Promise<void> {
    // Initialize your custom transport
  }

  async close(): Promise<void> {
    // Clean up resources
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // Send message to server
  }
}
```

---

## Multimodal (Vision)

### Analyzing Images

```typescript
import { Agent, createMessageWithImages } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4-vision',
});

// From file path
const response1 = await agent.run(
  createMessageWithImages('What is in this image?', ['./photo.jpg'])
);

// From URL
const response2 = await agent.run(
  createMessageWithImages('Describe this image', [
    'https://example.com/image.jpg'
  ])
);

// From base64
const base64Image = Buffer.from(imageData).toString('base64');
const response3 = await agent.run(
  createMessageWithImages('Analyze this', [
    `data:image/jpeg;base64,${base64Image}`
  ])
);

// Multiple images
const response4 = await agent.run(
  createMessageWithImages(
    'Compare these two images',
    ['./image1.jpg', './image2.jpg']
  )
);
```

### Clipboard Images

Paste images directly from clipboard (like Claude Code!):

```typescript
import { Agent, readClipboardImage, hasClipboardImage } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'anthropic',
  model: 'claude-opus-4-5-20251101',
});

// Check if clipboard has an image
if (await hasClipboardImage()) {
  // Read clipboard image
  const result = await readClipboardImage();

  if (result.success && result.base64) {
    const response = await agent.run(
      createMessageWithImages('What is in this screenshot?', [
        `data:${result.mimeType};base64,${result.base64}`
      ])
    );

    console.log(response.output_text);
  }
}
```

### Vision with Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4-vision',
  tools: [extractTextTool, identifyObjectsTool],
});

const response = await agent.run(
  createMessageWithImages(
    'Extract all text from this receipt and calculate the total',
    ['./receipt.jpg']
  )
);

// Agent will:
// 1. Analyze image
// 2. Call extractTextTool to extract text
// 3. Parse numbers
// 4. Calculate total
```

---

## Audio (TTS/STT)

The library provides comprehensive Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities.

### Text-to-Speech

#### Basic Usage

```typescript
import { Connector, TextToSpeech, Vendor } from '@oneringai/agents';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create TTS instance
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'tts-1-hd',      // High-quality model
  voice: 'nova',          // Female voice
});

// Synthesize to Buffer
const response = await tts.synthesize('Hello, world!');
console.log(response.audio);   // Buffer
console.log(response.format);  // 'mp3'

// Synthesize to file
await tts.toFile('Hello, world!', './output.mp3');
```

#### Voice Options

```typescript
// Available voices
const voices = await tts.listVoices();
// [
//   { id: 'alloy', name: 'Alloy', gender: 'neutral', isDefault: true },
//   { id: 'echo', name: 'Echo', gender: 'male' },
//   { id: 'fable', name: 'Fable', gender: 'male' },
//   { id: 'onyx', name: 'Onyx', gender: 'male' },
//   { id: 'nova', name: 'Nova', gender: 'female' },
//   { id: 'shimmer', name: 'Shimmer', gender: 'female' },
//   ...
// ]

// Synthesize with specific voice
const audio = await tts.synthesize('Hello', { voice: 'echo' });
```

#### Audio Formats

```typescript
// Supported formats: mp3, opus, aac, flac, wav, pcm
const mp3 = await tts.synthesize('Hello', { format: 'mp3' });
const wav = await tts.synthesize('Hello', { format: 'wav' });
const flac = await tts.synthesize('Hello', { format: 'flac' });
```

#### Speed Control

```typescript
// Speed range: 0.25 (slow) to 4.0 (fast)
const slow = await tts.synthesize('Speaking slowly', { speed: 0.5 });
const normal = await tts.synthesize('Normal speed', { speed: 1.0 });
const fast = await tts.synthesize('Speaking fast', { speed: 2.0 });
```

#### Instruction Steering (gpt-4o-mini-tts)

The `gpt-4o-mini-tts` model supports instruction steering for emotional control:

```typescript
const tts = TextToSpeech.create({
  connector: 'openai',
  model: 'gpt-4o-mini-tts',
  voice: 'nova',
});

const audio = await tts.synthesize('I\'m so happy to see you!', {
  vendorOptions: {
    instructions: 'Speak with enthusiasm and joy, like greeting an old friend.',
  },
});
```

#### Model Introspection

```typescript
// Get model information
const info = tts.getModelInfo();
console.log(info.capabilities.features.instructionSteering); // true for gpt-4o-mini-tts

// Check feature support
const canSteer = tts.supportsFeature('instructionSteering');
const canStream = tts.supportsFeature('streaming');

// Get supported formats
const formats = tts.getSupportedFormats();  // ['mp3', 'opus', 'aac', ...]

// List available models
const models = tts.listAvailableModels();
```

### Speech-to-Text

#### Basic Usage

```typescript
import { Connector, SpeechToText, Vendor } from '@oneringai/agents';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create STT instance
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

// Transcribe from file path
const result = await stt.transcribeFile('./audio.mp3');
console.log(result.text);

// Transcribe from Buffer
import * as fs from 'fs/promises';
const audioBuffer = await fs.readFile('./audio.mp3');
const result2 = await stt.transcribe(audioBuffer);
```

#### Timestamps

```typescript
// Word-level timestamps
const withWords = await stt.transcribeWithTimestamps(audioBuffer, 'word');
console.log(withWords.words);
// [
//   { word: 'Hello', start: 0.0, end: 0.5 },
//   { word: 'world', start: 0.6, end: 1.1 },
// ]

// Segment-level timestamps
const withSegments = await stt.transcribeWithTimestamps(audioBuffer, 'segment');
console.log(withSegments.segments);
// [
//   { id: 0, text: 'Hello world.', start: 0.0, end: 1.5 },
// ]
```

#### Translation

Translate audio to English:

```typescript
const stt = SpeechToText.create({
  connector: 'openai',
  model: 'whisper-1',
});

// Translate French audio to English
const english = await stt.translate(frenchAudioBuffer);
console.log(english.text);  // English translation
```

#### Output Formats

```typescript
// JSON (default)
const json = await stt.transcribe(audio, { outputFormat: 'json' });

// Plain text
const text = await stt.transcribe(audio, { outputFormat: 'text' });

// Subtitles (SRT format)
const srt = await stt.transcribe(audio, { outputFormat: 'srt' });

// WebVTT format
const vtt = await stt.transcribe(audio, { outputFormat: 'vtt' });

// Verbose JSON (includes all metadata)
const verbose = await stt.transcribe(audio, { outputFormat: 'verbose_json' });
```

#### Language Hints

```typescript
// Provide language hint for better accuracy
const result = await stt.transcribe(audio, { language: 'fr' });  // French
const result2 = await stt.transcribe(audio, { language: 'es' }); // Spanish
```

#### Model Introspection

```typescript
// Get model information
const info = stt.getModelInfo();
console.log(info.capabilities.features.diarization);  // Speaker identification

// Check feature support
const supportsTranslation = stt.supportsFeature('translation');
const supportsDiarization = stt.supportsFeature('diarization');

// Get supported formats
const inputFormats = stt.getSupportedInputFormats();
const outputFormats = stt.getSupportedOutputFormats();

// Get timestamp granularities
const granularities = stt.getTimestampGranularities();  // ['word', 'segment']
```

### Available Models

#### TTS Models

| Model | Provider | Features | Price/1k chars |
|-------|----------|----------|----------------|
| `tts-1` | OpenAI | Fast, low-latency | $0.015 |
| `tts-1-hd` | OpenAI | High-quality audio | $0.030 |
| `gpt-4o-mini-tts` | OpenAI | Instruction steering, emotions | $0.015 |
| `gemini-2.5-flash-preview-tts` | Google | Low latency, 30 voices | - |
| `gemini-2.5-pro-preview-tts` | Google | High quality, 30 voices | - |

#### STT Models

| Model | Provider | Features | Price/minute |
|-------|----------|----------|--------------|
| `whisper-1` | OpenAI | General-purpose, 50+ languages | $0.006 |
| `gpt-4o-transcribe` | OpenAI | Superior accuracy | $0.006 |
| `gpt-4o-transcribe-diarize` | OpenAI | Speaker identification | $0.012 |
| `whisper-large-v3` | Groq | Ultra-fast (12x cheaper!) | $0.0005 |
| `distil-whisper-large-v3-en` | Groq | English-only, fastest | $0.00033 |

### Voice Assistant Pipeline

Combine TTS and STT for a voice assistant:

```typescript
import { Connector, Agent, TextToSpeech, SpeechToText, Vendor } from '@oneringai/agents';

// Setup
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

const stt = SpeechToText.create({ connector: 'openai', model: 'whisper-1' });
const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const tts = TextToSpeech.create({ connector: 'openai', model: 'tts-1-hd', voice: 'nova' });

// Voice assistant pipeline
async function voiceAssistant(audioInput: Buffer): Promise<Buffer> {
  // 1. Speech → Text
  const transcription = await stt.transcribe(audioInput);
  console.log('User said:', transcription.text);

  // 2. Text → AI Response
  const response = await agent.run(transcription.text);
  console.log('Agent response:', response.output_text);

  // 3. Text → Speech
  const audioResponse = await tts.synthesize(response.output_text);
  return audioResponse.audio;
}
```

### Cost Estimation

```typescript
import { calculateTTSCost, calculateSTTCost } from '@oneringai/agents';

// TTS cost (per 1,000 characters)
const ttsCost = calculateTTSCost('tts-1-hd', 5000);  // 5000 characters
console.log(`TTS cost: $${ttsCost}`);  // $0.15

// STT cost (per minute)
const sttCost = calculateSTTCost('whisper-1', 300);  // 5 minutes
console.log(`STT cost: $${sttCost}`);  // $0.03

// Groq is much cheaper for STT
const groqCost = calculateSTTCost('whisper-large-v3', 300);  // 5 minutes
console.log(`Groq STT cost: $${groqCost}`);  // $0.0025
```

---

## Image Generation

The library provides comprehensive image generation capabilities with support for OpenAI (DALL-E) and Google (Imagen).

### Basic Usage

```typescript
import { Connector, ImageGeneration, Vendor } from '@oneringai/agents';
import * as fs from 'fs/promises';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create image generator
const imageGen = ImageGeneration.create({ connector: 'openai' });

// Generate an image
const result = await imageGen.generate({
  prompt: 'A futuristic city at sunset with flying cars',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
});

// Save to file
const buffer = Buffer.from(result.data[0].b64_json!, 'base64');
await fs.writeFile('./output.png', buffer);
```

### OpenAI DALL-E

```typescript
// DALL-E 3 (recommended for quality)
const result = await imageGen.generate({
  prompt: 'A serene mountain landscape',
  model: 'dall-e-3',
  size: '1024x1024',      // 1024x1024, 1024x1792, 1792x1024
  quality: 'hd',           // standard or hd
  style: 'vivid',          // vivid or natural
});

// DALL-E 3 often revises prompts for better results
console.log('Revised prompt:', result.data[0].revised_prompt);

// DALL-E 2 (faster, supports multiple images)
const multiResult = await imageGen.generate({
  prompt: 'A colorful abstract pattern',
  model: 'dall-e-2',
  size: '512x512',         // 256x256, 512x512, 1024x1024
  n: 4,                    // Generate up to 10 images
});

// Process all generated images
for (let i = 0; i < multiResult.data.length; i++) {
  const buffer = Buffer.from(multiResult.data[i].b64_json!, 'base64');
  await fs.writeFile(`./output-${i}.png`, buffer);
}
```

### Google Imagen

```typescript
// Setup Google connector
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const googleGen = ImageGeneration.create({ connector: 'google' });

// Imagen 4.0 (standard quality)
const result = await googleGen.generate({
  prompt: 'A beautiful butterfly in a garden',
  model: 'imagen-4.0-generate-001',
  n: 2,  // Up to 4 images
});

// Imagen 4.0 Fast (optimized for speed)
const fastResult = await googleGen.generate({
  prompt: 'A simple geometric pattern',
  model: 'imagen-4.0-fast-generate-001',
});

// Imagen 4.0 Ultra (highest quality)
const ultraResult = await googleGen.generate({
  prompt: 'A photorealistic portrait',
  model: 'imagen-4.0-ultra-generate-001',
});
```

### Available Models

#### OpenAI Image Models

| Model | Features | Max Images | Sizes | Price/Image |
|-------|----------|------------|-------|-------------|
| `dall-e-3` | HD quality, style control, prompt revision | 1 | 1024², 1024x1792, 1792x1024 | $0.04-0.08 |
| `dall-e-2` | Fast, multiple images, editing, variations | 10 | 256², 512², 1024² | $0.02 |
| `gpt-image-1` | Latest model, transparency support | 1 | 1024², 1024x1536, 1536x1024 | $0.01-0.04 |

#### Google Image Models

| Model | Features | Max Images | Price/Image |
|-------|----------|------------|-------------|
| `imagen-4.0-generate-001` | Standard quality, aspect ratios | 4 | $0.04 |
| `imagen-4.0-ultra-generate-001` | Highest quality | 4 | $0.08 |
| `imagen-4.0-fast-generate-001` | Speed optimized | 4 | $0.02 |

### Model Introspection

```typescript
// List available models
const models = await imageGen.listModels();
console.log('Available models:', models);

// Get model information
const info = imageGen.getModelInfo('dall-e-3');
console.log('Max images:', info.capabilities.maxImagesPerRequest);
console.log('Supported sizes:', info.capabilities.sizes);
console.log('Has style control:', info.capabilities.features.styleControl);
```

### Cost Estimation

```typescript
import { calculateImageCost } from '@oneringai/agents';

// Standard quality
const standardCost = calculateImageCost('dall-e-3', 5, 'standard');
console.log(`5 standard images: $${standardCost}`);  // $0.20

// HD quality
const hdCost = calculateImageCost('dall-e-3', 5, 'hd');
console.log(`5 HD images: $${hdCost}`);  // $0.40

// Google Imagen
const imagenCost = calculateImageCost('imagen-4.0-generate-001', 4);
console.log(`4 Imagen images: $${imagenCost}`);  // $0.16
```

---

## Video Generation

The library provides comprehensive video generation capabilities with support for OpenAI (Sora) and Google (Veo). Video generation is **asynchronous** - you start a job and poll for completion.

### Basic Usage

```typescript
import { Connector, VideoGeneration, Vendor } from '@oneringai/agents';
import * as fs from 'fs/promises';

// Setup connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Create video generator
const videoGen = VideoGeneration.create({ connector: 'openai' });

// Start video generation (returns immediately with job ID)
const job = await videoGen.generate({
  prompt: 'A cinematic shot of a sunrise over mountains with clouds rolling',
  model: 'sora-2',
  duration: 8,           // 8 seconds
  resolution: '1280x720', // 720p landscape
});

console.log('Job started:', job.jobId);
console.log('Status:', job.status);  // 'pending'

// Wait for completion (polls every 10 seconds, default 10-minute timeout)
const result = await videoGen.waitForCompletion(job.jobId);

// Download the completed video
const videoBuffer = await videoGen.download(job.jobId);
await fs.writeFile('./output.mp4', videoBuffer);
```

### Understanding the Async Model

Video generation takes significant time (often minutes). The API uses an async job model:

```typescript
// 1. Start generation - returns immediately
const job = await videoGen.generate({ prompt: '...', duration: 8 });
// job.status = 'pending'

// 2. Poll for status (optional - if you want progress updates)
const status = await videoGen.getStatus(job.jobId);
// status.status = 'processing', status.progress = 45

// 3. Wait for completion (blocks until done or timeout)
const result = await videoGen.waitForCompletion(job.jobId);
// result.status = 'completed'

// 4. Download the video
const buffer = await videoGen.download(job.jobId);
```

Or use the convenience method:

```typescript
// Generate and wait in one call
const result = await videoGen.generateAndWait({
  prompt: 'A butterfly flying through a garden',
  duration: 4,
});

const buffer = await videoGen.download(result.jobId);
```

### Video Response Structure

The API returns a `VideoResponse` object:

```typescript
interface VideoResponse {
  jobId: string;              // Unique job identifier
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created: number;            // Unix timestamp
  progress?: number;          // 0-100 percentage (when processing)
  video?: {
    url?: string;             // Download URL (if available)
    duration?: number;        // Actual duration in seconds
    resolution?: string;      // Actual resolution
    format?: string;          // 'mp4' typically
  };
  error?: string;             // Error message if failed
}
```

### Viewing Your Generated Video

After downloading, the video is a standard MP4 file that can be:

```typescript
// Save to file
await fs.writeFile('./output.mp4', videoBuffer);

// Open with default player (Node.js)
import { exec } from 'child_process';
exec('open ./output.mp4');  // macOS
exec('xdg-open ./output.mp4');  // Linux
exec('start ./output.mp4');  // Windows

// Serve via web server
import express from 'express';
const app = express();
app.get('/video', (req, res) => {
  res.setHeader('Content-Type', 'video/mp4');
  res.send(videoBuffer);
});

// Convert to base64 for embedding
const base64 = videoBuffer.toString('base64');
const dataUrl = `data:video/mp4;base64,${base64}`;
```

### OpenAI Sora

```typescript
// Sora 2 (standard quality, good value)
const result = await videoGen.generate({
  prompt: 'A futuristic city at sunset with flying cars',
  model: 'sora-2',
  duration: 8,              // 4, 8, or 12 seconds
  resolution: '1280x720',   // 720p landscape
  seed: 42,                 // For reproducibility
});

// Sora 2 Pro (higher quality, more options)
const proResult = await videoGen.generate({
  prompt: 'A photorealistic ocean wave crashing',
  model: 'sora-2-pro',
  duration: 12,
  resolution: '1920x1080',  // Full HD
  seed: 42,
});

// Image-to-video (animate a still image)
const imageBuffer = await fs.readFile('./photo.jpg');
const animated = await videoGen.generate({
  prompt: 'Gentle camera pan across the landscape',
  image: imageBuffer,       // Reference image
  model: 'sora-2',
  duration: 4,
});
```

### Google Veo

```typescript
// Setup Google connector
Connector.create({
  name: 'google',
  vendor: Vendor.Google,
  auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY! },
});

const googleVideo = VideoGeneration.create({ connector: 'google' });

// Veo 2.0 (budget-friendly at $0.03/sec)
const veo2 = await googleVideo.generate({
  prompt: 'A colorful butterfly landing on a flower',
  model: 'veo-2.0-generate-001',
  duration: 5,
  vendorOptions: {
    negativePrompt: 'blurry, low quality',  // What to avoid
  },
});

// Veo 3.0 (with audio support)
const veo3 = await googleVideo.generate({
  prompt: 'A thunderstorm over a city with lightning',
  model: 'veo-3-generate-preview',
  duration: 8,
  vendorOptions: {
    personGeneration: 'dont_allow',  // Safety setting
  },
});

// Veo 3.1 (latest features, 4K support)
const veo31 = await googleVideo.generate({
  prompt: 'A drone shot flying over mountains',
  model: 'veo-3.1-generate-preview',
  duration: 8,
  resolution: '4k',
});

// Veo 3.1 Fast (optimized for speed)
const fast = await googleVideo.generate({
  prompt: 'Simple animation of bouncing balls',
  model: 'veo-3.1-fast-generate-preview',
  duration: 4,
});
```

### Video Extension

Extend an existing video (not all models support this):

```typescript
const videoGen = VideoGeneration.create({ connector: 'openai' });

// First, create a video
const original = await videoGen.generateAndWait({
  prompt: 'A rocket launching',
  duration: 4,
});

// Download the original
const originalBuffer = await videoGen.download(original.jobId);

// Extend it
const extended = await videoGen.extend({
  video: originalBuffer,
  prompt: 'The rocket continues into space',
  extendDuration: 4,        // Add 4 more seconds
  direction: 'end',         // Extend from the end
});

await videoGen.waitForCompletion(extended.jobId);
```

### Available Models

#### OpenAI Sora Models

| Model | Features | Durations | Resolutions | Price/Second |
|-------|----------|-----------|-------------|--------------|
| `sora-2` | Text/image-to-video, audio, seed | 4, 8, 12s | 720p, custom | $0.15 |
| `sora-2-pro` | + HD, upscaling, style control | 4, 8, 12s | 720p-1080p | $0.40 |

#### Google Veo Models

| Model | Features | Durations | Resolutions | Price/Second |
|-------|----------|-----------|-------------|--------------|
| `veo-2.0-generate-001` | Image-to-video, negative prompts | 5-8s | 768x1408 | $0.03 |
| `veo-3-generate-preview` | + Audio, extension, style | 4-8s | 720p-1080p | $0.75 |
| `veo-3.1-fast-generate-preview` | Fast inference, audio | 4-8s | 720p | $0.75 |
| `veo-3.1-generate-preview` | Full features, 4K | 4-8s | 720p-4K | $0.75 |

### Model Introspection

```typescript
// List available models
const models = await videoGen.listModels();
console.log('Available models:', models);

// Get model information
const info = videoGen.getModelInfo('sora-2');
console.log('Durations:', info.capabilities.durations);       // [4, 8, 12]
console.log('Resolutions:', info.capabilities.resolutions);   // ['720x1280', ...]
console.log('Has audio:', info.capabilities.audio);           // true
console.log('Image-to-video:', info.capabilities.imageToVideo); // true
console.log('Style control:', info.capabilities.features.styleControl); // false
```

### Cost Estimation

```typescript
import { calculateVideoCost } from '@oneringai/agents';

// Sora 2: $0.15/second
const soraCost = calculateVideoCost('sora-2', 8);  // 8 seconds
console.log(`Sora 2 (8s): $${soraCost}`);  // $1.20

// Sora 2 Pro: $0.40/second
const proCost = calculateVideoCost('sora-2-pro', 12);  // 12 seconds
console.log(`Sora 2 Pro (12s): $${proCost}`);  // $4.80

// Veo 2.0: $0.03/second (budget option)
const veo2Cost = calculateVideoCost('veo-2.0-generate-001', 8);
console.log(`Veo 2.0 (8s): $${veo2Cost}`);  // $0.24

// Veo 3.1: $0.75/second
const veo3Cost = calculateVideoCost('veo-3.1-generate-preview', 8);
console.log(`Veo 3.1 (8s): $${veo3Cost}`);  // $6.00
```

### Error Handling

```typescript
try {
  const job = await videoGen.generate({
    prompt: 'A video',
    duration: 8,
  });

  const result = await videoGen.waitForCompletion(job.jobId, 300000); // 5 min timeout

  if (result.status === 'completed') {
    const buffer = await videoGen.download(result.jobId);
    await fs.writeFile('./output.mp4', buffer);
  }
} catch (error) {
  if (error.message.includes('timed out')) {
    console.error('Video generation took too long');
  } else if (error.message.includes('failed')) {
    console.error('Video generation failed:', error.message);
  } else if (error.message.includes('policy')) {
    console.error('Content policy violation');
  } else {
    console.error('Error:', error.message);
  }
}
```

### Job Management

```typescript
// Cancel a pending job
const job = await videoGen.generate({ prompt: '...', duration: 8 });

// Changed your mind? Cancel it
const cancelled = await videoGen.cancel(job.jobId);
console.log('Cancelled:', cancelled);  // true
```

---

## Web Search

Web search capabilities with Connector-based authentication. Supports multiple providers: Serper, Brave, Tavily, and RapidAPI.

### Quick Start

```typescript
import { Connector, SearchProvider, Services } from '@oneringai/agents';

// Create search connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Create search provider
const search = SearchProvider.create({ connector: 'serper-main' });

// Perform search
const results = await search.search('latest AI developments 2026', {
  numResults: 10,
  country: 'us',
  language: 'en',
});

if (results.success) {
  console.log(`Found ${results.count} results:`);
  results.results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   ${result.url}`);
    console.log(`   ${result.snippet}\n`);
  });
}
```

### Search Providers

#### Serper (Google Search)

Fast Google search results via Serper.dev API:

```typescript
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

const search = SearchProvider.create({ connector: 'serper-main' });
const results = await search.search('query', {
  numResults: 10,
  country: 'us',
  language: 'en',
});
```

**Features:**
- Fast (1-2 second response time)
- 2,500 free queries, then $0.30/1k
- Google search quality
- Up to 100 results per query

#### Brave Search

Independent search index (privacy-focused):

```typescript
Connector.create({
  name: 'brave-main',
  serviceType: Services.BraveSearch,
  auth: { type: 'api_key', apiKey: process.env.BRAVE_API_KEY! },
  baseURL: 'https://api.search.brave.com/res/v1',
});

const search = SearchProvider.create({ connector: 'brave-main' });
const results = await search.search('query', {
  numResults: 10,
});
```

**Features:**
- Privacy-focused (no Google)
- Independent search index
- 2,000 free queries, then $3/1k
- Up to 20 results per query

#### Tavily

AI-optimized search with summaries:

```typescript
Connector.create({
  name: 'tavily-main',
  serviceType: Services.Tavily,
  auth: { type: 'api_key', apiKey: process.env.TAVILY_API_KEY! },
  baseURL: 'https://api.tavily.com',
});

const search = SearchProvider.create({ connector: 'tavily-main' });
const results = await search.search('query', {
  numResults: 10,
  vendorOptions: {
    search_depth: 'advanced',  // 'basic' or 'advanced'
    include_answer: true,
    include_raw_content: false,
  },
});
```

**Features:**
- AI-optimized for LLMs
- Includes summaries
- 1,000 free queries, then $1/1k
- Up to 20 results per query

#### RapidAPI

Real-time web search via RapidAPI:

```typescript
Connector.create({
  name: 'rapidapi-search',
  serviceType: Services.RapidapiSearch,
  auth: { type: 'api_key', apiKey: process.env.RAPIDAPI_KEY! },
  baseURL: 'https://real-time-web-search.p.rapidapi.com',
});

const search = SearchProvider.create({ connector: 'rapidapi-search' });
const results = await search.search('query', {
  numResults: 50,
  country: 'us',
  language: 'en',
  vendorOptions: {
    start: 0,                  // Pagination offset
    fetch_ai_overviews: false,
    deduplicate: false,
    nfpr: 0,                   // No auto-correct
    tbs: 'qdr:d',             // Time-based search (d=day, w=week, m=month, y=year)
    location: 'New York',      // Search origin
  },
});
```

**Features:**
- Real-time web results
- Up to 100 results per query
- Advanced filtering options
- Various pricing plans

### Using with Agent (webSearch Tool)

The webSearch tool is available for agents:

```typescript
import { Agent, webSearch } from '@oneringai/agents';

// Create agent with webSearch tool
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webSearch],
});

// Agent automatically uses available search connectors
const response = await agent.run(
  'Search for the latest AI news from 2026 and summarize the top 3 results'
);
```

**Tool Parameters:**
- `query` (required) - Search query string
- `connectorName` - Connector name to use (recommended)
- `numResults` - Number of results (default: 10)
- `country` - Country/region code (e.g., 'us', 'gb')
- `language` - Language code (e.g., 'en', 'fr')
- `provider` - Legacy parameter ('serper', 'brave', 'tavily') for backward compatibility

**Example with specific connector:**

```typescript
await webSearch.execute({
  query: 'quantum computing breakthroughs',
  connectorName: 'serper-main',
  numResults: 5,
  country: 'us',
});
```

### Multiple Keys (Failover)

Support for backup keys:

```typescript
// Main connector
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY_MAIN! },
  baseURL: 'https://google.serper.dev',
});

// Backup connector
Connector.create({
  name: 'serper-backup',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY_BACKUP! },
  baseURL: 'https://google.serper.dev',
});

// Use with failover
try {
  const search = SearchProvider.create({ connector: 'serper-main' });
  const results = await search.search('query');
} catch (error) {
  console.log('Main failed, trying backup...');
  const backup = SearchProvider.create({ connector: 'serper-backup' });
  const results = await backup.search('query');
}
```

### Enterprise Resilience

All Connector features automatically apply:

```typescript
Connector.create({
  name: 'serper-main',
  serviceType: Services.Serper,
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',

  // Resilience features
  timeout: 30000,  // 30 second timeout
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 60000,
  },
});

const search = SearchProvider.create({ connector: 'serper-main' });
// Automatically includes retry, circuit breaker, and timeout!
const results = await search.search('query');
```

### Metrics and Monitoring

```typescript
const connector = Connector.get('serper-main');

// Get metrics
const metrics = connector.getMetrics();
console.log(`Requests: ${metrics.requestCount}`);
console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
console.log(`Avg latency: ${metrics.avgLatencyMs.toFixed(0)}ms`);

// Circuit breaker state
const cbState = connector.getCircuitBreakerState();
console.log(`Circuit breaker: ${cbState}`);  // 'closed' | 'open' | 'half-open'
```

### Backward Compatibility

Old environment variable approach still works:

```typescript
// Set environment variable
process.env.SERPER_API_KEY = 'your-key';

// Use without connector (legacy)
await webSearch.execute({
  query: 'search term',
  provider: 'serper',  // 'serper' | 'brave' | 'tavily'
  numResults: 10
});
```

### Best Practices

1. **Use Connectors** - Preferred over environment variables
2. **Setup Backup Keys** - For production resilience
3. **Monitor Metrics** - Track usage and performance
4. **Cache Results** - Reduce API costs by caching
5. **Handle Errors** - Always check `results.success`
6. **Respect Rate Limits** - Each provider has different limits

### Error Handling

```typescript
const results = await search.search('query');

if (!results.success) {
  console.error('Search failed:', results.error);

  // Check error type
  if (results.error?.includes('API key')) {
    console.error('Authentication failed - check API key');
  } else if (results.error?.includes('429')) {
    console.error('Rate limit exceeded - try backup connector');
  } else if (results.error?.includes('timeout')) {
    console.error('Request timed out - increase timeout setting');
  }
} else {
  console.log(`Success: ${results.count} results`);
}
```

---

## Web Scraping

The library provides enterprise web scraping with automatic fallback chains and bot protection bypass.

### Quick Start

```typescript
import { Connector, ScrapeProvider, Services } from '@oneringai/agents';

// Create ZenRows connector
Connector.create({
  name: 'zenrows',
  serviceType: Services.Zenrows,
  auth: { type: 'api_key', apiKey: process.env.ZENROWS_API_KEY! },
  baseURL: 'https://api.zenrows.com/v1',
});

// Create scrape provider
const scraper = ScrapeProvider.create({ connector: 'zenrows' });

// Scrape a URL
const result = await scraper.scrape('https://example.com', {
  includeMarkdown: true,
  includeLinks: true,
});

if (result.success) {
  console.log(result.result?.title);
  console.log(result.result?.content);
  console.log(result.finalUrl);
}
```

### ZenRows Provider

ZenRows provides enterprise-grade scraping with:
- JavaScript rendering for SPAs
- Premium proxies (residential IPs)
- Anti-bot and CAPTCHA bypass
- Markdown conversion
- Screenshot capture

```typescript
import { ScrapeProvider, ZenRowsOptions } from '@oneringai/agents';

const scraper = ScrapeProvider.create({ connector: 'zenrows' });

// Full control with ZenRows options
const result = await scraper.scrape('https://protected-site.com', {
  includeMarkdown: true,
  includeScreenshot: true,
  vendorOptions: {
    jsRender: true,           // Enable JS rendering (default: true)
    premiumProxy: true,       // Use residential IPs (default: true)
    wait: 5000,               // Wait 5s before scraping
    waitFor: '.content',      // Wait for CSS selector
    device: 'mobile',         // Mobile user agent
    proxyCountry: 'us',       // Use US proxies
    autoparse: true,          // Auto-structure data
  } as ZenRowsOptions,
});
```

### Using webScrape Tool with Agent

The webScrape tool provides guaranteed URL reading with automatic fallback:

```typescript
import { Agent, webScrape } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [webScrape],
});

// Agent uses automatic fallback: native → JS → API
await agent.run('Scrape https://example.com and summarize');
```

### Scraping Strategies

The webScrape tool supports different strategies:

```typescript
await webScrape.execute({
  url: 'https://example.com',
  strategy: 'auto',           // 'auto' | 'native' | 'js' | 'api' | 'api-first'
  connectorName: 'zenrows',   // Optional: specify API connector
  minQualityScore: 50,        // Minimum quality score to accept
  includeMarkdown: true,      // Convert to markdown
  includeLinks: true,         // Extract links
  waitForSelector: '.main',   // Wait for selector (JS/API only)
});
```

**Strategy Options:**
- `auto` (default) - Tries native → JS → API until one succeeds
- `native` - Only native HTTP fetch (fast, free, static sites only)
- `js` - Only JavaScript rendering (handles SPAs, needs Puppeteer)
- `api` - Only external API provider (handles bot protection)
- `api-first` - Tries API first, then falls back to native

### Best Practices

1. **Start with `auto` strategy** - Let the tool figure out the best approach
2. **Use API for protected sites** - ZenRows handles bot protection
3. **Set quality thresholds** - Increase `minQualityScore` for better content
4. **Request markdown** - Cleaner output for LLM processing
5. **Handle errors** - Check `result.success` and `result.error`

---

## Streaming

### Basic Streaming

```typescript
import { Agent, isOutputTextDelta } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
});

// Stream response
for await (const event of agent.stream('Tell me a story')) {
  if (isOutputTextDelta(event)) {
    process.stdout.write(event.delta);
  }
}
```

### Stream Helpers

```typescript
import { StreamHelpers } from '@oneringai/agents';

// Text only (filters to just text deltas)
for await (const text of StreamHelpers.textOnly(agent.stream('Hello'))) {
  process.stdout.write(text);
}

// All events
for await (const event of agent.stream('Hello')) {
  switch (event.type) {
    case 'response_created':
      console.log('🔄 Starting...');
      break;

    case 'output_text_delta':
      process.stdout.write(event.delta);
      break;

    case 'tool_call_start':
      console.log(`\n🔧 Calling ${event.toolName}...`);
      break;

    case 'tool_execution_done':
      console.log(`✅ Tool complete`);
      break;

    case 'response_complete':
      console.log('\n✓ Done');
      break;

    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

### Streaming with Tools

```typescript
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [weatherTool, calculatorTool],
});

for await (const event of agent.stream('What is the weather in Paris?')) {
  if (event.type === 'tool_call_start') {
    console.log(`🔧 Calling ${event.toolName}...`);
  }

  if (event.type === 'tool_execution_done') {
    console.log(`✅ Tool result: ${JSON.stringify(event.result)}`);
  }

  if (event.type === 'output_text_delta') {
    process.stdout.write(event.delta);
  }
}
```

---

## External API Integration

Connect your AI agents to 35+ external services with enterprise-grade resilience. The library provides both connector-based tools and direct fetch capabilities.

### Overview

External API integration uses the **Connector-First Architecture** - the same pattern used for AI providers. This means:
- Single source of truth for authentication
- Built-in resilience (retry, timeout, circuit breaker)
- Automatic tool generation for any service

### Quick Start

```typescript
import { Connector, ConnectorTools, Services, Agent } from '@oneringai/agents';

// 1. Create a connector for an external service
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
});

// 2. Generate tools from the connector
const tools = ConnectorTools.for('github');

// 3. Use with an agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: tools,
});

// 4. Agent can now call the GitHub API
await agent.run('List all open issues in owner/repo');
```

### Connector Configuration

#### Basic Configuration

```typescript
Connector.create({
  name: 'slack',
  serviceType: Services.Slack,  // Optional: explicit service type
  auth: { type: 'api_key', apiKey: process.env.SLACK_TOKEN! },
  baseURL: 'https://slack.com/api',
});
```

#### Enterprise Resilience Features

```typescript
Connector.create({
  name: 'stripe',
  serviceType: Services.Stripe,
  auth: { type: 'api_key', apiKey: process.env.STRIPE_SECRET_KEY! },
  baseURL: 'https://api.stripe.com/v1',

  // Timeout
  timeout: 30000,  // 30 seconds (default)

  // Retry with exponential backoff
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableStatuses: [429, 500, 502, 503, 504],
  },

  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,      // Open after 5 failures
    successThreshold: 2,      // Close after 2 successes
    resetTimeoutMs: 60000,    // Try again after 60s
  },

  // Logging
  logging: {
    enabled: true,
    logBody: false,           // Don't log request/response bodies
    logHeaders: false,        // Don't log headers
  },
});
```

### Supported Services (35+)

The library includes built-in definitions for 35+ popular services:

| Category | Services |
|----------|----------|
| **Communication** | Slack, Discord, Microsoft Teams, Twilio, Zoom |
| **Development** | GitHub, GitLab, Jira, Linear, Bitbucket, CircleCI |
| **Productivity** | Notion, Asana, Monday, Airtable, Trello, Confluence |
| **CRM** | Salesforce, HubSpot, Zendesk, Intercom, Freshdesk |
| **Payments** | Stripe, PayPal, Square, Braintree |
| **Cloud** | AWS, Azure, GCP, DigitalOcean, Vercel, Netlify |
| **Storage** | Dropbox, Box, Google Drive, OneDrive |
| **Email** | SendGrid, Mailchimp, Mailgun, Postmark |
| **Monitoring** | Datadog, PagerDuty, Sentry, New Relic |

```typescript
import { Services, getServiceInfo, getServicesByCategory } from '@oneringai/agents';

// Use service constants
Connector.create({
  name: 'my-slack',
  serviceType: Services.Slack,  // Type-safe
  // ...
});

// Get service metadata
const info = getServiceInfo('slack');
console.log(info?.name);        // 'Slack'
console.log(info?.category);    // 'communication'
console.log(info?.docsURL);     // 'https://api.slack.com/methods'
console.log(info?.commonScopes); // ['chat:write', 'channels:read', ...]

// Filter by category
const devServices = getServicesByCategory('development');
// Returns: github, gitlab, jira, linear, bitbucket, ...
```

### Using Connector.fetch()

For direct API calls without tools:

```typescript
const connector = Connector.get('github');

// Basic fetch
const response = await connector.fetch('/repos/owner/repo/issues', {
  method: 'GET',
  queryParams: { state: 'open', per_page: '10' },
});

// JSON helper with automatic parsing
const issues = await connector.fetchJSON<Issue[]>('/repos/owner/repo/issues');

// POST with body
const newIssue = await connector.fetchJSON('/repos/owner/repo/issues', {
  method: 'POST',
  body: {
    title: 'New Issue',
    body: 'Issue description',
    labels: ['bug'],
  },
});

// Per-request options
const urgent = await connector.fetch('/chat.postMessage', {
  method: 'POST',
  body: { channel: 'C123', text: 'Urgent!' },
  timeout: 5000,           // Override timeout
  skipRetry: true,         // Skip retry for this request
  skipCircuitBreaker: true, // Bypass circuit breaker
});
```

### ConnectorTools API

#### Generate Tools for a Connector

```typescript
import { ConnectorTools } from '@oneringai/agents';

// Get all tools for a connector (generic API + any registered service tools)
const tools = ConnectorTools.for('github');
const tools = ConnectorTools.for(connector);  // Can pass instance too

// Get only the generic API tool
const apiTool = ConnectorTools.genericAPI('github');

// Custom tool name
const customTool = ConnectorTools.genericAPI('github', {
  toolName: 'github_api',
});
```

#### The Generic API Tool

Every connector with a `baseURL` gets a generic API tool that allows the agent to make any API call:

```typescript
// Tool schema:
{
  name: 'github_api',  // {connectorName}_api
  description: 'Make API requests to api.github.com',
  parameters: {
    method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    endpoint: { type: 'string' },          // e.g., '/repos/owner/repo'
    queryParams: { type: 'object' },       // Optional query parameters
    body: { type: 'object' },              // Optional request body
    headers: { type: 'object' },           // Optional headers (auth protected)
  }
}
```

**Security:** Authorization headers cannot be overridden by the agent.

#### Register Custom Service Tools

For frequently-used operations, register service-specific tools:

```typescript
import { ConnectorTools, ToolFunction } from '@oneringai/agents';

// Register tools for a service type
ConnectorTools.registerService('slack', (connector) => {
  const listChannels: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'slack_list_channels',
        description: 'List all Slack channels',
        parameters: {
          type: 'object',
          properties: {
            types: {
              type: 'string',
              description: 'Filter by channel types',
              enum: ['public_channel', 'private_channel'],
            },
            limit: { type: 'number', description: 'Max results' },
          },
        },
      },
    },
    execute: async (args) => {
      return connector.fetchJSON('/conversations.list', {
        queryParams: { types: args.types, limit: String(args.limit || 100) },
      });
    },
    describeCall: (args) => `List ${args.types || 'all'} channels`,
  };

  const postMessage: ToolFunction = {
    definition: {
      type: 'function',
      function: {
        name: 'slack_post_message',
        description: 'Post a message to a Slack channel',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID' },
            text: { type: 'string', description: 'Message text' },
          },
          required: ['channel', 'text'],
        },
      },
    },
    execute: async (args) => {
      return connector.fetchJSON('/chat.postMessage', {
        method: 'POST',
        body: { channel: args.channel, text: args.text },
      });
    },
    describeCall: (args) => `Post to ${args.channel}`,
    permission: { riskLevel: 'medium', scope: 'session' },
  };

  return [listChannels, postMessage];
});

// Now ConnectorTools.for('slack-connector') returns both generic + custom tools
```

#### Discover All Connectors

```typescript
// Get tools for all connectors with serviceType
const allTools = ConnectorTools.discoverAll();
// Returns: Map<connectorName, ToolFunction[]>

for (const [name, tools] of allTools) {
  console.log(`${name}: ${tools.length} tools`);
}

// Find connector by service type
const slackConnector = ConnectorTools.findConnector(Services.Slack);

// Find all connectors for a service type
const allSlackConnectors = ConnectorTools.findConnectors(Services.Slack);

// Check if service has custom tools
if (ConnectorTools.hasServiceTools('slack')) {
  // ...
}

// List all services with custom tools registered
const services = ConnectorTools.listSupportedServices();
```

### Service Detection

Services are detected from URL patterns or explicit `serviceType`:

```typescript
import { detectServiceFromURL, Services } from '@oneringai/agents';

// Automatic detection from URL
detectServiceFromURL('https://api.github.com/repos');     // 'github'
detectServiceFromURL('https://slack.com/api/chat');       // 'slack'
detectServiceFromURL('https://api.stripe.com/v1');        // 'stripe'
detectServiceFromURL('https://company.atlassian.net');    // 'jira'

// Explicit serviceType takes precedence
Connector.create({
  name: 'custom',
  serviceType: Services.Jira,                        // Explicit
  baseURL: 'https://api.github.com',                 // Ignored for detection
});
```

### Metrics and Monitoring

```typescript
const connector = Connector.get('github');

// Get metrics
const metrics = connector.getMetrics();
console.log(`Requests: ${metrics.requestCount}`);
console.log(`Success: ${metrics.successCount}`);
console.log(`Failures: ${metrics.failureCount}`);
console.log(`Avg Latency: ${metrics.avgLatencyMs}ms`);
console.log(`Circuit: ${metrics.circuitBreakerState}`);

// Reset circuit breaker manually
connector.resetCircuitBreaker();

// Check if connector is disposed
if (connector.isDisposed()) {
  // Recreate connector
}
```

### Complete Example

```typescript
import { Connector, ConnectorTools, Services, Agent, Vendor } from '@oneringai/agents';

// Setup AI connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! },
});

// Setup GitHub connector with resilience
Connector.create({
  name: 'github',
  serviceType: Services.Github,
  auth: { type: 'api_key', apiKey: process.env.GITHUB_TOKEN! },
  baseURL: 'https://api.github.com',
  timeout: 15000,
  retry: { maxRetries: 2, baseDelayMs: 500 },
  circuitBreaker: { enabled: true, failureThreshold: 3 },
});

// Setup Slack connector
Connector.create({
  name: 'slack',
  serviceType: Services.Slack,
  auth: { type: 'api_key', apiKey: process.env.SLACK_TOKEN! },
  baseURL: 'https://slack.com/api',
});

// Create agent with external API tools
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [
    ...ConnectorTools.for('github'),
    ...ConnectorTools.for('slack'),
  ],
});

// Agent can now interact with both services
await agent.run(`
  Check if there are any critical issues in owner/repo,
  and if so, post a summary to the #alerts Slack channel.
`);
```

---

## OAuth for External APIs

The library includes full OAuth 2.0 support for external APIs.

### Basic OAuth Setup

```typescript
import { OAuthManager, FileStorage } from '@oneringai/agents';

const oauth = new OAuthManager({
  flow: 'authorization_code',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  redirectUri: 'http://localhost:3000/callback',
  scope: 'repo user',

  // Token storage
  storage: new FileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY,
  }),
});

// Start OAuth flow
const authUrl = await oauth.startAuthFlow('user-123');
console.log('Visit:', authUrl);

// After user authorizes and you receive the code:
const token = await oauth.handleCallback('user-123', code);

// Use token
const userToken = await oauth.getToken('user-123');
```

### Authenticated Fetch

```typescript
import { createAuthenticatedFetch } from '@oneringai/agents';

// Create connector for external API
Connector.create({
  name: 'github',
  vendor: Vendor.Custom,
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    accessToken: userToken.access_token,
    refreshToken: userToken.refresh_token,
    expiresAt: userToken.expires_at,
  },
});

// Create authenticated fetch
const githubFetch = createAuthenticatedFetch('github');

// Make API calls (automatically refreshes tokens)
const response = await githubFetch('https://api.github.com/user/repos');
const repos = await response.json();
```

### OAuth as a Connector

```typescript
// Create connector with OAuth
Connector.create({
  name: 'microsoft-graph',
  vendor: Vendor.Custom,
  baseURL: 'https://graph.microsoft.com/v1.0',
  auth: {
    type: 'oauth',
    flow: 'authorization_code',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  },
});

// Use in tools
const listEmailsTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'list_emails',
      description: 'List user emails',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  execute: async () => {
    const fetch = createAuthenticatedFetch('microsoft-graph');
    const response = await fetch('/me/messages');
    return await response.json();
  },
};

// Use with agent
const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [listEmailsTool],
});

await agent.run('Show me my recent emails');
```

---

## Model Registry

The library includes a comprehensive model registry with metadata for 23+ models.

### Using the Model Registry

```typescript
import {
  getModelInfo,
  calculateCost,
  getModelsByVendor,
  getActiveModels,
  LLM_MODELS,
  Vendor,
} from '@oneringai/agents';

// Get model information
const model = getModelInfo('gpt-5.2-thinking');
console.log(model.vendor);                    // 'openai'
console.log(model.features.input.tokens);     // 400000
console.log(model.features.output.tokens);    // 128000
console.log(model.features.reasoning);        // true
console.log(model.features.vision);           // true
console.log(model.features.input.cpm);        // 1.75 (cost per million)
console.log(model.features.output.cpm);       // 14

// Calculate API costs
const cost = calculateCost('gpt-5.2-thinking', 50000, 2000);
console.log(`Cost: $${cost}`); // $0.1155

// With caching (90% discount)
const cachedCost = calculateCost('gpt-5.2-thinking', 50000, 2000, {
  useCachedInput: true
});
console.log(`Cached: $${cachedCost}`); // $0.0293

// Get all models for a vendor
const openaiModels = getModelsByVendor(Vendor.OpenAI);
console.log(openaiModels.map(m => m.name));
// ['gpt-5.2-thinking', 'gpt-5.2-instant', 'gpt-5.1', ...]

// Get all active models
const activeModels = getActiveModels();
console.log(activeModels.length); // 23

// Use model constants
const model = LLM_MODELS[Vendor.OpenAI].GPT_5_2_THINKING;
console.log(model); // 'gpt-5.2-thinking'
```

### Model Information

```typescript
interface ILLMDescription {
  name: string;
  vendor: string;
  releaseDate: string;
  knowledgeCutoff?: string;
  active: boolean;

  features: {
    input: {
      tokens: number;
      cpm: number;
      cachedCpm?: number;
    };
    output: {
      tokens: number;
      cpm: number;
    };

    // Feature flags
    reasoning: boolean;
    streaming: boolean;
    structuredOutput: boolean;
    functionCalling: boolean;
    vision: boolean;
    audio: boolean;
    video: boolean;
    extendedThinking: boolean;
    batchAPI: boolean;
    promptCaching: boolean;
  };
}
```

### Available Models

**OpenAI (11 models):**
- GPT-5.2: thinking, instant, pro, codex
- GPT-5: standard, 5.1, mini, nano
- GPT-4.1: standard, mini
- o3-mini

**Anthropic (5 models):**
- Claude 4.5: Opus, Sonnet, Haiku
- Claude 4.x: Opus 4.1, Sonnet 4

**Google (7 models):**
- Gemini 3: Flash preview, Pro, Pro Image
- Gemini 2.5: Pro, Flash, Flash-Lite, Flash Image

---

## Advanced Features

### Hooks & Lifecycle Events

Intercept and modify agent behavior:

```typescript
import { Agent, HookManager } from '@oneringai/agents';

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [myTool],
});

// Create hook manager
const hooks = new HookManager();

// Before tool execution
hooks.registerHook('before:tool', async (context) => {
  console.log(`Calling ${context.tool.name}`);

  // Modify arguments
  return {
    ...context.args,
    modified: true,
  };
});

// After tool execution
hooks.registerHook('after:tool', async (context) => {
  console.log(`Result: ${JSON.stringify(context.result)}`);

  // Modify result
  return {
    ...context.result,
    timestamp: Date.now(),
  };
});

// Approve tool (require confirmation)
hooks.registerHook('approve:tool', async (context) => {
  console.log(`Approve ${context.tool.name}?`);

  // Could ask user for confirmation
  return {
    approved: true,
    message: 'Approved',
  };
});

// Apply hooks to agent
agent.applyHooks(hooks);
```

### Circuit Breaker

Protect external services:

```typescript
import { CircuitBreaker } from '@oneringai/agents';

const breaker = new CircuitBreaker({
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 2,        // Close after 2 successes
  timeout: 5000,              // 5 second timeout
  resetTimeout: 30000,        // Try again after 30 seconds
});

// Wrap API calls
const result = await breaker.execute(async () => {
  return await externalAPI.call();
});

// Monitor state
breaker.on('stateChange', ({ from, to }) => {
  console.log(`Circuit: ${from} → ${to}`);
});

// Get metrics
const metrics = breaker.getMetrics();
console.log(metrics);
// {
//   state: 'closed',
//   failures: 0,
//   successes: 10,
//   totalCalls: 10,
//   consecutiveFailures: 0
// }
```

### Retry with Backoff

```typescript
import { retryWithBackoff } from '@oneringai/agents';

const result = await retryWithBackoff(
  async () => {
    // Your operation
    return await apiCall();
  },
  {
    maxAttempts: 5,
    initialDelay: 1000,     // Start with 1 second
    maxDelay: 30000,        // Cap at 30 seconds
    backoffFactor: 2,       // Double each time
    jitter: true,           // Add randomness
  }
);
```

### Logging

```typescript
import { logger } from '@oneringai/agents';

// Set log level
logger.setLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'

// Log messages
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Structured logging
logger.info('User action', { userId: '123', action: 'login' });
```

### Metrics

```typescript
import { metrics, setMetricsCollector, ConsoleMetrics } from '@oneringai/agents';

// Use console metrics
setMetricsCollector(new ConsoleMetrics());

// Track metrics
metrics.counter('requests', 1, { endpoint: '/api/chat' });
metrics.gauge('active_connections', 42);
metrics.histogram('response_time', 125.5, { endpoint: '/api/chat' });

// Custom metrics collector
class CustomMetrics {
  counter(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }

  gauge(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }

  histogram(name: string, value: number, tags?: Record<string, string>) {
    // Send to your metrics service
  }
}

setMetricsCollector(new CustomMetrics());
```

---

## Production Deployment

### Environment Variables

```env
# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# OAuth (32-byte hex key)
OAUTH_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789

# Optional: Base URLs for proxies
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Optional: Timeouts
REQUEST_TIMEOUT=30000
```

### Error Handling

```typescript
import {
  Agent,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  ToolExecutionError,
} from '@oneringai/agents';

const agent = Agent.create({ connector: 'openai', model: 'gpt-4' });

try {
  const response = await agent.run('Hello');
} catch (error) {
  if (error instanceof ProviderAuthError) {
    console.error('Authentication failed:', error.message);
    // Check API key
  } else if (error instanceof ProviderRateLimitError) {
    console.error('Rate limit exceeded:', error.message);
    // Retry with backoff
  } else if (error instanceof ProviderContextLengthError) {
    console.error('Context too long:', error.message);
    // Use context management
  } else if (error instanceof ToolExecutionError) {
    console.error('Tool failed:', error.message);
    // Handle tool error
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Best Practices

#### 1. Use Named Connectors

```typescript
// Good: Named connectors
Connector.create({ name: 'openai-main', vendor: Vendor.OpenAI, auth: { ... } });
Connector.create({ name: 'openai-backup', vendor: Vendor.OpenAI, auth: { ... } });

const agent = Agent.create({ connector: 'openai-main', model: 'gpt-4' });

// Bad: Passing keys directly
const agent = Agent.create({
  connector: { vendor: Vendor.OpenAI, auth: { apiKey: '...' } },
  model: 'gpt-4'
});
```

#### 2. Handle Rate Limits

```typescript
import { retryWithBackoff } from '@oneringai/agents';

const response = await retryWithBackoff(
  () => agent.run(input),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffFactor: 2,
  }
);
```

#### 3. Monitor Context Usage

```typescript
// For TaskAgent
agent.on('memory:limit_warning', ({ utilization }) => {
  console.warn(`Memory at ${utilization}%`);
  // Alert operations team
});

// For manual context management
contextManager.on('budget_critical', ({ budget }) => {
  console.error(`Context critical: ${budget.utilizationPercent}%`);
  // Take action
});
```

#### 4. Use Circuit Breakers

```typescript
import { CircuitBreaker } from '@oneringai/agents';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
});

const safeTool: ToolFunction = {
  // ...
  execute: async (args) => {
    return await breaker.execute(() => externalAPI.call(args));
  },
};
```

#### 5. Secure OAuth Tokens

```typescript
// Always use encryption for OAuth tokens
const oauth = new OAuthManager({
  // ...
  storage: new FileStorage({
    directory: './tokens',
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY, // Required!
  }),
});
```

#### 6. Clean Up Resources

```typescript
// Basic agents
const agent = Agent.create({ ... });
agent.onCleanup(() => {
  console.log('Cleaning up...');
});
agent.destroy();

// Task agents
const taskAgent = TaskAgent.create({ ... });
await taskAgent.destroy();
```

### Performance Tips

1. **Use appropriate models:**
   - GPT-3.5/Claude Haiku for simple tasks
   - GPT-4/Claude Sonnet for complex tasks
   - GPT-4-turbo/Claude Opus for critical tasks

2. **Leverage caching:**
   - Tool idempotency for TaskAgents
   - Prompt caching (Anthropic/OpenAI)

3. **Use streaming:**
   - Better user experience
   - Lower perceived latency

4. **Manage context:**
   - Use aggressive strategy for long conversations
   - Use rolling window for real-time agents
   - Use adaptive strategy for production

5. **Batch requests:**
   - Use parallel tasks in TaskAgents
   - Batch API calls where possible

---

## Examples

### Complete Examples

See the `examples/` directory:

```bash
# Basic examples
npm run example:basic              # Simple text generation
npm run example:streaming          # Streaming responses
npm run example:vision             # Image analysis
npm run example:tools              # Tool calling

# Task Agent examples
npm run example:task-agent         # Basic task agent
npm run example:task-agent-demo    # Full demo with memory
npm run example:planning-agent     # AI-driven planning

# Context management
npm run example:context-management # All strategies
```

### Quick Recipes

#### Multi-Provider Setup

```typescript
// Configure all providers
Connector.create({ name: 'openai', vendor: Vendor.OpenAI, auth: { ... } });
Connector.create({ name: 'anthropic', vendor: Vendor.Anthropic, auth: { ... } });
Connector.create({ name: 'google', vendor: Vendor.Google, auth: { ... } });

// Create agents for each
const openaiAgent = Agent.create({ connector: 'openai', model: 'gpt-4' });
const claudeAgent = Agent.create({ connector: 'anthropic', model: 'claude-opus-4-5-20251101' });
const geminiAgent = Agent.create({ connector: 'google', model: 'gemini-3-flash-preview' });

// Compare responses
const [r1, r2, r3] = await Promise.all([
  openaiAgent.run(prompt),
  claudeAgent.run(prompt),
  geminiAgent.run(prompt),
]);
```

#### RAG (Retrieval-Augmented Generation)

```typescript
const searchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search internal knowledge base',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  execute: async (args) => {
    // Search your vector database
    const results = await vectorDB.search(args.query);
    return { results };
  },
};

const agent = Agent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [searchTool],
  instructions: `You are a helpful assistant with access to a knowledge base.
                 Always search the knowledge base before answering questions.`,
});

const response = await agent.run('What is our return policy?');
```

#### Autonomous Research Agent

```typescript
const taskAgent = TaskAgent.create({
  connector: 'openai',
  model: 'gpt-4',
  tools: [searchTool, scrapeWebTool, summarizeTool],
});

await taskAgent.start({
  goal: 'Research competitors and create a report',
  tasks: [
    {
      name: 'identify_competitors',
      description: 'Search for and identify top 5 competitors',
    },
    {
      name: 'gather_data',
      description: 'For each competitor, scrape their website and gather key information',
      dependsOn: ['identify_competitors'],
    },
    {
      name: 'analyze',
      description: 'Analyze competitive advantages and weaknesses',
      dependsOn: ['gather_data'],
    },
    {
      name: 'create_report',
      description: 'Create a comprehensive markdown report with findings',
      dependsOn: ['analyze'],
    },
  ],
});
```

---

## Support & Resources

- **GitHub:** https://github.com/anthropics/oneringai
- **Issues:** https://github.com/anthropics/oneringai/issues
- **Examples:** `/examples` directory in repo
- **TypeScript Docs:** Full IntelliSense support

---

## License

MIT License - see LICENSE file for details.

---

**Last Updated:** 2026-01-28
**Version:** 0.2.0
