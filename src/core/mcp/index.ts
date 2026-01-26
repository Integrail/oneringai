/**
 * MCP (Model Context Protocol) Module
 *
 * Integration with Model Context Protocol servers for tool discovery and execution.
 */

export { MCPClient } from './MCPClient.js';
export { MCPRegistry } from './MCPRegistry.js';
export type { IMCPClient, MCPClientConnectionState } from '../../domain/interfaces/IMCPClient.js';
export type {
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptResult,
  MCPServerCapabilities,
  MCPClientState,
} from '../../domain/entities/MCPTypes.js';
export type {
  MCPServerConfig,
  MCPConfiguration,
  MCPTransportType,
  StdioTransportConfig,
  HTTPTransportConfig,
  TransportConfig,
} from '../../domain/entities/MCPConfig.js';
export {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
} from '../../domain/errors/MCPError.js';
