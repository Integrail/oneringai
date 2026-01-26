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
export { Vendor, VENDORS, isVendor } from './Vendor.js';
export { createProvider, createProviderAsync } from './createProvider.js';

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

// Tool management
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

// Session management
export { SessionManager, createEmptyHistory, createEmptyMemory, addHistoryEntry } from './SessionManager.js';
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
} from './SessionManager.js';

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
