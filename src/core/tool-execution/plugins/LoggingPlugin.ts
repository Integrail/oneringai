/**
 * LoggingPlugin
 *
 * A tool execution plugin that logs tool execution start, completion, and errors.
 * Useful for debugging and observability.
 *
 * @module tool-execution
 */

import type {
  IToolExecutionPlugin,
  PluginExecutionContext,
  BeforeExecuteResult,
} from '../types.js';
import { logger as frameworkLogger, type FrameworkLogger } from '../../../infrastructure/observability/Logger.js';

/**
 * Configuration options for LoggingPlugin
 */
export interface LoggingPluginOptions {
  /**
   * Log level for start/complete messages.
   * Default: 'debug'
   */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';

  /**
   * Log level for error messages.
   * Default: 'error'
   */
  errorLevel?: 'warn' | 'error';

  /**
   * Whether to include tool arguments in logs.
   * Set to false for tools with sensitive data.
   * Default: true
   */
  logArgs?: boolean;

  /**
   * Whether to include result summary in completion logs.
   * Default: true
   */
  logResult?: boolean;

  /**
   * Maximum length for argument/result strings in logs.
   * Default: 200
   */
  maxLogLength?: number;

  /**
   * Custom logger instance. If not provided, uses framework logger.
   */
  logger?: FrameworkLogger;

  /**
   * Component name for the logger.
   * Default: 'ToolExecution'
   */
  component?: string;
}

/**
 * LoggingPlugin - Logs tool execution lifecycle events.
 *
 * @example
 * ```typescript
 * const pipeline = new ToolExecutionPipeline();
 * pipeline.use(new LoggingPlugin());
 * // Or with custom options:
 * pipeline.use(new LoggingPlugin({
 *   level: 'info',
 *   logArgs: false, // Don't log potentially sensitive args
 * }));
 * ```
 */
export class LoggingPlugin implements IToolExecutionPlugin {
  readonly name = 'logging';
  readonly priority = 5; // Run very early to capture full execution

  private logger: FrameworkLogger;
  private level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  private errorLevel: 'warn' | 'error';
  private logArgs: boolean;
  private logResult: boolean;
  private maxLogLength: number;

  constructor(options: LoggingPluginOptions = {}) {
    const baseLogger = options.logger ?? frameworkLogger;
    this.logger = baseLogger.child({ component: options.component ?? 'ToolExecution' });
    this.level = options.level ?? 'debug';
    this.errorLevel = options.errorLevel ?? 'error';
    this.logArgs = options.logArgs ?? true;
    this.logResult = options.logResult ?? true;
    this.maxLogLength = options.maxLogLength ?? 200;
  }

  async beforeExecute(ctx: PluginExecutionContext): Promise<BeforeExecuteResult> {
    const logData: Record<string, unknown> = {
      executionId: ctx.executionId,
      tool: ctx.toolName,
    };

    if (this.logArgs) {
      logData.args = this.summarize(ctx.args);
    }

    this.log(this.level, logData, `Tool ${ctx.toolName} starting`);
  }

  async afterExecute(ctx: PluginExecutionContext, result: unknown): Promise<unknown> {
    const duration = Date.now() - ctx.startTime;

    const logData: Record<string, unknown> = {
      executionId: ctx.executionId,
      tool: ctx.toolName,
      durationMs: duration,
    };

    if (this.logResult) {
      logData.result = this.summarize(result);
    }

    this.log(this.level, logData, `Tool ${ctx.toolName} completed in ${duration}ms`);

    return result;
  }

  async onError(ctx: PluginExecutionContext, error: Error): Promise<unknown> {
    const duration = Date.now() - ctx.startTime;

    const logData: Record<string, unknown> = {
      executionId: ctx.executionId,
      tool: ctx.toolName,
      durationMs: duration,
      error: error.message,
      errorName: error.name,
    };

    this.log(this.errorLevel, logData, `Tool ${ctx.toolName} failed after ${duration}ms: ${error.message}`);

    // Don't recover, let error propagate
    return undefined;
  }

  /**
   * Log a message at the specified level.
   */
  private log(level: string, data: Record<string, unknown>, message: string): void {
    switch (level) {
      case 'trace':
        this.logger.trace(data, message);
        break;
      case 'debug':
        this.logger.debug(data, message);
        break;
      case 'info':
        this.logger.info(data, message);
        break;
      case 'warn':
        this.logger.warn(data, message);
        break;
      case 'error':
        this.logger.error(data, message);
        break;
    }
  }

  /**
   * Summarize a value for logging, truncating if necessary.
   */
  private summarize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return value.length > this.maxLogLength
        ? value.slice(0, this.maxLogLength) + '...'
        : value;
    }

    if (typeof value !== 'object') {
      return value;
    }

    // For objects, provide a summary
    if (Array.isArray(value)) {
      return { type: 'array', length: value.length };
    }

    const obj = value as Record<string, unknown>;

    // Handle common result patterns
    if ('success' in obj) {
      const summary: Record<string, unknown> = { success: obj.success };
      if ('error' in obj) summary.error = obj.error;
      if ('count' in obj) summary.count = obj.count;
      if ('results' in obj && Array.isArray(obj.results)) {
        summary.resultCount = obj.results.length;
      }
      return summary;
    }

    // Generic object summary
    const keys = Object.keys(obj);
    return { type: 'object', keys: keys.slice(0, 5), keyCount: keys.length };
  }
}
