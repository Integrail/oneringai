/**
 * ContextGuardian - Mandatory checkpoint for context validation before LLM calls
 *
 * This class provides the final safety net to ensure context never exceeds
 * the model's limits. It validates the prepared input and applies graceful
 * degradation if needed, ensuring the LLM call will succeed.
 *
 * Graceful Degradation Levels (applied in order):
 * 1. Remove ToolOutputPlugin entries (if present)
 * 2. Truncate tool results to maxToolResultTokens each
 * 3. Remove oldest N unprotected tool pairs
 * 4. Truncate system prompt to minSystemPromptTokens
 * 5. Throw ContextOverflowError with detailed budget
 *
 * @example
 * ```typescript
 * const guardian = new ContextGuardian({ maxContextTokens: 128000 });
 *
 * // In AgentContext.prepare():
 * const input = await this.buildLLMInput();
 * const validation = guardian.validate(input, maxTokens);
 *
 * if (!validation.valid) {
 *   const { input: safeInput, log } = guardian.applyGracefulDegradation(input, validation.targetTokens);
 *   return { input: safeInput, ... };
 * }
 * ```
 */

import type { InputItem, Message } from '../../domain/entities/Message.js';
import { MessageRole } from '../../domain/entities/Message.js';
import { ContentType } from '../../domain/entities/Content.js';
import type { ITokenEstimator } from './types.js';
import { ContextOverflowError } from '../../domain/errors/AIErrors.js';
import { GUARDIAN_DEFAULTS, STRATEGY_THRESHOLDS, SAFETY_CAPS, type StrategyName } from '../constants.js';
import { logger as baseLogger, FrameworkLogger } from '../../infrastructure/observability/Logger.js';

// Plugin-specific logger
const logger: FrameworkLogger = baseLogger.child({ component: 'ContextGuardian' });

// ============================================================================
// Types
// ============================================================================

/**
 * Result of guardian validation
 */
export interface GuardianValidation {
  /** Whether the input fits within limits */
  valid: boolean;
  /** Actual token count of input */
  actualTokens: number;
  /** Target token limit (maxTokens - reserved) */
  targetTokens: number;
  /** How many tokens over the limit (0 if valid) */
  overageTokens: number;
  /** Token breakdown by message type */
  breakdown: Record<string, number>;
}

/**
 * Result of graceful degradation
 */
export interface DegradationResult {
  /** The potentially modified input */
  input: InputItem[];
  /** Log of actions taken */
  log: string[];
  /** Final token count after degradation */
  finalTokens: number;
  /** Tokens freed during degradation */
  tokensFreed: number;
  /** Whether degradation was successful (fits within limits) */
  success: boolean;
}

/**
 * Configuration for ContextGuardian
 */
export interface ContextGuardianConfig {
  /** Enable guardian validation (default: true) */
  enabled?: boolean;
  /** Maximum tool result size in tokens before truncation */
  maxToolResultTokens?: number;
  /** Minimum system prompt tokens to preserve */
  minSystemPromptTokens?: number;
  /** Number of recent messages to always protect from compaction */
  protectedRecentMessages?: number;
  /** Maximum context tokens (used for percentage-based protection calculations) */
  maxContextTokens?: number;
  /** Strategy name (affects protected message percentage) */
  strategy?: StrategyName;
}

// ============================================================================
// ContextGuardian Implementation
// ============================================================================

/**
 * ContextGuardian - Ensures context never exceeds model limits
 *
 * The guardian acts as a LAST RESORT after smart compaction and strategy-based
 * eviction have already been attempted. It uses strategy-aware thresholds
 * to avoid overly aggressive data loss.
 */
export class ContextGuardian {
  private readonly _enabled: boolean;
  private readonly _maxToolResultTokens: number;
  private readonly _minSystemPromptTokens: number;
  private readonly _configuredProtectedMessages: number;
  private readonly _maxContextTokens: number | undefined;
  private readonly _strategy: StrategyName;
  private readonly _estimator: ITokenEstimator;

  constructor(estimator: ITokenEstimator, config: ContextGuardianConfig = {}) {
    this._estimator = estimator;
    this._enabled = config.enabled ?? GUARDIAN_DEFAULTS.ENABLED;
    this._maxToolResultTokens = config.maxToolResultTokens ?? GUARDIAN_DEFAULTS.MAX_TOOL_RESULT_TOKENS;
    this._minSystemPromptTokens = config.minSystemPromptTokens ?? GUARDIAN_DEFAULTS.MIN_SYSTEM_PROMPT_TOKENS;
    this._configuredProtectedMessages = config.protectedRecentMessages ?? GUARDIAN_DEFAULTS.PROTECTED_RECENT_MESSAGES;
    this._maxContextTokens = config.maxContextTokens;
    this._strategy = config.strategy ?? 'proactive';
  }

  /**
   * Get effective protected message count, considering strategy and context size.
   * Uses percentage-based calculation if maxContextTokens is available.
   *
   * NOTE: If an explicit value was configured (not using default), it's honored
   * without applying minimum caps - this allows tests and special cases to work.
   */
  private get _protectedRecentMessages(): number {
    // If explicitly configured (not default), honor that value directly
    if (this._configuredProtectedMessages !== GUARDIAN_DEFAULTS.PROTECTED_RECENT_MESSAGES) {
      return this._configuredProtectedMessages;
    }

    // If we have maxContextTokens, use percentage-based calculation
    if (this._maxContextTokens) {
      const thresholds = STRATEGY_THRESHOLDS[this._strategy];
      // Estimate: average message is ~100 tokens
      const percentBasedTokens = Math.floor(this._maxContextTokens * thresholds.protectedContextPercent);
      const percentBasedMessages = Math.floor(percentBasedTokens / 100);
      // Use the more permissive of percentage-based or configured
      const calculated = Math.max(percentBasedMessages, this._configuredProtectedMessages);
      // But always ensure minimum protection
      return Math.max(calculated, SAFETY_CAPS.MIN_PROTECTED_MESSAGES);
    }

    // Fallback to configured value with minimum (using defaults)
    return Math.max(this._configuredProtectedMessages, SAFETY_CAPS.MIN_PROTECTED_MESSAGES);
  }

  /**
   * Check if guardian is enabled
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Validate that input fits within token limits
   *
   * @param input - The InputItem[] to validate
   * @param maxTokens - Maximum allowed tokens (after reserving for response)
   * @returns Validation result with actual counts and breakdown
   */
  validate(input: InputItem[], maxTokens: number): GuardianValidation {
    const breakdown = {
      system: 0,
      user: 0,
      assistant: 0,
      tool_use: 0,
      tool_result: 0,
      other: 0,
    };

    let actualTokens = 0;

    for (const item of input) {
      const tokens = this.estimateInputItemTokens(item);
      actualTokens += tokens;

      // Categorize for breakdown
      if (item.type === 'message') {
        const msg = item as Message;
        if (msg.role === MessageRole.DEVELOPER) {
          breakdown.system += tokens;
        } else if (msg.role === MessageRole.USER) {
          // Check for tool results
          const hasToolResult = msg.content.some(c => c.type === ContentType.TOOL_RESULT);
          if (hasToolResult) {
            breakdown.tool_result += tokens;
          } else {
            breakdown.user += tokens;
          }
        } else if (msg.role === MessageRole.ASSISTANT) {
          // Check for tool uses
          const hasToolUse = msg.content.some(c => c.type === ContentType.TOOL_USE);
          if (hasToolUse) {
            breakdown.tool_use += tokens;
          } else {
            breakdown.assistant += tokens;
          }
        }
      } else {
        breakdown.other += tokens;
      }
    }

    const valid = actualTokens <= maxTokens;
    const overageTokens = valid ? 0 : actualTokens - maxTokens;

    logger.debug({
      actualTokens,
      maxTokens,
      valid,
      overageTokens,
      breakdown,
    }, `Guardian validation: ${valid ? 'PASS' : 'FAIL'}`);

    return {
      valid,
      actualTokens,
      targetTokens: maxTokens,
      overageTokens,
      breakdown,
    };
  }

  /**
   * Apply graceful degradation to reduce input size
   *
   * @param input - The InputItem[] to potentially modify
   * @param targetTokens - Target token count to achieve
   * @returns Degradation result with potentially modified input
   */
  applyGracefulDegradation(input: InputItem[], targetTokens: number): DegradationResult {
    const log: string[] = [];
    let tokensFreed = 0;
    let currentInput = [...input];

    const initialValidation = this.validate(currentInput, targetTokens);
    if (initialValidation.valid) {
      return {
        input: currentInput,
        log: ['No degradation needed'],
        finalTokens: initialValidation.actualTokens,
        tokensFreed: 0,
        success: true,
      };
    }

    log.push(`Starting graceful degradation: ${initialValidation.actualTokens} tokens, target: ${targetTokens}`);

    // Level 1: Truncate large tool results
    const level1Result = this.truncateToolResults(currentInput, log);
    currentInput = level1Result.input;
    tokensFreed += level1Result.tokensFreed;

    let validation = this.validate(currentInput, targetTokens);
    if (validation.valid) {
      log.push(`Level 1 (truncate tool results) successful: ${validation.actualTokens} tokens`);
      return {
        input: currentInput,
        log,
        finalTokens: validation.actualTokens,
        tokensFreed,
        success: true,
      };
    }

    // Level 2: Remove oldest unprotected tool pairs
    const level2Result = this.removeOldestToolPairs(currentInput, validation.overageTokens, log);
    currentInput = level2Result.input;
    tokensFreed += level2Result.tokensFreed;

    validation = this.validate(currentInput, targetTokens);
    if (validation.valid) {
      log.push(`Level 2 (remove tool pairs) successful: ${validation.actualTokens} tokens`);
      return {
        input: currentInput,
        log,
        finalTokens: validation.actualTokens,
        tokensFreed,
        success: true,
      };
    }

    // Level 3: Truncate system prompt (last resort before error)
    const level3Result = this.truncateSystemPrompt(currentInput, log);
    currentInput = level3Result.input;
    tokensFreed += level3Result.tokensFreed;

    validation = this.validate(currentInput, targetTokens);
    if (validation.valid) {
      log.push(`Level 3 (truncate system prompt) successful: ${validation.actualTokens} tokens`);
      return {
        input: currentInput,
        log,
        finalTokens: validation.actualTokens,
        tokensFreed,
        success: true,
      };
    }

    // Level 4: FAIL - throw ContextOverflowError
    log.push(`All degradation levels exhausted: ${validation.actualTokens} tokens (target: ${targetTokens})`);

    // Throw detailed error
    throw new ContextOverflowError(
      'All graceful degradation levels exhausted',
      {
        actualTokens: validation.actualTokens,
        maxTokens: targetTokens,
        overageTokens: validation.overageTokens,
        breakdown: validation.breakdown,
        degradationLog: log,
      }
    );
  }

  /**
   * Emergency compact - more aggressive than graceful degradation
   * Used when even graceful degradation fails
   *
   * @param input - The InputItem[] to compact
   * @param targetTokens - Target token count
   * @returns Compacted InputItem[] (may lose significant data)
   */
  emergencyCompact(input: InputItem[], targetTokens: number): InputItem[] {
    const log: string[] = ['EMERGENCY COMPACTION'];
    let result = [...input];

    // Keep only: system prompt (truncated), last N protected messages
    const systemMessages: InputItem[] = [];
    const otherMessages: InputItem[] = [];

    for (const item of result) {
      if (item.type === 'message' && (item as Message).role === MessageRole.DEVELOPER) {
        systemMessages.push(item);
      } else {
        otherMessages.push(item);
      }
    }

    // Truncate system prompt aggressively
    const truncatedSystem = systemMessages.map(item =>
      this.truncateMessage(item as Message, this._minSystemPromptTokens)
    );

    // Keep only last N messages
    const protectedMessages = otherMessages.slice(-this._protectedRecentMessages);

    result = [...truncatedSystem, ...protectedMessages];

    // Verify
    const validation = this.validate(result, targetTokens);
    if (!validation.valid) {
      log.push(`Emergency compaction failed: still at ${validation.actualTokens} tokens`);
      logger.error({ validation, log }, 'Emergency compaction failed');
    }

    return result;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Estimate tokens for an InputItem
   */
  private estimateInputItemTokens(item: InputItem): number {
    if (item.type !== 'message') {
      return 50; // Default for unknown types
    }

    const msg = item as Message;
    let total = 4; // Message overhead

    for (const content of msg.content) {
      if (content.type === ContentType.INPUT_TEXT || content.type === ContentType.OUTPUT_TEXT) {
        total += this._estimator.estimateTokens((content as any).text || '');
      } else if (content.type === ContentType.TOOL_USE) {
        total += this._estimator.estimateTokens((content as any).name || '');
        total += this._estimator.estimateDataTokens((content as any).input || {});
      } else if (content.type === ContentType.TOOL_RESULT) {
        total += this._estimator.estimateTokens((content as any).content || '');
      } else if (content.type === ContentType.INPUT_IMAGE_URL) {
        total += 200; // Images are typically 85-170 tokens per tile
      }
    }

    return total;
  }

  /**
   * Level 1: Truncate large tool results
   */
  private truncateToolResults(
    input: InputItem[],
    log: string[]
  ): { input: InputItem[]; tokensFreed: number } {
    let tokensFreed = 0;
    const result: InputItem[] = [];

    for (const item of input) {
      if (item.type !== 'message') {
        result.push(item);
        continue;
      }

      const msg = item as Message;
      const hasToolResult = msg.content.some(c => c.type === ContentType.TOOL_RESULT);

      if (!hasToolResult) {
        result.push(item);
        continue;
      }

      // Check and truncate tool results
      const newContent = msg.content.map(c => {
        if (c.type !== ContentType.TOOL_RESULT) return c;

        const toolResult = c as any;
        const content = toolResult.content || '';
        const currentTokens = this._estimator.estimateTokens(content);

        if (currentTokens > this._maxToolResultTokens) {
          // Truncate to target
          const targetChars = this._maxToolResultTokens * 4; // ~4 chars per token
          const truncated = content.slice(0, targetChars) + GUARDIAN_DEFAULTS.TRUNCATION_SUFFIX;

          const freed = currentTokens - this._estimator.estimateTokens(truncated);
          tokensFreed += freed;

          log.push(`Truncated tool result ${toolResult.tool_use_id}: ${currentTokens} → ${currentTokens - freed} tokens`);

          return {
            ...toolResult,
            content: truncated,
          };
        }

        return c;
      });

      result.push({
        ...msg,
        content: newContent,
      } as Message);
    }

    if (tokensFreed > 0) {
      log.push(`Level 1: Truncated tool results, freed ${tokensFreed} tokens`);
    }

    return { input: result, tokensFreed };
  }

  /**
   * Level 2: Remove oldest unprotected tool pairs
   */
  private removeOldestToolPairs(
    input: InputItem[],
    overageTokens: number,
    log: string[]
  ): { input: InputItem[]; tokensFreed: number } {
    // Find tool pairs (tool_use -> tool_result)
    const toolPairs = new Map<string, { useIndex: number; resultIndex: number | null }>();

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      if (item?.type !== 'message') continue;

      const msg = item as Message;
      for (const content of msg.content) {
        if (content.type === ContentType.TOOL_USE) {
          const toolUseId = (content as any).id;
          if (toolUseId) {
            toolPairs.set(toolUseId, { useIndex: i, resultIndex: null });
          }
        } else if (content.type === ContentType.TOOL_RESULT) {
          const toolUseId = (content as any).tool_use_id;
          const pair = toolPairs.get(toolUseId);
          if (pair) {
            pair.resultIndex = i;
          }
        }
      }
    }

    // Sort pairs by age (oldest first)
    const sortedPairs = [...toolPairs.entries()]
      .filter(([, pair]) => pair.resultIndex !== null)
      .sort(([, a], [, b]) => a.useIndex - b.useIndex);

    // Calculate how many pairs to remove
    const protectedStart = input.length - this._protectedRecentMessages;
    const indicesToRemove = new Set<number>();
    let tokensFreed = 0;

    for (const [toolUseId, pair] of sortedPairs) {
      if (tokensFreed >= overageTokens) break;

      // Skip if protected
      if (pair.useIndex >= protectedStart || (pair.resultIndex !== null && pair.resultIndex >= protectedStart)) {
        continue;
      }

      // Remove both tool_use and tool_result messages
      indicesToRemove.add(pair.useIndex);
      if (pair.resultIndex !== null) {
        indicesToRemove.add(pair.resultIndex);
      }

      // Estimate tokens freed
      const useItem = input[pair.useIndex];
      const resultItem = pair.resultIndex !== null ? input[pair.resultIndex] : null;

      if (useItem) tokensFreed += this.estimateInputItemTokens(useItem);
      if (resultItem) tokensFreed += this.estimateInputItemTokens(resultItem);

      log.push(`Removing tool pair ${toolUseId}`);
    }

    // Filter out removed indices
    const result = input.filter((_, i) => !indicesToRemove.has(i));

    if (indicesToRemove.size > 0) {
      log.push(`Level 2: Removed ${indicesToRemove.size} messages (${sortedPairs.length} tool pairs evaluated), freed ${tokensFreed} tokens`);
    }

    return { input: result, tokensFreed };
  }

  /**
   * Level 3: Truncate system prompt
   */
  private truncateSystemPrompt(
    input: InputItem[],
    log: string[]
  ): { input: InputItem[]; tokensFreed: number } {
    let tokensFreed = 0;
    const result: InputItem[] = [];

    for (const item of input) {
      if (item.type !== 'message') {
        result.push(item);
        continue;
      }

      const msg = item as Message;
      if (msg.role !== MessageRole.DEVELOPER) {
        result.push(item);
        continue;
      }

      // Truncate system message
      const currentTokens = this.estimateInputItemTokens(msg);
      if (currentTokens > this._minSystemPromptTokens) {
        const truncated = this.truncateMessage(msg, this._minSystemPromptTokens);
        const newTokens = this.estimateInputItemTokens(truncated);
        tokensFreed += currentTokens - newTokens;
        log.push(`Truncated system prompt: ${currentTokens} → ${newTokens} tokens`);
        result.push(truncated);
      } else {
        result.push(item);
      }
    }

    if (tokensFreed > 0) {
      log.push(`Level 3: Truncated system prompt, freed ${tokensFreed} tokens`);
    }

    return { input: result, tokensFreed };
  }

  /**
   * Truncate a message to target token count
   */
  private truncateMessage(msg: Message, targetTokens: number): Message {
    const newContent = msg.content.map(c => {
      if (c.type !== ContentType.INPUT_TEXT && c.type !== ContentType.OUTPUT_TEXT) {
        return c;
      }

      const text = (c as any).text || '';
      const currentTokens = this._estimator.estimateTokens(text);

      if (currentTokens > targetTokens) {
        const targetChars = targetTokens * 4;
        const truncated = text.slice(0, targetChars) + GUARDIAN_DEFAULTS.TRUNCATION_SUFFIX;
        return { ...c, text: truncated };
      }

      return c;
    });

    return { ...msg, content: newContent };
  }
}
