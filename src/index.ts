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
export type { AgentConfig, AgentSessionConfig } from './core/index.js';

// Audio Capabilities
export { TextToSpeech, SpeechToText } from './core/index.js';
export type { TextToSpeechConfig, SpeechToTextConfig } from './core/index.js';

// Image Capabilities
export { ImageGeneration } from './capabilities/images/index.js';
export type { ImageGenerationCreateOptions, SimpleGenerateOptions } from './capabilities/images/index.js';
export { createImageProvider } from './core/index.js';

// Tool Management (Dynamic)
export { ToolManager } from './core/index.js';
export type {
  ToolOptions,
  ToolCondition,
  ToolSelectionContext,
  ToolRegistration,
  ToolMetadata,
  ToolManagerStats,
  SerializedToolState,
  ToolManagerEvent,
} from './core/index.js';

// Session Management (Persistence)
export { SessionManager, createEmptyHistory, createEmptyMemory, addHistoryEntry } from './core/index.js';
export type {
  Session,
  SessionMetadata,
  SessionMetrics,
  SessionFilter,
  SessionSummary,
  ISessionStorage,
  SerializedHistory,
  SerializedHistoryEntry,
  SerializedMemory,
  SerializedMemoryEntry,
  SerializedPlan,
  SessionManagerConfig,
  SessionManagerEvent,
} from './core/index.js';

// ============ Task-Based Agents ============
export {
  TaskAgent,
  WorkingMemory,
  IdempotencyCache,
  HistoryManager,
  ExternalDependencyHandler,
  PlanExecutor,
  CheckpointManager,
  createMemoryTools,
} from './capabilities/taskAgent/index.js';
export type {
  TaskAgentConfig,
  TaskAgentSessionConfig,
  TaskAgentHooks,
  AgentHandle,
  PlanResult,
  PlanUpdates,
  TaskContext,
  TaskResult,
  ErrorContext,
  WorkingMemoryEvents,
  IdempotencyCacheConfig,
  CacheStats,
  HistoryManagerConfig,
  ExternalDependencyEvents,
  PlanExecutorConfig,
  PlanExecutorEvents,
  PlanExecutionResult,
  CheckpointStrategy,
} from './capabilities/taskAgent/index.js';
export { DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_CHECKPOINT_STRATEGY } from './capabilities/taskAgent/index.js';

// ============ Context Management (Universal) ============
export { ContextManager } from './core/context/index.js';
export type {
  IContextComponent,
  ContextBudget,
  PreparedContext,
  ContextManagerConfig,
  IContextProvider,
  ITokenEstimator,
  IContextCompactor,
  IContextStrategy,
} from './core/context/types.js';
export { DEFAULT_CONTEXT_CONFIG } from './core/context/types.js';

// Context Strategies
export {
  ProactiveCompactionStrategy,
  AggressiveCompactionStrategy,
  LazyCompactionStrategy,
  RollingWindowStrategy,
  AdaptiveStrategy,
  createStrategy,
} from './core/context/strategies/index.js';

// Context Infrastructure
export {
  TaskAgentContextProvider,
  TruncateCompactor,
  SummarizeCompactor,
  MemoryEvictionCompactor,
  ApproximateTokenEstimator,
  createEstimator,
} from './infrastructure/context/index.js';

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

// Session Storage Implementations
export { InMemorySessionStorage, FileSessionStorage } from './infrastructure/storage/index.js';
export type { FileSessionStorageConfig } from './infrastructure/storage/index.js';

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

// Audio Model Registries
export type { ITTSModelDescription, TTSModelCapabilities } from './domain/entities/TTSModel.js';
export type { ISTTModelDescription, STTModelCapabilities } from './domain/entities/STTModel.js';
export type { IVoiceInfo } from './domain/entities/SharedVoices.js';
export {
  TTS_MODELS,
  TTS_MODEL_REGISTRY,
  getTTSModelInfo,
  getTTSModelsByVendor,
  getActiveTTSModels,
  getTTSModelsWithFeature,
  calculateTTSCost,
} from './domain/entities/TTSModel.js';
export {
  STT_MODELS,
  STT_MODEL_REGISTRY,
  getSTTModelInfo,
  getSTTModelsByVendor,
  getActiveSTTModels,
  getSTTModelsWithFeature,
  calculateSTTCost,
} from './domain/entities/STTModel.js';

// Image Model Registry
export type { IImageModelDescription, ImageModelCapabilities, ImageModelPricing } from './domain/entities/ImageModel.js';
export {
  IMAGE_MODELS,
  IMAGE_MODEL_REGISTRY,
  getImageModelInfo,
  getImageModelsByVendor,
  getActiveImageModels,
  getImageModelsWithFeature,
  calculateImageCost,
} from './domain/entities/ImageModel.js';

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
  isToolCallStart,
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

// Audio Interfaces
export type {
  ITextToSpeechProvider,
  ISpeechToTextProvider,
  TTSOptions,
  TTSResponse,
  STTOptions,
  STTResponse,
  STTOutputFormat,
  WordTimestamp,
  SegmentTimestamp,
} from './domain/interfaces/IAudioProvider.js';

// Image Interfaces
export type {
  IImageProvider,
  ImageGenerateOptions,
  ImageEditOptions,
  ImageVariationOptions,
  ImageResponse,
} from './domain/interfaces/IImageProvider.js';

// Base classes for custom providers
export { BaseProvider } from './infrastructure/providers/base/BaseProvider.js';
export { BaseTextProvider } from './infrastructure/providers/base/BaseTextProvider.js';
export { BaseMediaProvider } from './infrastructure/providers/base/BaseMediaProvider.js';
export { ProviderErrorMapper } from './infrastructure/providers/base/ProviderErrorMapper.js';

// Shared types for multi-modal
export type {
  AspectRatio,
  QualityLevel,
  AudioFormat,
  OutputFormat,
  ISourceLinks,
  VendorOptionSchema,
  IBaseModelDescription,
} from './domain/types/SharedTypes.js';

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

// ============ Resilience & Observability (Phase 3) ============
export { CircuitBreaker, CircuitOpenError } from './infrastructure/resilience/index.js';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerEvents,
} from './infrastructure/resilience/index.js';
export { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './infrastructure/resilience/index.js';

export {
  calculateBackoff,
  addJitter,
  backoffWait,
  backoffSequence,
  retryWithBackoff,
} from './infrastructure/resilience/index.js';
export type { BackoffConfig, BackoffStrategyType } from './infrastructure/resilience/index.js';
export { DEFAULT_BACKOFF_CONFIG } from './infrastructure/resilience/index.js';

export { FrameworkLogger, logger } from './infrastructure/observability/index.js';
export type { LogLevel, LoggerConfig, LogEntry } from './infrastructure/observability/index.js';

export {
  NoOpMetrics,
  ConsoleMetrics,
  InMemoryMetrics,
  createMetricsCollector,
  metrics,
  setMetricsCollector,
} from './infrastructure/observability/index.js';
export type { MetricsCollector, MetricTags, MetricsCollectorType } from './infrastructure/observability/index.js';

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

// ============ UniversalAgent (NEW) ============
export { UniversalAgent, ModeManager } from './capabilities/universalAgent/index.js';
export type { UniversalAgentEvents, ModeManagerEvents } from './capabilities/universalAgent/index.js';
export {
  getMetaTools,
  isMetaTool,
  META_TOOL_NAMES,
} from './capabilities/universalAgent/index.js';
export type {
  UniversalAgentConfig,
  UniversalAgentSessionConfig,
  UniversalAgentPlanningConfig,
  UniversalResponse,
  UniversalEvent,
  AgentMode,
  TaskProgress,
  IntentAnalysis,
  PlanChange,
  ExecutionResult,
  ToolCallResult as UniversalToolCallResult,
  ModeState,
} from './capabilities/universalAgent/index.js';
