/**
 * Custom error classes for the AI library
 */

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIError';
    Object.setPrototypeOf(this, AIError.prototype);
  }
}

export class ProviderNotFoundError extends AIError {
  constructor(providerName: string) {
    super(
      `Provider '${providerName}' not found. Did you configure it in OneRingAI constructor?`,
      'PROVIDER_NOT_FOUND',
      404
    );
    this.name = 'ProviderNotFoundError';
    Object.setPrototypeOf(this, ProviderNotFoundError.prototype);
  }
}

export class ProviderAuthError extends AIError {
  constructor(providerName: string, message: string = 'Authentication failed') {
    super(
      `${providerName}: ${message}`,
      'PROVIDER_AUTH_ERROR',
      401
    );
    this.name = 'ProviderAuthError';
    Object.setPrototypeOf(this, ProviderAuthError.prototype);
  }
}

export class ProviderRateLimitError extends AIError {
  constructor(
    providerName: string,
    public readonly retryAfter?: number
  ) {
    super(
      `${providerName}: Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`,
      'PROVIDER_RATE_LIMIT',
      429
    );
    this.name = 'ProviderRateLimitError';
    Object.setPrototypeOf(this, ProviderRateLimitError.prototype);
  }
}

export class ProviderContextLengthError extends AIError {
  constructor(
    providerName: string,
    public readonly maxTokens: number,
    public readonly requestedTokens?: number
  ) {
    super(
      `${providerName}: Context length exceeded. Max: ${maxTokens}${requestedTokens ? `, Requested: ${requestedTokens}` : ''}`,
      'PROVIDER_CONTEXT_LENGTH_EXCEEDED',
      413
    );
    this.name = 'ProviderContextLengthError';
    Object.setPrototypeOf(this, ProviderContextLengthError.prototype);
  }
}

export class ToolExecutionError extends AIError {
  constructor(
    toolName: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      'TOOL_EXECUTION_ERROR',
      500,
      originalError
    );
    this.name = 'ToolExecutionError';
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

export class ToolTimeoutError extends AIError {
  constructor(
    toolName: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Tool '${toolName}' execution timed out after ${timeoutMs}ms`,
      'TOOL_TIMEOUT',
      408
    );
    this.name = 'ToolTimeoutError';
    Object.setPrototypeOf(this, ToolTimeoutError.prototype);
  }
}

export class ToolNotFoundError extends AIError {
  constructor(toolName: string) {
    super(
      `Tool '${toolName}' not found. Did you register it with the agent?`,
      'TOOL_NOT_FOUND',
      404
    );
    this.name = 'ToolNotFoundError';
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}

export class ModelNotSupportedError extends AIError {
  constructor(providerName: string, model: string, capability: string) {
    super(
      `Model '${model}' from ${providerName} does not support ${capability}`,
      'MODEL_NOT_SUPPORTED',
      400
    );
    this.name = 'ModelNotSupportedError';
    Object.setPrototypeOf(this, ModelNotSupportedError.prototype);
  }
}

export class InvalidConfigError extends AIError {
  constructor(message: string) {
    super(message, 'INVALID_CONFIG', 400);
    this.name = 'InvalidConfigError';
    Object.setPrototypeOf(this, InvalidConfigError.prototype);
  }
}

export class InvalidToolArgumentsError extends AIError {
  constructor(
    toolName: string,
    public readonly rawArguments: string,
    public readonly parseError?: Error
  ) {
    super(
      `Invalid arguments for tool '${toolName}': ${parseError?.message || 'Failed to parse JSON'}`,
      'INVALID_TOOL_ARGUMENTS',
      400,
      parseError
    );
    this.name = 'InvalidToolArgumentsError';
    Object.setPrototypeOf(this, InvalidToolArgumentsError.prototype);
  }
}

export class ProviderError extends AIError {
  constructor(
    public readonly providerName: string,
    message: string,
    statusCode?: number,
    originalError?: Error
  ) {
    super(
      `${providerName}: ${message}`,
      'PROVIDER_ERROR',
      statusCode,
      originalError
    );
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

// ============ TaskAgent Errors ============

/**
 * Error thrown when a dependency cycle is detected in a plan
 */
export class DependencyCycleError extends AIError {
  constructor(
    /** Task IDs forming the cycle (e.g., ['A', 'B', 'C', 'A']) */
    public readonly cycle: string[],
    /** Plan ID where the cycle was detected */
    public readonly planId?: string
  ) {
    super(
      `Dependency cycle detected: ${cycle.join(' -> ')}`,
      'DEPENDENCY_CYCLE',
      400
    );
    this.name = 'DependencyCycleError';
    Object.setPrototypeOf(this, DependencyCycleError.prototype);
  }
}

/**
 * Error thrown when a task execution times out
 */
export class TaskTimeoutError extends AIError {
  constructor(
    public readonly taskId: string,
    public readonly taskName: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Task '${taskName}' (${taskId}) timed out after ${timeoutMs}ms`,
      'TASK_TIMEOUT',
      408
    );
    this.name = 'TaskTimeoutError';
    Object.setPrototypeOf(this, TaskTimeoutError.prototype);
  }
}

/**
 * Error thrown when task completion validation fails
 */
export class TaskValidationError extends AIError {
  constructor(
    public readonly taskId: string,
    public readonly taskName: string,
    public readonly reason: string
  ) {
    super(
      `Task '${taskName}' (${taskId}) validation failed: ${reason}`,
      'TASK_VALIDATION_ERROR',
      422
    );
    this.name = 'TaskValidationError';
    Object.setPrototypeOf(this, TaskValidationError.prototype);
  }
}
