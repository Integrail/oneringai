/**
 * Integration tests for VideoGeneration (requires API keys)
 * These tests make real API calls to verify functionality
 *
 * NOTE: Video generation is slow (30s - several minutes) and expensive.
 * These tests are designed to verify basic API functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';
import { VideoGeneration } from '../../../src/capabilities/video/VideoGeneration.js';
import { Vendor } from '../../../src/core/Vendor.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_GOOGLE_KEY = Boolean(GOOGLE_API_KEY);

// Skip tests if no API key
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
const describeIfGoogle = HAS_GOOGLE_KEY ? describe : describe.skip;

// ============================================================================
// OpenAI Sora Video Generation Tests
// ============================================================================

describeIfOpenAI('VideoGeneration Integration (OpenAI Sora)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping OpenAI video integration tests');
      return;
    }

    Connector.create({
      name: 'openai-video-test',
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

  describe('Basic generation with Sora 2', () => {
    // OpenAI SDK 6.x now supports video generation
    it('should start video generation and get a job ID', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'openai-video-test',
      });

      const job = await videoGen.generate({
        prompt: 'A simple rotating red cube on a white background',
        model: 'sora-2',
        duration: 4,
        resolution: '720x1280',
      });

      expect(job.jobId).toBeDefined();
      expect(job.status).toMatch(/pending|processing/);
      expect(job.created).toBeGreaterThan(0);
    }, 30000);

    it('should check job status', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'openai-video-test',
      });

      const job = await videoGen.generate({
        prompt: 'A simple blue sphere',
        model: 'sora-2',
        duration: 4,
      });

      const status = await videoGen.getStatus(job.jobId);
      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toMatch(/pending|processing|completed|failed/);
    }, 30000);
  });

  describe('List models', () => {
    it('should list available models', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'openai-video-test',
      });

      const models = await videoGen.listModels();

      expect(models).toContain('sora-2');
      expect(models).toContain('sora-2-pro');
    });
  });

  describe('Model info', () => {
    it('should get model info', () => {
      const videoGen = VideoGeneration.create({
        connector: 'openai-video-test',
      });

      const info = videoGen.getModelInfo('sora-2');

      expect(info).toBeDefined();
      expect(info?.name).toBe('sora-2');
      expect(info?.capabilities.durations).toContain(4);
      expect(info?.capabilities.durations).toContain(8);
      expect(info?.capabilities.audio).toBe(true);
    });

    it('should get Sora 2 Pro model info', () => {
      const videoGen = VideoGeneration.create({
        connector: 'openai-video-test',
      });

      const info = videoGen.getModelInfo('sora-2-pro');

      expect(info).toBeDefined();
      expect(info?.name).toBe('sora-2-pro');
      expect(info?.capabilities.features.upscaling).toBe(true);
      expect(info?.capabilities.features.styleControl).toBe(true);
    });
  });
});

// ============================================================================
// Google Veo Video Generation Tests
// ============================================================================

describeIfGoogle('VideoGeneration Integration (Google Veo)', () => {
  const tempFiles: string[] = [];

  beforeAll(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('⚠️  GOOGLE_API_KEY not set, skipping Google video integration tests');
      return;
    }

    Connector.create({
      name: 'google-video-test',
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

  describe('Basic generation with Veo 3.1', () => {
    it('should start video generation and get a job ID', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'google-video-test',
      });

      const job = await videoGen.generate({
        prompt: 'A simple rotating green cube on a white background',
        model: 'veo-3.1-generate-preview',
        duration: 4,
      });

      expect(job.jobId).toBeDefined();
      expect(job.status).toMatch(/pending|processing/);
      expect(job.created).toBeGreaterThan(0);
    }, 30000);

    it('should check job status', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'google-video-test',
      });

      const job = await videoGen.generate({
        prompt: 'A simple yellow sphere',
        model: 'veo-3.1-fast-generate-preview',
        duration: 4,
      });

      // Check status
      const status = await videoGen.getStatus(job.jobId);
      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toMatch(/pending|processing|completed|failed/);
    }, 30000);
  });

  describe('List models', () => {
    it('should list available models', async () => {
      const videoGen = VideoGeneration.create({
        connector: 'google-video-test',
      });

      const models = await videoGen.listModels();

      expect(models).toContain('veo-2.0-generate-001');
      expect(models).toContain('veo-3-generate-preview');
      expect(models).toContain('veo-3.1-fast-generate-preview');
      expect(models).toContain('veo-3.1-generate-preview');
    });
  });

  describe('Model info', () => {
    it('should get Veo 3.0 model info', () => {
      const videoGen = VideoGeneration.create({
        connector: 'google-video-test',
      });

      const info = videoGen.getModelInfo('veo-3-generate-preview');

      expect(info).toBeDefined();
      expect(info?.name).toBe('veo-3-generate-preview');
      expect(info?.capabilities.audio).toBe(true);
      expect(info?.capabilities.features.negativePrompt).toBe(true);
    });

    it('should get Veo 3.1 model info', () => {
      const videoGen = VideoGeneration.create({
        connector: 'google-video-test',
      });

      const info = videoGen.getModelInfo('veo-3.1-generate-preview');

      expect(info).toBeDefined();
      expect(info?.name).toBe('veo-3.1-generate-preview');
      expect(info?.capabilities.videoExtension).toBe(true);
      expect(info?.capabilities.durations).toContain(8);
    });
  });
});
