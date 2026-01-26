/**
 * MCP Domain Types
 *
 * Core types for MCP tools, resources, and prompts.
 * These are simplified wrappers around the SDK types.
 */

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** JSON Schema for tool input */
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  /** Result content */
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  /** Whether the tool call resulted in an error */
  isError?: boolean;
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * MCP Resource content
 */
export interface MCPResourceContent {
  /** Resource URI */
  uri: string;
  /** MIME type */
  mimeType?: string;
  /** Text content */
  text?: string;
  /** Binary content (base64) */
  blob?: string;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments schema */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP Prompt result
 */
export interface MCPPromptResult {
  /** Prompt description */
  description?: string;
  /** Prompt messages */
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
  }>;
}

/**
 * MCP Server capabilities
 */
export interface MCPServerCapabilities {
  /** Tools capability */
  tools?: Record<string, unknown>;
  /** Resources capability */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** Prompts capability */
  prompts?: {
    listChanged?: boolean;
  };
  /** Logging capability */
  logging?: Record<string, unknown>;
}

/**
 * MCP Client state (for serialization)
 */
export interface MCPClientState {
  /** Server name */
  name: string;
  /** Connection state */
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  /** Server capabilities */
  capabilities?: MCPServerCapabilities;
  /** Subscribed resource URIs */
  subscribedResources: string[];
  /** Last connected timestamp */
  lastConnectedAt?: number;
  /** Connection attempt count */
  connectionAttempts: number;
}
