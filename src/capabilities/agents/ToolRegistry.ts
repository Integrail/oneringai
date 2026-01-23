/**
 * Tool registry - manages tool registration and execution
 */

import { IToolExecutor } from '../../domain/interfaces/IToolExecutor.js';
import { Tool, ToolFunction } from '../../domain/entities/Tool.js';
import { ToolNotFoundError, ToolExecutionError } from '../../domain/errors/AIErrors.js';
import { CircuitBreaker, CircuitState } from '../../infrastructure/resilience/CircuitBreaker.js';
import { logger, FrameworkLogger } from '../../infrastructure/observability/Logger.js';
import { metrics } from '../../infrastructure/observability/Metrics.js';

export class ToolRegistry implements IToolExecutor {
  private tools: Map<string, ToolFunction> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private logger: FrameworkLogger;

  constructor() {
    this.logger = logger.child({ component: 'ToolRegistry' });
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolFunction): void {
    this.tools.set(tool.definition.function.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * Get or create circuit breaker for a tool
   */
  private getCircuitBreaker(toolName: string, tool: ToolFunction): CircuitBreaker {
    let breaker = this.circuitBreakers.get(toolName);

    if (!breaker) {
      // Create circuit breaker for this tool
      const config = (tool as any).circuitBreaker || {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeoutMs: 60000, // 1 minute
        windowMs: 300000, // 5 minutes
      };

      breaker = new CircuitBreaker(`tool:${toolName}`, config);

      // Forward CB events to logger and metrics
      breaker.on('opened', (data) => {
        this.logger.warn(data, `Circuit breaker opened for tool: ${toolName}`);
        metrics.increment('circuit_breaker.opened', 1, {
          breaker: data.name,
          tool: toolName,
        });
      });

      breaker.on('closed', (data) => {
        this.logger.info(data, `Circuit breaker closed for tool: ${toolName}`);
        metrics.increment('circuit_breaker.closed', 1, {
          breaker: data.name,
          tool: toolName,
        });
      });

      this.circuitBreakers.set(toolName, breaker);
    }

    return breaker;
  }

  /**
   * Execute a tool function
   */
  async execute(toolName: string, args: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    // Get circuit breaker for this tool
    const breaker = this.getCircuitBreaker(toolName, tool);

    this.logger.debug({ toolName, args }, 'Tool execution started');

    const startTime = Date.now();

    metrics.increment('tool.executed', 1, { tool: toolName });

    try {
      // Execute with circuit breaker protection
      const result = await breaker.execute(async () => {
        return await tool.execute(args);
      });

      const duration = Date.now() - startTime;

      this.logger.debug({ toolName, duration }, 'Tool execution completed');

      metrics.timing('tool.duration', duration, { tool: toolName });
      metrics.increment('tool.success', 1, { tool: toolName });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        toolName,
        error: (error as Error).message,
        duration,
      }, 'Tool execution failed');

      metrics.increment('tool.failed', 1, {
        tool: toolName,
        error: (error as Error).name,
      });

      throw new ToolExecutionError(
        toolName,
        (error as Error).message,
        error as Error
      );
    }
  }

  /**
   * Check if tool is available
   */
  hasToolFunction(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool definition
   */
  getToolDefinition(toolName: string): Tool | undefined {
    const tool = this.tools.get(toolName);
    return tool?.definition;
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Get circuit breaker states for all tools
   */
  getCircuitBreakerStates(): Map<string, CircuitState> {
    const states = new Map<string, CircuitState>();
    for (const [toolName, breaker] of this.circuitBreakers.entries()) {
      states.set(toolName, breaker.getState());
    }
    return states;
  }

  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName: string) {
    const breaker = this.circuitBreakers.get(toolName);
    return breaker?.getMetrics();
  }

  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName: string): void {
    const breaker = this.circuitBreakers.get(toolName);
    if (breaker) {
      breaker.reset();
      this.logger.info({ toolName }, 'Tool circuit breaker manually reset');
    }
  }
}
