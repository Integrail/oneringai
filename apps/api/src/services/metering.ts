/**
 * Metering service — pricing lookup from D1, cost calculation, usage recording
 */
import { getModelPricing } from './modelRegistry.js';
import { deductTokens } from './tokens.js';
import { execute } from '../db/queries.js';
import type { ExtractedUsage } from '../proxy/usageExtractor.js';

const DEFAULT_MULTIPLIER = 2.0;
// Fallback estimate: $0.002/1K tokens when model unknown
const FALLBACK_CPM = 2.0;

export interface MeteringResult {
  tokenCost: number;
  newBalance: number | null;
}

/**
 * Calculate token cost for a request based on DB-driven pricing.
 *
 * Resolution order:
 * 1. platform_input_tpm / platform_output_tpm → use exact platform token rates
 * 2. vendor cost * pricing_multiplier → calculated tokens
 * 3. Default 2x on vendor cost
 * 4. Unknown model → estimate
 */
export async function calculateTokenCost(
  db: D1Database,
  modelId: string | null,
  inputTokens: number,
  outputTokens: number,
  pricingMultiplier: number = DEFAULT_MULTIPLIER,
): Promise<number> {
  if (!modelId) {
    // Unknown model, use fallback
    return Math.ceil(((inputTokens + outputTokens) / 1_000_000) * FALLBACK_CPM * 100 * pricingMultiplier);
  }

  const pricing = await getModelPricing(db, modelId);

  if (!pricing) {
    // Model not in DB — estimate
    return Math.ceil(((inputTokens + outputTokens) / 1_000_000) * FALLBACK_CPM * 100 * pricingMultiplier);
  }

  // Option 1: Platform rates set (admin-configured)
  if (pricing.platformInputTpm !== null && pricing.platformOutputTpm !== null) {
    return Math.ceil(
      (inputTokens * pricing.platformInputTpm + outputTokens * pricing.platformOutputTpm) / 1_000_000,
    );
  }

  // Option 2: Fixed cost per call
  if (pricing.platformFixedCost !== null) {
    return pricing.platformFixedCost;
  }

  // Option 3: Calculate from vendor cost * multiplier
  const vendorCostUSD =
    (inputTokens * pricing.vendorInputCpm + outputTokens * pricing.vendorOutputCpm) / 1_000_000;
  // Convert USD to platform tokens: $1 = 100 tokens (baseline)
  return Math.max(1, Math.ceil(vendorCostUSD * 100 * pricingMultiplier));
}

/**
 * Calculate flat cost for non-LLM services (search, scrape)
 */
export function calculateFlatCost(
  meteringConfig: Record<string, unknown>,
  pricingMultiplier: number = DEFAULT_MULTIPLIER,
): number {
  const flatCost = meteringConfig.flatCostPerRequest as number | undefined;
  if (flatCost !== undefined) {
    return Math.ceil(flatCost * pricingMultiplier);
  }
  return 0;
}

/**
 * Record usage and deduct tokens.
 * Called after response is received (or streamed).
 */
export async function recordUsage(
  db: D1Database,
  userId: string,
  serviceId: string,
  usage: ExtractedUsage,
  tokenCost: number,
  latencyMs: number,
  statusCode: number,
  credentialType: 'platform' | 'user' | 'custom',
): Promise<MeteringResult> {
  const logId = crypto.randomUUID();

  // Log usage
  await execute(
    db,
    `INSERT INTO usage_log (id, user_id, service_id, model, input_tokens, output_tokens, token_cost, latency_ms, status_code, credential_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    logId, userId, serviceId, usage.model, usage.inputTokens, usage.outputTokens,
    tokenCost, latencyMs, statusCode, credentialType,
  );

  // Deduct tokens
  const newBalance = await deductTokens(
    db, userId, tokenCost,
    `${serviceId}${usage.model ? `:${usage.model}` : ''} — ${usage.inputTokens}in/${usage.outputTokens}out`,
    logId,
  );

  return { tokenCost, newBalance };
}

/**
 * Estimate cost before request (for balance check).
 * Uses conservative estimate based on model or flat cost.
 */
export async function estimateCost(
  db: D1Database,
  modelId: string | null,
  meteringConfig: Record<string, unknown>,
  pricingMultiplier: number,
): Promise<number> {
  // For flat-cost services
  const flat = calculateFlatCost(meteringConfig, pricingMultiplier);
  if (flat > 0) return flat;

  // For LLM services, estimate based on a typical request (~1K input, ~1K output)
  return calculateTokenCost(db, modelId, 1000, 1000, pricingMultiplier);
}
