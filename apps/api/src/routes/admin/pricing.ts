/**
 * Admin pricing management — per-model platform pricing
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import type { ModelRow } from '../../types.js';
import { queryAll, queryOne, execute } from '../../db/queries.js';
import { logAdminAction } from '../../middleware/auditLog.js';

interface PricingInfo {
  id: string;
  vendor: string;
  name: string;
  vendorInputCpm: number;
  vendorOutputCpm: number;
  platformInputTpm: number | null;
  platformOutputTpm: number | null;
  platformFixedCost: number | null;
  effectiveInputTpm: number;
  effectiveOutputTpm: number;
  marginPercent: number;
}

const DEFAULT_MULTIPLIER = 2.0;
const TOKENS_PER_DOLLAR = 100;

const adminPricing = new Hono<{ Bindings: Env }>();

/** GET /admin/pricing — all models with effective prices + margins */
adminPricing.get('/', async (c) => {
  const rows = await queryAll<ModelRow>(
    c.env.DB,
    'SELECT * FROM models ORDER BY vendor, id',
  );
  return c.json(rows.map(toPricingInfo));
});

/** GET /admin/pricing/:model */
adminPricing.get('/:model', async (c) => {
  const row = await queryOne<ModelRow>(
    c.env.DB,
    'SELECT * FROM models WHERE id = ?',
    c.req.param('model'),
  );
  if (!row) return c.json({ error: 'not_found', message: 'Model not found' }, 404);
  return c.json(toPricingInfo(row));
});

/**
 * PUT /admin/pricing/:model — set platform token rates
 * Body: { platformInputTpm?, platformOutputTpm?, platformFixedCost? }
 */
adminPricing.put('/:model', async (c) => {
  const modelId = c.req.param('model');
  const body = await c.req.json<{
    platformInputTpm?: number | null;
    platformOutputTpm?: number | null;
    platformFixedCost?: number | null;
  }>();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.platformInputTpm !== undefined) {
    sets.push('platform_input_tpm = ?');
    values.push(body.platformInputTpm);
  }
  if (body.platformOutputTpm !== undefined) {
    sets.push('platform_output_tpm = ?');
    values.push(body.platformOutputTpm);
  }
  if (body.platformFixedCost !== undefined) {
    sets.push('platform_fixed_cost = ?');
    values.push(body.platformFixedCost);
  }

  if (sets.length === 0) {
    return c.json({ error: 'validation', message: 'No pricing fields provided' }, 400);
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(modelId);

  const result = await execute(c.env.DB, `UPDATE models SET ${sets.join(', ')} WHERE id = ?`, ...values);
  if ((result.meta?.changes ?? 0) === 0) {
    return c.json({ error: 'not_found', message: 'Model not found' }, 404);
  }

  await logAdminAction(c.env.DB, c.get('userId'), 'pricing.update', 'model', modelId, body);
  await c.env.KV.delete('registry:models:all');

  return c.json({ message: 'Pricing updated' });
});

/** DELETE /admin/pricing/:model — clear overrides (fall back to multiplier) */
adminPricing.delete('/:model', async (c) => {
  const modelId = c.req.param('model');
  await execute(
    c.env.DB,
    'UPDATE models SET platform_input_tpm = NULL, platform_output_tpm = NULL, platform_fixed_cost = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    modelId,
  );

  await logAdminAction(c.env.DB, c.get('userId'), 'pricing.clear', 'model', modelId);
  await c.env.KV.delete('registry:models:all');

  return c.json({ message: 'Platform pricing cleared, falling back to multiplier' });
});

/**
 * POST /admin/pricing/bulk — bulk update pricing
 * Body: { updates: [{ model, platformInputTpm, platformOutputTpm }] }
 */
adminPricing.post('/bulk', async (c) => {
  const body = await c.req.json<{
    updates: Array<{
      model: string;
      platformInputTpm?: number | null;
      platformOutputTpm?: number | null;
      platformFixedCost?: number | null;
    }>;
  }>();

  if (!body.updates?.length) {
    return c.json({ error: 'validation', message: 'updates array is required' }, 400);
  }

  let updated = 0;
  for (const update of body.updates) {
    const result = await execute(
      c.env.DB,
      'UPDATE models SET platform_input_tpm = ?, platform_output_tpm = ?, platform_fixed_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      update.platformInputTpm ?? null, update.platformOutputTpm ?? null,
      update.platformFixedCost ?? null, update.model,
    );
    if ((result.meta?.changes ?? 0) > 0) updated++;
  }

  await logAdminAction(c.env.DB, c.get('userId'), 'pricing.bulk_update', null, null, {
    count: body.updates.length, updated,
  });
  await c.env.KV.delete('registry:models:all');

  return c.json({ message: `Updated ${updated} of ${body.updates.length} models` });
});

function toPricingInfo(row: ModelRow): PricingInfo {
  const vendorCostPer1M = row.vendor_input_cpm + row.vendor_output_cpm;

  // Calculate effective platform token rates
  let effectiveInputTpm: number;
  let effectiveOutputTpm: number;

  if (row.platform_input_tpm !== null && row.platform_output_tpm !== null) {
    effectiveInputTpm = row.platform_input_tpm;
    effectiveOutputTpm = row.platform_output_tpm;
  } else {
    // Default: vendor cost * multiplier * tokens-per-dollar
    effectiveInputTpm = Math.ceil(row.vendor_input_cpm * DEFAULT_MULTIPLIER * TOKENS_PER_DOLLAR);
    effectiveOutputTpm = Math.ceil(row.vendor_output_cpm * DEFAULT_MULTIPLIER * TOKENS_PER_DOLLAR);
  }

  // Calculate margin
  const effectiveCostPer1M = (effectiveInputTpm + effectiveOutputTpm) / TOKENS_PER_DOLLAR;
  const marginPercent = vendorCostPer1M > 0
    ? ((effectiveCostPer1M - vendorCostPer1M) / vendorCostPer1M) * 100
    : 0;

  return {
    id: row.id,
    vendor: row.vendor,
    name: row.name,
    vendorInputCpm: row.vendor_input_cpm,
    vendorOutputCpm: row.vendor_output_cpm,
    platformInputTpm: row.platform_input_tpm,
    platformOutputTpm: row.platform_output_tpm,
    platformFixedCost: row.platform_fixed_cost,
    effectiveInputTpm,
    effectiveOutputTpm,
    marginPercent: Math.round(marginPercent * 100) / 100,
  };
}

export { adminPricing };
