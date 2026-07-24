/**
 * Vendor-agnostic structured (JSON) output.
 *
 * One API across every LLM vendor: callers pass a {@link ResponseFormat} to
 * `agent.run()` / `agent.runDirect()` (and their streaming variants). The
 * library then either
 *   1. converts it to the vendor's *native* structured-output mechanism when
 *      the model/vendor supports it (OpenAI `text.format`, Anthropic
 *      `output_config.format`, Google/Vertex `responseJsonSchema`), or
 *   2. falls back to a strict prompt instruction that asks the model to emit
 *      raw JSON, then parses/repairs the result.
 *
 * Either way the parsed value is attached to `response.output_parsed`.
 *
 * **Validation contract:** on the *native* path the vendor enforces the schema
 * server-side. On the *prompt-fallback* path the library guarantees the output
 * is **valid, parseable JSON** (with a bounded re-ask on parse failure) but does
 * NOT itself validate schema conformance — it asks the model to conform and
 * trusts it. Callers needing hard schema validation should validate
 * `output_parsed` themselves. (Deliberate choice: no schema-validator dependency.)
 *
 * **Anthropic** uses its native mechanism only for model families explicitly
 * allowed by `AnthropicTextProvider.getModelCapabilities`; older/unknown
 * models retain the prompt fallback.
 *
 * Scope: JSON output only (`json_object` and `json_schema`).
 */

import { parseJsonPermissive } from '../utils/jsonRepair.js';
import type { ModelCapabilities } from '../domain/interfaces/ITextProvider.js';
import type { AdvancedTextCapabilities } from '../domain/interfaces/IAdvancedInference.js';
import { Vendor } from './Vendor.js';
import { AIError } from '../domain/errors/AIErrors.js';

/** A JSON Schema object (draft-07 subset — see per-vendor limitations). */
export type JSONSchema = Record<string, unknown>;

/**
 * Vendor-agnostic structured-output request. Identical across all vendors.
 */
export type ResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      /** The JSON Schema the response must conform to. */
      schema: JSONSchema;
      /** Schema name (some vendors require one). Default: `'response'`. */
      name?: string;
      /** Human-readable description of the schema (passed through where supported). */
      description?: string;
      /** Request strict schema adherence where the vendor supports it. Default: `true`. */
      strict?: boolean;
    };

/**
 * Provider-contract shape (`TextGenerateOptions.response_format`). This is the
 * lower-level structure each provider converter already understands.
 */
export interface ProviderResponseFormat {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: {
    name?: string;
    description?: string;
    schema?: JSONSchema;
    strict?: boolean;
  };
}

/** How many times we re-ask the model when its output won't parse as JSON. */
export const STRUCTURED_OUTPUT_MAX_REPAIR_ATTEMPTS = 1;

/**
 * Thrown when the model's output cannot be parsed as valid JSON after all
 * repair attempts. Carries the raw output + requested format for debugging —
 * never a silent failure.
 */
export class StructuredOutputError extends AIError {
  constructor(
    message: string,
    public readonly rawOutput: string,
    public readonly format: ResponseFormat,
    originalError?: Error,
  ) {
    super(message, 'STRUCTURED_OUTPUT_PARSE_FAILED', undefined, originalError);
    this.name = 'StructuredOutputError';
    Object.setPrototypeOf(this, StructuredOutputError.prototype);
  }
}

/**
 * Vendors whose native structured-output mechanism is mutually exclusive with
 * function/tool calling. When a tool loop is active we route these to the
 * prompt-injection fallback (applied to the final, tool-free answer) so tool
 * use is never suppressed mid-loop.
 *
 * - OpenAI (Responses API `text.format`) composes fine with tools → NOT listed
 *   here: OpenAI uses its native schema even inside a tool loop, no extra call.
 * - Google/Vertex `responseJsonSchema` cannot be combined with function tools.
 * - Anthropic is kept conservative because citation-producing server tools are
 *   incompatible with `output_config.format`; final formatting is tool-free.
 */
const FORMAT_TOOL_EXCLUSIVE: ReadonlySet<string> = new Set<string>([
  Vendor.Anthropic,
  Vendor.Google,
  Vendor.GoogleVertex,
]);

/**
 * Vendors that have no native "any JSON" (`json_object`) mode — only
 * schema-constrained output. For `json_object` on these we use the prompt
 * fallback. (OpenAI and Google both support a native json_object mode.)
 */
const NO_NATIVE_JSON_OBJECT: ReadonlySet<string> = new Set<string>([Vendor.Anthropic]);

/**
 * Vendors for which the library does not emit native schema output. This is
 * currently empty; model-specific gating belongs in provider capabilities.
 */
const NO_NATIVE_JSON_SCHEMA: ReadonlySet<string> = new Set<string>();

export type StructuredStrategy = 'native' | 'prompt';

/**
 * Decide whether to use the vendor's native structured-output API or the
 * prompt-injection fallback, given model capabilities, vendor, and whether a
 * tool call can be requested in the same turn.
 */
export function resolveStructuredStrategy(
  format: ResponseFormat,
  caps: ModelCapabilities,
  vendor: Vendor | undefined,
  hasTools: boolean,
  advanced?: AdvancedTextCapabilities,
): StructuredStrategy {
  const v = vendor ?? '';

  // Native schema + tools don't compose on some vendors — fall back to prompt.
  if (
    hasTools &&
    (advanced ? !advanced.structuredOutput.nativeWithTools : FORMAT_TOOL_EXCLUSIVE.has(v))
  ) {
    return 'prompt';
  }

  if (format.type === 'json_object') {
    if (advanced?.structuredOutput.jsonObject === 'prompt') return 'prompt';
    if (!caps.supportsJSON) return 'prompt';
    if (NO_NATIVE_JSON_OBJECT.has(v)) return 'prompt';
    return 'native';
  }

  // json_schema
  if (advanced?.structuredOutput.jsonSchema === 'prompt') return 'prompt';
  if (NO_NATIVE_JSON_SCHEMA.has(v)) return 'prompt';
  if (!caps.supportsJSONSchema) return 'prompt';
  return 'native';
}

/** Map the vendor-agnostic format to the provider-contract `response_format`. */
export function toProviderResponseFormat(format: ResponseFormat): ProviderResponseFormat {
  if (format.type === 'json_object') {
    return { type: 'json_object' };
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: format.name ?? 'response',
      description: format.description,
      schema: format.schema,
      strict: format.strict ?? true,
    },
  };
}

/**
 * Build the system-instruction suffix used by the prompt-injection fallback.
 * Embeds the schema so the model knows the exact shape to produce.
 */
export function buildStructuredInstructionSuffix(format: ResponseFormat): string {
  if (format.type === 'json_object') {
    return (
      '\n\n## Response format\n' +
      'Respond with ONLY a single valid JSON value. ' +
      'Output raw JSON — no markdown code fences, no prose, no explanation before or after the JSON.'
    );
  }
  const schemaStr = JSON.stringify(format.schema, null, 2);
  return (
    '\n\n## Response format\n' +
    'Respond with ONLY a single JSON value that strictly conforms to the JSON Schema below. ' +
    'Output raw JSON — no markdown code fences, no prose, no commentary before or after the JSON.\n\n' +
    'JSON Schema:\n' +
    schemaStr
  );
}

/** Build the re-ask prompt used when a previous response failed to parse. */
export function buildStructuredRepairInstruction(
  format: ResponseFormat,
  rawText: string,
  error: Error,
): string {
  const schemaClause = format.type === 'json_schema' ? ' conforming to the required JSON Schema' : '';
  return (
    `Your previous response could not be parsed as valid JSON (${error.message}). ` +
    `Return ONLY the corrected JSON value${schemaClause} — no markdown fences, no prose, no commentary.\n\n` +
    `Previous response:\n${rawText}`
  );
}

export type StructuredParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Error };

/**
 * Parse an LLM response into a JSON value, reusing the library's permissive
 * repair strategies (markdown-fence stripping, trailing commas, etc.).
 * Never throws — returns a discriminated result.
 *
 * Validates *parseability* only, not schema conformance (see the module-level
 * validation contract). `_format` is accepted for symmetry / future use but is
 * intentionally not consulted.
 */
export function parseStructuredOutput(rawText: string, _format: ResponseFormat): StructuredParseResult {
  try {
    const value = parseJsonPermissive(rawText ?? '');
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
