/**
 * Integration Tests for Ollama (local LLM)
 *
 * Tests the full Agent flow against a local Ollama instance:
 * - Basic text generation
 * - Streaming
 * - Tool calling
 * - Multi-turn conversation
 * - auth: { type: 'none' } connector
 *
 * Requires Ollama running locally on http://localhost:11434
 *
 * Run with: npx vitest run tests/integration/text/Ollama.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';
import { Agent } from '../../../src/core/Agent.js';
import { Vendor } from '../../../src/core/Vendor.js';
import {
  isOutputTextDelta,
  isResponseComplete,
} from '../../../src/domain/entities/StreamEvent.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';

// ============================================================================
// Ollama availability check
// ============================================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

interface OllamaModel {
  name: string;
  model: string;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

async function checkOllamaAvailable(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as OllamaTagsResponse;
    if (!data.models || data.models.length === 0) return null;

    // Prefer qwen3:8b, fall back to first available model
    const preferred = data.models.find((m) => m.name.startsWith('qwen3'));
    return preferred ? preferred.model : data.models[0].model;
  } catch {
    return null;
  }
}

// Detect Ollama before tests run
let ollamaModel: string | null = null;
try {
  ollamaModel = await checkOllamaAvailable();
} catch {
  ollamaModel = null;
}

const OLLAMA_AVAILABLE = ollamaModel !== null;
const describeOllama = OLLAMA_AVAILABLE ? describe : describe.skip;

if (!OLLAMA_AVAILABLE) {
  console.warn('⚠️  Ollama not running or no models available, skipping Ollama tests');
} else {
  console.log(`✅ Ollama available, using model: ${ollamaModel}`);
}

// ============================================================================
// Test tools
// ============================================================================

const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location. Returns temperature, condition, and humidity.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city name, e.g. "Paris"',
          },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args: { location: string }) => {
    return {
      location: args.location,
      temperature: 22,
      unit: 'celsius',
      condition: 'sunny',
      humidity: 45,
    };
  },
};

let toolCallCount = 0;
const counterTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'increment_counter',
      description: 'Increment a counter by a given amount and return the current total count.',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'Amount to increment by',
          },
        },
        required: ['amount'],
      },
    },
  },
  execute: async (args: { amount: number }) => {
    toolCallCount += args.amount;
    return { count: toolCallCount };
  },
};

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
      ...(stepData[args.step] || { data: 'Unknown step', next: null }),
    };
  },
};

// ============================================================================
// Ollama Integration Tests
// ============================================================================

describeOllama('Agent Integration - Ollama', () => {
  beforeAll(() => {
    Connector.create({
      name: 'ollama-test',
      vendor: Vendor.Ollama,
      auth: { type: 'none' },
    });
  });

  afterAll(() => {
    Connector.clear();
  });

  beforeEach(() => {
    toolCallCount = 0;
  });

  describe('Connector with auth: none', () => {
    it('should create a connector with auth type none', () => {
      const connector = Connector.get('ollama-test');
      expect(connector).toBeDefined();
      expect(connector.vendor).toBe(Vendor.Ollama);
      expect(connector.name).toBe('ollama-test');
    });
  });

  describe('Model discovery', () => {
    it('should list available models', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      const models = await agent.listModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      // The model we're testing with should be in the list
      // Ollama returns names like "qwen3:8b" — check that the current model appears
      const hasCurrentModel = models.some((m) => ollamaModel!.startsWith(m) || m.startsWith(ollamaModel!.split(':')[0]));
      expect(hasCurrentModel).toBe(true);
    }, 30000);
  });

  describe('Basic text generation', () => {
    it('should generate a response', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      const response = await agent.run('Say "Hello, World!" and nothing else.');

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text!.toLowerCase()).toContain('hello');
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    }, 120000);

    it('should respect system instructions', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
        instructions: 'You are a pirate. Always respond in pirate speak. Use words like "arr", "ye", "matey".',
      });

      const response = await agent.run('Tell me about the weather.');

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      const pirateWords = ['arr', 'ye', 'matey', 'ahoy', 'aye', 'sea', 'ship', 'captain', 'sail'];
      const lowerText = response.output_text!.toLowerCase();
      const hasPirateLanguage = pirateWords.some((word) => lowerText.includes(word));
      expect(hasPirateLanguage).toBe(true);
    }, 120000);
  });

  describe('Multi-turn conversation', () => {
    it('should preserve context across turns', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      // First turn
      await agent.run('My favorite color is blue. Remember this.');

      // Second turn - should remember context
      const response = await agent.run('What is my favorite color? Answer in one word.');

      expect(response.status).toBe('completed');
      expect(response.output_text!.toLowerCase()).toContain('blue');
    }, 120000);

    it('should handle multi-turn via input array', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      const response = await agent.run([
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'My name is Alice.' }],
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Nice to meet you, Alice!' }],
        },
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'What is my name? Answer in one word.' }],
        },
      ]);

      expect(response.status).toBe('completed');
      expect(response.output_text!.toLowerCase()).toContain('alice');
    }, 120000);
  });

  describe('Streaming', () => {
    it('should stream text deltas', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      const deltas: string[] = [];
      let completeEvent: any = null;

      for await (const event of agent.streamDirect('Count from 1 to 5.')) {
        if (isOutputTextDelta(event)) {
          deltas.push(event.delta);
        }
        if (isResponseComplete(event)) {
          completeEvent = event;
        }
      }

      expect(deltas.length).toBeGreaterThan(0);
      const fullText = deltas.join('');
      expect(fullText).toContain('1');
      expect(fullText).toContain('5');
      expect(completeEvent).not.toBeNull();
      expect(completeEvent.status).toBe('completed');
    }, 120000);
  });

  describe('Tool calling', () => {
    it('should call a single tool', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
        tools: [weatherTool],
      });
      // Disable built-in tools to reduce confusion for smaller local models
      agent.context.tools.disable('context_stats');
      agent.context.tools.disable('memory_store');
      agent.context.tools.disable('memory_retrieve');
      agent.context.tools.disable('memory_delete');
      agent.context.tools.disable('memory_list');

      const response = await agent.run(
        'What is the weather in Paris? Use the get_weather tool to find out.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      const lowerText = response.output_text!.toLowerCase();
      expect(lowerText).toMatch(/paris|sunny|22|celsius/i);
    }, 120000);

    it('should handle sequential tool calls', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
        tools: [sequentialTool],
      });
      agent.context.tools.disable('context_stats');
      agent.context.tools.disable('memory_store');
      agent.context.tools.disable('memory_retrieve');
      agent.context.tools.disable('memory_delete');
      agent.context.tools.disable('memory_list');

      const response = await agent.run(
        'Use the get_step_data tool to get all 3 steps in sequence. ' +
        'First call step 1, then step 2, then step 3. Report the final token from step 3.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text!.toLowerCase()).toContain('ghi');
    }, 180000);

    it('should handle counter tool with multiple invocations', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
        tools: [counterTool],
      });
      agent.context.tools.disable('context_stats');
      agent.context.tools.disable('memory_store');
      agent.context.tools.disable('memory_retrieve');
      agent.context.tools.disable('memory_delete');
      agent.context.tools.disable('memory_list');

      const response = await agent.run(
        'Use the increment_counter tool three times. First with amount 5, then amount 3, then amount 2. ' +
        'Tell me the final count.'
      );

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text).toMatch(/10/);
      expect(toolCallCount).toBe(10);
    }, 180000);
  });

  describe('Direct calls (runDirect / streamDirect)', () => {
    it('should handle runDirect without context management', async () => {
      const agent = Agent.create({
        connector: 'ollama-test',
        model: ollamaModel!,
      });

      const response = await agent.runDirect('What is 2 + 2? Answer with just the number.');

      expect(response.status).toBe('completed');
      expect(response.output_text).toBeDefined();
      expect(response.output_text).toContain('4');
    }, 120000);
  });
});
