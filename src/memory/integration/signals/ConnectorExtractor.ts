/**
 * ConnectorExtractor — default `IExtractor` implementation. Wraps an oneringai
 * Connector + model into a single-shot JSON-output LLM call.
 *
 * Mirrors the pattern used by `ConnectorProfileGenerator`: construct an agent
 * with no tools / no context management, call `runDirect` with
 * `responseFormat: { type: 'json_object' }`, and defensively parse the
 * response (some providers don't strictly honor the format instruction).
 */

import { Agent } from '../../../core/Agent.js';
import type { ExtractionOutput } from '../ExtractionResolver.js';
import type { IExtractor } from './types.js';

export interface ConnectorExtractorConfig {
  /** Connector name — must already be registered with `Connector.create()`. */
  connector: string;
  /** Chat/LLM model id, e.g. 'claude-sonnet-4-6' or 'gpt-5-mini'. */
  model: string;
  /** Default 0.2 — tighter sampling keeps JSON well-formed. */
  temperature?: number;
  /** Default 2000 — rooms for ~20 mentions + ~50 facts. */
  maxOutputTokens?: number;
}

export class ConnectorExtractor implements IExtractor {
  private readonly agent: Agent;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;

  constructor(config: ConnectorExtractorConfig) {
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
    });
    this.temperature = config.temperature ?? 0.2;
    this.maxOutputTokens = config.maxOutputTokens ?? 2000;
  }

  /**
   * Construct from a pre-built agent-like object. Intended for testing and
   * callers with their own LLM plumbing. The object must expose `runDirect`
   * (returning `{ output_text }`) and `destroy`.
   */
  static withAgent(args: {
    agent: { runDirect: Agent['runDirect']; destroy: Agent['destroy'] };
    temperature?: number;
    maxOutputTokens?: number;
  }): ConnectorExtractor {
    const instance = Object.create(ConnectorExtractor.prototype) as ConnectorExtractor;
    const bag = instance as unknown as {
      agent: { runDirect: Agent['runDirect']; destroy: Agent['destroy'] };
      temperature: number;
      maxOutputTokens: number;
    };
    bag.agent = args.agent;
    bag.temperature = args.temperature ?? 0.2;
    bag.maxOutputTokens = args.maxOutputTokens ?? 2000;
    return instance;
  }

  async extract(prompt: string): Promise<ExtractionOutput> {
    const response = await this.agent.runDirect(prompt, {
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      responseFormat: { type: 'json_object' },
    });
    const raw = response.output_text ?? '';
    return parseExtractionResponse(raw);
  }

  destroy(): void {
    this.agent.destroy();
  }
}

/**
 * Parse LLM output into `ExtractionOutput`. Resilient to code fences and
 * leading/trailing prose. Returns an empty shape rather than throwing so the
 * ingest pipeline can continue (the caller sees `entities: []`, `facts: []`,
 * `newPredicates: []` and can decide what to do).
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
