/**
 * Usage extractor — extract token usage from upstream API responses
 */

export interface ExtractedUsage {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Extract usage from a JSON response body using the metering config paths.
 */
export function extractUsageFromJSON(
  body: Record<string, unknown>,
  meteringConfig: Record<string, unknown>,
): ExtractedUsage {
  const modelPath = (meteringConfig.modelPath as string) ?? 'model';
  const inputPath = (meteringConfig.inputTokensPath as string) ?? 'usage.prompt_tokens';
  const outputPath = (meteringConfig.outputTokensPath as string) ?? 'usage.completion_tokens';

  return {
    model: getNestedValue(body, modelPath) as string | null,
    inputTokens: (getNestedValue(body, inputPath) as number) ?? 0,
    outputTokens: (getNestedValue(body, outputPath) as number) ?? 0,
  };
}

/**
 * Extract usage from the final SSE chunk (OpenAI-compatible format).
 * Looks for `data: {...}` lines with usage info.
 */
export function extractUsageFromSSEChunk(
  chunk: string,
  meteringConfig: Record<string, unknown>,
): ExtractedUsage | null {
  // Look for lines starting with "data: " that contain usage
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const usage = extractUsageFromJSON(parsed, meteringConfig);
      if (usage.inputTokens > 0 || usage.outputTokens > 0) {
        return usage;
      }
    } catch {
      // Not valid JSON, skip
    }
  }
  return null;
}

/**
 * Get a nested value from an object using dot-notation path.
 * e.g., "usage.prompt_tokens" from { usage: { prompt_tokens: 100 } }
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
