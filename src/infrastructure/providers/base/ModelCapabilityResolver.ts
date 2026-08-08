/**
 * Registry-driven model capability resolver
 * Maps ILLMDescription from the centralized model registry to ModelCapabilities
 * used by all providers, with vendor-specific fallbacks for unregistered models.
 */

import { getModelInfo, type ILLMDescription } from '../../../domain/entities/Model.js';
import type { ModelCapabilities } from '../../../domain/interfaces/ITextProvider.js';

/**
 * Maps a registry model description to provider ModelCapabilities
 */
function mapRegistryToCapabilities(
  info: ILLMDescription,
  fallback: ModelCapabilities,
): ModelCapabilities {
  const inputTokens = info.features.input.tokens ?? fallback.maxInputTokens ?? fallback.maxTokens;
  const outputTokens = info.features.output.tokens ?? fallback.maxOutputTokens ?? fallback.maxTokens;
  return {
    supportsTools: info.features.functionCalling ?? false,
    supportsVision: info.features.vision ?? false,
    supportsJSON: info.features.structuredOutput ?? false,
    supportsJSONSchema: info.features.structuredOutput ?? false,
    maxTokens: inputTokens,
    maxInputTokens: inputTokens,
    maxOutputTokens: outputTokens,
  };
}

/**
 * Resolve model capabilities from the centralized registry, falling back to vendor defaults.
 *
 * @param model - The model identifier (e.g., 'gpt-5.2', 'claude-sonnet-4-5-20250929')
 * @param vendorDefaults - Vendor-specific defaults for models not in the registry
 * @returns ModelCapabilities from registry or vendor defaults
 */
export function resolveModelCapabilities(
  model: string,
  vendorDefaults: ModelCapabilities
): ModelCapabilities {
  const info = getModelInfo(model);
  if (info) {
    return mapRegistryToCapabilities(info, vendorDefaults);
  }
  return vendorDefaults;
}

/**
 * Resolve the max context token limit for a specific model.
 * Used primarily for accurate error messages.
 *
 * @param model - The model identifier
 * @param fallback - Fallback value if model is not in registry
 * @returns The max input token count
 */
export function resolveMaxContextTokens(
  model: string | undefined,
  fallback: number
): number {
  if (!model) return fallback;
  const info = getModelInfo(model);
  return info?.features.input.tokens ?? fallback;
}
