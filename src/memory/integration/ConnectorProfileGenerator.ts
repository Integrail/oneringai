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
import { parseJsonPermissive } from '../../utils/jsonRepair.js';
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
  /**
   * Max output tokens. Default: undefined — use the model's own ceiling,
   * which is always the maximum it can emit. Hardcoded defaults silently
   * truncate profile generation. See feedback_no_output_limits.md.
   */
  maxOutputTokens?: number;
}

export class ConnectorProfileGenerator implements IProfileGenerator {
  private readonly agent: Agent;
  private readonly promptFn: (ctx: PromptContext) => string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number | undefined;

  constructor(config: ConnectorProfileGeneratorConfig) {
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      // No tools, no context management — single-shot via runDirect.
    });
    this.promptFn = config.promptTemplate ?? defaultProfilePrompt;
    this.temperature = config.temperature ?? 0.3;
    this.maxOutputTokens = config.maxOutputTokens;
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
      maxOutputTokens: number | undefined;
    };
    bag.agent = args.agent;
    bag.promptFn = args.promptTemplate ?? defaultProfilePrompt;
    bag.temperature = args.temperature ?? 0.3;
    bag.maxOutputTokens = args.maxOutputTokens;
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
  // Fast path — robust parse across markdown fences, prose wrappers, trailing
  // commas, single quotes, etc. `details` is in the default strip list so if
  // the LLM's verbatim narrative breaks escape rules the field is nulled and
  // we fall through to the markdown-passthrough fallback below.
  //
  // No size cap on `details` / `summaryForEmbedding` — library must not
  // silently truncate the LLM's output. Hosts that need a bound should
  // configure `maxOutputTokens` on the generator (at which point the model
  // itself stops at that boundary, audibly, rather than us slicing after).
  // See feedback_no_output_limits.md / feedback_no_truncation.md.
  let parsed: unknown = null;
  if (raw && raw.trim().length > 0) {
    try {
      parsed = parseJsonPermissive(raw);
    } catch {
      parsed = null;
    }
  }
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

  // Fallback — treat the raw text as markdown. When the LLM skipped the
  // structured format we use the full text as BOTH details and embedding
  // summary; the embedder's own token ceiling is the only place where
  // length ever bounds things, and it surfaces overflow as a real error
  // rather than a silent clip.
  const cleaned = raw.trim();
  const details = cleaned.length > 0 ? cleaned : fallbackDetails(entity, priorProfile);
  const plainText = details.replace(/^#+\s+/gm, '').replace(/\s+/g, ' ').trim();
  return { details, summaryForEmbedding: plainText };
}

function fallbackDetails(entity: IEntity, prior: IFact | undefined): string {
  return (
    prior?.details ??
    `# ${entity.displayName}\n\n${entity.type}. Profile generation returned no content.`
  );
}
