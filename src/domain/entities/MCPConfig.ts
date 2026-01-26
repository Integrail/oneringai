/**
 * MCP Configuration Types
 *
 * Defines configuration structures for MCP servers and global library configuration.
 */

/**
 * Transport type for MCP communication
 */
export type MCPTransportType = 'stdio' | 'http' | 'https';

/**
 * Stdio transport configuration
 */
export interface StdioTransportConfig {
  /** Command to execute (e.g., 'npx', 'node') */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory for the process */
  cwd?: string;
}

/**
 * HTTP/HTTPS transport configuration (StreamableHTTP)
 */
export interface HTTPTransportConfig {
  /** HTTP(S) endpoint URL */
  url: string;
  /** Authentication token (supports ${ENV_VAR} interpolation) */
  token?: string;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Session ID for reconnection */
  sessionId?: string;
  /** Reconnection options */
  reconnection?: {
    /** Max reconnection delay in ms (default: 30000) */
    maxReconnectionDelay?: number;
    /** Initial reconnection delay in ms (default: 1000) */
    initialReconnectionDelay?: number;
    /** Reconnection delay growth factor (default: 1.5) */
    reconnectionDelayGrowFactor?: number;
    /** Max retry attempts (default: 2) */
    maxRetries?: number;
  };
}

/**
 * Transport configuration union type
 */
export type TransportConfig = StdioTransportConfig | HTTPTransportConfig;

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Unique identifier for the server */
  name: string;
  /** Human-readable display name */
  displayName?: string;
  /** Server description */
  description?: string;
  /** Transport type */
  transport: MCPTransportType;
  /** Transport-specific configuration */
  transportConfig: TransportConfig;
  /** Auto-connect on startup (default: false) */
  autoConnect?: boolean;
  /** Auto-reconnect on failure (default: true) */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds (default: 5000) */
  reconnectIntervalMs?: number;
  /** Maximum reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
  /** Health check interval in milliseconds (default: 60000) */
  healthCheckIntervalMs?: number;
  /** Tool namespace prefix (default: 'mcp:{name}') */
  toolNamespace?: string;
  /** Permission configuration for tools from this server */
  permissions?: {
    /** Default permission scope */
    defaultScope?: 'once' | 'session' | 'always' | 'never';
    /** Default risk level */
    defaultRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * MCP global configuration
 */
export interface MCPConfiguration {
  /** List of MCP servers */
  servers: MCPServerConfig[];
  /** Default settings for all servers */
  defaults?: {
    /** Default auto-connect (default: false) */
    autoConnect?: boolean;
    /** Default auto-reconnect (default: true) */
    autoReconnect?: boolean;
    /** Default reconnect interval in milliseconds (default: 5000) */
    reconnectIntervalMs?: number;
    /** Default maximum reconnect attempts (default: 10) */
    maxReconnectAttempts?: number;
    /** Default request timeout in milliseconds (default: 30000) */
    requestTimeoutMs?: number;
    /** Default health check interval in milliseconds (default: 60000) */
    healthCheckIntervalMs?: number;
  };
}

/**
 * Global library configuration
 */
export interface OneRingAIConfig {
  /** Configuration schema version */
  version?: string;
  /** MCP configuration */
  mcp?: MCPConfiguration;
  /** Tools configuration */
  tools?: {
    /** Permission defaults for all tools */
    permissions?: {
      defaultScope?: 'once' | 'session' | 'always' | 'never';
      defaultRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    };
  };
  /** Session configuration */
  session?: {
    /** Storage type ('memory' or 'file') */
    storage?: 'memory' | 'file';
    /** Storage-specific options */
    storageOptions?: Record<string, unknown>;
    /** Auto-save enabled (default: false) */
    autoSave?: boolean;
    /** Auto-save interval in milliseconds (default: 30000) */
    autoSaveIntervalMs?: number;
  };
  /** Context management configuration */
  context?: {
    /** Maximum context tokens (default: 128000) */
    maxContextTokens?: number;
    /** Context strategy ('proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive') */
    strategy?: string;
    /** Strategy-specific options */
    strategyOptions?: Record<string, unknown>;
  };
}

/**
 * Apply defaults to server config
 */
export function applyServerDefaults(
  config: MCPServerConfig,
  defaults?: MCPConfiguration['defaults']
): Required<Omit<MCPServerConfig, 'displayName' | 'description' | 'permissions' | 'toolNamespace'>> & {
  displayName?: string;
  description?: string;
  permissions?: MCPServerConfig['permissions'];
  toolNamespace: string;
} {
  return {
    name: config.name,
    displayName: config.displayName,
    description: config.description,
    transport: config.transport,
    transportConfig: config.transportConfig,
    autoConnect: config.autoConnect ?? defaults?.autoConnect ?? false,
    autoReconnect: config.autoReconnect ?? defaults?.autoReconnect ?? true,
    reconnectIntervalMs: config.reconnectIntervalMs ?? defaults?.reconnectIntervalMs ?? 5000,
    maxReconnectAttempts: config.maxReconnectAttempts ?? defaults?.maxReconnectAttempts ?? 10,
    requestTimeoutMs: config.requestTimeoutMs ?? defaults?.requestTimeoutMs ?? 30000,
    healthCheckIntervalMs: config.healthCheckIntervalMs ?? defaults?.healthCheckIntervalMs ?? 60000,
    toolNamespace: config.toolNamespace ?? `mcp:${config.name}`,
    permissions: config.permissions,
  };
}
