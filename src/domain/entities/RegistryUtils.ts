/**
 * Generic utilities for model registries
 * Eliminates code duplication across Image, TTS, STT, and Video registries
 */

import type { Vendor as VendorType } from '../../core/Vendor.js';
import type { IBaseModelDescription } from '../types/SharedTypes.js';

/**
 * Creates standard helper functions for any model registry
 * This eliminates the need to write the same helper functions for each registry
 *
 * @example
 * ```typescript
 * const helpers = createRegistryHelpers(IMAGE_MODEL_REGISTRY);
 * export const getImageModelInfo = helpers.getInfo;
 * export const getImageModelsByVendor = helpers.getByVendor;
 * export const getActiveImageModels = helpers.getActive;
 * ```
 */
export function createRegistryHelpers<T extends IBaseModelDescription>(
  registry: Record<string, T>
) {
  return {
    /**
     * Get model information by name
     */
    getInfo: (modelName: string): T | undefined => {
      return registry[modelName];
    },

    /**
     * Get all active models for a specific vendor
     */
    getByVendor: (vendor: VendorType): T[] => {
      return Object.values(registry).filter(
        (model) => model.provider === vendor && model.isActive
      );
    },

    /**
     * Get all currently active models (across all vendors)
     */
    getActive: (): T[] => {
      return Object.values(registry).filter((model) => model.isActive);
    },

    /**
     * Get all models (including inactive/deprecated)
     */
    getAll: (): T[] => {
      return Object.values(registry);
    },

    /**
     * Check if model exists in registry
     */
    has: (modelName: string): boolean => {
      return modelName in registry;
    },
  };
}

/**
 * Creates feature-based filter for registries with capabilities
 * Used to find models that support specific features
 *
 * @example
 * ```typescript
 * const filter = createCapabilityFilter(IMAGE_MODEL_REGISTRY);
 * const modelsWithInpainting = filter.withFeature('inputModes').filter(
 *   m => m.capabilities.inputModes.inpainting
 * );
 * ```
 */
export function createCapabilityFilter<
  T extends IBaseModelDescription & { capabilities: Record<string, unknown> }
>(registry: Record<string, T>) {
  return {
    /**
     * Get models that have a specific capability feature
     * @param feature - The capability feature to filter by
     * @param value - Optional specific value to match (if undefined, just checks truthy)
     */
    withFeature: <K extends keyof T['capabilities']>(
      feature: K,
      value?: T['capabilities'][K]
    ): T[] => {
      return Object.values(registry).filter((model) => {
        if (!model.isActive) return false;

        const capValue = model.capabilities[feature];

        // If specific value provided, match exactly
        if (value !== undefined) {
          return capValue === value;
        }

        // Otherwise check if feature exists and is truthy
        return Array.isArray(capValue) ? capValue.length > 0 : Boolean(capValue);
      });
    },
  };
}
