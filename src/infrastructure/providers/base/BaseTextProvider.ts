/**
 * Base text provider with common text generation functionality
 */

import { BaseProvider } from './BaseProvider.js';
import { ITextProvider, ModelCapabilities, TextGenerateOptions } from '../../../domain/interfaces/ITextProvider.js';
import { LLMResponse } from '../../../domain/entities/Response.js';
import { StreamEvent } from '../../../domain/entities/StreamEvent.js';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../../resilience/CircuitBreaker.js';
import { logger, FrameworkLogger } from '../../observability/Logger.js';
import { metrics } from '../../observability/Metrics.js';
import type { IDisposable } from '../../../domain/interfaces/IDisposable.js';
import { enforceContextLimit } from '../shared/enforceContextLimit.js';
import type { AdvancedTextCapabilities } from '../../../domain/interfaces/IAdvancedInference.js';
import { ProviderCapabilityNotSupportedError } from '../../../domain/errors/AIErrors.js';
import { Connector } from '../../../core/Connector.js';
import {
  buildStructuredInstructionSuffix,
  type ResponseFormat,
} from '../../../core/StructuredOutput.js';

export abstract class BaseTextProvider extends BaseProvider implements ITextProvider, IDisposable {
  protected circuitBreaker?: CircuitBreaker;
  protected logger: FrameworkLogger;
  private _isObservabilityInitialized = false;
  private _isDestroyed = false;

  constructor(config: any) {
    super(config);

    // Initialize with default logger (will be updated with provider name on first use)
    this.logger = logger.child({
      component: 'Provider',
      provider: 'unknown',
    });

    // Circuit breaker created lazily on first use
  }

  /**
   * Auto-initialize observability on first use (lazy initialization)
   * This is called automatically by executeWithCircuitBreaker(); subclasses
   * whose stream paths bypass it (e.g. streamGenerate) should also call it
   * at entry so error logs carry the real provider name instead of "unknown".
   * @internal
   */
  protected ensureObservabilityInitialized(): void {
    if (this._isObservabilityInitialized || this._isDestroyed) {
      return;
    }

    const providerName = this.name || 'unknown';

    // Create circuit breaker with provider name
    const cbConfig = (this.config as any).circuitBreaker || DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new CircuitBreaker(
      `provider:${providerName}`,
      cbConfig
    );

    // Update logger with provider name
    this.logger = logger.child({
      component: 'Provider',
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
   * DEPRECATED: No longer needed, kept for backward compatibility
   * Observability is now auto-initialized on first use
   * @deprecated Initialization happens automatically
   */
  protected initializeObservability(_providerName: string): void {
    // Force initialization now (for providers that still call this)
    this.ensureObservabilityInitialized();
  }

  abstract generate(options: TextGenerateOptions): Promise<LLMResponse>;
  abstract streamGenerate(options: TextGenerateOptions): AsyncIterableIterator<StreamEvent>;
  abstract getModelCapabilities(model: string): ModelCapabilities;

  getAdvancedCapabilities(model: string): AdvancedTextCapabilities {
    const capabilities = this.getModelCapabilities(model);
    return {
      promptCaching: {
        // The base provider cannot promise a provider-specific cache contract.
        // Concrete providers must opt in only when they implement the wire
        // mapping and usage reporting themselves.
        mode: 'unsupported',
        ttlModes: [],
        reportsCacheUsage: false,
      },
      batch: { supported: false, cancellable: false },
      structuredOutput: {
        jsonObject: capabilities.supportsJSON ? 'native' : 'prompt',
        jsonSchema: capabilities.supportsJSONSchema ? 'native' : 'prompt',
        nativeWithTools: false,
      },
      nativeTools: [],
      nativeToolOptions: { remoteMcpApproval: false },
      dataHandling: {
        promptCaching: 'none',
        batch: 'none',
        remoteMcp: 'none',
      },
    };
  }

  /**
   * Execute with circuit breaker protection (helper for subclasses)
   */
  protected async executeWithCircuitBreaker<TResult>(
    operation: () => Promise<TResult>,
    model?: string
  ): Promise<TResult> {
    // Auto-initialize observability on first use
    this.ensureObservabilityInitialized();

    const startTime = Date.now();
    const operationName = 'llm.generate';

    this.logger.debug({
      operation: operationName,
      model,
    }, 'LLM call started');

    metrics.increment('provider.llm.request', 1, {
      provider: this.name,
      model: model || 'unknown',
    });

    try {
      // Execute with circuit breaker (should always be initialized after ensureObservabilityInitialized)
      if (!this.circuitBreaker) {
        // Fallback: execute without circuit breaker (should never happen)
        return await operation();
      }

      const result = await this.circuitBreaker.execute(operation);

      const duration = Date.now() - startTime;

      this.logger.info({
        operation: operationName,
        model,
        duration,
      }, 'LLM call completed');

      metrics.timing('provider.llm.latency', duration, {
        provider: this.name,
        model: model || 'unknown',
      });

      metrics.increment('provider.llm.response', 1, {
        provider: this.name,
        model: model || 'unknown',
        status: 'success',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        operation: operationName,
        model,
        error: (error as Error).message,
        duration,
      }, 'LLM call failed');

      metrics.increment('provider.llm.error', 1, {
        provider: this.name,
        model: model || 'unknown',
        error: (error as Error).name,
      });

      throw error;
    }
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    if (!this.circuitBreaker) {
      // Not yet initialized (no calls made yet)
      return null;
    }
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Normalize input to string (helper for providers that don't support complex input)
   */
  protected normalizeInputToString(input: string | any[]): string {
    if (typeof input === 'string') {
      return input;
    }

    // Extract text from InputItem array
    const textParts: string[] = [];
    for (const item of input) {
      if (item.type === 'message') {
        for (const content of item.content) {
          if (content.type === 'input_text') {
            textParts.push(content.text);
          } else if (content.type === 'output_text') {
            textParts.push(content.text);
          }
        }
      }
    }

    return textParts.join('\n');
  }

  /**
   * Apply context limit guardrail to generation options.
   * Returns the same options if within budget, or trimmed options if over.
   * This is a safety net — primary context management is in AgentContextNextGen.
   */
  protected applyContextLimitGuardrail(options: TextGenerateOptions): TextGenerateOptions {
    const normalized = this.normalizeProviderOptions(options);
    this.assertAdvancedOptionsSupported(normalized);
    if (normalized.skipContextLimitCheck) return normalized;
    const capabilities = this.getModelCapabilities(normalized.model);
    return enforceContextLimit(normalized, capabilities, this.logger);
  }

  protected async resolveAdvancedCredentials(
    options: TextGenerateOptions,
  ): Promise<TextGenerateOptions> {
    if (!options.native_tools?.some((tool) => tool.capability === 'remote_mcp')) {
      return options;
    }
    return {
      ...options,
      native_tools: await Promise.all(
        options.native_tools.map(async (tool) => {
          if (tool.capability !== 'remote_mcp' || !tool.server.authorization) return tool;
          const connector = options.credential_context?.connectorRegistry
            ? options.credential_context.connectorRegistry.get(tool.server.authorization.connector)
            : Connector.get(tool.server.authorization.connector);
          const token = await connector.getToken(
            options.credential_context?.userId,
            tool.server.authorization.accountId,
          );
          return {
            ...tool,
            server: { ...tool.server, resolvedAuthorizationToken: token },
          };
        }),
      ),
    };
  }

  private normalizeProviderOptions(options: TextGenerateOptions): TextGenerateOptions {
    return this.normalizeStructuredOutput(this.normalizePromptCache(options));
  }

  private normalizePromptCache(options: TextGenerateOptions): TextGenerateOptions {
    if (options.prompt_cache?.mode !== 'auto') return options;
    const caching = this.getAdvancedCapabilities(options.model).promptCaching;
    if (caching.mode === 'unsupported') {
      if (options.prompt_cache.strict) return options;
      // Non-strict cache requests degrade to an ordinary request. Never send
      // an unsupported vendor field and rely on the remote API to reject it.
      return { ...options, prompt_cache: undefined };
    }
    if (
      options.prompt_cache.ttl &&
      !caching.ttlModes.includes(options.prompt_cache.ttl)
    ) {
      if (options.prompt_cache.strict) return options;
      // Keep the cache request/key but omit a retention control the concrete
      // model cannot execute (implicit caching may still apply).
      return {
        ...options,
        prompt_cache: { ...options.prompt_cache, ttl: undefined },
      };
    }
    if (options.prompt_cache.breakpointMode === 'explicit' && !caching.explicitBreakpoints) {
      if (options.prompt_cache.strict) return options;
      return {
        ...options,
        prompt_cache: { ...options.prompt_cache, breakpointMode: undefined },
      };
    }
    return options;
  }

  /**
   * Normalize low-level provider/batch structured-output requests using the
   * same executable capability contract as Agent. Agent calls normally arrive
   * pre-normalized; this path primarily protects direct ITextProvider and batch
   * callers from sending unsupported native fields to the provider.
   */
  private normalizeStructuredOutput(options: TextGenerateOptions): TextGenerateOptions {
    const requested = options.response_format;
    if (!requested || requested.type === 'text') return options;

    let format: ResponseFormat;
    if (requested.type === 'json_object') {
      format = { type: 'json_object' };
    } else {
      const container = requested.json_schema;
      const schema =
        container && typeof container === 'object' && 'schema' in container
          ? container.schema
          : container;
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        throw new ProviderCapabilityNotSupportedError(
          this.name,
          options.model,
          'structured_output:json_schema_requires_schema',
        );
      }
      const metadata =
        container && typeof container === 'object'
          ? (container as {
              name?: string;
              description?: string;
              strict?: boolean;
            })
          : undefined;
      format = {
        type: 'json_schema',
        schema: schema as Record<string, unknown>,
        ...(metadata?.name !== undefined ? { name: metadata.name } : {}),
        ...(metadata?.description !== undefined ? { description: metadata.description } : {}),
        ...(metadata?.strict !== undefined ? { strict: metadata.strict } : {}),
      };
    }

    const advanced = this.getAdvancedCapabilities(options.model);
    const nativeMode =
      format.type === 'json_object'
        ? advanced.structuredOutput.jsonObject
        : advanced.structuredOutput.jsonSchema;
    const hasTools =
      (options.tools?.length ?? 0) + (options.native_tools?.length ?? 0) > 0;
    const useNative =
      nativeMode === 'native' && (!hasTools || advanced.structuredOutput.nativeWithTools);
    if (useNative) return options;

    return {
      ...options,
      response_format: undefined,
      instructions:
        (options.instructions ?? '') + buildStructuredInstructionSuffix(format),
    };
  }

  protected assertAdvancedOptionsSupported(options: TextGenerateOptions): void {
    const advanced = this.getAdvancedCapabilities(options.model);
    if (
      options.prompt_cache?.mode === 'auto' &&
      options.prompt_cache.strict &&
      advanced.promptCaching.mode === 'unsupported'
    ) {
      throw new ProviderCapabilityNotSupportedError(this.name, options.model, 'prompt_caching');
    }
    if (
      options.prompt_cache?.mode === 'auto' &&
      options.prompt_cache.strict &&
      options.prompt_cache.ttl &&
      !advanced.promptCaching.ttlModes.includes(options.prompt_cache.ttl)
    ) {
      throw new ProviderCapabilityNotSupportedError(
        this.name,
        options.model,
        `prompt_cache_ttl:${options.prompt_cache.ttl}`,
      );
    }
    if (
      options.prompt_cache?.mode === 'auto' &&
      options.prompt_cache.strict &&
      options.prompt_cache.breakpointMode === 'explicit' &&
      !advanced.promptCaching.explicitBreakpoints
    ) {
      throw new ProviderCapabilityNotSupportedError(
        this.name,
        options.model,
        'prompt_cache_explicit_breakpoints',
      );
    }
    for (const tool of options.native_tools ?? []) {
      if (!advanced.nativeTools.includes(tool.capability)) {
        throw new ProviderCapabilityNotSupportedError(
          this.name,
          options.model,
          `native_tool:${tool.capability}`,
        );
      }
      if (
        tool.capability === 'remote_mcp' &&
        options.data_handling?.allowThirdPartyTools !== true
      ) {
        throw new ProviderCapabilityNotSupportedError(
          this.name,
          options.model,
          'remote_mcp_blocked_by_data_policy',
        );
      }
      if (
        tool.capability === 'remote_mcp' &&
        tool.server.requireApproval === 'always' &&
        !advanced.nativeToolOptions.remoteMcpApproval
      ) {
        throw new ProviderCapabilityNotSupportedError(
          this.name,
          options.model,
          'remote_mcp_approval_policy',
        );
      }
      if (tool.capability === 'remote_mcp') {
        let url: URL;
        try {
          url = new URL(tool.server.url);
        } catch {
          throw new ProviderCapabilityNotSupportedError(
            this.name,
            options.model,
            'remote_mcp_invalid_url',
          );
        }
        if (url.protocol !== 'https:') {
          throw new ProviderCapabilityNotSupportedError(
            this.name,
            options.model,
            'remote_mcp_requires_https',
          );
        }
      }
      if (tool.capability === 'file_search') {
        const raw = tool.options as Record<string, unknown> | undefined;
        const vectorStoreIds = raw?.vectorStoreIds ?? raw?.vector_store_ids;
        if (!Array.isArray(vectorStoreIds) || vectorStoreIds.length === 0) {
          throw new ProviderCapabilityNotSupportedError(
            this.name,
            options.model,
            'native_tool:file_search_requires_vector_store_ids',
          );
        }
      }
      if (
        tool.capability !== 'remote_mcp' &&
        options.data_handling?.allowProviderTools !== true
      ) {
        throw new ProviderCapabilityNotSupportedError(
          this.name,
          options.model,
          `native_tool:${tool.capability}_blocked_by_data_policy`,
        );
      }
    }
    if (
      options.prompt_cache?.mode === 'auto' &&
      options.data_handling?.allowProviderCaching !== true
    ) {
      throw new ProviderCapabilityNotSupportedError(
        this.name,
        options.model,
        'prompt_caching_blocked_by_data_policy',
      );
    }
  }

  /**
   * List available models from the provider's API.
   * Default returns empty array; providers override when they have SDK support.
   */
  async listModels(): Promise<string[]> {
    return [];
  }

  /**
   * Check if the provider has been destroyed
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Clean up provider resources (circuit breaker listeners, etc.)
   * Should be called when the provider is no longer needed.
   */
  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    if (this.circuitBreaker) {
      this.circuitBreaker.removeAllListeners();
      this.circuitBreaker = undefined;
    }
    this._isObservabilityInitialized = false;
  }
}
