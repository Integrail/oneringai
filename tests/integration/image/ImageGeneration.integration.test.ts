/**
 * Integration tests for ImageGeneration (requires API keys)
 * These tests make real API calls to verify functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';
import { ImageGeneration } from '../../../src/capabilities/images/ImageGeneration.js';
import { Vendor } from '../../../src/core/Vendor.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_GOOGLE_KEY = Boolean(GOOGLE_API_KEY);
const HAS_XAI_KEY = Boolean(XAI_API_KEY);

// Skip tests if no API key
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
const describeIfGoogle = HAS_GOOGLE_KEY ? describe : describe.skip;
const describeIfGrok = HAS_XAI_KEY ? describe : describe.skip;

// ============================================================================
// OpenAI Image Generation Tests
// ============================================================================

describeIfOpenAI('ImageGeneration Integration (OpenAI)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping OpenAI image integration tests');
      return;
    }

    Connector.create({
      name: 'openai-image-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }

    try {
      Connector.clear();
    } catch {
      // Ignore if already cleared
    }
  });

  describe('Basic generation with GPT Image 2', () => {
    it('should generate an image from a prompt', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple red circle on a white background',
        model: 'gpt-image-2',
        size: '1024x1024',
        quality: 'standard',
      });

      expect(response.created).toBeGreaterThan(0);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
      expect(response.data[0].b64_json!.length).toBeGreaterThan(1000);

      if (response.data[0].revised_prompt) {
        expect(response.data[0].revised_prompt.length).toBeGreaterThan(0);
      }
    }, 60000); // 60s timeout for image generation

    it('should generate another square image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A sunset over mountains',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);

    it('should generate from a second prompt', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A forest path in autumn',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);
  });

  describe('GPT Image 2 batch generation', () => {
    it('should generate an image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A blue square',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);

    it('should generate multiple images', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A green triangle',
        model: 'gpt-image-2',
        size: '1024x1024',
        n: 2,
      });

      expect(response.data).toHaveLength(2);
      expect(response.data[0].b64_json).toBeDefined();
      expect(response.data[1].b64_json).toBeDefined();
    }, 60000);
  });

  describe('HD quality', () => {
    it('should generate HD quality image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A detailed cityscape at night',
        model: 'gpt-image-2',
        size: '1024x1024',
        quality: 'hd',
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
      // HD images should generally be larger
      expect(response.data[0].b64_json!.length).toBeGreaterThan(10000);
    }, 90000); // Longer timeout for HD
  });

  describe('Different aspect ratios', () => {
    it('should generate landscape image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A panoramic mountain view',
        model: 'gpt-image-2',
        size: '1536x1024', // Landscape
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);

    it('should generate portrait image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A tall waterfall',
        model: 'gpt-image-2',
        size: '1024x1536', // Portrait
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);
  });

  describe('Save to file', () => {
    it('should save generated image to file', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple star shape',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(response.data[0].b64_json).toBeDefined();

      // Save to file
      const outputPath = path.join(__dirname, 'test-output-openai.png');
      tempFiles.push(outputPath);

      const buffer = Buffer.from(response.data[0].b64_json!, 'base64');
      await fs.writeFile(outputPath, buffer);

      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify PNG header
      const fileBuffer = await fs.readFile(outputPath);
      expect(fileBuffer.slice(0, 4).toString('hex')).toBe('89504e47'); // PNG magic
    }, 60000);
  });

  describe('List models', () => {
    it('should list available models', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const models = await imageGen.listModels();

      expect(models).toContain('gpt-image-2');
      expect(models).toContain('gpt-image-1.5');
      expect(models).toContain('gpt-image-1');
    });
  });

  describe('Model info', () => {
    it('should get model info', () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const info = imageGen.getModelInfo('gpt-image-2');

      expect(info).toBeDefined();
      expect(info?.name).toBe('gpt-image-2');
      expect(info?.capabilities.features.styleControl).toBe(false);
      expect(info?.capabilities.features.qualityControl).toBe(true);
    });
  });

  describe('Image editing (GPT Image 2)', () => {
    it('should edit a generated image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'openai-image-test',
      });

      const baseResponse = await imageGen.generate({
        prompt: 'A simple white square on a light gray background',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(baseResponse.data[0].b64_json).toBeDefined();
      const imageBuffer = Buffer.from(baseResponse.data[0].b64_json!, 'base64');

      const editResponse = await imageGen.edit({
        image: imageBuffer,
        prompt: 'Add a small red circle in the center',
        model: 'gpt-image-2',
        size: '1024x1024',
      });

      expect(editResponse.data).toHaveLength(1);
      expect(editResponse.data[0].b64_json).toBeDefined();
    }, 120000);
  });
});

// ============================================================================
// Google Gemini Image Tests
// ============================================================================

describeIfGoogle('ImageGeneration Integration (Google)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('⚠️  GOOGLE_API_KEY not set, skipping Google image integration tests');
      return;
    }

    Connector.create({
      name: 'google-image-test',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY },
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }

    try {
      Connector.clear();
    } catch {
      // Ignore if already cleared
    }
  });

  describe('Basic generation with Gemini 3.1 Flash Image', () => {
    it('should generate an image from a prompt', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple red apple on a white background',
        model: 'gemini-3.1-flash-image',
      });

      expect(response.created).toBeGreaterThan(0);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
      expect(response.data[0].b64_json!.length).toBeGreaterThan(1000);
    }, 60000);

    it('should generate multiple images', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A colorful butterfly',
        model: 'gemini-3.1-flash-image',
        n: 2,
      });

      expect(response.data.length).toBeGreaterThanOrEqual(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);
  });

  describe('Gemini 3.1 Flash Lite Image model', () => {
    it('should generate with fast model', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple blue circle',
        model: 'gemini-3.1-flash-lite-image',
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json).toBeDefined();
    }, 60000);
  });

  describe('Save to file', () => {
    it('should save generated image to file', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple green square',
        model: 'gemini-3.1-flash-lite-image',
      });

      expect(response.data[0].b64_json).toBeDefined();

      // Save to file
      const outputPath = path.join(__dirname, 'test-output-google.png');
      tempFiles.push(outputPath);

      const buffer = Buffer.from(response.data[0].b64_json!, 'base64');
      await fs.writeFile(outputPath, buffer);

      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    }, 60000);
  });

  describe('List models', () => {
    it('should list available models', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const models = await imageGen.listModels();

      expect(models).toContain('gemini-3.1-flash-image');
      expect(models).toContain('gemini-3.1-flash-lite-image');
      expect(models).toContain('gemini-3-pro-image');
    });
  });

  describe('Model info', () => {
    it('should get model info', () => {
      const imageGen = ImageGeneration.create({
        connector: 'google-image-test',
      });

      const info = imageGen.getModelInfo('gemini-3.1-flash-image');

      expect(info).toBeDefined();
      expect(info?.name).toBe('gemini-3.1-flash-image');
      expect(info?.capabilities.aspectRatios).toBeDefined();
      expect(info?.capabilities.aspectRatios).toContain('16:9');
    });
  });
});

// ============================================================================
// xAI Grok Image Generation Tests
// ============================================================================

describeIfGrok('ImageGeneration Integration (Grok)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!XAI_API_KEY) {
      console.warn('⚠️  XAI_API_KEY not set, skipping Grok image integration tests');
      return;
    }

    Connector.create({
      name: 'grok-image-test',
      vendor: Vendor.Grok,
      auth: { type: 'api_key', apiKey: XAI_API_KEY },
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }

    try {
      Connector.clear();
    } catch {
      // Ignore if already cleared
    }
  });

  describe('Basic generation with Grok Imagine', () => {
    it('should generate an image from a prompt', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple red circle on a white background',
        model: 'grok-imagine-image-2.0',
        size: '1024x1024',
      });

      // Grok API may not return 'created' field - check for response data instead
      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json || response.data[0].url).toBeDefined();
    }, 60000);

    it('should generate multiple images', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A colorful abstract pattern',
        model: 'grok-imagine-image-2.0',
        size: '1024x1024',
        n: 2,
      });

      expect(response.data.length).toBeGreaterThanOrEqual(1);
    }, 90000);
  });

  describe('Medium quality', () => {
    it('should generate a 2K medium-quality image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A detailed cityscape at night',
        model: 'grok-imagine-image-2.0',
        vendorOptions: { resolution: '2K', quality: 'medium' },
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].b64_json || response.data[0].url).toBeDefined();
    }, 90000);
  });

  describe('Different aspect ratios', () => {
    it('should generate landscape image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A panoramic mountain view',
        model: 'grok-imagine-image-2.0',
        aspectRatio: '16:9',
      });

      expect(response.data).toHaveLength(1);
    }, 60000);

    it('should generate portrait image', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A tall waterfall',
        model: 'grok-imagine-image-2.0',
        aspectRatio: '9:16',
      });

      expect(response.data).toHaveLength(1);
    }, 60000);
  });

  describe('Save to file', () => {
    it('should save generated image to file', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const response = await imageGen.generate({
        prompt: 'A simple star shape',
        model: 'grok-imagine-image-2.0',
        size: '1024x1024',
      });

      expect(response.data[0].b64_json || response.data[0].url).toBeDefined();

      if (response.data[0].b64_json) {
        // Save to file
        const outputPath = path.join(__dirname, 'test-output-grok.png');
        tempFiles.push(outputPath);

        const buffer = Buffer.from(response.data[0].b64_json, 'base64');
        await fs.writeFile(outputPath, buffer);

        const stats = await fs.stat(outputPath);
        expect(stats.size).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('List models', () => {
    it('should list available models', async () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const models = await imageGen.listModels();

      expect(models).toContain('grok-imagine-image-2.0');
      expect(models).toContain('grok-imagine-image-quality');
    });
  });

  describe('Model info', () => {
    it('should get model info', () => {
      const imageGen = ImageGeneration.create({
        connector: 'grok-image-test',
      });

      const info = imageGen.getModelInfo('grok-imagine-image-2.0');

      expect(info).toBeDefined();
      expect(info?.name).toBe('grok-imagine-image-2.0');
      expect(info?.capabilities.features.generation).toBe(true);
      expect(info?.capabilities.features.editing).toBe(true);
      expect(info?.capabilities.maxImagesPerRequest).toBe(10);
    });
  });
});
