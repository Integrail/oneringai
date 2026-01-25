/**
 * Unit tests for Image Model Registry
 */

import { describe, it, expect } from 'vitest';
import {
  IMAGE_MODEL_REGISTRY,
  getImageModelInfo,
  getImageModelsByVendor,
  getActiveImageModels,
  getImageModelsWithFeature,
  calculateImageCost,
  IMAGE_MODELS,
} from '../../../src/domain/entities/ImageModel.js';
import { Vendor } from '../../../src/core/Vendor.js';

describe('ImageModel Registry', () => {
  describe('Registry structure', () => {
    it('should have all declared OpenAI models', () => {
      expect(IMAGE_MODEL_REGISTRY['gpt-image-1']).toBeDefined();
      expect(IMAGE_MODEL_REGISTRY['dall-e-3']).toBeDefined();
      expect(IMAGE_MODEL_REGISTRY['dall-e-2']).toBeDefined();
    });

    it('should have all declared Google models', () => {
      expect(IMAGE_MODEL_REGISTRY['imagen-3.0-generate-002']).toBeDefined();
      expect(IMAGE_MODEL_REGISTRY['imagen-3.0-capability-001']).toBeDefined();
      expect(IMAGE_MODEL_REGISTRY['imagen-3.0-fast-generate-001']).toBeDefined();
    });

    it('should have consistent structure', () => {
      const model = IMAGE_MODEL_REGISTRY['dall-e-3'];
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('isActive');
      expect(model).toHaveProperty('sources');
      expect(model).toHaveProperty('capabilities');
      expect(model.sources).toHaveProperty('lastVerified');
    });

    it('should have valid capabilities', () => {
      const model = IMAGE_MODEL_REGISTRY['dall-e-3'];
      expect(model.capabilities).toHaveProperty('sizes');
      expect(model.capabilities).toHaveProperty('maxImagesPerRequest');
      expect(model.capabilities).toHaveProperty('outputFormats');
      expect(model.capabilities).toHaveProperty('features');
      expect(model.capabilities).toHaveProperty('limits');
    });
  });

  describe('getImageModelInfo', () => {
    it('should return model info for valid model', () => {
      const model = getImageModelInfo('dall-e-3');
      expect(model).toBeDefined();
      expect(model?.name).toBe('dall-e-3');
    });

    it('should return undefined for unknown model', () => {
      const model = getImageModelInfo('unknown-model');
      expect(model).toBeUndefined();
    });
  });

  describe('getImageModelsByVendor', () => {
    it('should return OpenAI models', () => {
      const models = getImageModelsByVendor(Vendor.OpenAI);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.OpenAI)).toBe(true);
      expect(models.every((m) => m.isActive)).toBe(true);
    });

    it('should return Google models', () => {
      const models = getImageModelsByVendor(Vendor.Google);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === Vendor.Google)).toBe(true);
    });

    it('should return empty for unsupported vendor', () => {
      const models = getImageModelsByVendor(Vendor.Anthropic);
      expect(models.length).toBe(0);
    });
  });

  describe('getActiveImageModels', () => {
    it('should return all active models', () => {
      const models = getActiveImageModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.isActive)).toBe(true);
    });
  });

  describe('getImageModelsWithFeature', () => {
    it('should find models with generation support', () => {
      const models = getImageModelsWithFeature('generation');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'dall-e-3')).toBe(true);
      expect(models.some((m) => m.name === 'imagen-3.0-generate-002')).toBe(true);
    });

    it('should find models with editing support', () => {
      const models = getImageModelsWithFeature('editing');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'gpt-image-1')).toBe(true);
      expect(models.some((m) => m.name === 'dall-e-2')).toBe(true);
    });

    it('should find models with variation support', () => {
      const models = getImageModelsWithFeature('variations');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'dall-e-2')).toBe(true);
    });

    it('should find models with style control', () => {
      const models = getImageModelsWithFeature('styleControl');
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.name === 'dall-e-3')).toBe(true);
    });
  });

  describe('calculateImageCost', () => {
    it('should calculate cost for dall-e-3 standard', () => {
      const cost = calculateImageCost('dall-e-3', 1, 'standard');
      expect(cost).toBe(0.040);
    });

    it('should calculate cost for dall-e-3 hd', () => {
      const cost = calculateImageCost('dall-e-3', 1, 'hd');
      expect(cost).toBe(0.080);
    });

    it('should calculate cost for multiple images', () => {
      const cost = calculateImageCost('dall-e-2', 5);
      expect(cost).toBe(0.100); // 5 * 0.020
    });

    it('should calculate cost for Google Imagen', () => {
      const cost = calculateImageCost('imagen-3.0-generate-002', 2);
      expect(cost).toBe(0.080); // 2 * 0.04
    });

    it('should return null for unknown model', () => {
      const cost = calculateImageCost('unknown', 1);
      expect(cost).toBeNull();
    });
  });

  describe('Model constants', () => {
    it('should have IMAGE_MODELS constants for OpenAI', () => {
      expect(IMAGE_MODELS[Vendor.OpenAI].GPT_IMAGE_1).toBe('gpt-image-1');
      expect(IMAGE_MODELS[Vendor.OpenAI].DALL_E_3).toBe('dall-e-3');
      expect(IMAGE_MODELS[Vendor.OpenAI].DALL_E_2).toBe('dall-e-2');
    });

    it('should have IMAGE_MODELS constants for Google', () => {
      expect(IMAGE_MODELS[Vendor.Google].IMAGEN_3_GENERATE).toBe('imagen-3.0-generate-002');
      expect(IMAGE_MODELS[Vendor.Google].IMAGEN_3_CAPABILITY).toBe('imagen-3.0-capability-001');
      expect(IMAGE_MODELS[Vendor.Google].IMAGEN_3_FAST).toBe('imagen-3.0-fast-generate-001');
    });
  });

  describe('Model features', () => {
    it('should mark DALL-E 3 as having style control', () => {
      const model = getImageModelInfo('dall-e-3');
      expect(model?.capabilities.features.styleControl).toBe(true);
    });

    it('should mark DALL-E 3 as having prompt revision', () => {
      const model = getImageModelInfo('dall-e-3');
      expect(model?.capabilities.features.promptRevision).toBe(true);
    });

    it('should mark DALL-E 2 as supporting variations', () => {
      const model = getImageModelInfo('dall-e-2');
      expect(model?.capabilities.features.variations).toBe(true);
    });

    it('should mark gpt-image-1 as supporting transparency', () => {
      const model = getImageModelInfo('gpt-image-1');
      expect(model?.capabilities.features.transparency).toBe(true);
    });

    it('should show Google Imagen aspect ratios', () => {
      const model = getImageModelInfo('imagen-3.0-generate-002');
      expect(model?.capabilities.aspectRatios).toBeDefined();
      expect(model?.capabilities.aspectRatios).toContain('16:9');
      expect(model?.capabilities.aspectRatios).toContain('9:16');
    });
  });
});
