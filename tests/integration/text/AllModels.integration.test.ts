/**
 * Integration Tests for ALL LLM Models in the Registry
 *
 * This test file dynamically tests every model in the MODEL_REGISTRY
 * by sending a simple "hi" message and verifying a non-error response.
 *
 * Tests are organized by vendor and conditionally run based on API key availability.
 *
 * Required environment variables:
 * - OPENAI_API_KEY
 * - GOOGLE_API_KEY
 * - ANTHROPIC_API_KEY
 *
 * Run with: npm run test:integration -- tests/integration/text/AllModels.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '../../../src/core/Connector.js';
import { Agent } from '../../../src/core/Agent.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { MODEL_REGISTRY } from '../../../src/domain/entities/Model.js';
import type { ILLMDescription } from '../../../src/domain/entities/Model.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_GOOGLE_KEY = Boolean(GOOGLE_API_KEY);
const HAS_ANTHROPIC_KEY = Boolean(ANTHROPIC_API_KEY);

// Timeout for each model test (some models may be slow)
const MODEL_TEST_TIMEOUT = 120000; // 2 minutes
const REASONING_MODEL_TIMEOUT = 240000; // 4 minutes for reasoning models (Google API can be slow)

// Test prompt - simple greeting to minimize cost and latency
const TEST_PROMPT = 'Hi! Say hello back in one short sentence.';

/**
 * Models to skip (deprecated, image-only, or unsupported models)
 */
const SKIP_MODELS: Set<string> = new Set([
  // Image generation models - don't support text-only requests
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  // Deprecated Claude 3.x models - only test Claude 4+
  'claude-3-7-sonnet-20250219',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]);

/**
 * Reasoning models that don't support temperature parameter
 * These models also require longer timeout due to thinking/reasoning time
 */
const REASONING_MODELS: Set<string> = new Set([
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'o3-mini',
  'o1',
  'gemini-3-pro-preview', // Takes 60+ seconds for reasoning
  'gemini-3-flash-preview', // Also a reasoning model
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all models for a specific vendor from the registry
 */
function getVendorModels(vendor: string): ILLMDescription[] {
  return Object.values(MODEL_REGISTRY).filter(
    (model) => model.provider === vendor && model.isActive
  );
}

/**
 * Test a single model with a simple greeting
 */
async function testModel(connectorName: string, modelName: string): Promise<void> {
  // For Gemini 3 reasoning models, use low thinking level to speed up responses
  const isGemini3Reasoning = modelName.startsWith('gemini-3-') &&
                            (modelName.includes('pro') || modelName.includes('flash'));

  const agent = Agent.create({
    connector: connectorName,
    model: modelName,
    temperature: 0.7,
    maxOutputTokens: 100, // Limit output to reduce cost
    vendorOptions: isGemini3Reasoning ? { thinkingLevel: 'low' } : undefined,
  });

  const response = await agent.run(TEST_PROMPT);

  // Basic assertions
  expect(response.status).toBe('completed');
  expect(response.output_text).toBeDefined();
  expect(response.output_text!.length).toBeGreaterThan(0);
  expect(response.usage).toBeDefined();
  expect(response.usage.input_tokens).toBeGreaterThan(0);
  expect(response.usage.output_tokens).toBeGreaterThan(0);

  // Log success for visibility
  console.log(
    `  ✓ ${modelName}: "${response.output_text!.substring(0, 50).replace(/\n/g, ' ')}..." ` +
      `(${response.usage.input_tokens}/${response.usage.output_tokens} tokens)`
  );
}

// ============================================================================
// OpenAI Models
// ============================================================================

const openaiModels = getVendorModels(Vendor.OpenAI);
const describeOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;

describeOpenAI(`OpenAI Models (${openaiModels.length} total)`, () => {
  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping OpenAI tests');
      return;
    }

    Connector.create({
      name: 'openai-all-models',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });

    console.log(`\n🔵 Testing ${openaiModels.length} OpenAI models:`);
    openaiModels.forEach((m) => console.log(`   - ${m.name}`));
  });

  afterAll(() => {
    Connector.clear();
  });

  // Generate test for each model
  openaiModels.forEach((modelInfo) => {
    const shouldSkip = SKIP_MODELS.has(modelInfo.name);
    const testFn = shouldSkip ? it.skip : it;
    const isReasoning = REASONING_MODELS.has(modelInfo.name);
    const timeout = isReasoning ? REASONING_MODEL_TIMEOUT : MODEL_TEST_TIMEOUT;

    testFn(
      `${modelInfo.name} should respond to greeting`,
      async () => {
        await testModel('openai-all-models', modelInfo.name);
      },
      timeout
    );
  });
});

// ============================================================================
// Anthropic Models
// ============================================================================

const anthropicModels = getVendorModels(Vendor.Anthropic);
const describeAnthropic = HAS_ANTHROPIC_KEY ? describe : describe.skip;

describeAnthropic(`Anthropic Models (${anthropicModels.length} total)`, () => {
  beforeAll(() => {
    if (!ANTHROPIC_API_KEY) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set, skipping Anthropic tests');
      return;
    }

    Connector.create({
      name: 'anthropic-all-models',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: ANTHROPIC_API_KEY },
    });

    console.log(`\n🟣 Testing ${anthropicModels.length} Anthropic models:`);
    anthropicModels.forEach((m) => console.log(`   - ${m.name}`));
  });

  afterAll(() => {
    Connector.clear();
  });

  // Generate test for each model
  anthropicModels.forEach((modelInfo) => {
    const shouldSkip = SKIP_MODELS.has(modelInfo.name);
    const testFn = shouldSkip ? it.skip : it;
    const isReasoning = REASONING_MODELS.has(modelInfo.name);
    const timeout = isReasoning ? REASONING_MODEL_TIMEOUT : MODEL_TEST_TIMEOUT;

    testFn(
      `${modelInfo.name} should respond to greeting`,
      async () => {
        await testModel('anthropic-all-models', modelInfo.name);
      },
      timeout
    );
  });
});

// ============================================================================
// Google Models
// ============================================================================

const googleModels = getVendorModels(Vendor.Google);
const describeGoogle = HAS_GOOGLE_KEY ? describe : describe.skip;

describeGoogle(`Google Models (${googleModels.length} total)`, () => {
  beforeAll(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('⚠️  GOOGLE_API_KEY not set, skipping Google tests');
      return;
    }

    Connector.create({
      name: 'google-all-models',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY },
    });

    console.log(`\n🔴 Testing ${googleModels.length} Google models:`);
    googleModels.forEach((m) => console.log(`   - ${m.name}`));
  });

  afterAll(() => {
    Connector.clear();
  });

  // Generate test for each model
  googleModels.forEach((modelInfo) => {
    const shouldSkip = SKIP_MODELS.has(modelInfo.name);
    const testFn = shouldSkip ? it.skip : it;
    const isReasoning = REASONING_MODELS.has(modelInfo.name);
    const timeout = isReasoning ? REASONING_MODEL_TIMEOUT : MODEL_TEST_TIMEOUT;

    testFn(
      `${modelInfo.name} should respond to greeting`,
      async () => {
        await testModel('google-all-models', modelInfo.name);
      },
      timeout
    );
  });
});

// ============================================================================
// Model Registry Validation Tests (always run)
// ============================================================================

describe('Model Registry Validation', () => {
  it('should have all expected vendors represented', () => {
    const vendors = new Set(Object.values(MODEL_REGISTRY).map((m) => m.provider));
    expect(vendors.has(Vendor.OpenAI)).toBe(true);
    expect(vendors.has(Vendor.Anthropic)).toBe(true);
    expect(vendors.has(Vendor.Google)).toBe(true);
  });

  it('should have at least one active model per vendor', () => {
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(anthropicModels.length).toBeGreaterThan(0);
    expect(googleModels.length).toBeGreaterThan(0);
  });

  it('should have valid pricing for all models', () => {
    Object.values(MODEL_REGISTRY).forEach((model) => {
      expect(model.features.input.cpm).toBeGreaterThanOrEqual(0);
      expect(model.features.output.cpm).toBeGreaterThanOrEqual(0);
      expect(model.features.input.tokens).toBeGreaterThan(0);
      expect(model.features.output.tokens).toBeGreaterThan(0);
    });
  });

  it('should have consistent model name as key and property', () => {
    Object.entries(MODEL_REGISTRY).forEach(([key, model]) => {
      expect(key).toBe(model.name);
    });
  });

  it('should print model summary', () => {
    console.log('\n' + '='.repeat(60));
    console.log('MODEL REGISTRY SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total models: ${Object.keys(MODEL_REGISTRY).length}`);
    console.log(`  - OpenAI: ${openaiModels.length} models`);
    console.log(`  - Anthropic: ${anthropicModels.length} models`);
    console.log(`  - Google: ${googleModels.length} models`);
    console.log('='.repeat(60) + '\n');

    // This test always passes, it's just for logging
    expect(true).toBe(true);
  });
});
