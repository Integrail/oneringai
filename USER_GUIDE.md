# @oneringai/agents - Complete User Guide

**Version:** 0.2.0
**Last Updated:** 2026-01-24

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
8. [Task Agents](#task-agents)
9. [Context Management](#context-management)
10. [Tools & Function Calling](#tools--function-calling)
11. [Dynamic Tool Management](#dynamic-tool-management)
12. [Multimodal (Vision)](#multimodal-vision)
13. [Audio (TTS/STT)](#audio-ttsstt) **NEW**
14. [Streaming](#streaming)
15. [OAuth for External APIs](#oauth-for-external-apis)
16. [Model Registry](#model-registry)
17. [Advanced Features](#advanced-features)
18. [Production Deployment](#production-deployment)

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

TaskAgents are **autonomous agents** that execute complex, multi-step plans with:
- **Working Memory** - Store and retrieve data across tasks
- **Context Management** - Automatic handling of context limits
- **External Dependencies** - Wait for webhooks, polling, manual input
- **State Persistence** - Resume after crashes or long waits
- **Tool Idempotency** - Prevent duplicate side effects

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
      dependsOn: ['fetch_weather'], // Run after fetch_weather
    },
  ],
});

// Wait for completion
const result = await handle.wait();
console.log(`Status: ${result.status}`);
console.log(`Completed ${result.metrics.completedTasks}/${result.metrics.totalTasks} tasks`);
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

### Working Memory

TaskAgents have indexed working memory that the agent can use to store and retrieve data:

```typescript
// The agent automatically has access to memory tools:
// - memory_store(key, description, value)
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

```typescript
// Task-scoped memory (cleared after task completes)
memory_store({
  key: 'temp.calculation',
  description: 'Intermediate result',
  value: 12345,
  scope: 'task',
});

// Persistent memory (survives across tasks)
memory_store({
  key: 'user.session',
  description: 'Session token',
  value: 'token-xyz',
  scope: 'persistent',
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

```typescript
{
  name: 'wait_for_job',
  description: 'Wait for batch job to complete',
  externalDependency: {
    type: 'poll',
    pollConfig: {
      toolName: 'check_job_status',
      toolArgs: { jobId: 'job-456' },
      intervalMs: 30000,  // Poll every 30 seconds
      maxAttempts: 60,    // Max 30 minutes
    },
    state: 'waiting',
  },
}
```

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

### Tool Idempotency

Prevent duplicate side effects when tools are called multiple times:

```typescript
import { ToolFunction } from '@oneringai/agents';

// Safe tool (naturally idempotent)
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
    safe: true, // GET requests, pure functions
  },
};

// Non-safe tool with caching
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
    safe: false,
    keyFn: (args) => `email:${args.to}:${args.subject}`, // Custom cache key
    ttlMs: 3600000, // Cache for 1 hour
  },
};

// If agent calls sendEmailTool twice with same args within 1 hour:
// - First call: Email sent
// - Second call: Returns cached result, no duplicate email
```

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

---

## Context Management

The library includes a universal context management system that works with any agent type.

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
// 1. Track context usage
// 2. Compact when approaching limits
// 3. Evict memory when needed
// 4. Truncate tool outputs
// 5. Summarize history
```

### Manual Context Management

For advanced use cases, use the `ContextManager` directly:

```typescript
import {
  ContextManager,
  TaskAgentContextProvider,
  ApproximateTokenEstimator,
  TruncateCompactor,
  MemoryEvictionCompactor,
} from '@oneringai/agents';

// Create context provider
const provider = new TaskAgentContextProvider({
  model: 'gpt-4',
  instructions: 'Your instructions',
  plan: yourPlan,
  memory: workingMemory,
  historyManager: historyManager,
  currentInput: 'Current task',
});

// Create estimator
const estimator = new ApproximateTokenEstimator();

// Create compactors
const compactors = [
  new TruncateCompactor(estimator),
  new MemoryEvictionCompactor(estimator),
];

// Create context manager with strategy
const contextManager = new ContextManager(
  provider,
  {
    maxContextTokens: 128000,
    compactionThreshold: 0.75,  // Compact at 75%
    hardLimit: 0.9,             // Must compact before 90%
    responseReserve: 0.15,      // Reserve 15% for response
    autoCompact: true,
    strategy: 'proactive',      // Compaction strategy
  },
  compactors,
  estimator
);

// Use before LLM call
const prepared = await contextManager.prepare();
console.log(`Context: ${prepared.budget.used}/${prepared.budget.total} tokens`);

// Make LLM call
const response = await agent.run(input);
```

### Context Strategies

Five built-in strategies for different use cases:

#### 1. Proactive (Default)

Balanced approach for general use:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'proactive',
  compactionThreshold: 0.75,  // Compact at 75%
}, compactors, estimator);

// Best for: General purpose agents
```

#### 2. Aggressive

Early compaction for long-running agents:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'aggressive',
  strategyOptions: {
    threshold: 0.55,  // Compact at 55%
    target: 0.45,     // Target 45% utilization
  },
}, compactors, estimator);

// Best for: Long conversations, limited context
```

#### 3. Lazy

Minimal compaction, preserve context:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'lazy',
}, compactors, estimator);

// Best for: High-context models, short tasks
// Only compacts when critical (>90%)
```

#### 4. Rolling Window

Fixed-size window, no compaction overhead:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'rolling-window',
  strategyOptions: {
    maxMessages: 20,  // Keep last 20 messages only
  },
}, compactors, estimator);

// Best for: Real-time agents, streaming conversations
```

#### 5. Adaptive

Learns and adapts based on usage:

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'adaptive',
  strategyOptions: {
    learningWindow: 50,     // Learn from last 50 compactions
    switchThreshold: 5,     // Switch if >5 compactions/min
  },
}, compactors, estimator);

// Best for: Production systems, varied workloads
// Automatically switches between proactive/aggressive/lazy
```

### Runtime Strategy Switching

```typescript
const contextManager = new ContextManager(provider, {
  strategy: 'proactive',
}, compactors, estimator);

// Start with proactive
await contextManager.prepare();

// Switch to aggressive for intensive task
contextManager.setStrategy('aggressive');
await contextManager.prepare();

// Switch to adaptive for auto-optimization
contextManager.setStrategy('adaptive');
await contextManager.prepare();

// Monitor strategy changes
contextManager.on('strategy_switched', ({ from, to, reason }) => {
  console.log(`Strategy: ${from} → ${to} (${reason})`);
});
```

### Monitoring Context

```typescript
// Get current budget
const budget = contextManager.getCurrentBudget();
if (budget) {
  console.log(`Used: ${budget.used}/${budget.total} tokens`);
  console.log(`Utilization: ${budget.utilizationPercent.toFixed(1)}%`);
  console.log(`Status: ${budget.status}`); // 'ok', 'warning', 'critical'
}

// Listen to events
contextManager.on('budget_warning', ({ budget }) => {
  console.log(`⚠️ Context at ${budget.utilizationPercent}%`);
});

contextManager.on('budget_critical', ({ budget }) => {
  console.error(`🚨 Context critical: ${budget.utilizationPercent}%`);
});

contextManager.on('compacting', ({ reason, strategy }) => {
  console.log(`Compacting: ${reason} (${strategy})`);
});

contextManager.on('compacted', ({ log, tokensFreed }) => {
  console.log(`Freed ${tokensFreed} tokens`);
  log.forEach(entry => console.log(`  ${entry}`));
});

// Get strategy metrics
const metrics = contextManager.getStrategyMetrics();
console.log('Strategy metrics:', metrics);
```

### Custom Strategies

Create custom compaction strategies:

```typescript
import { IContextStrategy, IContextComponent, ContextBudget } from '@oneringai/agents';

class BusinessHoursStrategy implements IContextStrategy {
  readonly name = 'business-hours';

  shouldCompact(budget: ContextBudget): boolean {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;

    // More aggressive during business hours
    return isBusinessHours
      ? budget.utilizationPercent > 60
      : budget.utilizationPercent > 85;
  }

  async compact(components, budget, compactors, estimator) {
    // Your custom compaction logic
    return { components, log: [], tokensFreed: 0 };
  }
}

// Use custom strategy
const contextManager = new ContextManager(
  provider,
  {},
  compactors,
  estimator,
  new BusinessHoursStrategy()
);
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

**Last Updated:** 2026-01-24
**Version:** 0.2.0
