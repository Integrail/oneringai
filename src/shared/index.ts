/**
 * @everworker/oneringai/shared
 *
 * Lightweight subpath export containing only pure data constants and types.
 * Zero Node.js dependencies — safe for Cloudflare Workers, Deno, and browsers.
 *
 * Usage:
 *   import { Vendor, MODEL_REGISTRY, SERVICE_DEFINITIONS } from '@everworker/oneringai/shared';
 */

// ============ Vendor ============
export { Vendor, VENDORS, isVendor } from '../core/Vendor.js';
export type { Vendor as VendorType } from '../core/Vendor.js';

// ============ Models ============
export {
  MODEL_REGISTRY,
  LLM_MODELS,
  getModelInfo,
  getModelsByVendor,
  getActiveModels,
  calculateCost,
} from '../domain/entities/Model.js';
export type { ILLMDescription } from '../domain/entities/Model.js';

// ============ Services ============
export {
  SERVICE_DEFINITIONS,
  Services,
  SERVICE_URL_PATTERNS,
  SERVICE_INFO,
  detectServiceFromURL,
  getServiceInfo,
  getServiceDefinition,
  getServicesByCategory,
  getAllServiceIds,
  isKnownService,
} from '../domain/entities/Services.js';
export type {
  ServiceCategory,
  ServiceDefinition,
  ServiceType,
  ServiceInfo,
} from '../domain/entities/Services.js';
