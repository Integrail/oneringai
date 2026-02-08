/**
 * Balance check middleware — pre-request balance estimation
 * Rejects requests with 402 if insufficient balance.
 */
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env.js';
import { hasBalance } from '../services/tokens.js';
import { estimateCost } from '../services/metering.js';

/**
 * Quick balance check: estimate minimum cost, reject if insufficient.
 * The actual cost is calculated after the response.
 */
export const checkBalance = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const userId = c.get('userId');

  // Extract model from request body if present (for LLM requests)
  let modelId: string | null = null;
  try {
    if (c.req.method === 'POST') {
      const cloned = c.req.raw.clone();
      const body = await cloned.json() as Record<string, unknown>;
      modelId = (body.model as string) ?? null;
    }
  } catch {
    // Not JSON body, that's fine
  }

  // Conservative estimate — minimum cost for this request
  const estimate = await estimateCost(c.env.DB, modelId, {}, 2.0);
  const sufficient = await hasBalance(c.env.DB, userId, estimate);

  if (!sufficient) {
    return c.json(
      {
        error: 'insufficient_balance',
        message: 'Insufficient token balance. Please add tokens to continue.',
        estimatedCost: estimate,
      },
      402,
    );
  }

  return next();
});
