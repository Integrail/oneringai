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

// AgentContext - Unified "Swiss Army Knife" for context management
export { AgentContext, DEFAULT_FEATURES } from './core/index.js';
export type {
  AgentContextConfig,
  AgentContextFeatures,
  AgentContextEvents,
  AgentContextMetrics,
  HistoryMessage as AgentContextHistoryMessage,
  ToolCallRecord,
  SerializedAgentContextState,
  DirectCallOptions,
  PrepareOptions,
  PreparedResult,
} from './core/index.js';

// Feature-aware tool factory
export { getAgentContextTools, getBasicIntrospectionTools, getMemoryTools } from './core/index.js';

// Feature Instructions (runtime usage instructions for enabled features)
export {
  buildFeatureInstructions,
  INTROSPECTION_INSTRUCTIONS,
  WORKING_MEMORY_INSTRUCTIONS,
  IN_CONTEXT_MEMORY_INSTRUCTIONS,
  PERSISTENT_INSTRUCTIONS_INSTRUCTIONS,
  TOOL_OUTPUT_TRACKING_INSTRUCTIONS,
  AUTO_SPILL_INSTRUCTIONS,
  TOOL_RESULT_EVICTION_INSTRUCTIONS,
  getAllInstructions,
} from './core/index.js';

// Context Plugins
export { ToolOutputPlugin, AutoSpillPlugin, ToolResultEvictionPlugin } from './core/index.js';
export type {
  ToolOutputPluginConfig,
  ToolOutput,
  AutoSpillConfig,
  SpilledEntry,
  ToolResultEvictionConfig,
  TrackedResult,
  EvictionResult,
} from './core/index.js';

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

// Search Capabilities (NEW - Connector-based web search)
export { SearchProvider } from './capabilities/search/index.js';
export type {
  ISearchProvider,
  SearchResult,
  SearchOptions,
  SearchResponse,
  SearchProviderConfig,
} from './capabilities/search/index.js';
export { SerperProvider, BraveProvider, TavilyProvider, RapidAPIProvider } from './capabilities/search/index.js';

// Scrape Capabilities (Connector-based web scraping)
export { ScrapeProvider, registerScrapeProvider, getRegisteredScrapeProviders } from './capabilities/scrape/index.js';
export type {
  IScrapeProvider,
  ScrapeResult,
  ScrapeOptions,
  ScrapeResponse,
  ScrapeFeature,
  ScrapeProviderConfig,
  ScrapeProviderFallbackConfig,
} from './capabilities/scrape/index.js';

// Shared Capability Utilities
export {
  buildQueryString,
  toConnectorOptions,
  buildEndpointWithQuery,
  resolveConnector,
  // Service type auto-detection (for external API-dependent tools)
  findConnectorByServiceTypes,
  listConnectorsByServiceTypes,
  type BaseProviderConfig,
  type BaseProviderResponse,
  type ICapabilityProvider,
  type ExtendedFetchOptions,
} from './capabilities/shared/index.js';

// Tool Management (Unified - handles registration, execution, and circuit breakers)
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
// Note: CircuitBreakerConfig, CircuitState are exported from infrastructure/resilience

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

// Context Storage (Session Persistence via AgentContext)
export type {
  IContextStorage,
  StoredContextSession,
  ContextSessionSummary,
  ContextSessionMetadata,
  ContextStorageListOptions,
} from './domain/interfaces/IContextStorage.js';
export { CONTEXT_SESSION_FORMAT_VERSION } from './domain/interfaces/IContextStorage.js';

// Agent Definition Storage (Agent Configuration Persistence)
export type {
  IAgentDefinitionStorage,
  StoredAgentDefinition,
  StoredAgentType,
  AgentDefinitionMetadata,
  AgentDefinitionSummary,
  AgentDefinitionListOptions,
} from './domain/interfaces/IAgentDefinitionStorage.js';
export { AGENT_DEFINITION_FORMAT_VERSION } from './domain/interfaces/IAgentDefinitionStorage.js';

// ============ Error Handling ============
export { ErrorHandler, globalErrorHandler } from './core/index.js';
export type {
  ErrorContext,
  ErrorHandlerConfig,
  ErrorHandlerEvents,
} from './core/index.js';

// ============ Task-Based Agents ============
export {
  TaskAgent,
  WorkingMemory,
  IdempotencyCache,
  ExternalDependencyHandler,
  PlanExecutor,
  CheckpointManager,
  createMemoryTools,
  createContextTools,
  PlanningAgent,
  generateSimplePlan,
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
  ErrorContext as TaskAgentErrorContext,
  WorkingMemoryEvents,
  EvictionStrategy,
  IdempotencyCacheConfig,
  CacheStats,
  ExternalDependencyEvents,
  PlanExecutorConfig,
  PlanExecutorEvents,
  PlanExecutionResult,
  CheckpointStrategy,
  PlanningAgentConfig,
  GeneratedPlan,
} from './capabilities/taskAgent/index.js';
export { DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_CHECKPOINT_STRATEGY } from './capabilities/taskAgent/index.js';

// ============ ResearchAgent (Generic Research Capabilities) ============
export {
  ResearchAgent,
  createResearchTools,
  WebSearchSource,
  createWebSearchSource,
  FileSearchSource,
  createFileSearchSource,
} from './capabilities/researchAgent/index.js';
export type {
  ResearchAgentConfig,
  ResearchAgentHooks,
  IResearchSource,
  SourceResult,
  SearchResponse as ResearchSearchResponse,
  FetchedContent,
  SearchOptions as ResearchSearchOptions,
  FetchOptions as ResearchFetchOptions,
  SourceCapabilities,
  ResearchFinding,
  ResearchPlan,
  ResearchQuery,
  ResearchResult,
  ResearchProgress,
  WebSearchSourceConfig,
  FileSearchSourceConfig,
} from './capabilities/researchAgent/index.js';

// ============ Context Management (Universal) ============
// Note: ContextManager class deleted - AgentContext is THE ONLY context manager
export type {
  IContextComponent,
  ContextBudget,
  PreparedContext,
  ContextManagerConfig,
  ITokenEstimator,
  IContextCompactor,
  IContextStrategy,
  TokenContentType,
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
  TruncateCompactor,
  SummarizeCompactor,
  MemoryEvictionCompactor,
  ApproximateTokenEstimator,
  createEstimator,
} from './infrastructure/context/index.js';

// ============ Conversation History Management ============
// Note: ConversationHistoryManager class deleted - AgentContext manages history directly
export type {
  IHistoryManager,
  IHistoryStorage,
  HistoryMessage,
  IHistoryManagerConfig,
  HistoryManagerEvents,
  SerializedHistoryState,
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

// Context Storage Implementations (for AgentContext session persistence)
export { FileContextStorage, createFileContextStorage } from './infrastructure/storage/index.js';
export type { FileContextStorageConfig } from './infrastructure/storage/index.js';

// Agent Definition Storage Implementations (for agent configuration persistence)
export { FileAgentDefinitionStorage, createFileAgentDefinitionStorage } from './infrastructure/storage/index.js';
export type { FileAgentDefinitionStorageConfig } from './infrastructure/storage/index.js';

// Tool Context (ToolContext is the canonical interface for tool execution context)
export type { ToolContext, ToolContext as TaskToolContext, WorkingMemoryAccess } from './domain/interfaces/IToolContext.js';

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
export { ExecutionContext, HookManager } from './capabilities/agents/index.js';
export type {
  // New canonical names
  AgentEvents,
  AgentEventName,
  ExecutionConfig,
  // Legacy names for backward compatibility
  AgenticLoopEvents,
  AgenticLoopEventName,
  // Hook types
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

// ============ Vendor Templates (Pre-configured auth for 40+ services) ============
export {
  // Helpers
  createConnectorFromTemplate,
  getConnectorTools,
  getVendorTemplate,
  getVendorAuthTemplate,
  getAllVendorTemplates,
  listVendorIds,
  listVendors,
  listVendorsByCategory,
  listVendorsByAuthType,
  getVendorInfo,
  getCredentialsSetupURL,
  getDocsURL,
  buildAuthConfig,
  // All templates array
  allVendorTemplates,
  // Logo utilities
  getVendorLogo,
  getVendorLogoSvg,
  getVendorColor,
  getVendorLogoCdnUrl,
  hasVendorLogo,
  getAllVendorLogos,
  listVendorsWithLogos,
  VENDOR_ICON_MAP,
  SIMPLE_ICONS_CDN,
} from './connectors/index.js';

export type {
  VendorTemplate,
  AuthTemplate,
  AuthTemplateField,
  VendorRegistryEntry,
  TemplateCredentials,
  CreateConnectorOptions,
  VendorInfo,
  VendorLogo,
  SimpleIcon,
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

// Tool Registry (auto-generated)
export {
  toolRegistry,
  getAllBuiltInTools,
  getToolRegistry,
  getToolsByCategory,
  getToolByName,
  getToolsRequiringConnector,
  getToolCategories,
} from './tools/index.js';

export type {
  ToolCategory,
  ToolRegistryEntry,
} from './tools/index.js';

// Unified Tool Registry (built-in + connector tools)
export { ToolRegistry, type ConnectorToolEntry } from './tools/index.js';

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

// ============ MCP (Model Context Protocol) ============
export { MCPClient, MCPRegistry } from './core/mcp/index.js';
export type {
  IMCPClient,
  MCPClientConnectionState,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPServerCapabilities,
  MCPClientState,
  MCPServerConfig,
  MCPConfiguration,
  MCPTransportType,
  StdioTransportConfig,
  HTTPTransportConfig,
  TransportConfig,
} from './core/mcp/index.js';
export {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
} from './core/mcp/index.js';

// ============ InContextMemory (Live Context Storage) ============
export {
  InContextMemoryPlugin,
  createInContextMemoryTools,
  createInContextMemory,
  setupInContextMemory,
} from './core/context/plugins/index.js';
export type {
  InContextEntry,
  InContextPriority,
  InContextMemoryConfig,
  SerializedInContextMemoryState,
} from './core/context/plugins/index.js';

// ============ PersistentInstructions (Disk-Persisted Custom Instructions) ============
export {
  PersistentInstructionsPlugin,
  createPersistentInstructionsTools,
  createPersistentInstructions,
  setupPersistentInstructions,
} from './core/context/plugins/index.js';
export type {
  PersistentInstructionsConfig,
  SerializedPersistentInstructionsState,
} from './core/context/plugins/index.js';

// PersistentInstructions Storage
export { FilePersistentInstructionsStorage } from './infrastructure/storage/index.js';
export type { FilePersistentInstructionsStorageConfig } from './infrastructure/storage/index.js';
export type { IPersistentInstructionsStorage } from './domain/interfaces/IPersistentInstructionsStorage.js';

