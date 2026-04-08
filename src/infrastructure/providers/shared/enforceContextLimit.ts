/**
 * Pre-flight context limit guardrail for LLM providers.
 *
 * Estimates input token count and, if it exceeds the model's context window,
 * logs a warning and trims the input to fit — leaving space for the response.
 *
 * This is a safety net. The primary context management lives in
 * AgentContextNextGen.prepare() for the managed agent.run()/stream() path.
 */

import type { TextGenerateOptions, ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';
import type { InputItem } from '../../../domain/entities/Message.js';
import type { FrameworkLogger } from '../../observability/Logger.js';

// Local constant to keep provider layer independent from core/
const CHARS_PER_TOKEN = 3.5;

/** Default response reserve when maxOutputTokens is unknown */
const DEFAULT_RESPONSE_RESERVE = 4096;

// ─── Token Estimation Helpers ───────────────────────────────────────────────

function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateDataTokens(data: unknown): number {
  if (data === undefined || data === null) return 0;
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return estimateTokens(text);
}

function estimateInputItemTokens(item: InputItem): number {
  if (item.type === 'compaction') {
    return estimateTokens(item.encrypted_content ?? '');
  }
  // Message — sum text from all content entries
  let chars = 0;
  for (const c of item.content) {
    if ('text' in c && typeof c.text === 'string') {
      chars += c.text.length;
    }
    if ('arguments' in c && typeof c.arguments === 'string') {
      chars += c.arguments.length;
    }
    if ('content' in c && typeof c.content === 'string') {
      chars += c.content.length;
    }
  }
  // Small overhead per message for role/type metadata
  chars += 20;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function estimateInputTokens(input: string | InputItem[]): number {
  if (typeof input === 'string') return estimateTokens(input);
  let total = 0;
  for (const item of input) {
    total += estimateInputItemTokens(item);
  }
  return total;
}

// ─── Trimming Helpers ───────────────────────────────────────────────────────

/**
 * Truncate a string from the beginning, keeping the tail that fits.
 */
function trimStringFromBeginning(input: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  if (input.length <= maxChars) return input;
  const trimmed = input.slice(input.length - maxChars);
  return `[...truncated ${input.length - maxChars} chars to fit context limit...]\n${trimmed}`;
}

/**
 * Trim an InputItem[] by removing items from the middle (oldest first),
 * keeping the first item (system/developer message) and the last item (current turn).
 * If still over budget, truncates text in the last item.
 */
function trimInputItems(
  items: InputItem[],
  maxTokens: number,
  currentTotal: number,
): InputItem[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [trimSingleItem(items[0]!, maxTokens)];
  }

  let excess = currentTotal - maxTokens;
  const result = [...items];

  // Remove from index 1..N-2 (oldest first, preserve first + last)
  let i = 1;
  while (excess > 0 && i < result.length - 1) {
    const removedTokens = estimateInputItemTokens(result[i]!);
    result.splice(i, 1);
    excess -= removedTokens;
    // Don't increment i — next item shifts into this index
  }

  // If still over budget, truncate the last item's text content
  if (excess > 0 && result.length > 0) {
    const lastIdx = result.length - 1;
    const lastItem = result[lastIdx]!;
    const lastTokens = estimateInputItemTokens(lastItem);
    const allowedForLast = Math.max(10, lastTokens - excess);
    result[lastIdx] = trimSingleItem(lastItem, allowedForLast);
  }

  return result;
}

/**
 * Truncate text content within a single InputItem to fit within maxTokens.
 */
function trimSingleItem(item: InputItem, maxTokens: number): InputItem {
  if (item.type === 'compaction') {
    const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
    return {
      ...item,
      encrypted_content: item.encrypted_content.slice(0, maxChars),
    };
  }

  // Message — truncate text content from the beginning
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  let charsUsed = 0;
  const newContent = item.content.map(c => {
    if ('text' in c && typeof c.text === 'string') {
      const available = Math.max(0, maxChars - charsUsed);
      if (c.text.length > available) {
        const truncated = c.text.slice(c.text.length - available);
        charsUsed += available;
        return { ...c, text: `[...truncated to fit context...]\n${truncated}` };
      }
      charsUsed += c.text.length;
    }
    return c;
  });

  return { ...item, content: newContent };
}

// ─── Main Function ──────────────────────────────────────────────────────────

/**
 * Enforce context limit on TextGenerateOptions.
 *
 * If the estimated input tokens exceed the model's context window (minus response
 * reserve), logs a warning and returns a new options object with trimmed input.
 * If within budget, returns the original options reference (zero allocation).
 *
 * @param options - The generation options to validate
 * @param capabilities - Model capabilities (maxInputTokens, maxOutputTokens)
 * @param logger - Logger for warnings
 * @returns Original options if within budget, or new options with trimmed input
 */
export function enforceContextLimit(
  options: TextGenerateOptions,
  capabilities: ModelCapabilities,
  logger: FrameworkLogger,
): TextGenerateOptions {
  // Compute budget
  const maxInputTokens = capabilities.maxInputTokens ?? capabilities.maxTokens;
  const responseReserve = options.max_output_tokens
    ?? capabilities.maxOutputTokens
    ?? DEFAULT_RESPONSE_RESERVE;
  const maxAllowed = maxInputTokens - responseReserve;

  if (maxAllowed <= 0) {
    // Can't determine a valid budget — skip guardrail
    logger.debug(
      { maxInputTokens, responseReserve },
      'enforceContextLimit: cannot determine valid budget, skipping',
    );
    return options;
  }

  // Estimate total input tokens
  const instructionsTokens = estimateTokens(options.instructions ?? '');
  const toolsTokens = estimateDataTokens(options.tools);
  const inputTokens = estimateInputTokens(options.input);
  const totalEstimate = instructionsTokens + toolsTokens + inputTokens;

  // Happy path — within budget
  if (totalEstimate <= maxAllowed) {
    return options;
  }

  // Over budget — log warning
  const overshoot = totalEstimate - maxAllowed;
  logger.warn(
    {
      model: options.model,
      estimatedTokens: totalEstimate,
      maxAllowed,
      overshoot,
      breakdown: {
        instructions: instructionsTokens,
        tools: toolsTokens,
        input: inputTokens,
      },
    },
    `Context limit exceeded: estimated ${totalEstimate} tokens vs ${maxAllowed} max. Trimming input to fit.`,
  );

  // Trim the input only (never touch instructions or tools)
  const availableForInput = maxAllowed - instructionsTokens - toolsTokens;

  if (availableForInput <= 0) {
    // Instructions + tools alone exceed the budget — can't trim input to help.
    // Return as-is and let the API error surface naturally.
    logger.error(
      { instructionsTokens, toolsTokens, maxAllowed },
      'enforceContextLimit: instructions + tools alone exceed context limit, cannot trim input',
    );
    return options;
  }

  let trimmedInput: string | InputItem[];

  if (typeof options.input === 'string') {
    trimmedInput = trimStringFromBeginning(options.input, availableForInput);
  } else {
    trimmedInput = trimInputItems(options.input, availableForInput, inputTokens);
  }

  return { ...options, input: trimmedInput };
}
