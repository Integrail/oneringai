/**
 * AgentContext - The "Swiss Army Knife" for Agent State Management
 *
 * Unified facade that composes all context-related managers:
 * - History: Conversation tracking (built-in)
 * - Tools: Tool management via ToolManager (composed)
 * - Memory: Working memory via WorkingMemory (composed)
 * - Cache: Tool result caching via IdempotencyCache (composed)
 * - Permissions: Tool permissions via ToolPermissionManager (composed)
 *
 * Design Principles:
 * - DRY: Reuses existing managers, doesn't duplicate
 * - Simple API: One import, one object
 * - Maximum Power: Full access to sub-managers when needed
 * - Coordinated: prepare(), save(), load() handle everything
 *
 * Usage:
 * ```typescript
 * const ctx = AgentContext.create({
 *   model: 'gpt-4',
 *   tools: [readFile, writeFile],
 * });
 *
 * ctx.addMessage('user', 'Hello');
 * await ctx.tools.execute('read_file', { path: './file.txt' });
 * ctx.memory.store('key', 'description', value);
 * const prepared = await ctx.prepare();
 * await ctx.save();
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import { ToolManager } from './ToolManager.js';
import type { ToolFunction } from '../domain/entities/Tool.js';
import type { ToolContext } from '../domain/interfaces/IToolContext.js';
import type { SerializedToolState } from './ToolManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { AgentPermissionsConfig, SerializedApprovalState } from './permissions/types.js';
import { IdempotencyCache, DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';
import type { IdempotencyCacheConfig, CacheStats } from './IdempotencyCache.js';
import { WorkingMemory } from '../capabilities/taskAgent/WorkingMemory.js';
import type { WorkingMemoryConfig } from '../domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '../domain/entities/Memory.js';
import { InMemoryStorage } from '../infrastructure/storage/InMemoryStorage.js';
import type { IMemoryStorage } from '../domain/interfaces/IMemoryStorage.js';
import type {
  IContextComponent,
  ITokenEstimator,
  IContextStrategy,
  ContextBudget,
  PreparedContext,
  TokenContentType,
} from './context/types.js';
import { DEFAULT_CONTEXT_CONFIG } from './context/types.js';
import { createStrategy as createStrategyFactory } from './context/strategies/index.js';
import { estimateComponentTokens } from './context/utils/ContextUtils.js';
import type { IContextPlugin } from './context/plugins/IContextPlugin.js';
import { getModelInfo } from '../domain/entities/Model.js';
import { PlanPlugin } from './context/plugins/PlanPlugin.js';
import { createInContextMemory } from './context/plugins/inContextMemoryTools.js';
import type { InContextMemoryPlugin, InContextMemoryConfig as InContextMemoryPluginConfig } from './context/plugins/InContextMemoryPlugin.js';

// ============================================================================
// Task Types & Priority Profiles
// ============================================================================

/**
 * Task type determines compaction priorities and system prompt additions
 */
export type TaskType = 'research' | 'coding' | 'analysis' | 'general';

/**
 * Priority profiles for different task types
 * Lower number = keep longer (compact last), Higher number = compact first
 *
 * Research: Preserve tool outputs (search/scrape results) longest
 * Coding: Preserve conversation history (context) longest
 * Analysis: Balanced, preserve analysis results
 * General: Default balanced approach
 */
export const PRIORITY_PROFILES: Record<TaskType, Record<string, number>> = {
  research: {
    memory_index: 3,           // Keep longest (summaries!)
    tool_outputs: 5,           // Keep long (research data!)
    conversation_history: 10,  // Compact first (old chat less critical)
  },
  coding: {
    memory_index: 5,
    conversation_history: 8,   // Keep more context
    tool_outputs: 10,          // Compact first (output less critical once seen)
  },
  analysis: {
    memory_index: 4,
    tool_outputs: 6,           // Analysis results important
    conversation_history: 7,
  },
  general: {
    memory_index: 8,
    conversation_history: 6,   // Balanced
    tool_outputs: 10,
  },
};

/**
 * Task-type-specific system prompt additions
 */
export const TASK_TYPE_PROMPTS: Record<TaskType, string> = {
  research: `## Research Protocol

You are conducting research. Follow this workflow to preserve findings:

### 1. SEARCH PHASE
- Execute searches to find relevant sources
- After EACH search, immediately store key findings in memory

### 2. READ PHASE
For each promising result:
- Read/scrape the content
- Extract key points (2-3 sentences per source)
- Store IMMEDIATELY in memory - do NOT keep full articles in conversation

### 3. SYNTHESIZE PHASE
Before writing final report:
- Use memory_list() to see all stored findings
- Retrieve relevant findings with memory_retrieve(key)
- Cross-reference and consolidate

### 4. CONTEXT MANAGEMENT
- Your context may be compacted automatically
- Always store important findings in memory IMMEDIATELY
- Stored data survives compaction; conversation history may not`,

  coding: `## Coding Protocol

You are implementing code changes. Guidelines:
- Read relevant files before making changes
- Implement incrementally
- Store key design decisions in memory if they'll be needed later
- Code file contents are large - summarize structure after reading`,

  analysis: `## Analysis Protocol

You are performing analysis. Guidelines:
- Store intermediate results in memory
- Summarize data immediately after loading (raw data is large)
- Keep only essential context for current analysis step`,

  general: `## Task Execution

Guidelines:
- Store important information in memory for later reference
- Monitor your context usage with context_inspect()`,
};

// ============================================================================
// Feature Configuration
// ============================================================================

/**
 * AgentContext feature configuration - controls which features are enabled
 *
 * Each feature can be enabled/disabled independently. When a feature is disabled:
 * - Its components are not created (saves memory)
 * - Its tools are not registered (cleaner LLM tool list)
 * - Related context preparation is skipped
 */
export interface AgentContextFeatures {
  /**
   * Enable WorkingMemory + IdempotencyCache
   * When enabled: memory storage, tool result caching, memory_* tools, cache_stats tool
   * When disabled: no memory/cache, tools not registered
   * @default true
   */
  memory?: boolean;

  /**
   * Enable InContextMemoryPlugin for in-context key-value storage
   * When enabled: context_set/get/delete/list tools
   * @default false (opt-in)
   */
  inContextMemory?: boolean;

  /**
   * Enable conversation history tracking
   * When disabled: addMessage() is no-op, history not in context
   * @default true
   */
  history?: boolean;

  /**
   * Enable ToolPermissionManager for approval workflow
   * When disabled: all tools auto-approved
   * @default true
   */
  permissions?: boolean;
}

/**
 * Default feature configuration
 *
 * - memory: true (includes WorkingMemory + IdempotencyCache)
 * - inContextMemory: false (opt-in)
 * - history: true
 * - permissions: true
 */
export const DEFAULT_FEATURES: Required<AgentContextFeatures> = {
  memory: true,
  inContextMemory: false,
  history: true,
  permissions: true,
};

// ============================================================================
// Types
// ============================================================================

/**
 * History message
 */
export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tool call record (stored in history)
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
  cached?: boolean;
  timestamp: number;
}

/**
 * AgentContext configuration
 */
export interface AgentContextConfig {
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

  /**
   * Feature configuration - enable/disable AgentContext features independently
   * Each feature controls component creation and tool registration
   */
  features?: AgentContextFeatures;

  /** Tool permissions configuration */
  permissions?: AgentPermissionsConfig;

  /** Memory configuration */
  memory?: Partial<WorkingMemoryConfig> & {
    /** Custom storage backend (default: InMemoryStorage) */
    storage?: IMemoryStorage;
  };

  /** Cache configuration */
  cache?: Partial<IdempotencyCacheConfig> & {
    /** Enable caching (default: true) */
    enabled?: boolean;
  };

  /** InContextMemory configuration (only used if features.inContextMemory is true) */
  inContextMemory?: InContextMemoryPluginConfig;

  /** History configuration */
  history?: {
    /** Max messages before compaction */
    maxMessages?: number;
    /** Messages to preserve during compaction */
    preserveRecent?: number;
  };

  /** Compaction strategy */
  strategy?: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive';

  /** Response token reserve (0.0 - 1.0) */
  responseReserve?: number;

  /** Enable auto-compaction */
  autoCompact?: boolean;

  /** Task type for priority profiles (default: auto-detect from plan) */
  taskType?: TaskType;

  /** Auto-detect task type from plan (default: true) */
  autoDetectTaskType?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_AGENT_CONTEXT_CONFIG: Required<Omit<AgentContextConfig, 'tools' | 'permissions' | 'memory' | 'cache' | 'taskType' | 'autoDetectTaskType' | 'features' | 'inContextMemory'>> & {
  history: Required<NonNullable<AgentContextConfig['history']>>;
} = {
  model: 'gpt-4',
  maxContextTokens: 128000,
  systemPrompt: '',
  instructions: '',
  history: {
    maxMessages: 100,
    preserveRecent: 20,
  },
  strategy: 'proactive',
  responseReserve: 0.15,
  autoCompact: true,
};

/**
 * Serialized state for session persistence
 */
export interface SerializedAgentContextState {
  version: number;
  core: {
    systemPrompt: string;
    instructions: string;
    history: HistoryMessage[];
    toolCalls: ToolCallRecord[];
  };
  tools: SerializedToolState;
  // Note: WorkingMemory state is serialized by the memory manager itself
  // when using SessionManager. Here we just track basic stats.
  memoryStats?: {
    entryCount: number;
    sizeBytes: number;
  };
  permissions: SerializedApprovalState;
  plugins: Record<string, unknown>;
  config: {
    model: string;
    maxContextTokens: number;
    strategy: string;
  };
}

/**
 * Context metrics
 */
export interface AgentContextMetrics {
  historyMessageCount: number;
  toolCallCount: number;
  cacheStats: CacheStats;
  memoryStats: {
    totalEntries: number;
    totalSizeBytes: number;
    utilizationPercent: number;
  };
  pluginCount: number;
  utilizationPercent: number;
}

// ============================================================================
// Events
// ============================================================================

export interface AgentContextEvents {
  // History events
  'message:added': { message: HistoryMessage };
  'history:cleared': { reason?: string };
  'history:compacted': { removedCount: number };

  // Tool events
  'tool:registered': { name: string };
  'tool:executed': { record: ToolCallRecord };
  'tool:cached': { name: string; args: Record<string, unknown> };

  // Context events
  'context:preparing': { componentCount: number };
  'context:prepared': { budget: ContextBudget; compacted: boolean };
  'compacted': { log: string[]; tokensFreed: number };

  // Budget events
  'budget:warning': { budget: ContextBudget };
  'budget:critical': { budget: ContextBudget };

  // Plugin events
  'plugin:registered': { name: string };
  'plugin:unregistered': { name: string };
}

// ============================================================================
// AgentContext Implementation
// ============================================================================

export class AgentContext extends EventEmitter<AgentContextEvents> {
  // ===== Composed Managers (conditionally created based on features) =====
  private readonly _tools: ToolManager;
  private readonly _memory: WorkingMemory | null;
  private readonly _cache: IdempotencyCache | null;
  private readonly _permissions: ToolPermissionManager | null;
  private _inContextMemory: InContextMemoryPlugin | null = null;

  // ===== Feature Configuration =====
  private readonly _features: Required<AgentContextFeatures>;

  // ===== Built-in State =====
  private _systemPrompt: string;
  private _instructions: string;
  private _history: HistoryMessage[] = [];
  private _toolCalls: ToolCallRecord[] = [];
  private _currentInput: string = '';
  private _historyEnabled: boolean;

  // ===== Plugins =====
  private _plugins: Map<string, IContextPlugin> = new Map();

  // ===== Configuration =====
  private _config: typeof DEFAULT_AGENT_CONTEXT_CONFIG;
  private _maxContextTokens: number;
  private _strategy: IContextStrategy;
  private _estimator: ITokenEstimator;
  private _cacheEnabled: boolean;

  // ===== Metrics =====
  private _compactionCount = 0;
  private _totalTokensFreed = 0;
  private _lastBudget: ContextBudget | null = null;

  // ===== Task Type =====
  private _explicitTaskType?: TaskType;
  private _autoDetectedTaskType?: TaskType;
  private _autoDetectTaskType: boolean = true;

  // ============================================================================
  // Constructor & Factory
  // ============================================================================

  private constructor(config: AgentContextConfig = {}) {
    super();

    // Resolve features - merge user features with defaults
    this._features = { ...DEFAULT_FEATURES, ...config.features };

    // Handle legacy cache.enabled flag (maps to features.memory)
    if (config.cache?.enabled === false) {
      this._features.memory = false;
    }

    // Merge config with defaults
    this._config = {
      ...DEFAULT_AGENT_CONTEXT_CONFIG,
      ...config,
      history: { ...DEFAULT_AGENT_CONTEXT_CONFIG.history, ...config.history },
    };

    this._systemPrompt = config.systemPrompt ?? '';
    this._instructions = config.instructions ?? '';

    // History feature
    this._historyEnabled = this._features.history;

    // Determine max tokens from model or config
    this._maxContextTokens = config.maxContextTokens
      ?? getModelInfo(config.model ?? 'gpt-4')?.features.input.tokens
      ?? 128000;

    // Create strategy and estimator
    this._strategy = createStrategyFactory(this._config.strategy, {});
    this._estimator = this.createEstimator();

    // ===== Compose existing managers (conditionally based on features) =====

    // ToolManager - always created
    this._tools = new ToolManager();
    if (config.tools) {
      for (const tool of config.tools) {
        this._tools.register(tool);
      }
    }

    // ToolPermissionManager - conditional
    if (this._features.permissions) {
      this._permissions = new ToolPermissionManager(config.permissions);
    } else {
      this._permissions = null;
    }

    // Memory feature includes WorkingMemory + IdempotencyCache (they work together)
    if (this._features.memory) {
      // WorkingMemory
      const memoryStorage = config.memory?.storage ?? new InMemoryStorage();
      const memoryConfig: WorkingMemoryConfig = {
        ...DEFAULT_MEMORY_CONFIG,
        ...config.memory,
      };
      this._memory = new WorkingMemory(memoryStorage, memoryConfig);

      // IdempotencyCache
      this._cacheEnabled = true;
      const cacheConfig: IdempotencyCacheConfig = {
        ...DEFAULT_IDEMPOTENCY_CONFIG,
        ...config.cache,
      };
      this._cache = new IdempotencyCache(cacheConfig);
    } else {
      this._memory = null;
      this._cache = null;
      this._cacheEnabled = false;
    }

    // InContextMemory - opt-in feature
    if (this._features.inContextMemory) {
      const { plugin, tools } = createInContextMemory(config.inContextMemory);
      this._inContextMemory = plugin;
      this.registerPlugin(plugin);
      for (const tool of tools) {
        this._tools.register(tool);
      }
    }

    // Task type configuration
    this._explicitTaskType = config.taskType;
    this._autoDetectTaskType = config.autoDetectTaskType !== false;
  }

  /**
   * Create a new AgentContext
   */
  static create(config: AgentContextConfig = {}): AgentContext {
    return new AgentContext(config);
  }

  // ============================================================================
  // Public Accessors (expose composed managers for direct access)
  // ============================================================================

  /** Tool manager - register, enable/disable, execute tools */
  get tools(): ToolManager {
    return this._tools;
  }

  /** Working memory - store/retrieve agent state (null if memory feature disabled) */
  get memory(): WorkingMemory | null {
    return this._memory;
  }

  /** Tool result cache - automatic deduplication (null if memory feature disabled) */
  get cache(): IdempotencyCache | null {
    return this._cache;
  }

  /** Tool permissions - approval workflow (null if permissions feature disabled) */
  get permissions(): ToolPermissionManager | null {
    return this._permissions;
  }

  /** InContextMemory plugin (null if inContextMemory feature disabled) */
  get inContextMemory(): InContextMemoryPlugin | null {
    return this._inContextMemory;
  }

  // ============================================================================
  // Feature Configuration
  // ============================================================================

  /**
   * Get the resolved feature configuration
   */
  get features(): Readonly<Required<AgentContextFeatures>> {
    return this._features;
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: keyof AgentContextFeatures): boolean {
    return this._features[feature];
  }

  /**
   * Get memory, throwing if disabled
   * Use when memory is required for an operation
   */
  requireMemory(): WorkingMemory {
    if (!this._memory) {
      throw new Error('WorkingMemory is not available. Enable the "memory" feature in AgentContextConfig.');
    }
    return this._memory;
  }

  /**
   * Get cache, throwing if disabled
   * Use when cache is required for an operation
   */
  requireCache(): IdempotencyCache {
    if (!this._cache) {
      throw new Error('IdempotencyCache is not available. Enable the "memory" feature in AgentContextConfig.');
    }
    return this._cache;
  }

  /**
   * Get permissions, throwing if disabled
   * Use when permissions is required for an operation
   */
  requirePermissions(): ToolPermissionManager {
    if (!this._permissions) {
      throw new Error('ToolPermissionManager is not available. Enable the "permissions" feature in AgentContextConfig.');
    }
    return this._permissions;
  }

  // ============================================================================
  // Core Context (Built-in)
  // ============================================================================

  /** Get/set system prompt */
  get systemPrompt(): string {
    return this._systemPrompt;
  }

  set systemPrompt(value: string) {
    this._systemPrompt = value;
  }

  /** Get/set instructions */
  get instructions(): string {
    return this._instructions;
  }

  set instructions(value: string) {
    this._instructions = value;
  }

  /** Set current input for this turn */
  setCurrentInput(input: string): void {
    this._currentInput = input;
  }

  /** Get current input */
  getCurrentInput(): string {
    return this._currentInput;
  }

  // ============================================================================
  // Task Type Management
  // ============================================================================

  /**
   * Set explicit task type (overrides auto-detection)
   */
  setTaskType(type: TaskType): void {
    this._explicitTaskType = type;
  }

  /**
   * Clear explicit task type (re-enables auto-detection)
   */
  clearTaskType(): void {
    this._explicitTaskType = undefined;
    this._autoDetectedTaskType = undefined;
  }

  /**
   * Get current task type
   * Priority: explicit > auto-detected > 'general'
   */
  getTaskType(): TaskType {
    if (this._explicitTaskType) {
      return this._explicitTaskType;
    }
    if (this._autoDetectTaskType) {
      this._autoDetectedTaskType = this.detectTaskTypeFromPlan();
      return this._autoDetectedTaskType ?? 'general';
    }
    return 'general';
  }

  /**
   * Get task-type-specific system prompt addition
   */
  getTaskTypePrompt(): string {
    return TASK_TYPE_PROMPTS[this.getTaskType()];
  }

  /**
   * Auto-detect task type from plan (if PlanPlugin is registered)
   * Uses keyword matching - NO LLM calls
   */
  private detectTaskTypeFromPlan(): TaskType | undefined {
    const planPlugin = this.getPlugin<PlanPlugin>('plan');
    const plan = planPlugin?.getPlan();
    if (!plan) return undefined;

    // Combine goal + task descriptions
    const text = `${plan.goal} ${plan.tasks.map(t => `${t.name} ${t.description}`).join(' ')}`.toLowerCase();

    // Research keywords
    if (/\b(research|search|find|investigate|discover|explore|gather|look\s*up|scrape|web\s*search|crawl|collect\s*data|survey|study)\b/.test(text)) {
      return 'research';
    }

    // Coding keywords
    if (/\b(code|implement|develop|program|function|class|refactor|debug|fix\s*bug|write\s*code|api|endpoint|module|component|typescript|javascript|python)\b/.test(text)) {
      return 'coding';
    }

    // Analysis keywords
    if (/\b(analyze|analysis|calculate|compute|evaluate|assess|compare|statistics|metrics|measure|data|report|chart|graph)\b/.test(text)) {
      return 'analysis';
    }

    return 'general';
  }

  // ============================================================================
  // History Management (Built-in)
  // ============================================================================

  /**
   * Add a message to history
   * Returns null if history feature is disabled
   */
  addMessage(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata?: Record<string, unknown>
  ): HistoryMessage | null {
    // Return null if history is disabled
    if (!this._historyEnabled) {
      return null;
    }

    const message: HistoryMessage = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    this._history.push(message);
    this.emit('message:added', { message });

    return message;
  }

  /**
   * Get all history messages
   */
  getHistory(): HistoryMessage[] {
    return [...this._history];
  }

  /**
   * Get recent N messages
   */
  getRecentHistory(count: number): HistoryMessage[] {
    return this._history.slice(-count);
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this._history.length;
  }

  /**
   * Clear history
   */
  clearHistory(reason?: string): void {
    this._history = [];
    this.emit('history:cleared', { reason });
  }

  /**
   * Get all tool call records
   */
  getToolCalls(): ToolCallRecord[] {
    return [...this._toolCalls];
  }

  // ============================================================================
  // Tool Execution (with caching integration)
  // ============================================================================

  /**
   * Execute a tool with automatic caching
   *
   * This is the recommended way to execute tools - it integrates:
   * - Permission checking
   * - Result caching (if tool is cacheable and memory feature enabled)
   * - History recording
   * - Metrics tracking
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: Partial<ToolContext>
  ): Promise<unknown> {
    const tool = this._tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const startTime = Date.now();
    let result: unknown;
    let error: string | undefined;
    let cached = false;

    try {
      // Check cache first (if enabled and cache available)
      if (this._cacheEnabled && this._cache) {
        const cachedResult = await this._cache.get(tool, args);
        if (cachedResult !== undefined) {
          cached = true;
          result = cachedResult;
          this.emit('tool:cached', { name: toolName, args });
        }
      }

      // Execute if not cached
      if (!cached) {
        // Set tool context on manager before execution
        const fullContext: ToolContext = {
          agentId: context?.agentId ?? 'agent-context',
          taskId: context?.taskId,
          memory: this._memory?.getAccess(),  // May be undefined if memory disabled
          idempotencyCache: this._cache ?? undefined,  // May be undefined if memory disabled
          inContextMemory: this._inContextMemory ?? undefined,  // May be undefined if inContextMemory disabled
          signal: context?.signal,
        };
        this._tools.setToolContext(fullContext);

        // Execute via ToolManager (context is already set)
        result = await this._tools.execute(toolName, args);

        // Cache result (if enabled, cache available, and tool is cacheable)
        if (this._cacheEnabled && this._cache) {
          await this._cache.set(tool, args, result);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      // Record tool call
      const record: ToolCallRecord = {
        id: this.generateId(),
        name: toolName,
        args,
        result: error ? undefined : result,
        error,
        durationMs: Date.now() - startTime,
        cached,
        timestamp: Date.now(),
      };

      this._toolCalls.push(record);
      this.emit('tool:executed', { record });
    }

    return result;
  }

  // ============================================================================
  // Plugin System
  // ============================================================================

  /**
   * Register a context plugin
   */
  registerPlugin(plugin: IContextPlugin): void {
    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this._plugins.set(plugin.name, plugin);
    this.emit('plugin:registered', { name: plugin.name });
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): boolean {
    const plugin = this._plugins.get(name);
    if (plugin) {
      plugin.destroy?.();
      this._plugins.delete(name);
      this.emit('plugin:unregistered', { name });
      return true;
    }
    return false;
  }

  /**
   * Get a plugin by name
   */
  getPlugin<T extends IContextPlugin>(name: string): T | undefined {
    return this._plugins.get(name) as T | undefined;
  }

  /**
   * List all registered plugins
   */
  listPlugins(): string[] {
    return Array.from(this._plugins.keys());
  }

  // ============================================================================
  // Context Preparation (Unified)
  // ============================================================================

  /**
   * Prepare context for LLM call
   *
   * Assembles all components:
   * - System prompt, instructions
   * - Conversation history
   * - Memory index
   * - Plugin components
   * - Current input
   *
   * Handles compaction automatically if budget is exceeded.
   */
  async prepare(): Promise<PreparedContext> {
    const components = await this.buildComponents();
    this.emit('context:preparing', { componentCount: components.length });

    let budget = this.calculateBudget(components);
    this._lastBudget = budget;

    // Emit warnings
    if (budget.status === 'warning') {
      this.emit('budget:warning', { budget });
    } else if (budget.status === 'critical') {
      this.emit('budget:critical', { budget });
    }

    // Compact if needed
    const needsCompaction = this._config.autoCompact &&
      this._strategy.shouldCompact(budget, {
        ...DEFAULT_CONTEXT_CONFIG,
        maxContextTokens: this._maxContextTokens,
        responseReserve: this._config.responseReserve,
      });

    if (needsCompaction) {
      const result = await this.doCompaction(components, budget);
      this.emit('context:prepared', { budget: result.budget, compacted: true });
      return result;
    }

    this.emit('context:prepared', { budget, compacted: false });
    return { components, budget, compacted: false };
  }

  /**
   * Get current budget without full preparation
   */
  async getBudget(): Promise<ContextBudget> {
    const components = await this.buildComponents();
    return this.calculateBudget(components);
  }

  /**
   * Force compaction
   */
  async compact(): Promise<PreparedContext> {
    const components = await this.buildComponents();
    const budget = this.calculateBudget(components);
    return this.doCompaction(components, budget);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set compaction strategy
   */
  setStrategy(strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive'): void {
    this._strategy = createStrategyFactory(strategy, {});
  }

  /**
   * Get max context tokens
   */
  getMaxContextTokens(): number {
    return this._maxContextTokens;
  }

  /**
   * Set max context tokens
   */
  setMaxContextTokens(tokens: number): void {
    this._maxContextTokens = tokens;
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this._cacheEnabled = enabled;
  }

  /**
   * Check if caching is enabled
   */
  isCacheEnabled(): boolean {
    return this._cacheEnabled;
  }

  // ============================================================================
  // Introspection
  // ============================================================================

  /**
   * Estimate tokens for content
   */
  estimateTokens(content: string, type?: TokenContentType): number {
    return this._estimator.estimateTokens(content, type);
  }

  /**
   * Get utilization percentage
   */
  getUtilization(): number {
    return this._lastBudget?.utilizationPercent ?? 0;
  }

  /**
   * Get last calculated budget
   */
  getLastBudget(): ContextBudget | null {
    return this._lastBudget;
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(): Promise<AgentContextMetrics> {
    // Get memory stats if memory feature is enabled
    let memoryStats: { totalEntries: number; totalSizeBytes: number; utilizationPercent: number };
    if (this._memory) {
      const stats = await this._memory.getStats();
      memoryStats = {
        totalEntries: stats.totalEntries,
        totalSizeBytes: stats.totalSizeBytes,
        utilizationPercent: stats.utilizationPercent,
      };
    } else {
      memoryStats = {
        totalEntries: 0,
        totalSizeBytes: 0,
        utilizationPercent: 0,
      };
    }

    // Get cache stats if memory feature is enabled
    const cacheStats = this._cache?.getStats() ?? {
      entries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    return {
      historyMessageCount: this._history.length,
      toolCallCount: this._toolCalls.length,
      cacheStats,
      memoryStats,
      pluginCount: this._plugins.size,
      utilizationPercent: this._lastBudget?.utilizationPercent ?? 0,
    };
  }

  // ============================================================================
  // Session Persistence (Unified)
  // ============================================================================

  /**
   * Get state for session persistence
   *
   * Serializes ALL state:
   * - History and tool calls
   * - Tool enable/disable state
   * - Memory state (if enabled)
   * - Permission state (if enabled)
   * - Plugin state
   * - Feature configuration
   */
  async getState(): Promise<SerializedAgentContextState> {
    const pluginStates: Record<string, unknown> = {};
    for (const [name, plugin] of this._plugins) {
      const state = plugin.getState?.();
      if (state !== undefined) {
        pluginStates[name] = state;
      }
    }

    // Get memory stats if memory is enabled
    let memoryStats: { entryCount: number; sizeBytes: number } | undefined;
    if (this._memory) {
      const stats = await this._memory.getStats();
      memoryStats = {
        entryCount: stats.totalEntries,
        sizeBytes: stats.totalSizeBytes,
      };
    }

    // Get permission state if permissions are enabled
    const permissionState = this._permissions?.getState() ?? {
      version: 1,
      approvals: {},
      blocklist: [],
      allowlist: [],
    };

    return {
      version: 1,
      core: {
        systemPrompt: this._systemPrompt,
        instructions: this._instructions,
        history: this._history,
        toolCalls: this._toolCalls,
      },
      tools: this._tools.getState(),
      memoryStats,
      permissions: permissionState,
      plugins: pluginStates,
      config: {
        model: this._config.model,
        maxContextTokens: this._maxContextTokens,
        strategy: this._strategy.name,
      },
    };
  }

  /**
   * Restore from saved state
   *
   * Restores ALL state from a previous session.
   */
  async restoreState(state: SerializedAgentContextState): Promise<void> {
    // Core state
    this._systemPrompt = state.core.systemPrompt || '';
    this._instructions = state.core.instructions || '';
    this._history = state.core.history || [];
    this._toolCalls = state.core.toolCalls || [];

    // Config
    if (state.config.maxContextTokens) {
      this._maxContextTokens = state.config.maxContextTokens;
    }
    if (state.config.strategy) {
      this._strategy = createStrategyFactory(state.config.strategy, {});
    }

    // Tool state
    if (state.tools) {
      this._tools.loadState(state.tools);
    }

    // Note: Memory state is managed by WorkingMemory + SessionManager separately
    // AgentContext only tracks stats, not full memory content

    // Permission state (only if permissions feature is enabled)
    if (state.permissions && this._permissions) {
      this._permissions.loadState(state.permissions);
    }

    // Plugin states
    for (const [name, pluginState] of Object.entries(state.plugins)) {
      const plugin = this._plugins.get(name);
      if (plugin?.restoreState) {
        plugin.restoreState(pluginState);
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy the context and release resources
   */
  destroy(): void {
    // Destroy plugins
    for (const plugin of this._plugins.values()) {
      plugin.destroy?.();
    }
    this._plugins.clear();

    // Destroy cache if it exists (clears interval and entries)
    this._cache?.destroy();

    // Destroy tool manager (cleans up circuit breaker listeners)
    this._tools.destroy();

    // Clear state
    this._history = [];
    this._toolCalls = [];

    this.removeAllListeners();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build all context components
   * Uses task-type-aware priority profiles for compaction ordering
   * Conditionally includes components based on enabled features
   */
  private async buildComponents(): Promise<IContextComponent[]> {
    const components: IContextComponent[] = [];

    // Get task type and priority profile
    const taskType = this.getTaskType();
    const priorityProfile = PRIORITY_PROFILES[taskType];

    // Build task-type-specific system prompt based on enabled features
    const taskTypePrompt = this.buildTaskTypePromptForFeatures(taskType);

    // System prompt + task type prompt (never compact)
    const fullSystemPrompt = this._systemPrompt
      ? `${this._systemPrompt}\n\n${taskTypePrompt}`
      : taskTypePrompt;
    if (fullSystemPrompt) {
      components.push({
        name: 'system_prompt',
        content: fullSystemPrompt,
        priority: 0,
        compactable: false,
      });
    }

    // Instructions (never compact)
    if (this._instructions) {
      components.push({
        name: 'instructions',
        content: this._instructions,
        priority: 0,
        compactable: false,
      });
    }

    // Conversation history (compactable, priority from profile) - only if history enabled
    if (this._features.history && this._history.length > 0) {
      components.push({
        name: 'conversation_history',
        content: this.formatHistoryForContext(),
        priority: priorityProfile.conversation_history ?? 6,
        compactable: true,
        metadata: {
          messageCount: this._history.length,
          strategy: taskType === 'research' ? 'summarize' : 'truncate',
        },
      });
    }

    // Memory index (compactable, priority from profile) - only if memory enabled
    if (this._features.memory && this._memory) {
      const memoryIndex = await this._memory.formatIndex();
      // Check if memory is truly empty (formatMemoryIndex returns "Memory is empty." when no entries)
      const isEmpty = !memoryIndex || memoryIndex.trim().length === 0 || memoryIndex.includes('Memory is empty.');
      if (!isEmpty) {
        components.push({
          name: 'memory_index',
          content: memoryIndex,
          priority: priorityProfile.memory_index ?? 8,
          compactable: true,
          metadata: {
            strategy: 'evict',
          },
        });
      }
    }

    // Plugin components with priority override
    for (const plugin of this._plugins.values()) {
      try {
        const component = await plugin.getComponent();
        if (component) {
          // Apply task-type priority override if defined in profile
          const overridePriority = priorityProfile[component.name];
          if (overridePriority !== undefined) {
            component.priority = overridePriority;
          }
          components.push(component);
        }
      } catch (error) {
        console.warn(`Plugin '${plugin.name}' failed to get component:`, error);
      }
    }

    // Current input (never compact)
    if (this._currentInput) {
      components.push({
        name: 'current_input',
        content: this._currentInput,
        priority: 0,
        compactable: false,
      });
    }

    return components;
  }

  /**
   * Build task-type prompt adjusted for enabled features
   */
  private buildTaskTypePromptForFeatures(taskType: TaskType): string {
    const basePrompt = TASK_TYPE_PROMPTS[taskType];

    // If memory is disabled, modify the prompts to remove memory-related instructions
    if (!this._features.memory) {
      // Return simplified prompts without memory references
      if (taskType === 'research') {
        return `## Research Protocol

You are conducting research. Follow this workflow:

### 1. SEARCH PHASE
- Execute searches to find relevant sources

### 2. READ PHASE
For each promising result:
- Read/scrape the content
- Extract key points (2-3 sentences per source)

### 3. SYNTHESIZE PHASE
- Cross-reference and consolidate findings
- Write the final report`;
      } else if (taskType === 'coding') {
        return `## Coding Protocol

You are implementing code changes. Guidelines:
- Read relevant files before making changes
- Implement incrementally
- Code file contents are large - summarize structure after reading`;
      } else if (taskType === 'analysis') {
        return `## Analysis Protocol

You are performing analysis. Guidelines:
- Summarize data immediately after loading (raw data is large)
- Keep only essential context for current analysis step`;
      } else {
        return `## Task Execution

Guidelines:
- Focus on completing the task efficiently`;
      }
    }

    return basePrompt;
  }

  /**
   * Format history for context
   */
  private formatHistoryForContext(): string {
    return this._history
      .map(m => {
        const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
        return `${roleLabel}: ${m.content}`;
      })
      .join('\n\n');
  }

  /**
   * Calculate budget
   */
  private calculateBudget(components: IContextComponent[]): ContextBudget {
    const breakdown: Record<string, number> = {};
    let used = 0;

    for (const component of components) {
      const tokens = estimateComponentTokens(component, this._estimator);
      breakdown[component.name] = tokens;
      used += tokens;
    }

    const total = this._maxContextTokens;
    const reserved = Math.floor(total * this._config.responseReserve);
    const available = total - reserved - used;
    const utilizationRatio = (used + reserved) / total;
    const utilizationPercent = (used / (total - reserved)) * 100;

    let status: 'ok' | 'warning' | 'critical';
    if (utilizationRatio >= 0.9) {
      status = 'critical';
    } else if (utilizationRatio >= 0.75) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      total,
      reserved,
      used,
      available,
      utilizationPercent,
      status,
      breakdown,
    };
  }

  /**
   * Perform compaction
   */
  private async doCompaction(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise<PreparedContext> {
    const log: string[] = [];
    let tokensFreed = 0;
    let currentBudget = budget;

    // Sort compactable by priority (highest first)
    const compactable = components
      .filter(c => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    for (const component of compactable) {
      if (currentBudget.status === 'ok') break;

      let freed = 0;

      if (component.name === 'conversation_history') {
        freed = this.compactHistory();
        if (freed > 0) log.push(`Compacted history: freed ~${freed} tokens`);
      } else if (component.name === 'memory_index') {
        freed = await this.compactMemory();
        if (freed > 0) log.push(`Compacted memory: freed ~${freed} tokens`);
      } else {
        const plugin = this._plugins.get(component.name);
        if (plugin?.compact) {
          freed = await plugin.compact(currentBudget.available, this._estimator);
          if (freed > 0) log.push(`Compacted ${component.name}: freed ~${freed} tokens`);
        }
      }

      tokensFreed += freed;

      // Recalculate
      const newComponents = await this.buildComponents();
      currentBudget = this.calculateBudget(newComponents);
    }

    this._compactionCount++;
    this._totalTokensFreed += tokensFreed;

    const finalComponents = await this.buildComponents();
    const finalBudget = this.calculateBudget(finalComponents);

    this.emit('compacted', { log, tokensFreed });

    return {
      components: finalComponents,
      budget: finalBudget,
      compacted: true,
      compactionLog: log,
    };
  }

  /**
   * Compact history
   */
  private compactHistory(): number {
    const preserve = this._config.history.preserveRecent;
    const before = this._history.length;

    if (before <= preserve) return 0;

    const removed = this._history.slice(0, -preserve);
    this._history = this._history.slice(-preserve);

    const tokensFreed = removed.reduce(
      (sum, m) => sum + this._estimator.estimateTokens(m.content),
      0
    );

    this.emit('history:compacted', { removedCount: removed.length });
    return tokensFreed;
  }

  /**
   * Compact memory
   */
  private async compactMemory(): Promise<number> {
    // Return 0 if memory is disabled
    if (!this._memory) {
      return 0;
    }

    const beforeIndex = await this._memory.formatIndex();
    const beforeTokens = this._estimator.estimateTokens(beforeIndex);

    await this._memory.evict(3, 'lru');

    const afterIndex = await this._memory.formatIndex();
    const afterTokens = this._estimator.estimateTokens(afterIndex);

    return Math.max(0, beforeTokens - afterTokens);
  }

  /**
   * Create token estimator
   */
  private createEstimator(): ITokenEstimator {
    return {
      estimateTokens: (text: string, contentType?: TokenContentType) => {
        if (!text || text.length === 0) return 0;
        const ratio = contentType === 'code' ? 3 : contentType === 'prose' ? 4 : 3.5;
        return Math.ceil(text.length / ratio);
      },
      estimateDataTokens: (data: unknown, contentType?: TokenContentType) => {
        const serialized = JSON.stringify(data);
        const ratio = contentType === 'code' ? 3 : contentType === 'prose' ? 4 : 3.5;
        return Math.ceil(serialized.length / ratio);
      },
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
