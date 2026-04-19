/**
 * ConnectorProfileGenerator — adapts an LLM connector + model into the memory
 * layer's IProfileGenerator interface.
 *
 * Initialized once with { connector, model, promptTemplate? }. Subsequent
 * regenerateProfile() calls on MemorySystem route through this generator,
 * which builds a single-shot prompt and calls `agent.runDirect()` with JSON
 * response format. Parsing falls back gracefully if the model ignores the
 * format instruction.
 */

import { Agent } from '../../core/Agent.js';
import type { IEntity, IFact, IProfileGenerator, ProfileGeneratorInput } from '../types.js';
import { defaultProfilePrompt, type PromptContext } from './defaultPrompt.js';

export interface ConnectorProfileGeneratorConfig {
  /** Connector name — must already be registered. */
  connector: string;
  /** Chat/LLM model id, e.g. 'claude-sonnet-4-6' or 'gpt-5-mini'. */
  model: string;
  /** Override the default prompt. Must still return {details, summaryForEmbedding}. */
  promptTemplate?: (ctx: PromptContext) => string;
  /** Temperature for generation. Default 0.3 (tighter, more factual). */
  temperature?: number;
  /** Max output tokens. Default 1200 (room for ~600-word markdown + summary). */
  maxOutputTokens?: number;
}

export class ConnectorProfileGenerator implements IProfileGenerator {
  private readonly agent: Agent;
  private readonly promptFn: (ctx: PromptContext) => string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;

  constructor(config: ConnectorProfileGeneratorConfig) {
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      // No tools, no context management — single-shot via runDirect.
    });
    this.promptFn = config.promptTemplate ?? defaultProfilePrompt;
    this.temperature = config.temperature ?? 0.3;
    this.maxOutputTokens = config.maxOutputTokens ?? 1200;
  }

  /**
   * Construct from a pre-built agent-like object. Intended for testing and
   * unusual callers that already have their own LLM plumbing.
   */
  static withAgent(args: {
    agent: { runDirect: Agent['runDirect']; destroy: Agent['destroy'] };
    promptTemplate?: (ctx: PromptContext) => string;
    temperature?: number;
    maxOutputTokens?: number;
  }): ConnectorProfileGenerator {
    const instance = Object.create(
      ConnectorProfileGenerator.prototype,
    ) as ConnectorProfileGenerator;
    const bag = instance as unknown as {
      agent: { runDirect: Agent['runDirect']; destroy: Agent['destroy'] };
      promptFn: (ctx: PromptContext) => string;
      temperature: number;
      maxOutputTokens: number;
    };
    bag.agent = args.agent;
    bag.promptFn = args.promptTemplate ?? defaultProfilePrompt;
    bag.temperature = args.temperature ?? 0.3;
    bag.maxOutputTokens = args.maxOutputTokens ?? 1200;
    return instance;
  }

  async generate(
    input: ProfileGeneratorInput,
  ): Promise<{ details: string; summaryForEmbedding: string }> {
    const prompt = this.promptFn(input);

    const response = await this.agent.runDirect(prompt, {
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      responseFormat: { type: 'json_object' },
    });

    const raw = response.output_text ?? '';
    return parseProfileResponse(raw, input.entity, input.priorProfile);
  }

  /** Release the internal agent. */
  destroy(): void {
    this.agent.destroy();
  }
}

// =============================================================================
// Response parsing — resilient to providers that don't honor json_object
// =============================================================================

export function parseProfileResponse(
  raw: string,
  entity: IEntity,
  priorProfile: IFact | undefined,
): { details: string; summaryForEmbedding: string } {
  const cleaned = stripCodeFences(raw).trim();

  // Fast path — valid JSON with both fields.
  const parsed = safeJsonParse(cleaned);
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Record<string, unknown>).details === 'string' &&
    typeof (parsed as Record<string, unknown>).summaryForEmbedding === 'string'
  ) {
    const p = parsed as { details: string; summaryForEmbedding: string };
    return {
      details: p.details.trim(),
      summaryForEmbedding: p.summaryForEmbedding.trim(),
    };
  }

  // Fallback — treat the raw text as markdown, synthesize a summary from it.
  const details = cleaned.length > 0 ? cleaned : fallbackDetails(entity, priorProfile);
  const summaryForEmbedding = deriveSummary(details);
  return { details, summaryForEmbedding };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Try to extract the first JSON object from the text.
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

function fallbackDetails(entity: IEntity, prior: IFact | undefined): string {
  return (
    prior?.details ??
    `# ${entity.displayName}\n\n${entity.type}. Profile generation returned no content.`
  );
}

function deriveSummary(details: string): string {
  // First ~80 words, stripped of markdown headers.
  const plain = details.replace(/^#+\s+/gm, '').replace(/\s+/g, ' ').trim();
  const words = plain.split(' ').slice(0, 80);
  return words.join(' ');
}
