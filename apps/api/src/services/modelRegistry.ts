/**
 * Model Registry service — reads from D1 `models` table
 */
import type { ModelRow } from '../types.js';
import { queryAll, queryOne } from '../db/queries.js';

export interface ModelInfo {
  id: string;
  vendor: string;
  name: string;
  description: string | null;
  maxInputTokens: number;
  maxOutputTokens: number;
  vendorInputCpm: number;
  vendorOutputCpm: number;
  vendorInputCpmCached: number | null;
  platformInputTpm: number | null;
  platformOutputTpm: number | null;
  platformFixedCost: number | null;
  features: Record<string, unknown>;
  releaseDate: string | null;
  knowledgeCutoff: string | null;
  isActive: boolean;
  sortOrder: number;
}

function rowToModel(row: ModelRow): ModelInfo {
  return {
    id: row.id,
    vendor: row.vendor,
    name: row.name,
    description: row.description,
    maxInputTokens: row.max_input_tokens,
    maxOutputTokens: row.max_output_tokens,
    vendorInputCpm: row.vendor_input_cpm,
    vendorOutputCpm: row.vendor_output_cpm,
    vendorInputCpmCached: row.vendor_input_cpm_cached,
    platformInputTpm: row.platform_input_tpm,
    platformOutputTpm: row.platform_output_tpm,
    platformFixedCost: row.platform_fixed_cost,
    features: JSON.parse(row.features || '{}') as Record<string, unknown>,
    releaseDate: row.release_date,
    knowledgeCutoff: row.knowledge_cutoff,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  };
}

/** Get all active models */
export async function listModels(db: D1Database): Promise<ModelInfo[]> {
  const rows = await queryAll<ModelRow>(
    db,
    'SELECT * FROM models WHERE is_active = 1 ORDER BY sort_order, vendor, id',
  );
  return rows.map(rowToModel);
}

/** Get all models (including inactive) — for admin */
export async function listAllModels(db: D1Database): Promise<ModelInfo[]> {
  const rows = await queryAll<ModelRow>(
    db,
    'SELECT * FROM models ORDER BY sort_order, vendor, id',
  );
  return rows.map(rowToModel);
}

/** Get models by vendor */
export async function listModelsByVendor(db: D1Database, vendor: string): Promise<ModelInfo[]> {
  const rows = await queryAll<ModelRow>(
    db,
    'SELECT * FROM models WHERE vendor = ? AND is_active = 1 ORDER BY sort_order, id',
    vendor,
  );
  return rows.map(rowToModel);
}

/** Get a single model by ID */
export async function getModel(db: D1Database, modelId: string): Promise<ModelInfo | null> {
  const row = await queryOne<ModelRow>(db, 'SELECT * FROM models WHERE id = ?', modelId);
  return row ? rowToModel(row) : null;
}

/**
 * Get model pricing info (used by metering)
 */
export async function getModelPricing(
  db: D1Database,
  modelId: string,
): Promise<{
  vendorInputCpm: number;
  vendorOutputCpm: number;
  platformInputTpm: number | null;
  platformOutputTpm: number | null;
  platformFixedCost: number | null;
} | null> {
  return queryOne(
    db,
    `SELECT vendor_input_cpm as vendorInputCpm, vendor_output_cpm as vendorOutputCpm,
            platform_input_tpm as platformInputTpm, platform_output_tpm as platformOutputTpm,
            platform_fixed_cost as platformFixedCost
     FROM models WHERE id = ?`,
    modelId,
  );
}
