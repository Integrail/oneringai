/**
 * Stream handler — TransformStream SSE passthrough + usage accumulation
 */
import { extractUsageFromSSEChunk, type ExtractedUsage } from './usageExtractor.js';

export interface StreamResult {
  readable: ReadableStream;
  usagePromise: Promise<ExtractedUsage>;
}

/**
 * Create a TransformStream that passes SSE chunks through to the client
 * while accumulating usage from the final chunk.
 */
export function createSSEPassthrough(
  upstream: ReadableStream<Uint8Array>,
  meteringConfig: Record<string, unknown>,
): StreamResult {
  let lastUsage: ExtractedUsage | null = null;
  let resolveUsage: (usage: ExtractedUsage) => void;

  const usagePromise = new Promise<ExtractedUsage>((resolve) => {
    resolveUsage = resolve;
  });

  const decoder = new TextDecoder();
  let buffer = '';

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);

      // Accumulate text and look for usage in SSE data
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const usage = extractUsageFromSSEChunk(line + '\n', meteringConfig);
          if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            lastUsage = usage;
          }
        }
      }
    },

    flush() {
      // Process any remaining buffer
      if (buffer.length > 0) {
        const usage = extractUsageFromSSEChunk(buffer, meteringConfig);
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
          lastUsage = usage;
        }
      }

      resolveUsage(lastUsage ?? { model: null, inputTokens: 0, outputTokens: 0 });
    },
  });

  upstream.pipeTo(transform.writable).catch(() => {
    // Stream error — resolve with whatever we have
    resolveUsage(lastUsage ?? { model: null, inputTokens: 0, outputTokens: 0 });
  });

  return { readable: transform.readable, usagePromise };
}
