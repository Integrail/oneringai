/**
 * Core module - main public API
 *
 * This is the primary entry point for the library.
 *
 * @example
 * ```typescript
 * import { Connector, Agent, Vendor } from '@oneringai/agents';
 *
 * // Create a connector
 * Connector.create({
 *   name: 'openai',
 *   vendor: Vendor.OpenAI,
 *   auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
 * });
 *
 * // Create an agent
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4'
 * });
 *
 * // Run the agent
 * const response = await agent.run('Hello!');
 * ```
 */

export { Connector } from './Connector.js';
export { Agent } from './Agent.js';
export type { AgentConfig, AgentSessionConfig } from './Agent.js';

// ============================================================================
// AgentContextNextGen - Clean, Simple Context Management
// ============================================================================
export {
  AgentContextNextGen,
  DEFAULT_FEATURES,
  DEFAULT_CONFIG,
  STRATEGY_THRESHOLDS,
  BasePluginNextGen,
  simpleTokenEstimator,
  WorkingMemoryPluginNextGen,
  InContextMemoryPluginNextGen,
  PersistentInstructionsPluginNextGen,
} from './context-nextgen/index.js';
export type {
  IContextPluginNextGen,
  ITokenEstimator,
  AgentContextNextGenConfig,
  ContextFeatures,
  ContextBudget,
  PreparedContext,
  OversizedInputResult,
  CompactionStrategyName,
  IContextStorage,
  SerializedContextState,
  ContextEvents,
  PluginConfigs,
  WorkingMemoryPluginConfig,
  SerializedWorkingMemoryState,
  EvictionStrategy,
  InContextMemoryConfig,
  InContextEntry,
  InContextPriority,
  SerializedInContextMemoryState,
  PersistentInstructionsConfig,
  SerializedPersistentInstructionsState,
} from './context-nextgen/index.js';

// SmartCompactor - LLM-powered intelligent context compaction (Phase 4)
export { SmartCompactor, createSmartCompactor } from './context/SmartCompactor.js';
export type {
  SmartCompactorConfig,
  SmartCompactionResult,
  CompactionSummary,
  SpilledData,
} from './context/SmartCompactor.js';

// Lifecycle hooks and direct call types (from BaseAgent)
export type {
  AgentLifecycleHooks,
  ToolExecutionHookContext,
  ToolExecutionResult,
  DirectCallOptions,
} from './BaseAgent.js';
export { Vendor, VENDORS, isVendor } from './Vendor.js';
export { createProvider, createProviderAsync } from './createProvider.js';

// Centralized constants
export {
  TASK_DEFAULTS,
  CONTEXT_DEFAULTS,
  PROACTIVE_STRATEGY_DEFAULTS,
  AGGRESSIVE_STRATEGY_DEFAULTS,
  LAZY_STRATEGY_DEFAULTS,
  ADAPTIVE_STRATEGY_DEFAULTS,
  ROLLING_WINDOW_DEFAULTS,
  MEMORY_DEFAULTS,
  SESSION_DEFAULTS,
  AGENT_DEFAULTS,
  CIRCUIT_BREAKER_DEFAULTS,
  HISTORY_DEFAULTS,
  TOKEN_ESTIMATION,
  TOOL_RESULT_EVICTION_DEFAULTS,
  DEFAULT_TOOL_RETENTION,
  GUARDIAN_DEFAULTS,
  // Note: STRATEGY_THRESHOLDS is exported from context-nextgen/index.js above
  SAFETY_CAPS,
  TOOL_RETENTION_MULTIPLIERS,
} from './constants.js';
export type { StrategyName } from './constants.js';

// Global configuration
export { Config } from './Config.js';
export type { OneRingAIConfig, MCPConfiguration } from '../domain/entities/MCPConfig.js';

// MCP (Model Context Protocol)
export * from './mcp/index.js';

// Audio capabilities
export { TextToSpeech } from './TextToSpeech.js';
export type { TextToSpeechConfig } from './TextToSpeech.js';
export { SpeechToText } from './SpeechToText.js';
export type { SpeechToTextConfig } from './SpeechToText.js';

// Image capabilities
export { createImageProvider } from './createImageProvider.js';

// Tool management (unified - handles registration, execution, and circuit breakers)
export { ToolManager } from './ToolManager.js';
export type {
  ToolOptions,
  ToolCondition,
  ToolSelectionContext,
  ToolRegistration,
  ToolMetadata,
  ToolManagerStats,
  SerializedToolState,
  ToolManagerEvent,
} from './ToolManager.js';
// Note: CircuitBreakerConfig, CircuitState are re-exported from ToolManager but
// canonically exported from infrastructure/resilience/index.js

// Tool permission management
export { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
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
} from './permissions/types.js';
export { APPROVAL_STATE_VERSION, DEFAULT_PERMISSION_CONFIG } from './permissions/types.js';

// Error Handling
export { ErrorHandler, globalErrorHandler } from './ErrorHandler.js';
export type {
  ErrorContext,
  ErrorHandlerConfig,
  ErrorHandlerEvents,
} from './ErrorHandler.js';
