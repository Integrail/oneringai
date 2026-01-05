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

// Configuration types
export type {
  ProviderConfig,
  ProvidersConfig,
  OpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
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
} from './domain/errors/AIErrors.js';

// Capability managers (re-exported from their modules)
export { AgentManager, Agent, ToolRegistry } from './capabilities/agents/index.js';
export type { AgentConfig } from './capabilities/agents/index.js';

export { TextManager } from './capabilities/text/index.js';
export type { SimpleTextOptions } from './capabilities/text/index.js';

export { ImageManager } from './capabilities/images/index.js';
