/**
 * Integration Tests for Provider Converters
 *
 * Tests the converter implementations for each provider, focusing on:
 * - Multi-turn tool call conversations
 * - Thought signature handling (Gemini 3+)
 * - Context preservation across tool executions
 *
 * Requires API keys in environment:
 * - OPENAI_API_KEY
 * - GOOGLE_API_KEY
 * - ANTHROPIC_API_KEY
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '../../../src/core/Connector.js';
import { Agent } from '../../../src/core/Agent.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const HAS_OPENAI_KEY = Boolean(OPENAI_API_KEY);
const HAS_GOOGLE_KEY = Boolean(GOOGLE_API_KEY);
const HAS_ANTHROPIC_KEY = Boolean(ANTHROPIC_API_KEY);

// Conditional test execution based on API key availability
const describeIfOpenAI = HAS_OPENAI_KEY ? describe : describe.skip;
const describeIfGoogle = HAS_GOOGLE_KEY ? describe : describe.skip;
const describeIfAnthropic = HAS_ANTHROPIC_KEY ? describe : describe.skip;

/**
 * Sequential tool that requires multiple calls in sequence
 * Tests that tool call IDs and thought signatures are preserved across turns
 */
const sequentialTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_step_data',
      description: 'Get data for a specific step in a sequence. Must call step 1 first, then step 2, then step 3.',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'number',
            description: 'Step number (1, 2, or 3)',
          },
        },
        required: ['step'],
      },
    },
  },
  execute: async (args: { step: number }) => {
    const stepData: Record<number, { data: string; next: number | null }> = {
      1: { data: 'First step complete - token: ABC', next: 2 },
      2: { data: 'Second step complete - token: DEF', next: 3 },
      3: { data: 'Third step complete - final token: GHI', next: null },
    };
    return {
      step: args.step,
      ...stepData[args.step] || { data: 'Unknown step', next: null },
    };
  },
};

/**
 * Counter tool to track how many times tool was called
 */
let toolCallCount = 0;
const counterTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'increment_counter',
      description: 'Increment a counter and return its current value',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'Amount to increment by (default 1)',
          },
        },
        required: [],
      },
    },
  },
  execute: async (args: { amount?: number }) => {
    toolCallCount += args.amount || 1;
    return { count: toolCallCount };
  },
};

// ============================================================================
// Google Gemini Converter Tests (thought_signature handling)
// ============================================================================

describeIfGoogle('Google Converter - thought_signature handling', () => {
  beforeAll(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('GOOGLE_API_KEY not set, skipping Google converter tests');
      return;
    }

    Connector.create({
      name: 'google-converter-test',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY },
    });
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    toolCallCount = 0;
  });

  describe('Gemini 3 (requires thought_signature)', () => {
    it('should handle multi-turn tool calls with thought_signature preservation', async () => {
      const agent = Agent.create({
        connector: 'google-converter-test',
        model: 'gemini-3-flash-preview',
        tools: [sequentialTool],
        context: { features: { workingMemory: false } },
      });
      // Disable built-in tools to reduce confusion
      agent.context.tools.disable('context_stats');

      const response = await agent.run(
        'Use the get_step_data tool to get all 3 steps in sequence. ' +
        'First call step 1, then step 2, then step 3. Report the final token from step 3.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      // Should have successfully called all 3 steps and report the final token
      expect(response.output_text!.toLowerCase()).toContain('ghi');
    }, 120000);

    it('should handle counter tool with multiple invocations', async () => {
      const agent = Agent.create({
        connector: 'google-converter-test',
        model: 'gemini-3-flash-preview',
        tools: [counterTool],
        context: { features: { workingMemory: false } },
      });
      agent.context.tools.disable('context_stats');

      const response = await agent.run(
        'Use the increment_counter tool three times. First with amount 5, then amount 3, then amount 2. ' +
        'Tell me the final count.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      // Should have incremented: 5 + 3 + 2 = 10
      expect(response.output_text).toMatch(/10/);
      expect(toolCallCount).toBe(10);
    }, 120000);
  });

  describe('Gemini 2 (no thought_signature needed)', () => {
    it('should handle multi-turn tool calls', async () => {
      const agent = Agent.create({
        connector: 'google-converter-test',
        model: 'gemini-2.0-flash',
        tools: [sequentialTool],
        context: { features: { workingMemory: false } },
      });
      agent.context.tools.disable('context_stats');

      const response = await agent.run(
        'Use the get_step_data tool to get all 3 steps in sequence. ' +
        'First call step 1, then step 2, then step 3. Report the final token from step 3.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text!.toLowerCase()).toContain('ghi');
    }, 120000);

    it('should handle basic chat without tools', async () => {
      const agent = Agent.create({
        connector: 'google-converter-test',
        model: 'gemini-2.0-flash',
        context: { features: { workingMemory: false } },
      });

      const response = await agent.runDirect('What is 2 + 2? Answer with just the number.');

      expect(response.status).toBe('completed');
      expect(response.output_text).toContain('4');
    }, 60000);
  });

  describe('Context preservation', () => {
    it('should preserve multi-turn context without tools', async () => {
      const agent = Agent.create({
        connector: 'google-converter-test',
        model: 'gemini-2.0-flash',
      });

      // First turn
      await agent.run('My favorite color is blue. Remember this.');

      // Second turn - should remember context
      const response = await agent.run('What is my favorite color?');

      expect(response.status).toBe('completed');
      expect(response.output_text!.toLowerCase()).toContain('blue');
    }, 60000);
  });
});

// ============================================================================
// OpenAI Converter Tests
// ============================================================================

describeIfOpenAI('OpenAI Converter - multi-turn tool calls', () => {
  beforeAll(() => {
    if (!OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping OpenAI converter tests');
      return;
    }

    Connector.create({
      name: 'openai-converter-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY },
    });
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    toolCallCount = 0;
  });

  it('should handle sequential tool calls', async () => {
    const agent = Agent.create({
      connector: 'openai-converter-test',
      model: 'gpt-4o-mini',
      tools: [sequentialTool],
      context: { features: { workingMemory: false } },
    });
    agent.context.tools.disable('context_stats');

    const response = await agent.run(
      'Use the get_step_data tool to get all 3 steps in sequence. ' +
      'First call step 1, then step 2, then step 3. Report the final token from step 3.'
    );

    expect(response.status).toBe('completed');
    expect(response.output_text).toBeDefined();
    expect(response.output_text!.toLowerCase()).toContain('ghi');
  }, 90000);

  it('should handle counter tool with multiple invocations', async () => {
    const agent = Agent.create({
      connector: 'openai-converter-test',
      model: 'gpt-4o-mini',
      tools: [counterTool],
      context: { features: { workingMemory: false } },
    });
    agent.context.tools.disable('context_stats');

    const response = await agent.run(
      'Use the increment_counter tool three times. First with amount 5, then amount 3, then amount 2. ' +
      'Tell me the final count.'
    );

    expect(response.status).toBe('completed');
    expect(response.output_text).toBeDefined();
    expect(response.output_text).toMatch(/10/);
    expect(toolCallCount).toBe(10);
  }, 90000);

  it('should handle chat without tools', async () => {
    const agent = Agent.create({
      connector: 'openai-converter-test',
      model: 'gpt-4o-mini',
      context: { features: { workingMemory: false } },
    });

    const response = await agent.runDirect('What is 2 + 2? Answer with just the number.');

    expect(response.status).toBe('completed');
    expect(response.output_text).toContain('4');
  }, 30000);
});

// ============================================================================
// Anthropic Converter Tests
// ============================================================================

describeIfAnthropic('Anthropic Converter - multi-turn tool calls', () => {
  beforeAll(() => {
    if (!ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not set, skipping Anthropic converter tests');
      return;
    }

    Connector.create({
      name: 'anthropic-converter-test',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: ANTHROPIC_API_KEY },
    });
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    toolCallCount = 0;
  });

  it('should handle sequential tool calls', async () => {
    const agent = Agent.create({
      connector: 'anthropic-converter-test',
      model: 'claude-3-5-haiku-20241022',
      tools: [sequentialTool],
      context: { features: { workingMemory: false } },
    });
    agent.context.tools.disable('context_stats');

    const response = await agent.run(
      'Use the get_step_data tool to get all 3 steps in sequence. ' +
      'First call step 1, then step 2, then step 3. Report the final token from step 3.'
    );

    expect(response.status).toBe('completed');
    expect(response.output_text).toBeDefined();
    expect(response.output_text!.toLowerCase()).toContain('ghi');
  }, 90000);

  it('should handle counter tool with multiple invocations', async () => {
    const agent = Agent.create({
      connector: 'anthropic-converter-test',
      model: 'claude-3-5-haiku-20241022',
      tools: [counterTool],
      context: { features: { workingMemory: false } },
    });
    agent.context.tools.disable('context_stats');

    const response = await agent.run(
      'Use the increment_counter tool three times. First with amount 5, then amount 3, then amount 2. ' +
      'Tell me the final count.'
    );

    expect(response.status).toBe('completed');
    expect(response.output_text).toBeDefined();
    expect(response.output_text).toMatch(/10/);
    expect(toolCallCount).toBe(10);
  }, 90000);

  it('should handle chat without tools', async () => {
    const agent = Agent.create({
      connector: 'anthropic-converter-test',
      model: 'claude-3-5-haiku-20241022',
      context: { features: { workingMemory: false } },
    });

    const response = await agent.runDirect('What is 2 + 2? Answer with just the number.');

    expect(response.status).toBe('completed');
    expect(response.output_text).toContain('4');
  }, 30000);
});

// ============================================================================
// Cross-Provider Consistency Tests
// ============================================================================

const allKeysAvailable = HAS_OPENAI_KEY && HAS_GOOGLE_KEY && HAS_ANTHROPIC_KEY;
const describeIfAllKeys = allKeysAvailable ? describe : describe.skip;

describeIfAllKeys('Cross-Provider Converter Consistency', () => {
  beforeAll(() => {
    Connector.create({
      name: 'openai-cross-conv',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: OPENAI_API_KEY! },
    });
    Connector.create({
      name: 'google-cross-conv',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: GOOGLE_API_KEY! },
    });
    Connector.create({
      name: 'anthropic-cross-conv',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: ANTHROPIC_API_KEY! },
    });
  });

  afterAll(() => {
    Connector.clear();
  });

  it('all providers should handle tool call/result cycle correctly', async () => {
    const configs = [
      { connector: 'openai-cross-conv', model: 'gpt-4o-mini', name: 'OpenAI' },
      { connector: 'google-cross-conv', model: 'gemini-2.0-flash', name: 'Google' },
      { connector: 'anthropic-cross-conv', model: 'claude-3-5-haiku-20241022', name: 'Anthropic' },
    ];

    for (const config of configs) {
      toolCallCount = 0;

      const agent = Agent.create({
        connector: config.connector,
        model: config.model,
        tools: [counterTool],
        context: { features: { workingMemory: false } },
      });
      agent.context.tools.disable('context_stats');

      const response = await agent.run(
        'Use the increment_counter tool twice: first with amount 7, then with amount 3. Report the final count.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text).toMatch(/10/);
      expect(toolCallCount).toBe(10);
    }
  }, 180000);

  it('all providers should preserve tool call IDs across turns', async () => {
    const configs = [
      { connector: 'openai-cross-conv', model: 'gpt-4o-mini', name: 'OpenAI' },
      { connector: 'google-cross-conv', model: 'gemini-2.0-flash', name: 'Google' },
      { connector: 'anthropic-cross-conv', model: 'claude-3-5-haiku-20241022', name: 'Anthropic' },
    ];

    for (const config of configs) {
      const agent = Agent.create({
        connector: config.connector,
        model: config.model,
        tools: [sequentialTool],
        context: { features: { workingMemory: false } },
      });
      agent.context.tools.disable('context_stats');

      const response = await agent.run(
        'Get data from steps 1, 2, and 3 using get_step_data. Report the final token.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      // All should successfully retrieve final token
      expect(response.output_text!.toLowerCase()).toContain('ghi');
    }
  }, 180000);
});
