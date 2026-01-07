/**
 * Hook manager - handles hook registration and execution
 * Includes error isolation, timeouts, and optional parallel execution
 */

import { EventEmitter } from 'eventemitter3';
import {
  Hook,
  HookConfig,
  HookName,
  HookSignatures,
} from './types/HookTypes.js';

export class HookManager {
  private hooks: Map<HookName, Hook<any, any>[]> = new Map();
  private timeout: number;
  private parallel: boolean;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 3;
  private emitter: EventEmitter;

  constructor(
    config: HookConfig = {},
    emitter: EventEmitter,
    errorHandling?: { maxConsecutiveErrors?: number }
  ) {
    this.timeout = config.hookTimeout || 5000; // 5 second default
    this.parallel = config.parallelHooks || false;
    this.emitter = emitter;
    this.maxConsecutiveErrors = errorHandling?.maxConsecutiveErrors || 3;

    // Register hooks from config
    this.registerFromConfig(config);
  }

  /**
   * Register hooks from configuration
   */
  private registerFromConfig(config: HookConfig): void {
    const hookNames: HookName[] = [
      'before:execution',
      'after:execution',
      'before:llm',
      'after:llm',
      'before:tool',
      'after:tool',
      'approve:tool',
      'pause:check',
    ];

    for (const name of hookNames) {
      const hook = config[name];
      if (hook) {
        this.register(name, hook);
      }
    }
  }

  /**
   * Register a hook
   */
  register(name: HookName, hook: Hook<any, any>): void {
    // Validate hook is a function
    if (typeof hook !== 'function') {
      throw new Error(`Hook must be a function, got: ${typeof hook}`);
    }

    // Get or create hooks array
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }

    const existing = this.hooks.get(name)!;

    // Limit number of hooks per name
    if (existing.length >= 10) {
      throw new Error(`Too many hooks for ${name} (max: 10)`);
    }

    existing.push(hook);
  }

  /**
   * Execute hooks for a given name
   */
  async executeHooks<K extends HookName>(
    name: K,
    context: HookSignatures[K]['context'],
    defaultResult: HookSignatures[K]['result']
  ): Promise<HookSignatures[K]['result']> {
    const hooks = this.hooks.get(name);

    if (!hooks || hooks.length === 0) {
      return defaultResult;
    }

    // Parallel execution (for independent hooks)
    if (this.parallel && hooks.length > 1) {
      return this.executeHooksParallel(hooks, context, defaultResult);
    }

    // Sequential execution (default)
    return this.executeHooksSequential(hooks, context, defaultResult);
  }

  /**
   * Execute hooks sequentially
   */
  private async executeHooksSequential<T>(
    hooks: Hook<any, any>[],
    context: any,
    defaultResult: T
  ): Promise<T> {
    let result = defaultResult;

    for (const hook of hooks) {
      const hookResult = await this.executeHookSafely(hook, context);

      // Skip failed hooks
      if (hookResult === null) {
        continue;
      }

      // Merge hook result
      result = { ...result, ...hookResult };

      // Check for early exit
      if ((hookResult as any).skip === true) {
        break;
      }
    }

    return result;
  }

  /**
   * Execute hooks in parallel
   */
  private async executeHooksParallel<T>(
    hooks: Hook<any, any>[],
    context: any,
    defaultResult: T
  ): Promise<T> {
    // Execute all hooks concurrently
    const results = await Promise.all(
      hooks.map((hook) => this.executeHookSafely(hook, context))
    );

    // Filter out failures and merge results
    const validResults = results.filter((r) => r !== null);

    return validResults.reduce(
      (acc, hookResult) => ({ ...acc, ...hookResult }),
      defaultResult
    );
  }

  /**
   * Execute single hook with error isolation and timeout
   */
  private async executeHookSafely<T>(hook: Hook<any, any>, context: any): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await Promise.race([
        hook(context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Hook timeout')), this.timeout)
        ),
      ]);

      // Reset error counter on success
      this.consecutiveErrors = 0;

      // Track timing
      const duration = Date.now() - startTime;
      if (context.context?.updateMetrics) {
        context.context.updateMetrics({
          hookDuration: (context.context.metrics.hookDuration || 0) + duration,
        });
      }

      return result as T;
    } catch (error) {
      // Increment error counter
      this.consecutiveErrors++;

      // Emit error event
      this.emitter.emit('hook:error', {
        executionId: context.executionId,
        hookName: hook.name || 'anonymous',
        error: error as Error,
        timestamp: new Date(),
      });

      // Check consecutive error threshold
      if (this.consecutiveErrors > this.maxConsecutiveErrors) {
        // Too many failures - this is critical
        throw new Error(
          `Too many consecutive hook failures (${this.consecutiveErrors}). Last error: ${(error as Error).message}`
        );
      }

      // Log warning but continue (degraded mode)
      console.warn(
        `Hook execution failed (${hook.name || 'anonymous'}): ${(error as Error).message}`
      );

      return null; // Hook failed, skip its result
    }
  }

  /**
   * Check if there are any hooks registered
   */
  hasHooks(name: HookName): boolean {
    const hooks = this.hooks.get(name);
    return !!hooks && hooks.length > 0;
  }

  /**
   * Get hook count
   */
  getHookCount(name?: HookName): number {
    if (name) {
      return this.hooks.get(name)?.length || 0;
    }
    // Total across all hooks
    return Array.from(this.hooks.values()).reduce((sum, arr) => sum + arr.length, 0);
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
    this.consecutiveErrors = 0;
  }
}
