/**
 * MCP Error Classes
 *
 * Error hierarchy for MCP-related failures.
 */

/**
 * Base error for all MCP-related errors
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public readonly serverName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MCPError';
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Connection-related errors (failed to connect, disconnected unexpectedly)
 */
export class MCPConnectionError extends MCPError {
  constructor(message: string, serverName?: string, cause?: Error) {
    super(message, serverName, cause);
    this.name = 'MCPConnectionError';
  }
}

/**
 * Timeout errors (request timeout, connection timeout)
 */
export class MCPTimeoutError extends MCPError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    serverName?: string,
    cause?: Error
  ) {
    super(message, serverName, cause);
    this.name = 'MCPTimeoutError';
  }
}

/**
 * Protocol-level errors (invalid message, unsupported capability)
 */
export class MCPProtocolError extends MCPError {
  constructor(message: string, serverName?: string, cause?: Error) {
    super(message, serverName, cause);
    this.name = 'MCPProtocolError';
  }
}

/**
 * Tool execution errors (tool not found, tool execution failed)
 */
export class MCPToolError extends MCPError {
  constructor(
    message: string,
    public readonly toolName: string,
    serverName?: string,
    cause?: Error
  ) {
    super(message, serverName, cause);
    this.name = 'MCPToolError';
  }
}

/**
 * Resource-related errors (resource not found, subscription failed)
 */
export class MCPResourceError extends MCPError {
  constructor(
    message: string,
    public readonly resourceUri: string,
    serverName?: string,
    cause?: Error
  ) {
    super(message, serverName, cause);
    this.name = 'MCPResourceError';
  }
}
