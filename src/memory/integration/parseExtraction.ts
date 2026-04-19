/**
 * Pure parser for LLM extraction output → `ExtractionOutput`.
 *
 * Lives outside `ConnectorExtractor` so callers (e.g. `SessionIngestorPluginNextGen`)
 * can parse without importing `Agent` (which would introduce an
 * Agent ↔ plugins cycle at module-load time).
 */

import type { ExtractionOutput } from './ExtractionResolver.js';

/**
 * Resilient to code fences + leading/trailing prose. Returns an empty shape
 * rather than throwing so ingest pipelines can continue.
 */
export function parseExtractionResponse(raw: string): ExtractionOutput {
  const cleaned = stripCodeFences(raw).trim();
  const parsed = safeJsonParse(cleaned);
  if (!parsed || typeof parsed !== 'object') {
    return { mentions: {}, facts: [] };
  }
  const obj = parsed as Record<string, unknown>;
  const mentions =
    obj.mentions && typeof obj.mentions === 'object' && !Array.isArray(obj.mentions)
      ? (obj.mentions as ExtractionOutput['mentions'])
      : {};
  const facts = Array.isArray(obj.facts) ? (obj.facts as ExtractionOutput['facts']) : [];
  return { mentions, facts };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(s.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function stripCodeFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
}
