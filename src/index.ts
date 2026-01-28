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

// Video Capabilities
export { VideoGeneration } from './capabilities/video/index.js';
export type {
  VideoGenerationCreateOptions,
  SimpleVideoGenerateOptions,
} from './capabilities/video/index.js';
export { createVideoProvider } from './core/createVideoProvider.js';

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

// Tool Permissions (NEW)
export { ToolPermissionManager } from './core/permissions/index.js';
export type {
  PermissionScope,
  RiskLevel,
  ToolPermissionConfig,
  ApprovalCacheEntry,
  SerializedApprovalState,
  SerializedApprovalEntry,
  PermissionCheckResult,
  ApprovalDecision,
  AgentPermissionsConfig,
  PermissionCheckContext,
  PermissionManagerEvent,
} from './core/permissions/index.js';
export { APPROVAL_STATE_VERSION, DEFAULT_PERMISSION_CONFIG, DEFAULT_ALLOWLIST } from './core/permissions/index.js';
export type { DefaultAllowlistedTool } from './core/permissions/index.js';

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
  PlanUpdateOptions,
  TaskContext,
  TaskResult,
  ErrorContext,
  WorkingMemoryEvents,
  EvictionStrategy,
  IdempotencyCacheConfig,
  CacheStats,
  HistoryManagerConfig,
  ExternalDependencyEvents,
  PlanExecutorConfig,
  PlanExecutorEvents,
  PlanExecutionResult,
  CheckpointStrategy,
} from './capabilities/taskAgent/index.js';
export { DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_SUMMARIZATION_PROMPT } from './capabilities/taskAgent/index.js';
export type { SummarizerFunction } from './capabilities/taskAgent/index.js';

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

// Context Builder
export { DefaultContextBuilder } from './core/context/DefaultContextBuilder.js';
export type {
  IContextBuilder,
  ContextSource,
  BuiltContext,
  ContextBuilderConfig,
} from './domain/interfaces/IContextBuilder.js';
export { DEFAULT_CONTEXT_BUILDER_CONFIG } from './domain/interfaces/IContextBuilder.js';

// ============ Conversation History Management ============
export { ConversationHistoryManager } from './core/history/index.js';
export type {
  IHistoryManager,
  IHistoryStorage,
  HistoryMessage,
  IHistoryManagerConfig,
  HistoryManagerEvents,
  SerializedHistoryState,
  ConversationHistoryManagerConfig,
} from './core/history/index.js';
export { DEFAULT_HISTORY_MANAGER_CONFIG } from './core/history/index.js';
export { InMemoryHistoryStorage } from './infrastructure/storage/InMemoryHistoryStorage.js';

// Task & Plan Entities
export type {
  Task,
  TaskInput,
  TaskStatus,
  TaskCondition,
  TaskExecution,
  TaskValidation,
  TaskValidationResult,
  ExternalDependency,
  Plan,
  PlanInput,
  PlanStatus,
  PlanConcurrency,
} from './domain/entities/Task.js';

// Task & Plan Utilities
export {
  createTask,
  createPlan,
  detectDependencyCycle,
  canTaskExecute,
  getNextExecutableTasks,
  evaluateCondition,
  updateTaskStatus,
  isTaskBlocked,
  getTaskDependencies,
  resolveDependencies,
  isTerminalStatus,
  TERMINAL_TASK_STATUSES,
} from './domain/entities/Task.js';

// Memory Entities
export type {
  MemoryEntry,
  MemoryEntryInput,
  MemoryIndex,
  MemoryIndexEntry,
  MemoryScope,
  MemoryPriority,
  TaskAwareScope,
  SimpleScope,
  TaskStatusForMemory,
  WorkingMemoryConfig,
} from './domain/entities/Memory.js';
export {
  DEFAULT_MEMORY_CONFIG,
  forTasks,
  forPlan,
  scopeEquals,
  scopeMatches,
  isSimpleScope,
  isTaskAwareScope,
  isTerminalMemoryStatus,
  calculateEntrySize,
  MEMORY_PRIORITY_VALUES,
} from './domain/entities/Memory.js';

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
export {
  ToolCallState,
  defaultDescribeCall,
  getToolCallDescription,
} from './domain/entities/Tool.js';
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

// Video Model Registry
export type { IVideoModelDescription, VideoModelCapabilities, VideoModelPricing } from './domain/entities/VideoModel.js';
export {
  VIDEO_MODELS,
  VIDEO_MODEL_REGISTRY,
  getVideoModelInfo,
  getVideoModelsByVendor,
  getActiveVideoModels,
  getVideoModelsWithFeature,
  getVideoModelsWithAudio,
  calculateVideoCost,
} from './domain/entities/VideoModel.js';

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
  // TaskAgent errors
  DependencyCycleError,
  TaskTimeoutError,
  TaskValidationError,
  ParallelTasksError,
} from './domain/errors/AIErrors.js';
export type { TaskFailure } from './domain/errors/AIErrors.js';

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

// Video Interfaces
export type {
  IVideoProvider,
  VideoGenerateOptions,
  VideoExtendOptions,
  VideoResponse,
  VideoJob,
  VideoStatus,
} from './domain/interfaces/IVideoProvider.js';

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

// ============ External Services & Connector Tools ============
// Services constants for well-known external services
export {
  Services,
  SERVICE_DEFINITIONS,
  SERVICE_URL_PATTERNS,
  SERVICE_INFO,
  detectServiceFromURL,
  getServiceInfo,
  getServiceDefinition,
  getServicesByCategory,
  getAllServiceIds,
  isKnownService,
} from './domain/entities/Services.js';
export type { ServiceType, ServiceInfo, ServiceDefinition, ServiceCategory } from './domain/entities/Services.js';

// Connector resilience defaults
export {
  DEFAULT_CONNECTOR_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRYABLE_STATUSES,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
} from './core/Connector.js';
export type { ConnectorFetchOptions } from './core/Connector.js';

// ConnectorTools framework for vendor-dependent tools
export {
  ConnectorTools,
} from './tools/connector/index.js';
export type {
  ServiceToolFactory,
  GenericAPIToolOptions,
  GenericAPICallArgs,
  GenericAPICallResult,
} from './tools/connector/index.js';

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

export { TokenBucketRateLimiter, RateLimitError } from './infrastructure/resilience/index.js';
export type { RateLimiterConfig, RateLimiterMetrics } from './infrastructure/resilience/index.js';
export { DEFAULT_RATE_LIMITER_CONFIG } from './infrastructure/resilience/index.js';

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
export { extractJSON, extractJSONField, extractNumber } from './utils/jsonExtractor.js';
export type { JSONExtractionResult } from './utils/jsonExtractor.js';

// ============ Pre-built Tools ============
export * as tools from './tools/index.js';
export { createExecuteJavaScriptTool } from './tools/code/executeJavaScript.js';

// Filesystem tools (factory functions and types)
export {
  readFile,
  writeFile,
  editFile,
  glob,
  grep,
  listDirectory,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  DEFAULT_FILESYSTEM_CONFIG,
  validatePath,
  isExcludedExtension,
  developerTools,
} from './tools/index.js';

export type {
  FilesystemToolConfig,
  ReadFileResult,
  WriteFileResult,
  EditFileResult,
  GlobResult,
  GrepResult,
  GrepMatch,
} from './tools/index.js';

// Shell tools (factory functions and types)
export {
  bash,
  createBashTool,
  getBackgroundOutput,
  killBackgroundProcess,
  DEFAULT_SHELL_CONFIG,
  isBlockedCommand,
} from './tools/index.js';

export type {
  ShellToolConfig,
  BashResult,
} from './tools/index.js';

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
