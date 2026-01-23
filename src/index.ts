/**
 * @oneringai/agents - Unified AI agent library
 *
 * Connector-First Architecture: Simple, DRY, Powerful
 *
 * @example
 * ```typescript
 * import { Connector, Agent, Vendor } from '@oneringai/agents';
 *
 * // Create connector (can have multiple per vendor!)
 * Connector.create({
 *   name: 'openai-main',
 *   vendor: Vendor.OpenAI,
 *   auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
 * });
 *
 * // Create agent from connector
 * const agent = Agent.create({
 *   connector: 'openai-main',
 *   model: 'gpt-4',
 *   tools: [myTool]
 * });
 *
 * // Run the agent
 * const response = await agent.run('Hello!');
 * ```
 */

// ============ Core API (Primary) ============
export { Connector, Agent, Vendor, VENDORS, isVendor, createProvider } from './core/index.js';
export type { AgentConfig } from './core/index.js';

// ============ Task-Based Agents ============
export { TaskAgent, WorkingMemory, ContextManager, IdempotencyCache, createMemoryTools } from './capabilities/taskAgent/index.js';
export type {
  TaskAgentConfig,
  TaskAgentHooks,
  AgentHandle,
  PlanResult,
  PlanUpdates,
  TaskContext,
  TaskResult,
  ErrorContext,
  WorkingMemoryEvents,
  ContextManagerConfig,
  ContextComponents,
  ContextBudget,
  CompactionStrategy,
  IdempotencyCacheConfig,
  CacheStats,
} from './capabilities/taskAgent/index.js';

// Task & Plan Entities
export type {
  Task,
  TaskInput,
  TaskStatus,
  TaskCondition,
  TaskExecution,
  ExternalDependency,
  Plan,
  PlanInput,
  PlanStatus,
  PlanConcurrency,
} from './domain/entities/Task.js';

// Memory Entities
export type {
  MemoryEntry,
  MemoryIndex,
  MemoryIndexEntry,
  MemoryScope,
  WorkingMemoryConfig,
} from './domain/entities/Memory.js';
export { DEFAULT_MEMORY_CONFIG } from './domain/entities/Memory.js';

// Agent State
export type {
  AgentState,
  AgentStatus,
  AgentConfig as TaskAgentStateConfig,
  ConversationMessage,
  AgentMetrics,
} from './domain/entities/AgentState.js';

// Storage Interfaces
export type { IMemoryStorage } from './domain/interfaces/IMemoryStorage.js';
export type { IPlanStorage } from './domain/interfaces/IPlanStorage.js';
export type { IAgentStateStorage } from './domain/interfaces/IAgentStateStorage.js';
export { createAgentStorage } from './infrastructure/storage/index.js';
export type { IAgentStorage } from './infrastructure/storage/InMemoryStorage.js';
export { InMemoryStorage, InMemoryPlanStorage, InMemoryAgentStateStorage } from './infrastructure/storage/index.js';

// Tool Context
export type { ToolContext as TaskToolContext, WorkingMemoryAccess } from './domain/interfaces/IToolContext.js';

// ============ Domain Types ============

// Content
export { ContentType } from './domain/entities/Content.js';
export type {
  Content,
  InputTextContent,
  InputImageContent,
  OutputTextContent,
  ToolUseContent,
  ToolResultContent,
} from './domain/entities/Content.js';

// Messages
export { MessageRole } from './domain/entities/Message.js';
export type {
  Message,
  InputItem,
  OutputItem,
  CompactionItem,
  ReasoningItem,
} from './domain/entities/Message.js';

// Tools
export { ToolCallState } from './domain/entities/Tool.js';
export type {
  Tool,
  FunctionToolDefinition,
  BuiltInTool,
  ToolFunction,
  ToolCall,
  ToolResult,
  ToolExecutionContext,
  JSONSchema,
} from './domain/entities/Tool.js';

// Response
export type { LLMResponse, AgentResponse } from './domain/entities/Response.js';

// Connector types
export type {
  ConnectorConfig,
  ConnectorAuth,
  OAuthConnectorAuth,
  APIKeyConnectorAuth,
  JWTConnectorAuth,
} from './domain/entities/Connector.js';

// Model Registry
export type { ILLMDescription } from './domain/entities/Model.js';
export {
  LLM_MODELS,
  MODEL_REGISTRY,
  getModelInfo,
  getModelsByVendor,
  getActiveModels,
  calculateCost,
} from './domain/entities/Model.js';

// ============ Streaming ============
export { StreamEventType } from './domain/entities/StreamEvent.js';
export type {
  StreamEvent,
  ResponseCreatedEvent,
  ResponseInProgressEvent,
  OutputTextDeltaEvent,
  OutputTextDoneEvent,
  ToolCallStartEvent,
  ToolCallArgumentsDeltaEvent,
  ToolCallArgumentsDoneEvent,
  ToolExecutionStartEvent,
  ToolExecutionDoneEvent,
  IterationCompleteEvent,
  ResponseCompleteEvent,
  ErrorEvent,
} from './domain/entities/StreamEvent.js';
export {
  isStreamEvent,
  isOutputTextDelta,
  isToolCallArgumentsDelta,
  isToolCallArgumentsDone,
  isResponseComplete,
  isErrorEvent,
} from './domain/entities/StreamEvent.js';
export { StreamState } from './domain/entities/StreamState.js';
export { StreamHelpers } from './capabilities/agents/StreamHelpers.js';

// ============ Hooks & Events (Enterprise) ============
export { ToolRegistry, ExecutionContext, HookManager } from './capabilities/agents/index.js';
export type {
  AgenticLoopEvents,
  AgenticLoopEventName,
  HookConfig,
  HookName,
  Hook,
  ModifyingHook,
  BeforeToolContext,
  AfterToolContext,
  ApproveToolContext,
  ToolModification,
  ApprovalResult,
  HistoryMode,
  ExecutionMetrics,
  AuditEntry,
} from './capabilities/agents/index.js';

// ============ Errors ============
export {
  AIError,
  ProviderNotFoundError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  ToolExecutionError,
  ToolTimeoutError,
  ToolNotFoundError,
  ModelNotSupportedError,
  InvalidConfigError,
  InvalidToolArgumentsError,
  ProviderError,
} from './domain/errors/AIErrors.js';

// ============ Interfaces (for extensibility) ============
export type { IProvider, ProviderCapabilities } from './domain/interfaces/IProvider.js';
export type { ITextProvider, TextGenerateOptions, ModelCapabilities } from './domain/interfaces/ITextProvider.js';
export type { IToolExecutor } from './domain/interfaces/IToolExecutor.js';
export type { IDisposable, IAsyncDisposable } from './domain/interfaces/IDisposable.js';
export { assertNotDestroyed } from './domain/interfaces/IDisposable.js';

// Base classes for custom providers
export { BaseProvider } from './infrastructure/providers/base/BaseProvider.js';
export { BaseTextProvider } from './infrastructure/providers/base/BaseTextProvider.js';
export { ProviderErrorMapper } from './infrastructure/providers/base/ProviderErrorMapper.js';

// ============ OAuth & Storage (for external APIs) ============
export { OAuthManager, MemoryStorage, FileStorage } from './connectors/index.js';
export { generateEncryptionKey, authenticatedFetch, createAuthenticatedFetch, generateWebAPITool } from './connectors/index.js';
export type { OAuthConfig, OAuthFlow, ITokenStorage, FileStorageConfig, StoredToken } from './connectors/index.js';

// ConnectorConfig storage (persistent connector configs with encryption)
export {
  ConnectorConfigStore,
  MemoryConnectorStorage,
  FileConnectorStorage,
  CONNECTOR_CONFIG_VERSION,
} from './connectors/index.js';
export type {
  IConnectorConfigStorage,
  StoredConnectorConfig,
  FileConnectorStorageConfig,
} from './connectors/index.js';

// ============ Utilities ============
export { MessageBuilder, createTextMessage, createMessageWithImages } from './utils/messageBuilder.js';
export { readClipboardImage, hasClipboardImage } from './utils/clipboardImage.js';
export type { ClipboardImageResult } from './utils/clipboardImage.js';

// ============ Pre-built Tools ============
export * as tools from './tools/index.js';
export { createExecuteJavaScriptTool } from './tools/code/executeJavaScript.js';

// ============ Built-in Agents ============
export { ProviderConfigAgent } from './agents/index.js';
export type { ConnectorConfigResult } from './agents/index.js';
