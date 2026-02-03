/**
 * MCP Client Interface
 *
 * High-level interface for MCP client operations.
 * This wraps the @modelcontextprotocol/sdk Client class.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPServerCapabilities,
  MCPClientState,
} from '../entities/MCPTypes.js';
import type { ToolManager } from '../../core/ToolManager.js';

/**
 * MCP Client connection states
 */
export type MCPClientConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * MCP Client interface
 */
export interface IMCPClient extends EventEmitter {
  /** Server name */
  readonly name: string;

  /** Current connection state */
  readonly state: MCPClientConnectionState;

  /** Server capabilities (available after connection) */
  readonly capabilities?: MCPServerCapabilities;

  /** Currently available tools */
  readonly tools: MCPTool[];

  // Lifecycle methods

  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Reconnect to the MCP server
   */
  reconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Ping the server to check health
   */
  ping(): Promise<boolean>;

  // Tool methods

  /**
   * List available tools from the server
   */
  listTools(): Promise<MCPTool[]>;

  /**
   * Call a tool on the server
   */
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;

  /**
   * Register all tools with a ToolManager
   */
  registerTools(toolManager: ToolManager): void;

  /**
   * Register specific tools with a ToolManager (selective registration)
   * @param toolManager - ToolManager to register with
   * @param toolNames - Optional array of tool names to register (original MCP names, not namespaced).
   *                    If not provided, registers all tools.
   */
  registerToolsSelective(toolManager: ToolManager, toolNames?: string[]): void;

  /**
   * Unregister all tools from a ToolManager
   */
  unregisterTools(toolManager: ToolManager): void;

  // Resource methods

  /**
   * List available resources from the server
   */
  listResources(): Promise<MCPResource[]>;

  /**
   * Read a resource from the server
   */
  readResource(uri: string): Promise<MCPResourceContent>;

  /**
   * Subscribe to resource updates
   */
  subscribeResource(uri: string): Promise<void>;

  /**
   * Unsubscribe from resource updates
   */
  unsubscribeResource(uri: string): Promise<void>;

  // Prompt methods

  /**
   * List available prompts from the server
   */
  listPrompts(): Promise<MCPPrompt[]>;

  /**
   * Get a prompt from the server
   */
  getPrompt(name: string, args?: Record<string, unknown>): Promise<MCPPromptResult>;

  // State management

  /**
   * Get current state for serialization
   */
  getState(): MCPClientState;

  /**
   * Load state from serialization
   */
  loadState(state: MCPClientState): void;

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void;

  // Events:
  // - 'connected': () => void
  // - 'disconnected': () => void
  // - 'reconnecting': (attempt: number) => void
  // - 'failed': (error: Error) => void
  // - 'tool:called': (name: string, args: unknown) => void
  // - 'tool:result': (name: string, result: unknown) => void
  // - 'resource:updated': (uri: string) => void
  // - 'error': (error: Error) => void
}
