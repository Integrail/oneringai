/**
 * Base media provider with common functionality for Image, Audio, and Video providers
 * Provides circuit breaker, logging, and metrics similar to BaseTextProvider
 */

import { BaseProvider } from './BaseProvider.js';
import type { IProvider } from '../../../domain/interfaces/IProvider.js';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../../resilience/CircuitBreaker.js';
import { logger, FrameworkLogger } from '../../observability/Logger.js';
import { metrics } from '../../observability/Metrics.js';

/**
 * Base class for all media providers (Image, Audio, Video)
 * Follows the same patterns as BaseTextProvider for consistency
 */
export abstract class BaseMediaProvider extends BaseProvider implements IProvider {
  protected circuitBreaker?: CircuitBreaker;
  protected logger: FrameworkLogger;
  private _isObservabilityInitialized = false;

  constructor(config: any) {
    super(config);

    // Initialize with default logger (will be updated with provider name on first use)
    this.logger = logger.child({
      component: 'MediaProvider',
      provider: 'unknown',
    });

    // Circuit breaker created lazily on first use
  }

  /**
   * Auto-initialize observability on first use (lazy initialization)
   * This is called automatically by executeWithCircuitBreaker()
   * @internal
   */
  private ensureObservabilityInitialized(): void {
    if (this._isObservabilityInitialized) {
      return;
    }

    const providerName = this.name || 'unknown';

    // Create circuit breaker with provider name
    const cbConfig = (this.config as any).circuitBreaker || DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new CircuitBreaker(
      `media-provider:${providerName}`,
      cbConfig
    );

    // Update logger with provider name
    this.logger = logger.child({
      component: 'MediaProvider',
      provider: providerName,
    });

    // Forward circuit breaker events to metrics
    this.circuitBreaker.on('opened', (data) => {
      this.logger.warn(data, 'Circuit breaker opened');
      metrics.increment('circuit_breaker.opened', 1, {
        breaker: data.name,
        provider: providerName,
      });
    });

    this.circuitBreaker.on('closed', (data) => {
      this.logger.info(data, 'Circuit breaker closed');
      metrics.increment('circuit_breaker.closed', 1, {
        breaker: data.name,
        provider: providerName,
      });
    });

    this._isObservabilityInitialized = true;
  }

  /**
   * Execute operation with circuit breaker protection
   * Automatically records metrics and handles errors
   *
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for metrics (e.g., 'image.generate', 'audio.synthesize')
   * @param metadata - Additional metadata to log/record
   */
  protected async executeWithCircuitBreaker<TResult>(
    operation: () => Promise<TResult>,
    operationName: string,
    metadata?: Record<string, unknown>
  ): Promise<TResult> {
    // Auto-initialize observability on first use
    this.ensureObservabilityInitialized();

    const startTime = Date.now();
    const metricLabels = {
      provider: this.name,
      operation: operationName,
      ...metadata,
    };

    try {
      // Execute through circuit breaker
      const result = await this.circuitBreaker!.execute(operation);

      // Record success metrics
      const duration = Date.now() - startTime;
      metrics.histogram(`${operationName}.duration`, duration, metricLabels);
      metrics.increment(`${operationName}.success`, 1, metricLabels);

      this.logger.debug(
        { operation: operationName, duration, ...metadata },
        'Operation completed successfully'
      );

      return result;
    } catch (error) {
      // Record error metrics
      const duration = Date.now() - startTime;
      metrics.increment(`${operationName}.error`, 1, {
        ...metricLabels,
        error: error instanceof Error ? error.name : 'unknown',
      });

      this.logger.error(
        {
          operation: operationName,
          duration,
          error: error instanceof Error ? error.message : String(error),
          ...metadata,
        },
        'Operation failed'
      );

      throw error;
    }
  }

  /**
   * Log operation start with context
   * Useful for logging before async operations
   */
  protected logOperationStart(operation: string, context: Record<string, unknown>): void {
    this.ensureObservabilityInitialized();
    this.logger.info({ operation, ...context }, `${operation} started`);
  }

  /**
   * Log operation completion with context
   */
  protected logOperationComplete(operation: string, context: Record<string, unknown>): void {
    this.ensureObservabilityInitialized();
    this.logger.info({ operation, ...context }, `${operation} completed`);
  }
}
