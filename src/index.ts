/**
 * @oneringai/agents - Unified AI agent library
 *
 * Main entry point for the library
 */

// Main client
export { OneRingAI } from './client/OneRingAI.js';
export type { OneRingAIConfig } from './client/OneRingAI.js';

// Domain entities
export { ContentType } from './domain/entities/Content.js';
export type {
  Content,
  InputTextContent,
  InputImageContent,
  OutputTextContent,
  ToolUseContent,
  ToolResultContent,
} from './domain/entities/Content.js';

export { MessageRole } from './domain/entities/Message.js';
export type {
  Message,
  InputItem,
  OutputItem,
  CompactionItem,
  ReasoningItem,
} from './domain/entities/Message.js';

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

export type {
  LLMResponse,
  AgentResponse,
} from './domain/entities/Response.js';

// Streaming
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
export type { ToolCallBuffer } from './domain/entities/StreamState.js';

export { StreamHelpers } from './capabilities/agents/StreamHelpers.js';

// Domain interfaces
export type {
  IProvider,
  ProviderCapabilities,
} from './domain/interfaces/IProvider.js';

export type {
  ITextProvider,
  TextGenerateOptions,
  ModelCapabilities,
} from './domain/interfaces/ITextProvider.js';

export type {
  IImageProvider,
  ImageGenerateOptions,
  ImageEditOptions,
  ImageVariationOptions,
  ImageResponse,
} from './domain/interfaces/IImageProvider.js';

export type {
  IToolExecutor,
} from './domain/interfaces/IToolExecutor.js';

export type {
  IDisposable,
  IAsyncDisposable,
} from './domain/interfaces/IDisposable.js';

export { assertNotDestroyed } from './domain/interfaces/IDisposable.js';

// Configuration types
export type {
  BaseProviderConfig,
  ProviderConfig,
  ProvidersConfig,
  OpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
  VertexAIConfig,
  GroqConfig,
  GrokConfig,
  TogetherAIConfig,
  GenericOpenAIConfig,
} from './domain/types/ProviderConfig.js';

export type {
  LogLevel,
  Logger,
  RequestMetadata,
} from './domain/types/CommonTypes.js';

// Errors
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

// Capability managers (re-exported from their modules)
export {
  AgentManager,
  Agent,
  ToolRegistry,
  ExecutionContext,
  HookManager,
} from './capabilities/agents/index.js';

export type {
  AgentConfig,
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

export { TextManager } from './capabilities/text/index.js';
export type { SimpleTextOptions } from './capabilities/text/index.js';

export { ImageManager } from './capabilities/images/index.js';

// Infrastructure base classes (for custom provider implementations)
export { BaseProvider } from './infrastructure/providers/base/BaseProvider.js';
export { BaseTextProvider } from './infrastructure/providers/base/BaseTextProvider.js';
export { ProviderErrorMapper } from './infrastructure/providers/base/ProviderErrorMapper.js';

// Built-in AI agents
export { ProviderConfigAgent } from './agents/index.js';

// Utilities
export { MessageBuilder, createTextMessage, createMessageWithImages } from './utils/messageBuilder.js';
export { readClipboardImage, hasClipboardImage } from './utils/clipboardImage.js';
export type { ClipboardImageResult } from './utils/clipboardImage.js';

// Pre-built tools
export * as tools from './tools/index.js';
// Factory function for dynamic OAuth provider support
export { createExecuteJavaScriptTool } from './tools/code/executeJavaScript.js';

// Connectors (external system authentication)
export {
  connectorRegistry,
  ConnectorRegistry,
  OAuthManager,
  MemoryStorage,
  FileStorage,
} from './connectors/index.js';
export { generateEncryptionKey, authenticatedFetch, createAuthenticatedFetch, generateWebAPITool } from './connectors/index.js';

// Connector types (NEW recommended way)
export type {
  ConnectorConfig,
  ConnectorAuth,
  OAuthConnectorAuth,
  APIKeyConnectorAuth,
  JWTConnectorAuth,
  ConnectorConfigResult,
} from './domain/entities/Connector.js';

export type { IConnector } from './domain/interfaces/IConnector.js';

export type {
  ConnectorRegistrationConfig,
} from './connectors/index.js';

export { OAuthConnector } from './connectors/index.js';

// OAuth types
export type {
  OAuthConfig,
  OAuthFlow,
  ITokenStorage,
  FileStorageConfig,
} from './connectors/index.js';
