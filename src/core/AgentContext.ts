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
import { logger as baseLogger, FrameworkLogger } from '../infrastructure/observability/Logger.js';
import { ToolManager } from './ToolManager.js';

// Context-specific logger
const logger: FrameworkLogger = baseLogger.child({ component: 'AgentContext' });
import type { ToolFunction, ToolResult } from '../domain/entities/Tool.js';
import type { ToolContext } from '../domain/interfaces/IToolContext.js';
import type { SerializedToolState } from './ToolManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { AgentPermissionsConfig, SerializedApprovalState } from './permissions/types.js';
import type { SerializedMemory } from '../capabilities/taskAgent/WorkingMemory.js';
import type { IContextStorage, ContextSessionMetadata } from '../domain/interfaces/IContextStorage.js';
import { IdempotencyCache, DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';
import type { IdempotencyCacheConfig, CacheStats } from './IdempotencyCache.js';
import { WorkingMemory } from '../capabilities/taskAgent/WorkingMemory.js';
import type { WorkingMemoryConfig } from '../domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '../domain/entities/Memory.js';
import { InMemoryStorage } from '../infrastructure/storage/InMemoryStorage.js';
import type { IMemoryStorage } from '../domain/interfaces/IMemoryStorage.js';
// NEW: Message types for conversation storage
import type { InputItem, OutputItem, Message } from '../domain/entities/Message.js';
import { MessageRole } from '../domain/entities/Message.js';
import type { Content } from '../domain/entities/Content.js';
import { ContentType } from '../domain/entities/Content.js';
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
import { createPersistentInstructions } from './context/plugins/persistentInstructionsTools.js';
import type { PersistentInstructionsPlugin, PersistentInstructionsConfig as PersistentInstructionsPluginConfig } from './context/plugins/PersistentInstructionsPlugin.js';
import { ToolOutputPlugin } from './context/plugins/ToolOutputPlugin.js';
import type { ToolOutputPluginConfig } from './context/plugins/ToolOutputPlugin.js';
import { AutoSpillPlugin } from './context/plugins/AutoSpillPlugin.js';
import type { AutoSpillConfig } from './context/plugins/AutoSpillPlugin.js';
import { ToolResultEvictionPlugin } from './context/plugins/ToolResultEvictionPlugin.js';
import type { ToolResultEvictionConfig } from './context/plugins/ToolResultEvictionPlugin.js';

// Memory & Context introspection tool creators
// These are registered automatically based on enabled features for ALL agent types
import {
  createMemoryStoreTool,
  createMemoryRetrieveTool,
  createMemoryDeleteTool,
  createMemoryQueryTool,
  createMemoryCleanupRawTool,
} from '../capabilities/taskAgent/memoryTools.js';
import {
  createContextStatsTool,
} from '../capabilities/taskAgent/contextTools.js';
import { buildFeatureInstructions } from './context/FeatureInstructions.js';

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

  /**
   * Enable PersistentInstructionsPlugin for disk-persisted custom instructions
   * When enabled: instructions_set/get/append/clear tools
   * Requires agentId in config
   * @default false (opt-in)
   */
  persistentInstructions?: boolean;

  /**
   * Enable ToolOutputPlugin for tracking recent tool outputs in context
   * When enabled: Tool outputs are tracked and can be compacted
   * @default true
   */
  toolOutputTracking?: boolean;

  /**
   * Enable AutoSpillPlugin for auto-spilling large tool outputs to memory
   * When enabled: Large outputs are automatically stored in WorkingMemory's raw tier
   * Requires memory feature to be enabled
   * @default true
   */
  autoSpill?: boolean;

  /**
   * Enable ToolResultEvictionPlugin for smart eviction of old tool results
   * When enabled: Old tool results are automatically moved to WorkingMemory
   * and their tool_use/tool_result pairs are removed from conversation.
   * Agent can retrieve evicted results via memory_retrieve.
   * Requires memory feature to be enabled.
   * @default true
   */
  toolResultEviction?: boolean;
}

/**
 * Default feature configuration
 *
 * - memory: true (includes WorkingMemory + IdempotencyCache)
 * - inContextMemory: false (opt-in)
 * - history: true
 * - permissions: true
 * - toolOutputTracking: true
 * - autoSpill: true
 * - toolResultEviction: true (NEW - moves old results to memory)
 */
export const DEFAULT_FEATURES: Required<AgentContextFeatures> = {
  memory: true,
  inContextMemory: false,
  history: true,
  permissions: true,
  persistentInstructions: false,
  toolOutputTracking: true,
  autoSpill: true,
  toolResultEviction: true,
};

// ============================================================================
// Types
// ============================================================================

/**
 * History message - LEGACY FORMAT
 * @deprecated Use InputItem from Message.ts instead.
 * This interface is kept ONLY for backward compatibility with:
 * - v1 session deserialization
 * - Legacy addMessage()/addMessageSync() return types
 * New code should use InputItem[] exclusively.
 */
export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Message metadata for conversation tracking
 */
export interface MessageMetadata {
  timestamp: number;
  tokenCount: number;
  iteration?: number;
  /** Original legacy role (for backward compatibility with 'tool' role) */
  legacyRole?: 'user' | 'assistant' | 'system' | 'tool';
}

/**
 * Prepared conversation result from prepareConversation()
 * @deprecated Use PreparedResult instead
 */
export interface PreparedConversation {
  /** InputItem[] ready for LLM */
  input: InputItem[];
  /** Current budget */
  budget: ContextBudget;
  /** Whether compaction occurred */
  compacted: boolean;
  /** Compaction log if compacted */
  compactionLog: string[];
}

/**
 * Options for prepareConversation()
 * @deprecated Use PrepareOptions instead
 */
export interface PrepareConversationOptions {
  /** Override instructions for this call only */
  instructionOverride?: string;
}

/**
 * Options for the unified prepare() method
 */
export interface PrepareOptions {
  /** Override instructions for this call only */
  instructionOverride?: string;
  /**
   * Return format:
   * - 'llm-input': Returns LLM-ready InputItem[] (default)
   * - 'components': Returns raw context components for custom assembly
   */
  returnFormat?: 'llm-input' | 'components';
}

/**
 * Result from unified prepare() method
 */
export interface PreparedResult {
  /** Current budget */
  budget: ContextBudget;
  /** Whether compaction occurred */
  compacted: boolean;
  /** Compaction log if compacted */
  compactionLog: string[];

  /** LLM-ready input (when returnFormat='llm-input') */
  input?: InputItem[];
  /** Raw context components (when returnFormat='components') */
  components?: IContextComponent[];
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

  /**
   * PersistentInstructions configuration (only used if features.persistentInstructions is true)
   * If not provided, agentId will be auto-generated
   */
  persistentInstructions?: Omit<PersistentInstructionsPluginConfig, 'agentId'> & {
    /** Override the agent ID (default: auto-generated or from agent name) */
    agentId?: string;
  };

  /**
   * ToolOutputPlugin configuration (only used if features.toolOutputTracking is true)
   */
  toolOutputTracking?: ToolOutputPluginConfig;

  /**
   * AutoSpillPlugin configuration (only used if features.autoSpill is true)
   * Requires features.memory to be true
   */
  autoSpill?: AutoSpillConfig;

  /**
   * ToolResultEvictionPlugin configuration (only used if features.toolResultEviction is true)
   * Requires features.memory to be true
   */
  toolResultEviction?: ToolResultEvictionConfig;

  /**
   * Agent ID - used for persistent storage paths and identification
   * If not provided, will be auto-generated
   */
  agentId?: string;

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

  // ===== Session Persistence =====

  /**
   * Storage backend for session persistence.
   * If provided, enables save()/load() methods.
   */
  storage?: IContextStorage;

  /**
   * Session ID to load on creation.
   * If provided with storage, the session will be automatically loaded.
   */
  sessionId?: string;

  /**
   * Session metadata (used when saving new sessions).
   */
  sessionMetadata?: ContextSessionMetadata;
}

/**
 * Default configuration
 */
const DEFAULT_AGENT_CONTEXT_CONFIG: Required<Omit<AgentContextConfig, 'tools' | 'permissions' | 'memory' | 'cache' | 'taskType' | 'autoDetectTaskType' | 'features' | 'inContextMemory' | 'persistentInstructions' | 'toolOutputTracking' | 'autoSpill' | 'toolResultEviction' | 'agentId' | 'storage' | 'sessionId' | 'sessionMetadata'>> & {
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
 * Version 2: Stores conversation as InputItem[] instead of HistoryMessage[]
 */
export interface SerializedAgentContextState {
  version: number;  // 1 = legacy HistoryMessage[], 2 = InputItem[]
  core: {
    systemPrompt: string;
    instructions: string;
    /** @deprecated Use conversation instead (v2) */
    history?: HistoryMessage[];
    /** NEW in v2: Full conversation as InputItem[] */
    conversation?: InputItem[];
    /** NEW in v2: Message metadata */
    messageMetadata?: Record<string, MessageMetadata>;
    toolCalls: ToolCallRecord[];
  };
  tools: SerializedToolState;
  /** Full WorkingMemory state (if memory feature enabled) */
  memory?: SerializedMemory;
  permissions: SerializedApprovalState;
  plugins: Record<string, unknown>;
  /**
   * Agent-specific state (not context state).
   * This is for agent-level data like ModeManager state that doesn't belong in plugins.
   * Populated by agent subclasses via getContextState() override.
   */
  agentState?: Record<string, unknown>;
  config: {
    model: string;
    maxContextTokens: number;
    strategy: string;
    features?: AgentContextFeatures;
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
  // History/conversation events (NEW: uses InputItem, not HistoryMessage)
  'message:added': { item: InputItem; index: number };
  'message:user': { item: InputItem };
  'message:assistant': { item: InputItem };
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
  private _persistentInstructions: PersistentInstructionsPlugin | null = null;
  private _toolOutputPlugin: ToolOutputPlugin | null = null;
  private _autoSpillPlugin: AutoSpillPlugin | null = null;
  private _toolResultEvictionPlugin: ToolResultEvictionPlugin | null = null;
  private readonly _agentId: string;

  // ===== Feature Configuration =====
  private readonly _features: Required<AgentContextFeatures>;

  // ===== Built-in State =====
  private _systemPrompt: string;
  private _instructions: string;
  private _toolCalls: ToolCallRecord[] = [];
  private _currentInput: string = '';
  private _historyEnabled: boolean;

  // ===== Conversation State (NEW - THE source of truth) =====
  /** Conversation stored as InputItem[] - THE source of truth */
  private _conversation: InputItem[] = [];
  /** Metadata for each message (keyed by message ID) */
  private _messageMetadata: Map<string, MessageMetadata> = new Map();
  /** Messages at or after this index cannot be compacted (current iteration protection) */
  private _protectedFromIndex: number = 0;

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

  // ===== Session Persistence =====
  private _storage: IContextStorage | null = null;
  private _sessionId: string | null = null;
  private _sessionMetadata: ContextSessionMetadata = {};

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

    // Validate feature dependencies
    this.validateFeatures(this._features);

    // Merge config with defaults
    this._config = {
      ...DEFAULT_AGENT_CONTEXT_CONFIG,
      ...config,
      history: { ...DEFAULT_AGENT_CONTEXT_CONFIG.history, ...config.history },
    };

    this._systemPrompt = config.systemPrompt ?? '';
    this._instructions = config.instructions ?? '';

    // Generate or use provided agent ID
    this._agentId = config.agentId
      ?? config.persistentInstructions?.agentId
      ?? `agent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

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

    // IMPORTANT: Set parent context so ToolManager can auto-build ToolContext
    // This ensures tools have access to agentContext, memory, cache, etc.
    // even when ToolManager.execute() is called directly (e.g., by Agent)
    this._tools.setParentContext(this);

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

    // PersistentInstructions - opt-in feature
    // Note: Plugin initialization is lazy (loads from disk on first getComponent call)
    if (this._features.persistentInstructions) {
      const { plugin, tools } = createPersistentInstructions({
        agentId: this._agentId,
        ...config.persistentInstructions,
      });
      this._persistentInstructions = plugin;
      this.registerPlugin(plugin);
      for (const tool of tools) {
        this._tools.register(tool);
      }
    }

    // ToolOutputPlugin - tracks recent tool outputs in context (default ON)
    if (this._features.toolOutputTracking) {
      this._toolOutputPlugin = new ToolOutputPlugin(config.toolOutputTracking);
      this.registerPlugin(this._toolOutputPlugin);
    }

    // AutoSpillPlugin - auto-spills large tool outputs to memory (default ON)
    // Requires memory feature to be enabled
    if (this._features.autoSpill && this._memory) {
      this._autoSpillPlugin = new AutoSpillPlugin(this._memory, {
        sizeThreshold: 10 * 1024,  // 10KB default
        toolPatterns: [/^web_/, /^research_/, /^read_file/],  // Common large-output tools
        ...config.autoSpill,
      });
      this.registerPlugin(this._autoSpillPlugin);
    }

    // ToolResultEvictionPlugin - smart eviction of old tool results (default ON)
    // Requires memory feature to be enabled
    if (this._features.toolResultEviction && this._memory) {
      logger.debug({
        toolResultEviction: this._features.toolResultEviction,
        memoryEnabled: !!this._memory,
        config: config.toolResultEviction,
      }, 'Creating ToolResultEvictionPlugin');

      this._toolResultEvictionPlugin = new ToolResultEvictionPlugin(this._memory, {
        ...config.toolResultEviction,
      });
      // Set up callback for removing tool pairs from conversation
      this._toolResultEvictionPlugin.setRemoveCallback((toolUseId: string) => {
        return this.removeToolPair(toolUseId);
      });
      this.registerPlugin(this._toolResultEvictionPlugin);

      logger.debug({
        pluginName: this._toolResultEvictionPlugin.name,
        pluginConfig: this._toolResultEvictionPlugin.getConfig(),
      }, 'ToolResultEvictionPlugin created and registered');
    } else {
      logger.debug({
        toolResultEviction: this._features.toolResultEviction,
        memoryEnabled: !!this._memory,
      }, 'ToolResultEvictionPlugin NOT created (feature disabled or no memory)');
    }

    // Register feature-aware tools (memory, cache, introspection)
    // This ensures ALL agent types have consistent tool availability
    this._registerFeatureTools();

    // Task type configuration
    this._explicitTaskType = config.taskType;
    this._autoDetectTaskType = config.autoDetectTaskType !== false;

    // Session persistence configuration
    this._storage = config.storage ?? null;
    this._sessionMetadata = config.sessionMetadata ?? {};
    this._sessionId = config.sessionId ?? null;
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

  /** PersistentInstructions plugin (null if persistentInstructions feature disabled) */
  get persistentInstructions(): PersistentInstructionsPlugin | null {
    return this._persistentInstructions;
  }

  /** ToolOutputPlugin (null if toolOutputTracking feature disabled) */
  get toolOutputPlugin(): ToolOutputPlugin | null {
    return this._toolOutputPlugin;
  }

  /** AutoSpillPlugin (null if autoSpill feature disabled or memory disabled) */
  get autoSpillPlugin(): AutoSpillPlugin | null {
    return this._autoSpillPlugin;
  }

  /** ToolResultEvictionPlugin (null if toolResultEviction feature disabled or memory disabled) */
  get toolResultEvictionPlugin(): ToolResultEvictionPlugin | null {
    return this._toolResultEvictionPlugin;
  }

  /** Agent ID (auto-generated or from config) */
  get agentId(): string {
    return this._agentId;
  }

  /** Current session ID (null if no session loaded/saved) */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** Storage backend for session persistence (null if not configured) */
  get storage(): IContextStorage | null {
    return this._storage;
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

  /**
   * Validate feature dependencies and warn about potential issues
   * Called during construction after feature resolution
   */
  private validateFeatures(features: Required<AgentContextFeatures>): void {
    // autoSpill requires memory - throw error if invalid
    if (features.autoSpill && !features.memory) {
      throw new Error(
        'AgentContext: autoSpill feature requires memory feature to be enabled. ' +
        'Either enable memory (features.memory: true) or disable autoSpill (features.autoSpill: false).'
      );
    }

    // toolResultEviction requires memory - throw error if invalid
    if (features.toolResultEviction && !features.memory) {
      throw new Error(
        'AgentContext: toolResultEviction feature requires memory feature to be enabled. ' +
        'Either enable memory (features.memory: true) or disable toolResultEviction (features.toolResultEviction: false).'
      );
    }

    // inContextMemory without memory is allowed but warn about limitation
    if (features.inContextMemory && !features.memory) {
      console.warn(
        'AgentContext: inContextMemory enabled without memory feature. ' +
        'In-context data will not be backed by WorkingMemory for persistence or large data spilling.'
      );
    }

    // persistentInstructions without an agentId may cause issues
    // (handled separately in constructor, but we could add a warning here if needed)
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
  // Conversation Management (NEW - Primary API)
  // ============================================================================

  /**
   * Add user message to conversation.
   *
   * @param content - String or Content[] for the message
   * @returns Message ID
   */
  addUserMessage(content: string | Content[]): string {
    const id = this.generateId();
    const contentArray: Content[] = typeof content === 'string'
      ? [{ type: ContentType.INPUT_TEXT, text: content }]
      : content;

    const message: Message = {
      type: 'message',
      id,
      role: MessageRole.USER,
      content: contentArray,
    };

    this._conversation.push(message);
    this._messageMetadata.set(id, {
      timestamp: Date.now(),
      tokenCount: this.estimateMessageTokens(message),
    });

    // Update current input for task type detection
    const textContent = this.extractTextFromContent(contentArray);
    if (textContent) {
      this.setCurrentInput(textContent);
    }

    const index = this._conversation.length - 1;
    this.emit('message:added', { item: message, index });
    this.emit('message:user', { item: message });
    return id;
  }

  /**
   * Add raw InputItem[] to conversation (for complex inputs with images, files, etc.)
   *
   * @param items - InputItem[] to add
   */
  addInputItems(items: InputItem[]): void {
    for (const item of items) {
      if (item.type === 'message') {
        const id = item.id || this.generateId();
        const messageWithId: Message = { ...item, id };
        this._conversation.push(messageWithId);
        this._messageMetadata.set(id, {
          timestamp: Date.now(),
          tokenCount: this.estimateMessageTokens(messageWithId),
        });
        const index = this._conversation.length - 1;
        this.emit('message:added', { item: messageWithId, index });
      }
    }
  }

  /**
   * Add assistant response to conversation (including tool calls).
   *
   * @param output - OutputItem[] from LLM response
   * @returns Array of message IDs added
   */
  addAssistantResponse(output: OutputItem[]): string[] {
    const ids: string[] = [];

    for (const item of output) {
      if (item.type === 'message' && item.role === MessageRole.ASSISTANT) {
        const id = item.id || this.generateId();
        const messageWithId: Message = { ...item, id } as Message;
        this._conversation.push(messageWithId as InputItem);
        this._messageMetadata.set(id, {
          timestamp: Date.now(),
          tokenCount: this.estimateMessageTokens(messageWithId),
        });
        ids.push(id);
        const index = this._conversation.length - 1;
        this.emit('message:added', { item: messageWithId as InputItem, index });
        this.emit('message:assistant', { item: messageWithId as InputItem });
      }
    }

    return ids;
  }

  /**
   * Add tool results to conversation.
   *
   * @param results - ToolResult[] from tool execution
   * @returns Message ID of the tool results message
   */
  addToolResults(results: ToolResult[]): string {
    const id = this.generateId();

    const message: Message = {
      type: 'message',
      id,
      role: MessageRole.USER,  // Tool results go as user message per API spec
      content: results.map(r => ({
        type: ContentType.TOOL_RESULT as const,
        tool_use_id: r.tool_use_id,
        content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content),
        error: r.error,
      })),
    };

    this._conversation.push(message);
    this._messageMetadata.set(id, {
      timestamp: Date.now(),
      tokenCount: this.estimateMessageTokens(message),
    });

    // Also record in tool calls for analytics
    for (const r of results) {
      this._toolCalls.push({
        id: r.tool_use_id,
        name: r.tool_name || 'unknown',
        args: {},
        result: r.content,
        error: r.error,
        timestamp: Date.now(),
      });
    }

    const index = this._conversation.length - 1;
    this.emit('message:added', { item: message, index });

    // Track tool results for eviction (if plugin enabled)
    if (this._toolResultEvictionPlugin) {
      logger.debug({
        resultsCount: results.length,
        messageIndex: index,
        pluginTrackedBefore: this._toolResultEvictionPlugin.getTracked().length,
      }, 'addToolResults: tracking results for eviction');

      for (const r of results) {
        const toolName = r.tool_name || 'unknown';
        logger.debug({
          toolUseId: r.tool_use_id,
          toolName,
          contentLength: typeof r.content === 'string' ? r.content.length : JSON.stringify(r.content).length,
        }, `addToolResults: tracking ${toolName}`);

        this._toolResultEvictionPlugin.onToolResult(
          r.tool_use_id,
          toolName,
          r.content,
          index
        );
      }

      logger.debug({
        pluginTrackedAfter: this._toolResultEvictionPlugin.getTracked().length,
        pluginStats: this._toolResultEvictionPlugin.getStats(),
      }, 'addToolResults: tracking complete');
    } else {
      logger.debug({
        resultsCount: results.length,
        pluginEnabled: !!this._toolResultEvictionPlugin,
      }, 'addToolResults: NOT tracking (plugin not enabled)');
    }

    return id;
  }

  /**
   * Mark current position as protected from compaction.
   * Messages at or after this index cannot be compacted.
   * Called at the start of each iteration by Agent.
   */
  protectFromCompaction(): void {
    this._protectedFromIndex = this._conversation.length;
  }

  /**
   * Get conversation (read-only).
   */
  getConversation(): ReadonlyArray<InputItem> {
    return this._conversation;
  }

  /**
   * Get conversation length.
   */
  getConversationLength(): number {
    return this._conversation.length;
  }

  /**
   * Clear conversation.
   */
  clearConversation(reason?: string): void {
    this._conversation = [];
    this._messageMetadata.clear();
    this._protectedFromIndex = 0;
    this.emit('history:cleared', { reason });
  }

  /**
   * Unified context preparation method.
   *
   * Handles everything for preparing context before LLM calls:
   * 1. Marks current position as protected from compaction
   * 2. Advances iteration counter and evicts old tool results (if enabled)
   * 3. Builds components and calculates token usage
   * 4. Emits budget warnings if needed
   * 5. Compacts conversation if needed (respecting protection & tool pairs)
   * 6. Builds final output based on returnFormat option
   *
   * @param options - Preparation options
   * @returns PreparedResult with budget, compaction info, and either input or components
   *
   * @example
   * ```typescript
   * // For LLM calls (default)
   * const { input, budget } = await ctx.prepare();
   *
   * // For component inspection/custom assembly
   * const { components, budget } = await ctx.prepare({ returnFormat: 'components' });
   * ```
   */
  async prepare(options?: PrepareOptions): Promise<PreparedResult> {
    const returnFormat = options?.returnFormat ?? 'llm-input';
    let compactionLog: string[] = [];

    // 1. Protect current messages from compaction
    this.protectFromCompaction();

    // 2. Advance iteration counter and run tool result eviction (if enabled)
    if (this._toolResultEvictionPlugin) {
      const statsBefore = this._toolResultEvictionPlugin.getStats();
      logger.debug({
        statsBefore,
        conversationLength: this._conversation.length,
      }, 'prepare: before tool result eviction');

      this._toolResultEvictionPlugin.onIteration();

      // Run eviction at iteration boundary (handles age-based eviction)
      const shouldEvict = this._toolResultEvictionPlugin.shouldEvict();
      logger.debug({
        shouldEvict,
        trackedCount: statsBefore.count,
        config: this._toolResultEvictionPlugin.getConfig(),
      }, `prepare: shouldEvict=${shouldEvict}`);

      if (shouldEvict) {
        const evictionResult = await this._toolResultEvictionPlugin.evictOldResults();
        logger.debug({
          evictionResult: {
            evicted: evictionResult.evicted,
            tokensFreed: evictionResult.tokensFreed,
            memoryKeys: evictionResult.memoryKeys,
            log: evictionResult.log,
          },
        }, `prepare: eviction result - ${evictionResult.evicted} evicted`);

        if (evictionResult.evicted > 0) {
          compactionLog.push(
            `Evicted ${evictionResult.evicted} tool results to memory (${evictionResult.tokensFreed} tokens freed)`
          );
        }
      }

      const statsAfter = this._toolResultEvictionPlugin.getStats();
      logger.debug({
        statsAfter,
      }, 'prepare: after tool result eviction');
    } else {
      logger.debug({
        pluginEnabled: false,
      }, 'prepare: tool result eviction plugin not enabled');
    }

    // 3. Build components and calculate DETAILED budget (shows per-component breakdown)
    let components = await this.buildComponents();
    let budget = this.calculateBudget(components);
    this._lastBudget = budget;

    // 4. Emit warnings
    if (budget.status === 'warning') {
      this.emit('budget:warning', { budget });
    } else if (budget.status === 'critical') {
      this.emit('budget:critical', { budget });
    }

    // 5. Check if compaction needed
    const needsCompaction = this._config.autoCompact &&
      this._strategy.shouldCompact(budget, {
        ...DEFAULT_CONTEXT_CONFIG,
        maxContextTokens: this._maxContextTokens,
        responseReserve: this._config.responseReserve,
      });

    if (needsCompaction) {
      const compactionResult = await this.compactConversation(budget);
      compactionLog.push(...compactionResult.log);
      // Recalculate with detailed components
      components = await this.buildComponents();
      budget = this.calculateBudget(components);
      this._lastBudget = budget;
    }

    this.emit('context:prepared', { budget, compacted: needsCompaction });

    // 6. Build result based on format - reuse already-built components
    if (returnFormat === 'components') {
      return {
        components,
        budget,
        compacted: needsCompaction,
        compactionLog,
      };
    }

    // Default: build LLM input
    const input = await this.buildLLMInput(options?.instructionOverride);
    return {
      input,
      budget,
      compacted: needsCompaction,
      compactionLog,
    };
  }

  /**
   * Prepare conversation for LLM call.
   * @deprecated Use prepare() instead. This is a thin wrapper for backward compatibility.
   */
  async prepareConversation(options?: PrepareConversationOptions): Promise<PreparedConversation> {
    const result = await this.prepare({
      instructionOverride: options?.instructionOverride,
      returnFormat: 'llm-input',
    });
    return {
      input: result.input!,
      budget: result.budget,
      compacted: result.compacted,
      compactionLog: result.compactionLog,
    };
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
   * Register feature-aware tools based on enabled features.
   * Called once during construction to ensure ALL agent types have consistent tools.
   *
   * This is the SINGLE source of truth for context-related tool registration.
   * All agent types (Agent, TaskAgent, UniversalAgent) automatically get these tools.
   *
   * Consolidated tools (Phase 1):
   * - Always: context_stats (unified introspection - gracefully handles disabled features)
   * - When memory feature enabled: memory_store, memory_retrieve, memory_delete, memory_query, memory_cleanup_raw
   * - InContextMemory (context_set, context_delete, context_list) & PersistentInstructions tools
   *   are registered separately in the constructor when those features are enabled.
   */
  private _registerFeatureTools(): void {
    // Always available: consolidated introspection tool
    // This helps the agent understand its own context state
    // It gracefully handles disabled features (returns "feature_disabled" for memory/cache sections)
    this._tools.register(createContextStatsTool());

    // Memory feature includes memory tools
    if (this._features.memory) {
      // Memory manipulation tools (consolidated)
      this._tools.register(createMemoryStoreTool());
      this._tools.register(createMemoryRetrieveTool());
      this._tools.register(createMemoryDeleteTool());
      this._tools.register(createMemoryQueryTool());
      this._tools.register(createMemoryCleanupRawTool());
    }
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
   * Add a message to history with automatic capacity management.
   *
   * This async version checks if adding the message would exceed context budget
   * and triggers compaction BEFORE adding if needed. Use this for large content
   * like tool outputs.
   *
   * @param role - Message role (user, assistant, system, tool)
   * @param content - Message content
   * @param metadata - Optional metadata
   * @returns The added message, or null if history feature is disabled
   *
   * @deprecated Use addUserMessage() or addAssistantResponse() instead
   *
   * @example
   * ```typescript
   * // For large tool outputs, capacity is checked automatically
   * await ctx.addMessage('tool', largeWebFetchResult);
   *
   * // For small messages, same API but less overhead
   * await ctx.addMessage('user', 'Hello');
   * ```
   */
  async addMessage(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<HistoryMessage | null> {
    // Return null if history is disabled
    if (!this._historyEnabled) {
      return null;
    }

    // Estimate tokens for new content
    const estimatedTokens = this._estimator.estimateTokens(content);

    // Only check capacity for larger messages (>1000 tokens) to avoid overhead
    // for small messages like user inputs
    if (estimatedTokens > 1000) {
      const hasCapacity = await this.ensureCapacity(estimatedTokens);
      if (!hasCapacity) {
        // Emit warning but still add (best effort)
        this.emit('budget:critical', { budget: this._lastBudget! });
      }
    }

    // Convert to new conversation format and add
    const msgRole = role === 'user' ? MessageRole.USER
      : role === 'assistant' ? MessageRole.ASSISTANT
      : role === 'system' ? MessageRole.DEVELOPER
      : MessageRole.USER;

    const id = this.generateId();
    const message: Message = {
      type: 'message',
      id,
      role: msgRole,
      content: [{ type: ContentType.INPUT_TEXT, text: content }],
    };

    this._conversation.push(message);
    this._messageMetadata.set(id, {
      timestamp: Date.now(),
      tokenCount: estimatedTokens,
      legacyRole: role,  // Preserve original role for backward compat
    });

    // Emit new-style event
    const index = this._conversation.length - 1;
    this.emit('message:added', { item: message, index });

    // Return legacy format for backward compatibility
    const historyMessage: HistoryMessage = {
      id,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    return historyMessage;
  }

  /**
   * Add a message to history synchronously (without capacity checking).
   *
   * Use this when you need synchronous behavior or for small messages where
   * capacity checking overhead is not worth it. For large content (tool outputs,
   * fetched documents), prefer the async `addMessage()` instead.
   *
   * @param role - Message role (user, assistant, system, tool)
   * @param content - Message content
   * @param metadata - Optional metadata
   * @returns The added message, or null if history feature is disabled
   *
   * @deprecated Use addUserMessage() or addAssistantResponse() instead
   */
  addMessageSync(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata?: Record<string, unknown>
  ): HistoryMessage | null {
    // Return null if history is disabled
    if (!this._historyEnabled) {
      return null;
    }

    // Convert to new conversation format
    const msgRole = role === 'user' ? MessageRole.USER
      : role === 'assistant' ? MessageRole.ASSISTANT
      : role === 'system' ? MessageRole.DEVELOPER
      : MessageRole.USER;

    const id = this.generateId();
    const message: Message = {
      type: 'message',
      id,
      role: msgRole,
      content: [{ type: ContentType.INPUT_TEXT, text: content }],
    };

    this._conversation.push(message);
    this._messageMetadata.set(id, {
      timestamp: Date.now(),
      tokenCount: this._estimator.estimateTokens(content),
      legacyRole: role,  // Preserve original role for backward compat
    });

    // Emit new-style event
    const index = this._conversation.length - 1;
    this.emit('message:added', { item: message, index });

    // Return legacy format for backward compatibility
    const historyMessage: HistoryMessage = {
      id,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    return historyMessage;
  }

  /**
   * Add a tool result to context with automatic capacity management.
   *
   * This is a convenience method for adding tool outputs. It:
   * - Stringifies non-string results
   * - Checks capacity and triggers compaction if needed
   * - Adds as a 'tool' role message
   *
   * Use this for large tool outputs like web_fetch results, file contents, etc.
   *
   * @param result - The tool result (will be stringified for token estimation)
   * @param metadata - Optional metadata (e.g., tool name, duration)
   * @returns The added message, or null if history feature is disabled
   *
   * @deprecated Use addToolResults() with ToolResult[] instead
   *
   * @example
   * ```typescript
   * // Add large web fetch result
   * const html = await webFetch('https://example.com');
   * await ctx.addToolResult(html, { tool: 'web_fetch', url: 'https://example.com' });
   *
   * // Add structured data
   * await ctx.addToolResult({ items: [...], count: 100 }, { tool: 'search' });
   * ```
   */
  async addToolResult(
    result: unknown,
    metadata?: Record<string, unknown>
  ): Promise<HistoryMessage | null> {
    // Return null if history is disabled
    if (!this._historyEnabled) {
      return null;
    }

    // Convert result to string for history
    const content = typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2);

    // Use async addMessage which handles capacity checking
    return this.addMessage('tool', content, metadata);
  }

  /**
   * Get all history messages as InputItem[]
   * @deprecated Use getConversation() instead - this is an alias
   */
  getHistory(): ReadonlyArray<InputItem> {
    // Return a copy to prevent external mutation
    return [...this._conversation];
  }

  /**
   * Get recent N messages as InputItem[]
   * @deprecated Use getConversation().slice(-count) instead
   */
  getRecentHistory(count: number): InputItem[] {
    return this._conversation.slice(-count);
  }

  /**
   * Get message count
   * @deprecated Use getConversationLength() instead
   */
  getMessageCount(): number {
    return this._conversation.length;
  }

  /**
   * Clear history
   * @deprecated Use clearConversation() instead
   */
  clearHistory(reason?: string): void {
    this.clearConversation(reason);
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
          agentId: context?.agentId ?? this._agentId,
          taskId: context?.taskId,
          memory: this._memory?.getAccess(),  // May be undefined if memory disabled
          agentContext: this,  // THE source of truth for context management
          idempotencyCache: this._cache ?? undefined,  // May be undefined if memory disabled
          inContextMemory: this._inContextMemory ?? undefined,  // May be undefined if inContextMemory disabled
          persistentInstructions: this._persistentInstructions ?? undefined,  // May be undefined if persistentInstructions disabled
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
   * Get context components for custom assembly.
   * @deprecated Use prepare({ returnFormat: 'components' }) instead.
   */
  async prepareComponents(): Promise<PreparedContext> {
    const result = await this.prepare({ returnFormat: 'components' });
    return {
      components: result.components!,
      budget: result.budget,
      compacted: result.compacted,
    };
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

  // ============================================================================
  // Auto-Compaction Guard
  // ============================================================================

  /**
   * Ensure there's enough capacity for new content.
   * If adding the estimated tokens would exceed budget, triggers compaction first.
   *
   * This method enables proactive compaction BEFORE content is added, preventing
   * context overflow. It uses the configured strategy to determine when to compact.
   *
   * @param estimatedTokens - Estimated tokens of content to be added
   * @returns true if capacity is available (after potential compaction), false if cannot make room
   *
   * @example
   * ```typescript
   * const tokens = ctx.estimateTokens(largeToolOutput);
   * const hasRoom = await ctx.ensureCapacity(tokens);
   * if (hasRoom) {
   *   await ctx.addMessage('tool', largeToolOutput);
   * } else {
   *   // Handle overflow - truncate or summarize
   * }
   * ```
   */
  async ensureCapacity(estimatedTokens: number): Promise<boolean> {
    // Quick check: calculate current budget
    const components = await this.buildComponents();
    const budget = this.calculateBudget(components);

    // Calculate what utilization would be after adding new content
    const projectedUsed = budget.used + estimatedTokens;
    const availableForContent = budget.total - budget.reserved;
    const projectedUtilization = projectedUsed / availableForContent;

    // Build projected budget for strategy check
    const projectedBudget: ContextBudget = {
      ...budget,
      used: projectedUsed,
      available: budget.available - estimatedTokens,
      utilizationPercent: projectedUtilization * 100,
      status: projectedUtilization >= 0.9 ? 'critical' : projectedUtilization >= 0.75 ? 'warning' : 'ok',
    };

    // Check against strategy threshold (proactive = 0.75, aggressive = 0.6, etc.)
    const needsCompaction = this._strategy.shouldCompact(projectedBudget, {
      ...DEFAULT_CONTEXT_CONFIG,
      maxContextTokens: this._maxContextTokens,
      responseReserve: this._config.responseReserve,
    });

    if (!needsCompaction) {
      return true; // Plenty of room
    }

    // Trigger compaction
    this.emit('budget:warning', { budget });
    await this.doCompaction(components, budget);

    // Re-check after compaction
    const newComponents = await this.buildComponents();
    const newBudget = this.calculateBudget(newComponents);
    this._lastBudget = newBudget;

    // Return true if we now have room
    return (newBudget.available >= estimatedTokens);
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
      historyMessageCount: this._conversation.length,
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
   * - Memory entries (if enabled)
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

    // Serialize full memory state if memory is enabled
    let memory: SerializedMemory | undefined;
    if (this._memory) {
      memory = await this._memory.serialize();
    }

    // Get permission state if permissions are enabled
    const permissionState = this._permissions?.getState() ?? {
      version: 1,
      approvals: {},
      blocklist: [],
      allowlist: [],
    };

    // Convert messageMetadata Map to object for serialization
    const metadataObj: Record<string, MessageMetadata> = {};
    for (const [key, value] of this._messageMetadata) {
      metadataObj[key] = value;
    }

    return {
      version: 2,  // v2 format with conversation as InputItem[] only
      core: {
        systemPrompt: this._systemPrompt,
        instructions: this._instructions,
        // v2: Store conversation as InputItem[] (no legacy HistoryMessage[])
        conversation: this._conversation,
        messageMetadata: metadataObj,
        toolCalls: this._toolCalls,
      },
      tools: this._tools.getState(),
      memory,
      permissions: permissionState,
      plugins: pluginStates,
      config: {
        model: this._config.model,
        maxContextTokens: this._maxContextTokens,
        strategy: this._strategy.name,
        features: this._features,
      },
    };
  }

  /**
   * Restore from saved state
   *
   * Restores ALL state from a previous session.
   * Handles both v1 (HistoryMessage[]) and v2 (InputItem[]) formats.
   */
  async restoreState(state: SerializedAgentContextState): Promise<void> {
    // Core state
    this._systemPrompt = state.core.systemPrompt || '';
    this._instructions = state.core.instructions || '';
    this._toolCalls = state.core.toolCalls || [];

    // Restore conversation based on version
    if (state.version >= 2 && state.core.conversation) {
      // v2 format: restore InputItem[] directly
      this._conversation = state.core.conversation;
      // Restore metadata
      this._messageMetadata.clear();
      if (state.core.messageMetadata) {
        for (const [key, value] of Object.entries(state.core.messageMetadata)) {
          this._messageMetadata.set(key, value as MessageMetadata);
        }
      }
    } else if (state.core.history) {
      // v1 format: convert HistoryMessage[] to InputItem[]
      this._conversation = [];
      this._messageMetadata.clear();
      for (const msg of state.core.history) {
        const role = msg.role === 'user' ? MessageRole.USER
          : msg.role === 'assistant' ? MessageRole.ASSISTANT
          : msg.role === 'system' ? MessageRole.DEVELOPER
          : MessageRole.USER;

        const inputItem: Message = {
          type: 'message',
          id: msg.id,
          role,
          content: [{ type: ContentType.INPUT_TEXT, text: msg.content }],
        };
        this._conversation.push(inputItem);
        this._messageMetadata.set(msg.id, {
          timestamp: msg.timestamp,
          tokenCount: this._estimator.estimateTokens(msg.content),
        });
      }
    } else {
      this._conversation = [];
      this._messageMetadata.clear();
    }

    this._protectedFromIndex = 0;  // Reset protection on restore

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

    // Restore memory entries (if memory feature enabled and state contains memory)
    if (state.memory && this._memory) {
      await this._memory.restore(state.memory);
    }

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

  /**
   * Save the current context state to storage.
   *
   * @param sessionId - Session ID to save as. If not provided, uses the current sessionId.
   * @param metadata - Optional metadata to merge with existing session metadata.
   * @throws Error if no storage is configured or no sessionId is available.
   *
   * @example
   * ```typescript
   * // Save to a new session
   * await ctx.save('my-session-001', { title: 'Research on AI' });
   *
   * // Save to current session (must have been loaded or saved before)
   * await ctx.save();
   * ```
   */
  async save(
    sessionId?: string,
    metadata?: ContextSessionMetadata,
    stateOverride?: SerializedAgentContextState
  ): Promise<void> {
    if (!this._storage) {
      throw new Error('No storage configured. Provide storage in AgentContextConfig to enable session persistence.');
    }

    const targetSessionId = sessionId ?? this._sessionId;
    if (!targetSessionId) {
      throw new Error('No sessionId provided and no current session. Provide a sessionId or load a session first.');
    }

    // Use provided state or get current state
    const state = stateOverride ?? await this.getState();

    // Merge metadata
    const finalMetadata: ContextSessionMetadata = {
      ...this._sessionMetadata,
      ...metadata,
    };

    // Save to storage
    await this._storage.save(targetSessionId, state, finalMetadata);

    // Update internal state
    this._sessionId = targetSessionId;
    this._sessionMetadata = finalMetadata;
  }

  /**
   * Load a session from storage and restore its state.
   *
   * @param sessionId - Session ID to load.
   * @returns true if the session was found and loaded, false if not found.
   * @throws Error if no storage is configured.
   *
   * @example
   * ```typescript
   * const loaded = await ctx.load('my-session-001');
   * if (loaded) {
   *   console.log('Session restored!');
   * } else {
   *   console.log('Session not found, starting fresh.');
   * }
   * ```
   */
  async load(sessionId: string): Promise<boolean> {
    const result = await this.loadRaw(sessionId);
    if (!result) {
      return false;
    }
    await this.restoreState(result.state);
    return true;
  }

  /**
   * Load session state from storage without restoring it.
   * Useful for agents that need to process state before restoring (e.g., to restore agentState).
   *
   * @param sessionId - Session ID to load.
   * @returns The stored state and metadata, or null if not found.
   */
  async loadRaw(sessionId: string): Promise<{ state: SerializedAgentContextState; metadata: ContextSessionMetadata } | null> {
    if (!this._storage) {
      throw new Error('No storage configured. Provide storage in AgentContextConfig to enable session persistence.');
    }

    // Load from storage
    const stored = await this._storage.load(sessionId);
    if (!stored) {
      return null;
    }

    // Update internal session tracking (but don't restore state yet)
    this._sessionId = sessionId;
    this._sessionMetadata = stored.metadata;

    return { state: stored.state, metadata: stored.metadata };
  }

  /**
   * Check if a session exists in storage.
   *
   * @param sessionId - Session ID to check.
   * @returns true if the session exists.
   * @throws Error if no storage is configured.
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    if (!this._storage) {
      throw new Error('No storage configured. Provide storage in AgentContextConfig to enable session persistence.');
    }
    return this._storage.exists(sessionId);
  }

  /**
   * Delete a session from storage.
   *
   * @param sessionId - Session ID to delete. If not provided, deletes the current session.
   * @throws Error if no storage is configured or no sessionId is available.
   */
  async deleteSession(sessionId?: string): Promise<void> {
    if (!this._storage) {
      throw new Error('No storage configured. Provide storage in AgentContextConfig to enable session persistence.');
    }

    const targetSessionId = sessionId ?? this._sessionId;
    if (!targetSessionId) {
      throw new Error('No sessionId provided and no current session.');
    }

    await this._storage.delete(targetSessionId);

    // Clear current session if we deleted it
    if (targetSessionId === this._sessionId) {
      this._sessionId = null;
      this._sessionMetadata = {};
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

    // Destroy memory if it exists (FIX: was missing before)
    this._memory?.destroy();

    // Destroy tool manager (cleans up circuit breaker listeners)
    this._tools.destroy();

    // Clear state
    this._conversation = [];
    this._messageMetadata.clear();
    this._protectedFromIndex = 0;
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

    // Feature instructions (compactable but high priority)
    // Provides runtime guidance for using enabled features efficiently
    const featureInstructions = buildFeatureInstructions(this._features);
    if (featureInstructions) {
      components.push(featureInstructions);
    }

    // Conversation (compactable, priority from profile) - only if history enabled
    if (this._features.history && this._conversation.length > 0) {
      components.push({
        name: 'conversation_history',
        content: this.formatConversationForContext(),
        priority: priorityProfile.conversation_history ?? 6,
        compactable: true,
        metadata: {
          messageCount: this._conversation.length,
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
        const result = await this.compactConversation(currentBudget);
        freed = result.tokensFreed;
        log.push(...result.log);
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

  // ============================================================================
  // Helper Methods for Conversation Management (NEW)
  // ============================================================================

  /**
   * Extract text content from Content array
   */
  private extractTextFromContent(content: Content[]): string {
    const texts: string[] = [];
    for (const c of content) {
      if (c.type === ContentType.INPUT_TEXT || c.type === ContentType.OUTPUT_TEXT) {
        texts.push((c as any).text || '');
      } else if (c.type === ContentType.TOOL_RESULT) {
        texts.push((c as any).content || '');
      }
    }
    return texts.join(' ');
  }

  /**
   * Estimate tokens for a single InputItem
   */
  private estimateMessageTokens(item: InputItem): number {
    if (item.type === 'message') {
      const msg = item as Message;
      let total = 4; // Message overhead
      for (const c of msg.content) {
        if (c.type === ContentType.INPUT_TEXT || c.type === ContentType.OUTPUT_TEXT) {
          total += this._estimator.estimateTokens((c as any).text || '');
        } else if (c.type === ContentType.TOOL_USE) {
          total += this._estimator.estimateTokens((c as any).name || '');
          total += this._estimator.estimateDataTokens((c as any).input || {});
        } else if (c.type === ContentType.TOOL_RESULT) {
          total += this._estimator.estimateTokens((c as any).content || '');
        } else if (c.type === ContentType.INPUT_IMAGE_URL) {
          // Images are typically 85-170 tokens per tile
          total += 200;
        }
      }
      return total;
    }
    return 50; // Default for unknown types
  }

  /**
   * Find tool_use/tool_result pairs in conversation
   * Returns Map<tool_use_id, message_index>
   */
  private findToolPairs(): Map<string, { useIndex: number; resultIndex: number | null }> {
    const pairs = new Map<string, { useIndex: number; resultIndex: number | null }>();

    for (let i = 0; i < this._conversation.length; i++) {
      const item = this._conversation[i];
      if (!item) continue;
      if (item.type === 'message') {
        const msg = item as Message;
        for (const content of msg.content) {
          if (content.type === ContentType.TOOL_USE) {
            const toolUseId = (content as any).id;
            if (toolUseId) {
              pairs.set(toolUseId, { useIndex: i, resultIndex: null });
            }
          } else if (content.type === ContentType.TOOL_RESULT) {
            const toolUseId = (content as any).tool_use_id;
            const pair = pairs.get(toolUseId);
            if (pair) {
              pair.resultIndex = i;
            }
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Remove a tool_use/tool_result pair from conversation by toolUseId.
   * Used by ToolResultEvictionPlugin to evict old tool results.
   *
   * @param toolUseId - The tool_use ID linking request/response
   * @returns Estimated tokens freed
   */
  removeToolPair(toolUseId: string): number {
    let tokensFreed = 0;
    const indicesToRemove = new Set<number>();

    // Find indices of both tool_use and tool_result for this toolUseId
    for (let i = 0; i < this._conversation.length; i++) {
      const item = this._conversation[i];
      if (item?.type !== 'message') continue;

      const msg = item as Message;
      for (const content of msg.content) {
        // Match tool_use by id
        if (content.type === ContentType.TOOL_USE && (content as any).id === toolUseId) {
          indicesToRemove.add(i);
          const meta = this._messageMetadata.get(msg.id!);
          tokensFreed += meta?.tokenCount ?? this.estimateMessageTokens(msg);
        }
        // Match tool_result by tool_use_id
        if (content.type === ContentType.TOOL_RESULT && (content as any).tool_use_id === toolUseId) {
          indicesToRemove.add(i);
          const meta = this._messageMetadata.get(msg.id!);
          tokensFreed += meta?.tokenCount ?? this.estimateMessageTokens(msg);
        }
      }
    }

    if (indicesToRemove.size === 0) return 0;

    // Remove in reverse order to preserve indices
    const sortedIndices = [...indicesToRemove].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const item = this._conversation[idx];
      const id = (item as any)?.id;
      if (id) this._messageMetadata.delete(id);
      this._conversation.splice(idx, 1);
    }

    // Adjust protected index
    let removedBeforeProtected = 0;
    for (const idx of indicesToRemove) {
      if (idx < this._protectedFromIndex) removedBeforeProtected++;
    }
    this._protectedFromIndex = Math.max(0, this._protectedFromIndex - removedBeforeProtected);

    // Notify eviction plugin to update its message indices
    if (this._toolResultEvictionPlugin) {
      this._toolResultEvictionPlugin.updateMessageIndices(indicesToRemove);
    }

    return tokensFreed;
  }

  /**
   * Compact conversation respecting tool pairs and protected messages
   */
  private async compactConversation(_budget: ContextBudget): Promise<{ log: string[]; tokensFreed: number }> {
    const log: string[] = [];
    const toolPairs = this.findToolPairs();

    // Cannot compact protected messages
    const compactableEnd = this._protectedFromIndex;
    if (compactableEnd <= 0) {
      log.push('No compactable messages (all protected)');
      return { log, tokensFreed: 0 };
    }

    // Build set of indices that are part of tool pairs (must be removed together)
    const toolPairIndices = new Map<number, Set<number>>(); // index → all indices in same pair group
    for (const [, pair] of toolPairs) {
      if (pair.resultIndex !== null) {
        // Both tool_use and tool_result exist - they form a group
        const group = new Set([pair.useIndex, pair.resultIndex]);
        toolPairIndices.set(pair.useIndex, group);
        toolPairIndices.set(pair.resultIndex, group);
      }
    }

    // Identify safe compaction boundaries (don't split tool pairs)
    const safeIndices: number[] = [];
    for (let i = 0; i < compactableEnd; i++) {
      let isSafe = true;

      const pairGroup = toolPairIndices.get(i);
      if (pairGroup) {
        // This message is part of a tool pair - check if ALL members are compactable
        for (const pairIndex of pairGroup) {
          if (pairIndex >= compactableEnd) {
            // Partner is protected - can't remove this one
            isSafe = false;
            break;
          }
        }
      }

      if (isSafe) {
        safeIndices.push(i);
      }
    }

    if (safeIndices.length === 0) {
      log.push('No safe messages to compact (all involved in tool pairs)');
      return { log, tokensFreed: 0 };
    }

    // Remove oldest safe messages, ensuring tool pairs stay together
    const toRemove = new Set<number>();
    let removed = 0;
    const targetRemoval = Math.min(
      Math.floor(safeIndices.length / 2),
      safeIndices.length
    );

    for (const idx of safeIndices) {
      if (removed >= targetRemoval) break;

      // If this is part of a tool pair, add all members
      const pairGroup = toolPairIndices.get(idx);
      if (pairGroup) {
        // Only add if we haven't already added this group
        if (!toRemove.has(idx)) {
          for (const pairIdx of pairGroup) {
            toRemove.add(pairIdx);
            removed++;
          }
        }
      } else {
        toRemove.add(idx);
        removed++;
      }
    }
    let tokensFreed = 0;

    // Build new conversation excluding removed messages
    const newConversation: InputItem[] = [];
    for (let i = 0; i < this._conversation.length; i++) {
      const item = this._conversation[i];
      if (!item) continue;
      if (toRemove.has(i)) {
        const id = (item as any).id;
        const metadata = id ? this._messageMetadata.get(id) : null;
        tokensFreed += metadata?.tokenCount || this.estimateMessageTokens(item);
        if (id) {
          this._messageMetadata.delete(id);
        }
      } else {
        newConversation.push(item);
      }
    }

    this._conversation = newConversation;

    // Adjust protected index
    let removedBeforeProtected = 0;
    for (const idx of toRemove) {
      if (idx < this._protectedFromIndex) {
        removedBeforeProtected++;
      }
    }
    this._protectedFromIndex -= removedBeforeProtected;

    log.push(`Removed ${toRemove.size} messages, freed ~${tokensFreed} tokens`);

    this._compactionCount++;
    this._totalTokensFreed += tokensFreed;
    this.emit('history:compacted', { removedCount: toRemove.size });

    return { log, tokensFreed };
  }

  /**
   * Build final InputItem[] for LLM call
   */
  private async buildLLMInput(instructionOverride?: string): Promise<InputItem[]> {
    const input: InputItem[] = [];

    // Build system content
    const systemParts: string[] = [];

    // System prompt
    if (this._systemPrompt) {
      systemParts.push(this._systemPrompt);
    }

    // Task type prompt
    const taskTypePrompt = this.buildTaskTypePromptForFeatures(this.getTaskType());
    if (taskTypePrompt) {
      systemParts.push(taskTypePrompt);
    }

    // Instructions (can be overridden)
    const instructions = instructionOverride ?? this._instructions;
    if (instructions) {
      systemParts.push(instructions);
    }

    // Feature instructions
    const featureInstructions = buildFeatureInstructions(this._features);
    if (featureInstructions?.content && typeof featureInstructions.content === 'string') {
      systemParts.push(featureInstructions.content);
    }

    // Memory index
    if (this._features.memory && this._memory) {
      const memoryIndex = await this._memory.formatIndex();
      if (memoryIndex && !memoryIndex.includes('Memory is empty.')) {
        systemParts.push(`## Working Memory\n${memoryIndex}`);
      }
    }

    // Plugin components
    for (const plugin of this._plugins.values()) {
      try {
        const component = await plugin.getComponent();
        if (component?.content && typeof component.content === 'string') {
          systemParts.push(component.content);
        }
      } catch {
        // Ignore plugin errors
      }
    }

    // Add system message if we have content
    if (systemParts.length > 0) {
      input.push({
        type: 'message',
        role: MessageRole.DEVELOPER,
        content: [{ type: ContentType.INPUT_TEXT, text: systemParts.join('\n\n') }],
      } as Message);
    }

    // Add conversation
    input.push(...this._conversation);

    return input;
  }

  /**
   * Format conversation for context (backward compat for buildComponents)
   */
  private formatConversationForContext(): string {
    const lines: string[] = [];

    for (const item of this._conversation) {
      if (item.type === 'message') {
        const msg = item as Message;
        const roleLabel = msg.role === MessageRole.USER ? 'User'
          : msg.role === MessageRole.ASSISTANT ? 'Assistant'
          : msg.role === MessageRole.DEVELOPER ? 'System'
          : 'Message';

        const textContent = this.extractTextFromContent(msg.content);
        if (textContent) {
          lines.push(`${roleLabel}: ${textContent}`);
        }

        // Also show tool uses/results
        for (const c of msg.content) {
          if (c.type === ContentType.TOOL_USE) {
            const toolUse = c as any;
            lines.push(`${roleLabel}: [Called tool: ${toolUse.name}]`);
          } else if (c.type === ContentType.TOOL_RESULT) {
            const toolResult = c as any;
            const preview = (toolResult.content || '').slice(0, 200);
            lines.push(`${roleLabel}: [Tool result: ${preview}${toolResult.content?.length > 200 ? '...' : ''}]`);
          }
        }
      }
    }

    return lines.join('\n\n');
  }
}
