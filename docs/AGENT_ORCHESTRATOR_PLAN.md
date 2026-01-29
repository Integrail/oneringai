# Agent Orchestrator Architecture Plan

**Status**: Draft
**Created**: 2026-01-29
**Author**: Architecture Discussion

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Components](#4-core-components)
5. [Context & Memory Model](#5-context--memory-model)
6. [Task Routing Pipeline](#6-task-routing-pipeline)
7. [Agent Pool Management](#7-agent-pool-management)
8. [User Communication](#8-user-communication)
9. [Interface Definitions](#9-interface-definitions)
10. [Migration Path](#10-migration-path)
11. [Implementation Phases](#11-implementation-phases)
12. [Open Questions](#12-open-questions)

---

## 1. Motivation

### Current State

- `UniversalAgent` combines different modes (interactive, planning, executing) in a single class
- Adding new agent types (e.g., `ResearchAgent`) requires modifying or extending the class
- No clean way to coordinate multiple agent instances
- No shared context management between agents
- Tight coupling limits flexibility

### Problems with UniversalAgent Approach

| Problem | Impact |
|---------|--------|
| Modes are baked in | Can't add new agent types without code changes |
| Single instance | Can't run parallel agents of same type |
| No context sharing | Agents can't build on each other's work |
| No coordination | No way to route tasks to best agent |
| Monolithic | Testing and maintenance burden |

### Why Orchestrator?

An orchestrator inverts the control: agents register capabilities, orchestrator routes work. This enables:

- **Pluggable agents**: Add new types without modifying orchestrator
- **Multiple instances**: Run 3 ResearchAgents in parallel
- **Shared context**: Agents collaborate through managed memory
- **Smart routing**: Tasks go to the best available agent
- **Centralized communication**: Single point of contact with user

---

## 2. Goals & Non-Goals

### Goals

1. **Coordination**: Manage multiple agent types and instances
2. **Context sharing**: Controlled memory sharing between agents
3. **Smart routing**: Route tasks to appropriate agents (capability + vector + human)
4. **Lifecycle management**: Spawn, monitor, destroy agents
5. **Central communication**: Single interface for user interaction
6. **Scalability**: Support hundreds of agents in large deployments
7. **Backwards compatibility**: Existing agents work with minimal changes
8. **Extensibility**: Easy to add new agent types, routing strategies, memory scopes

### Non-Goals (v1)

1. **Nested orchestrators**: Orchestrator spawning sub-orchestrators (future)
2. **Distributed execution**: Agents on different machines (future)
3. **Agent marketplace**: Dynamic agent discovery/download (future)
4. **Full autonomy**: Orchestrator always has human oversight options

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          AgentOrchestrator                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │
│  │    AgentPool     │  │    TaskRouter    │  │    ScopedMemory       │   │
│  │                  │  │                  │  │                       │   │
│  │ - Type registry  │  │ - Capability DB  │  │ - Global scope        │   │
│  │ - Instance mgmt  │  │ - Vector index   │  │ - Team scopes         │   │
│  │ - Auto-scaling   │  │ - Scoring engine │  │ - Private scopes      │   │
│  │ - Load balancing │  │ - Human hooks    │  │ - Publish/subscribe   │   │
│  └──────────────────┘  └──────────────────┘  └───────────────────────┘   │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │
│  │  UserInterface   │  │   TaskManager    │  │      EventBus         │   │
│  │                  │  │                  │  │                       │   │
│  │ - Message I/O    │  │ - Task queue     │  │ - Broadcast events    │   │
│  │ - Human approval │  │ - Progress track │  │ - Agent-to-agent      │   │
│  │ - Streaming      │  │ - Dependencies   │  │ - Lifecycle events    │   │
│  └──────────────────┘  └──────────────────┘  └───────────────────────┘   │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                           Agent Instances                                │
│                                                                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │ TaskAgent │ │ TaskAgent │ │ Research  │ │ Research  │ │ CodeAgent │  │
│  │    #1     │ │    #2     │ │ Agent #1  │ │ Agent #2  │ │    #1     │  │
│  │           │ │           │ │           │ │           │ │           │  │
│  │ Team:plan │ │ Team:plan │ │Team:rsrch │ │Team:rsrch │ │ Team:code │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Message
     │
     ▼
┌─────────────────┐
│  UserInterface  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   TaskRouter    │────▶│  Human Decision │ (if needed)
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   AgentPool     │──── Select/spawn agent
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Agent Instance │◀───▶│  ScopedMemory   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   TaskManager   │──── Track progress
└────────┬────────┘
         │
         ▼
    User Response
```

---

## 4. Core Components

### 4.1 AgentOrchestrator (Main Class)

The central coordinator. Composes all other components.

**Responsibilities:**
- Initialize and wire components
- Provide unified API for external consumers
- Coordinate component interactions
- Handle top-level error recovery

**Key Methods:**
- `send(message: string)` - Main entry point for user messages
- `delegate(task: Task)` - Route and execute a task
- `spawn(agentType: string)` - Create new agent instance
- `destroy()` - Cleanup all resources

### 4.2 AgentPool

Manages agent type registration and instance lifecycle.

**Responsibilities:**
- Register agent types with factories
- Create/destroy agent instances
- Track instance load and health
- Optional auto-scaling

**Key Concepts:**
- **Agent Type**: A class/factory (e.g., `TaskAgent`, `ResearchAgent`)
- **Agent Instance**: A running instance (e.g., `TaskAgent#1`, `TaskAgent#2`)
- **Agent Factory**: Function that creates instances of a type

### 4.3 TaskRouter

Routes tasks to appropriate agents.

**Responsibilities:**
- Maintain capability database
- Maintain vector index for fuzzy matching
- Score and rank candidate agents
- Request human decision when uncertain

**Routing Pipeline (see Section 6 for details):**
1. Capability Filter (fast, explicit)
2. Vector Search (fuzzy, for large pools)
3. Scoring & Ranking (multi-factor)
4. Human Decision (when confidence low)

### 4.4 ScopedMemory

Hierarchical memory with controlled sharing.

**Responsibilities:**
- Manage memory scopes (global, team, private)
- Control visibility between agents
- Support publish pattern (promote data between scopes)
- Query across scopes with access control

**See Section 5 for detailed memory model.**

### 4.5 TaskManager

Tracks task execution and progress.

**Responsibilities:**
- Maintain task queue
- Track task status and progress
- Handle task dependencies
- Support task cancellation

### 4.6 UserInterface

Central point for user communication.

**Responsibilities:**
- Route messages to/from orchestrator
- Handle human-in-the-loop approvals
- Support streaming responses
- Aggregate multi-agent responses

### 4.7 EventBus

Internal event system for loose coupling.

**Responsibilities:**
- Broadcast lifecycle events (agent spawned, destroyed)
- Support agent-to-agent communication (through events, not direct)
- Enable plugins/extensions to react to events

**Event Types:**
- `agent:spawned`, `agent:destroyed`
- `task:started`, `task:completed`, `task:failed`
- `memory:published` (data promoted to higher scope)
- `routing:human_required`

---

## 5. Context & Memory Model

### 5.1 The Problem

Agents need to share information, but:
- Full sharing creates noise (one agent's drafts pollute others)
- Full isolation loses context (expensive handoffs)
- Need clear ownership (who wrote what?)

### 5.2 Hierarchical Scope Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      GLOBAL SCOPE                               │
│  Visible to: ALL agents                                         │
│  Contains:                                                      │
│    - User conversation history                                  │
│    - Orchestrator-level decisions                               │
│    - Published/approved results                                 │
│    - Shared facts and goals                                     │
├─────────────────────────────────────────────────────────────────┤
│                       TEAM SCOPE                                │
│  Visible to: Agents in the team                                 │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   Team: research    │    │    Team: coding     │             │
│  │                     │    │                     │             │
│  │ - Research findings │    │ - Code changes      │             │
│  │ - Source URLs       │    │ - Test results      │             │
│  │ - Analysis drafts   │    │ - Architecture      │             │
│  │                     │    │                     │             │
│  │ Members:            │    │ Members:            │             │
│  │  - ResearchAgent#1  │    │  - CodeAgent#1      │             │
│  │  - ResearchAgent#2  │    │  - CodeAgent#2      │             │
│  └─────────────────────┘    └─────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                      PRIVATE SCOPE                              │
│  Visible to: Single agent instance only                         │
│  Contains:                                                      │
│    - Draft reasoning                                            │
│    - Failed attempts                                            │
│    - Internal scratch space                                     │
│    - Agent-specific state                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Scope Operations

**Store (write to scope):**
```typescript
memory.global.store(key, value);           // All agents see
memory.team('research').store(key, value); // Research team sees
memory.private(agentId).store(key, value); // Only this agent sees
```

**Query (read from visible scopes):**
```typescript
// Agent sees: own private + own team + global
const results = memory.query(agentId, { pattern: 'user_*' });
```

**Publish (promote between scopes):**
```typescript
// Promote from private to team (after internal validation)
memory.publish('findings',
  { type: 'private', agentId: 'research-1' },
  { type: 'team', teamId: 'research' }
);

// Promote from team to global (after orchestrator approval)
memory.publish('final_report',
  { type: 'team', teamId: 'research' },
  { type: 'global' }
);
```

### 5.4 Memory Contract (Optional Enhancement)

Agents can declare what they read/write for:
- Routing hints (agent needs X, so send tasks that produce X)
- Prefetching (load relevant memory before agent starts)
- Validation (agent shouldn't write to keys it didn't declare)

```typescript
interface AgentMemoryContract {
  reads: string[];   // ['user_goals', 'codebase_*']
  writes: string[];  // ['research_findings', 'source_urls']
}
```

### 5.5 Memory Types to Share

| Memory Type | Typical Scope | Notes |
|-------------|---------------|-------|
| User conversation | Global | All agents need context |
| User goals/intent | Global | Extracted from conversation |
| Task assignments | Global | Who's doing what |
| Research findings | Team → Global | Publish when validated |
| Code changes | Team → Global | Publish when tested |
| Draft reasoning | Private | Never share |
| Failed attempts | Private | Learn but don't pollute |
| API credentials | Private | Security isolation |

---

## 6. Task Routing Pipeline

### 6.1 Overview

Four-stage pipeline that balances speed, accuracy, and human oversight:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ROUTING PIPELINE                               │
│                                                                         │
│  Task ──▶ [Stage 1] ──▶ [Stage 2] ──▶ [Stage 3] ──▶ [Stage 4] ──▶ Agent│
│           Capability    Vector        Scoring       Human               │
│           Filter        Search        & Ranking     Decision            │
│           (fast)        (fuzzy)       (multi)       (if needed)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Stage 1: Capability Filter

**Purpose:** Fast elimination of agents that definitely can't handle the task.

**How it works:**
1. Extract required capabilities from task (keywords, explicit tags)
2. Filter agents whose `handles` array includes at least one match
3. O(n) where n = number of agent types

**Input:**
```typescript
task = {
  description: "Research competitor pricing",
  capabilities: ['research', 'web-search']  // Explicit or extracted
}
```

**Output:**
```typescript
candidates = [ResearchAgent, WebSearchAgent, AnalyticsAgent]
// Filtered out: CodeAgent, TaskAgent (don't handle 'research')
```

**When to use:**
- Always (first stage)
- Fast enough for any pool size

### 6.3 Stage 2: Vector Search

**Purpose:** Fuzzy matching when capabilities are ambiguous or pool is large.

**How it works:**
1. Pre-index agent descriptions as embeddings
2. Embed task description
3. Find k-nearest agents by cosine similarity
4. Return with similarity scores

**When to use:**
- Pool size > 50 agents
- Capability filter returns 0 matches
- Capability filter returns > 10 matches
- Task description is ambiguous

**Implementation options:**
- Local: `transformers.js` with small embedding model
- Remote: OpenAI embeddings API
- Hybrid: Local for common, remote for edge cases

**Output:**
```typescript
vectorResults = [
  { agent: ResearchAgent, similarity: 0.89 },
  { agent: AnalyticsAgent, similarity: 0.84 },
  { agent: WebSearchAgent, similarity: 0.71 }
]
```

### 6.4 Stage 3: Scoring & Ranking

**Purpose:** Combine multiple factors to rank candidates.

**Scoring factors:**

| Factor | Weight | Description |
|--------|--------|-------------|
| capabilityMatch | 0.30 | From stage 1 (binary or count-based) |
| vectorSimilarity | 0.25 | From stage 2 (0-1) |
| agentLoad | 0.15 | Current utilization (prefer idle) |
| historicalSuccess | 0.15 | Past performance on similar tasks |
| contextRecency | 0.10 | Has relevant context already loaded |
| explicitPriority | 0.05 | User/config priority setting |

**Formula:**
```
score = Σ(factor_i × weight_i)
```

**Output:**
```typescript
rankedCandidates = [
  { agent: ResearchAgent#2, score: 0.91, reasons: ['capability match', 'low load'] },
  { agent: AnalyticsAgent#1, score: 0.86, reasons: ['vector similarity'] },
  { agent: ResearchAgent#1, score: 0.78, reasons: ['capability match', 'high load'] }
]
```

### 6.5 Stage 4: Human Decision

**Purpose:** Get human input when routing is uncertain.

**When triggered:**
- Top candidates have similar scores (within threshold, e.g., 0.05)
- Overall confidence below threshold (e.g., < 0.7)
- Task marked as sensitive/important
- User preference for approval on certain task types

**Human decision request:**
```typescript
{
  task: { description: "Analyze Q4 financial data" },
  candidates: [
    { agent: "ResearchAgent#2", score: 0.87, reasons: [...] },
    { agent: "AnalyticsAgent#1", score: 0.85, reasons: [...] }
  ],
  question: "Which agent should handle this task?",
  timeout: 30000,  // Auto-select top after 30s
  default: "ResearchAgent#2"
}
```

**Human response options:**
- Select one of the candidates
- Provide custom instruction ("Use ResearchAgent but focus on...")
- Reject all ("I'll handle this manually")
- Defer ("Let orchestrator decide")

### 6.6 Routing Configuration

```typescript
interface RoutingConfig {
  // Strategy selection
  strategy: 'capability-only' | 'vector-only' | 'hybrid' | 'hybrid-with-human';

  // Thresholds
  vectorSearchThreshold: number;     // Pool size to enable vector (default: 50)
  confidenceThreshold: number;       // Below this, ask human (default: 0.7)
  scoreDifferenceThreshold: number;  // If top scores within this, ask human (default: 0.05)

  // Human approval
  alwaysApproveTaskTypes: string[];  // ['financial', 'sensitive']
  humanApprovalTimeout: number;      // ms before auto-select (default: 30000)

  // Scoring weights (must sum to 1.0)
  weights: {
    capabilityMatch: number;
    vectorSimilarity: number;
    agentLoad: number;
    historicalSuccess: number;
    contextRecency: number;
    explicitPriority: number;
  };
}
```

---

## 7. Agent Pool Management

### 7.1 Agent Type Registration

```typescript
// Register a new agent type
orchestrator.agentPool.registerType({
  type: 'research',
  factory: (config) => new ResearchAgent(config),
  capability: {
    handles: ['research', 'web-search', 'document-analysis'],
    excludes: ['code-execution'],
    description: 'Conducts research using web search and document analysis'
  },
  defaults: {
    team: 'research',
    model: 'gpt-4',
    maxConcurrentTasks: 3
  }
});
```

### 7.2 Instance Lifecycle

```
┌─────────┐     spawn()      ┌─────────┐
│ (none)  │ ───────────────▶ │  IDLE   │
└─────────┘                  └────┬────┘
                                  │
                             task assigned
                                  │
                                  ▼
                             ┌─────────┐
                             │  BUSY   │◀──┐
                             └────┬────┘   │
                                  │        │ new task
                             task done     │
                                  │        │
                                  ▼        │
                             ┌─────────┐───┘
                             │  IDLE   │
                             └────┬────┘
                                  │
                             destroy()
                                  │
                                  ▼
                             ┌─────────┐
                             │DESTROYED│
                             └─────────┘
```

### 7.3 Load Balancing

When multiple instances of same type exist:

```typescript
// Selection strategy
type LoadBalanceStrategy =
  | 'round-robin'      // Simple rotation
  | 'least-loaded'     // Prefer idle/low-load instances
  | 'context-affinity' // Prefer instance with relevant context
  | 'random';          // Random selection
```

### 7.4 Auto-Scaling (Optional)

```typescript
interface AutoScaleConfig {
  enabled: boolean;
  minInstances: number;      // Minimum always running
  maxInstances: number;      // Hard cap
  scaleUpThreshold: number;  // Load % to trigger spawn (e.g., 80%)
  scaleDownThreshold: number; // Load % to trigger destroy (e.g., 20%)
  cooldownMs: number;        // Wait between scale operations
  scaleUpStep: number;       // How many to spawn at once
  scaleDownStep: number;     // How many to destroy at once
}
```

### 7.5 Health Monitoring

```typescript
interface AgentHealth {
  instanceId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  currentLoad: number;         // 0-1
  tasksCompleted: number;
  tasksFailed: number;
  avgResponseTime: number;     // ms
  lastActivity: Date;
  errorRate: number;           // Recent failures / total
}
```

Unhealthy agents can be:
- Restarted automatically
- Removed from routing pool
- Flagged for human review

---

## 8. User Communication

### 8.1 Central Communication Point

All user communication flows through `UserInterface`:

```
User ◀──────────────────────────▶ UserInterface ◀──▶ Orchestrator
                                       │
                                       ├──▶ Agent responses
                                       ├──▶ Progress updates
                                       ├──▶ Approval requests
                                       └──▶ Error notifications
```

### 8.2 Message Types

**Inbound (user → orchestrator):**
- `user_message`: Regular conversation
- `approval_response`: Answer to approval request
- `task_cancel`: Cancel running task
- `preference_update`: Change settings

**Outbound (orchestrator → user):**
- `agent_response`: Response from an agent
- `progress_update`: Task progress notification
- `approval_request`: Need human decision
- `error`: Something went wrong
- `status`: Orchestrator status update

### 8.3 Response Aggregation

When multiple agents contribute to a response:

```typescript
interface AggregatedResponse {
  primary: AgentResponse;        // Main response
  supporting: AgentResponse[];   // Additional context
  metadata: {
    agentsInvolved: string[];
    totalDuration: number;
    tasksCompleted: number;
  };
}
```

### 8.4 Streaming Support

For long-running tasks:

```typescript
interface StreamingResponse {
  type: 'chunk' | 'complete' | 'error';
  agentId: string;
  content: string;
  progress?: number;  // 0-100
}

// Usage
orchestrator.onStream((chunk: StreamingResponse) => {
  console.log(`[${chunk.agentId}] ${chunk.content}`);
});
```

---

## 9. Interface Definitions

### 9.1 IAgentOrchestrator

```typescript
interface IAgentOrchestrator extends IDisposable {
  // Core components (readonly access)
  readonly agentPool: IAgentPool;
  readonly router: ITaskRouter;
  readonly memory: IScopedMemory;
  readonly taskManager: ITaskManager;
  readonly events: IEventBus;

  // User communication
  send(message: string): Promise<OrchestratorResponse>;
  onMessage(handler: (response: OrchestratorResponse) => void): void;
  onStream(handler: (chunk: StreamingResponse) => void): void;

  // Task management
  delegate(task: Task, agentId?: string): Promise<TaskResult>;
  cancelTask(taskId: string): Promise<void>;
  getTaskStatus(taskId: string): TaskStatus;

  // Agent management (convenience methods)
  spawn(type: string, config?: Partial<AgentConfig>): IAgent;
  getAgent(id: string): IAgent | undefined;
  listAgents(filter?: AgentFilter): AgentInfo[];

  // Configuration
  configure(config: Partial<OrchestratorConfig>): void;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): void;
}
```

### 9.2 IAgentPool

```typescript
interface IAgentPool extends IDisposable {
  // Type registration
  registerType(registration: AgentTypeRegistration): void;
  unregisterType(type: string): void;
  getTypes(): AgentTypeInfo[];

  // Instance management
  spawn(type: string, config?: Partial<AgentConfig>): IAgent;
  spawnMultiple(type: string, count: number): IAgent[];
  destroy(instanceId: string): void;
  destroyType(type: string): void;  // All instances of type

  // Querying
  getInstance(id: string): IAgent | undefined;
  getInstancesByType(type: string): IAgent[];
  getAllInstances(): IAgent[];

  // Load balancing
  selectInstance(type: string, strategy?: LoadBalanceStrategy): IAgent | undefined;
  getLoad(type: string): PoolLoadStats;
  getHealth(instanceId: string): AgentHealth;

  // Auto-scaling
  setAutoScale(type: string, config: AutoScaleConfig): void;
  getAutoScaleConfig(type: string): AutoScaleConfig | undefined;
}

interface AgentTypeRegistration {
  type: string;
  factory: AgentFactory;
  capability: AgentCapability;
  defaults?: Partial<AgentConfig>;
  autoScale?: AutoScaleConfig;
}

interface AgentCapability {
  handles: string[];
  excludes?: string[];
  requirements?: string[];  // e.g., ['internet-access']
  description: string;
  concurrency?: number;     // Max parallel tasks
}

type AgentFactory = (config: AgentConfig) => IAgent | Promise<IAgent>;
```

### 9.3 ITaskRouter

```typescript
interface ITaskRouter {
  // Configuration
  setStrategy(strategy: RoutingStrategy): void;
  setConfig(config: Partial<RoutingConfig>): void;

  // Routing
  route(task: Task): Promise<RoutingDecision>;

  // Capability management
  registerCapability(agentType: string, capability: AgentCapability): void;
  updateCapability(agentType: string, capability: Partial<AgentCapability>): void;

  // Vector index (for large pools)
  indexAgents(agents: AgentTypeInfo[]): Promise<void>;
  reindex(): Promise<void>;

  // Human decision hooks
  onHumanDecisionRequired(handler: HumanDecisionHandler): void;

  // Learning/feedback
  recordOutcome(taskId: string, agentId: string, outcome: TaskOutcome): void;
  getAgentStats(agentType: string): AgentRoutingStats;
}

interface RoutingDecision {
  candidates: RankedCandidate[];
  confidence: number;
  decision: 'auto' | 'human_required' | 'no_match';
  selectedAgent?: IAgent;
  reasoning: string;
}

interface RankedCandidate {
  agent: IAgent;
  agentType: string;
  score: number;
  factors: ScoringFactors;
  reasons: string[];
}

type RoutingStrategy =
  | 'capability-only'
  | 'vector-only'
  | 'hybrid'
  | 'hybrid-with-human';

type HumanDecisionHandler = (
  request: HumanDecisionRequest
) => Promise<HumanDecisionResponse>;
```

### 9.4 IScopedMemory

```typescript
interface IScopedMemory extends IDisposable {
  // Scope access
  global: IMemoryScope;
  team(teamId: string): IMemoryScope;
  private(agentId: string): IMemoryScope;

  // Cross-scope operations
  query(agentId: string, query: MemoryQuery): MemoryEntry[];
  publish(key: string, from: ScopeRef, to: ScopeRef): void;

  // Team management
  createTeam(teamId: string, config?: TeamConfig): void;
  deleteTeam(teamId: string): void;
  addToTeam(agentId: string, teamId: string): void;
  removeFromTeam(agentId: string, teamId: string): void;
  getTeamMembers(teamId: string): string[];

  // Visibility
  canAccess(agentId: string, scope: ScopeRef): boolean;
  getVisibleScopes(agentId: string): ScopeRef[];
}

interface IMemoryScope {
  store(key: string, value: unknown, metadata?: EntryMetadata): void;
  get(key: string): MemoryEntry | undefined;
  query(query: MemoryQuery): MemoryEntry[];
  delete(key: string): void;
  clear(): void;
  keys(): string[];
}

interface ScopeRef {
  type: 'global' | 'team' | 'private';
  teamId?: string;   // Required if type === 'team'
  agentId?: string;  // Required if type === 'private'
}

interface MemoryEntry {
  key: string;
  value: unknown;
  scope: ScopeRef;
  metadata: EntryMetadata;
}

interface EntryMetadata {
  createdBy: string;      // Agent ID
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  ttl?: number;           // Auto-expire after ms
}
```

### 9.5 ITaskManager

```typescript
interface ITaskManager {
  // Task lifecycle
  create(task: Partial<Task>): Task;
  assign(taskId: string, agentId: string): void;
  start(taskId: string): void;
  complete(taskId: string, result: TaskResult): void;
  fail(taskId: string, error: Error): void;
  cancel(taskId: string): void;

  // Querying
  get(taskId: string): Task | undefined;
  list(filter?: TaskFilter): Task[];
  getByAgent(agentId: string): Task[];
  getByStatus(status: TaskStatus): Task[];

  // Dependencies
  addDependency(taskId: string, dependsOn: string): void;
  removeDependency(taskId: string, dependsOn: string): void;
  getDependencies(taskId: string): Task[];
  getDependents(taskId: string): Task[];

  // Progress
  updateProgress(taskId: string, progress: TaskProgress): void;
  onProgress(handler: (taskId: string, progress: TaskProgress) => void): void;
}

interface Task {
  id: string;
  description: string;
  capabilities?: string[];  // Hints for routing
  priority: number;
  status: TaskStatus;
  assignedTo?: string;
  dependencies: string[];
  progress?: TaskProgress;
  result?: TaskResult;
  error?: Error;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

interface TaskProgress {
  percent: number;      // 0-100
  message?: string;
  subTasks?: { total: number; completed: number };
}
```

### 9.6 IEventBus

```typescript
interface IEventBus {
  // Publishing
  emit(event: OrchestratorEvent): void;

  // Subscribing
  on(eventType: string, handler: EventHandler): Unsubscribe;
  once(eventType: string, handler: EventHandler): Unsubscribe;
  off(eventType: string, handler: EventHandler): void;

  // Filtering
  onFrom(agentId: string, handler: EventHandler): Unsubscribe;
  onType<T extends OrchestratorEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): Unsubscribe;
}

type OrchestratorEvent =
  | { type: 'agent:spawned'; agentId: string; agentType: string }
  | { type: 'agent:destroyed'; agentId: string; agentType: string }
  | { type: 'agent:error'; agentId: string; error: Error }
  | { type: 'task:created'; task: Task }
  | { type: 'task:assigned'; taskId: string; agentId: string }
  | { type: 'task:started'; taskId: string }
  | { type: 'task:progress'; taskId: string; progress: TaskProgress }
  | { type: 'task:completed'; taskId: string; result: TaskResult }
  | { type: 'task:failed'; taskId: string; error: Error }
  | { type: 'memory:published'; key: string; from: ScopeRef; to: ScopeRef }
  | { type: 'routing:human_required'; request: HumanDecisionRequest };

type EventHandler = (event: OrchestratorEvent) => void | Promise<void>;
type Unsubscribe = () => void;
```

---

## 10. Migration Path

### Phase 1: Coexistence

`UniversalAgent` and `AgentOrchestrator` exist side-by-side.

```typescript
// Old way (still works)
const agent = new UniversalAgent(config);
await agent.run('Hello');

// New way
const orchestrator = new AgentOrchestrator(config);
orchestrator.agentPool.registerType({ type: 'task', factory: ... });
await orchestrator.send('Hello');
```

### Phase 2: UniversalAgent as Facade

`UniversalAgent` becomes a thin wrapper around orchestrator.

```typescript
class UniversalAgent {
  private orchestrator: AgentOrchestrator;

  constructor(config: UniversalAgentConfig) {
    this.orchestrator = new AgentOrchestrator();
    // Register modes as agent types internally
    this.orchestrator.agentPool.registerType({ type: 'interactive', ... });
    this.orchestrator.agentPool.registerType({ type: 'planning', ... });
    this.orchestrator.agentPool.registerType({ type: 'executing', ... });
  }

  async run(message: string) {
    return this.orchestrator.send(message);
  }
}
```

### Phase 3: Deprecation

- Mark `UniversalAgent` as deprecated
- Guide users to migrate to `AgentOrchestrator`
- Remove in next major version

### Migration Guide (for Users)

```typescript
// Before
const agent = new UniversalAgent({
  connector: 'openai',
  model: 'gpt-4',
  mode: 'interactive'
});
const response = await agent.run('Hello');

// After
const orchestrator = new AgentOrchestrator({
  connector: 'openai',
  defaultModel: 'gpt-4'
});
orchestrator.agentPool.registerType({
  type: 'default',
  factory: (config) => new Agent(config),
  capability: { handles: ['*'], description: 'General purpose' }
});
const response = await orchestrator.send('Hello');
```

---

## 11. Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** Basic orchestration working with 2-3 agent types.

**Deliverables:**
- [ ] `IAgentOrchestrator` interface
- [ ] `AgentOrchestrator` basic implementation
- [ ] `AgentPool` with type registration and instance management
- [ ] `TaskRouter` with capability-only routing
- [ ] Basic `ScopedMemory` (global + private, no teams)
- [ ] Integration with existing `Agent`, `TaskAgent`

**Not included:**
- Vector routing
- Human-in-the-loop
- Auto-scaling
- Teams in memory

### Phase 2: Smart Routing

**Goal:** Intelligent task routing for larger deployments.

**Deliverables:**
- [ ] Vector search integration in `TaskRouter`
- [ ] Multi-factor scoring
- [ ] Human decision hooks
- [ ] Routing configuration and tuning
- [ ] Historical success tracking

### Phase 3: Advanced Memory

**Goal:** Full hierarchical memory with teams.

**Deliverables:**
- [ ] Team scope in `ScopedMemory`
- [ ] Publish pattern implementation
- [ ] Memory contracts (reads/writes declarations)
- [ ] Memory persistence options

### Phase 4: Production Readiness

**Goal:** Scalability and reliability features.

**Deliverables:**
- [ ] Auto-scaling for agent pools
- [ ] Health monitoring and recovery
- [ ] Metrics and observability
- [ ] Performance optimization
- [ ] Comprehensive tests

### Phase 5: Polish

**Goal:** Migration support and documentation.

**Deliverables:**
- [ ] `UniversalAgent` as facade (backwards compat)
- [ ] Migration guide
- [ ] API documentation
- [ ] Example applications

---

## 12. Open Questions

### Architecture

1. **Should orchestrator itself be an agent?**
   - Pro: Can be nested, consistent interface
   - Con: Adds complexity, unclear when useful
   - **Current decision:** No, keep it separate. Can add later.

2. **How to handle cross-team collaboration?**
   - Option A: Publish to global, other teams subscribe
   - Option B: Direct team-to-team channels
   - **Leaning toward:** Option A (simpler)

3. **Should agents know about orchestrator?**
   - Option A: Agents are orchestrator-agnostic (cleaner)
   - Option B: Agents can request orchestrator services (more powerful)
   - **Leaning toward:** Option A for v1, extend later

### Memory

4. **Memory persistence strategy?**
   - In-memory only (fast, loses state)
   - File-based (simple persistence)
   - Pluggable (user brings storage)
   - **Leaning toward:** Pluggable with in-memory default

5. **Memory size limits per scope?**
   - Global: larger (shared resource)
   - Team: medium
   - Private: smaller (per-agent)
   - **Need:** Concrete numbers and eviction strategy

### Routing

6. **What embedding model for vector search?**
   - Local: `all-MiniLM-L6-v2` via transformers.js
   - Remote: OpenAI `text-embedding-3-small`
   - **Leaning toward:** Pluggable, default to local

7. **How to extract capabilities from task description?**
   - Keyword extraction
   - LLM classification
   - User-provided tags
   - **Leaning toward:** Hybrid (keywords + optional LLM)

### Operations

8. **Default number of instances per type?**
   - 1 (spawn on demand)
   - Pre-warm common types
   - **Leaning toward:** 1 default, configurable per-type

9. **Task timeout handling?**
   - Kill agent instance
   - Just cancel task, reuse agent
   - **Leaning toward:** Cancel task, reuse agent

---

## Appendix A: Example Usage

### Basic Setup

```typescript
import { AgentOrchestrator, Agent, TaskAgent, ResearchAgent } from '@anthropic/agents';

// Create orchestrator
const orchestrator = new AgentOrchestrator({
  connector: 'openai',
  defaultModel: 'gpt-4'
});

// Register agent types
orchestrator.agentPool.registerType({
  type: 'general',
  factory: (config) => new Agent(config),
  capability: {
    handles: ['conversation', 'general'],
    description: 'General purpose conversational agent'
  }
});

orchestrator.agentPool.registerType({
  type: 'task',
  factory: (config) => new TaskAgent(config),
  capability: {
    handles: ['planning', 'task-execution', 'multi-step'],
    description: 'Task-oriented agent with planning capabilities'
  }
});

orchestrator.agentPool.registerType({
  type: 'research',
  factory: (config) => new ResearchAgent(config),
  capability: {
    handles: ['research', 'web-search', 'document-analysis'],
    description: 'Research agent with web search capabilities'
  }
});

// Start
await orchestrator.start();

// Send message (auto-routed)
const response = await orchestrator.send('Research the latest AI developments');
console.log(response);

// Cleanup
await orchestrator.stop();
```

### Manual Routing

```typescript
// Spawn specific agent
const researcher = orchestrator.spawn('research', {
  model: 'gpt-4-turbo'
});

// Delegate directly
const result = await orchestrator.delegate(
  { description: 'Find competitor pricing' },
  researcher.id
);
```

### Human-in-the-Loop

```typescript
// Configure routing with human approval
orchestrator.router.setConfig({
  strategy: 'hybrid-with-human',
  confidenceThreshold: 0.7,
  alwaysApproveTaskTypes: ['financial', 'legal']
});

// Handle approval requests
orchestrator.router.onHumanDecisionRequired(async (request) => {
  console.log('Candidates:', request.candidates);
  const choice = await promptUser(request.question);
  return { selectedAgentId: choice };
});
```

### Memory Sharing

```typescript
// Research agent stores findings
const memory = orchestrator.memory;
memory.team('research').store('competitor_pricing', {
  companyA: '$99/mo',
  companyB: '$149/mo'
});

// Publish to global for all agents
memory.publish('competitor_pricing',
  { type: 'team', teamId: 'research' },
  { type: 'global' }
);

// Other agents can now access
const pricing = memory.global.get('competitor_pricing');
```

---

## Appendix B: File Structure

```
src/core/orchestrator/
├── index.ts                    # Public exports
├── AgentOrchestrator.ts        # Main class
├── AgentPool.ts                # Agent lifecycle management
├── TaskRouter.ts               # Routing pipeline
├── ScopedMemory.ts             # Hierarchical memory
├── TaskManager.ts              # Task tracking
├── EventBus.ts                 # Internal events
├── UserInterface.ts            # User communication
│
├── interfaces/
│   ├── IAgentOrchestrator.ts
│   ├── IAgentPool.ts
│   ├── ITaskRouter.ts
│   ├── IScopedMemory.ts
│   ├── ITaskManager.ts
│   └── IEventBus.ts
│
├── routing/
│   ├── CapabilityMatcher.ts    # Stage 1
│   ├── VectorSearch.ts         # Stage 2
│   ├── Scorer.ts               # Stage 3
│   └── HumanDecision.ts        # Stage 4
│
├── memory/
│   ├── MemoryScope.ts          # Single scope implementation
│   ├── GlobalScope.ts
│   ├── TeamScope.ts
│   └── PrivateScope.ts
│
└── types.ts                    # Shared types
```

---

**End of Document**
