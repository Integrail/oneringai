/**
 * Tests for generic thinking/reasoning support across all vendors
 */

import { describe, it, expect } from 'vitest';
import {
  ContentType,
  StreamEventType,
  StreamState,
  MessageRole,
} from '../../../src/index.js';
import type { ThinkingContent } from '../../../src/index.js';
import { AnthropicConverter } from '../../../src/infrastructure/providers/anthropic/AnthropicConverter.js';
import { AnthropicStreamConverter } from '../../../src/infrastructure/providers/anthropic/AnthropicStreamConverter.js';
import { GoogleConverter } from '../../../src/infrastructure/providers/google/GoogleConverter.js';
import { GoogleStreamConverter } from '../../../src/infrastructure/providers/google/GoogleStreamConverter.js';
import { OpenAIResponsesConverter } from '../../../src/infrastructure/providers/openai/OpenAIResponsesConverter.js';
import { StreamHelpers } from '../../../src/capabilities/agents/StreamHelpers.js';
import { AgentContextNextGen } from '../../../src/core/context-nextgen/AgentContextNextGen.js';
import { validateThinkingConfig } from '../../../src/infrastructure/providers/shared/validateThinkingConfig.js';

// ============================================================================
// Content Types
// ============================================================================

describe('ThinkingContent', () => {
  it('should have THINKING content type', () => {
    expect(ContentType.THINKING).toBe('thinking');
  });

  it('should create ThinkingContent with persistInHistory true (Anthropic)', () => {
    const content: ThinkingContent = {
      type: ContentType.THINKING,
      thinking: 'Let me analyze this...',
      signature: 'abc123',
      persistInHistory: true,
    };
    expect(content.type).toBe(ContentType.THINKING);
    expect(content.thinking).toBe('Let me analyze this...');
    expect(content.signature).toBe('abc123');
    expect(content.persistInHistory).toBe(true);
  });

  it('should create ThinkingContent with persistInHistory false (OpenAI/Google)', () => {
    const content: ThinkingContent = {
      type: ContentType.THINKING,
      thinking: 'Reasoning step 1...',
      persistInHistory: false,
    };
    expect(content.persistInHistory).toBe(false);
    expect(content.signature).toBeUndefined();
  });
});

// ============================================================================
// StreamState - Reasoning Buffers
// ============================================================================

describe('StreamState reasoning buffers', () => {
  it('should accumulate reasoning deltas', () => {
    const state = new StreamState('resp_1', 'test-model');

    state.accumulateReasoningDelta('item_1', 'Step 1: ');
    state.accumulateReasoningDelta('item_1', 'analyze the problem.');

    expect(state.getCompleteReasoning('item_1')).toBe('Step 1: analyze the problem.');
    expect(state.hasReasoning()).toBe(true);
  });

  it('should handle multiple reasoning items', () => {
    const state = new StreamState('resp_1', 'test-model');

    state.accumulateReasoningDelta('item_1', 'First thought.');
    state.accumulateReasoningDelta('item_2', 'Second thought.');

    expect(state.getAllReasoning()).toBe('First thought.Second thought.');
  });

  it('should return empty string for missing reasoning item', () => {
    const state = new StreamState('resp_1', 'test-model');
    expect(state.getCompleteReasoning('nonexistent')).toBe('');
    expect(state.hasReasoning()).toBe(false);
  });

  it('should clear reasoning buffers', () => {
    const state = new StreamState('resp_1', 'test-model');
    state.accumulateReasoningDelta('item_1', 'thinking...');
    expect(state.hasReasoning()).toBe(true);

    state.clear();
    expect(state.hasReasoning()).toBe(false);
  });

  it('should include reasoning buffers in snapshot', () => {
    const state = new StreamState('resp_1', 'test-model');
    state.accumulateReasoningDelta('item_1', 'thinking...');

    const snapshot = state.createSnapshot();
    expect(snapshot.reasoningBuffers).toBeDefined();
    expect(snapshot.reasoningBuffers.size).toBe(1);
  });
});

// ============================================================================
// Stream Events
// ============================================================================

describe('Reasoning stream events', () => {
  it('should have REASONING_DELTA and REASONING_DONE event types', () => {
    expect(StreamEventType.REASONING_DELTA).toBe('response.reasoning.delta');
    expect(StreamEventType.REASONING_DONE).toBe('response.reasoning.done');
  });
});

// ============================================================================
// Anthropic Converter
// ============================================================================

describe('AnthropicConverter thinking', () => {
  const converter = new AnthropicConverter();

  it('should add thinking config to request when thinking.enabled', () => {
    const request = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input: 'Solve this math problem',
      thinking: { enabled: true, budgetTokens: 15000 },
    });

    expect((request as any).thinking).toEqual({
      type: 'enabled',
      budget_tokens: 15000,
    });
    // Anthropic requires temperature=1 with thinking
    expect(request.temperature).toBe(1);
  });

  it('should default budgetTokens to 10000', () => {
    const request = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input: 'Test',
      thinking: { enabled: true },
    });

    expect((request as any).thinking.budget_tokens).toBe(10000);
  });

  it('should not add thinking config when thinking is disabled', () => {
    const request = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input: 'Test',
      temperature: 0.5,
    });

    expect((request as any).thinking).toBeUndefined();
    expect(request.temperature).toBe(0.5);
  });

  it('should convert thinking blocks in response', () => {
    const response = {
      id: 'msg_123',
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'thinking',
          thinking: 'Let me reason about this...',
          signature: 'sig_abc123',
        },
        {
          type: 'text',
          text: 'The answer is 42.',
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    const result = converter.convertResponse(response as any);
    const content = result.output[0]?.content || [];

    // Should have thinking + text content
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe(ContentType.THINKING);
    const thinking = content[0] as ThinkingContent;
    expect(thinking.thinking).toBe('Let me reason about this...');
    expect(thinking.signature).toBe('sig_abc123');
    expect(thinking.persistInHistory).toBe(true);
    expect(content[1].type).toBe(ContentType.OUTPUT_TEXT);
  });

  it('should round-trip thinking blocks in requests', () => {
    // Simulate a conversation with thinking content in history
    const request = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: ContentType.THINKING,
              thinking: 'Previous reasoning...',
              signature: 'sig_old',
              persistInHistory: true,
            },
            {
              type: ContentType.OUTPUT_TEXT,
              text: 'Previous answer',
            },
          ],
        },
        {
          type: 'message',
          role: 'user',
          content: [
            { type: ContentType.INPUT_TEXT, text: 'Follow up question' },
          ],
        },
      ],
      thinking: { enabled: true },
    });

    // The thinking block should be converted to Anthropic format
    const assistantMsg = request.messages[0];
    expect(assistantMsg.role).toBe('assistant');
    const blocks = assistantMsg.content as any[];
    expect(blocks[0].type).toBe('thinking');
    expect(blocks[0].thinking).toBe('Previous reasoning...');
    expect(blocks[0].signature).toBe('sig_old');
  });
});

// ============================================================================
// Anthropic Stream Converter
// ============================================================================

describe('AnthropicStreamConverter thinking', () => {
  it('should emit REASONING_DELTA and REASONING_DONE for thinking blocks', async () => {
    const converter = new AnthropicStreamConverter();

    const events: any[] = [
      { type: 'message_start', message: { id: 'msg_1', usage: { input_tokens: 10 }, model: 'claude-sonnet-4-5-20250929', role: 'assistant', content: [], type: 'message', stop_reason: null, stop_sequence: null } },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Step 1: ' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'analyze.' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Result: 42' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 30 } },
      { type: 'message_stop' },
    ];

    async function* mockStream() {
      for (const e of events) yield e;
    }

    const result: any[] = [];
    for await (const event of converter.convertStream(mockStream() as any)) {
      result.push(event);
    }

    // Check for reasoning events
    const reasoningDeltas = result.filter(e => e.type === StreamEventType.REASONING_DELTA);
    expect(reasoningDeltas).toHaveLength(2);
    expect(reasoningDeltas[0].delta).toBe('Step 1: ');
    expect(reasoningDeltas[1].delta).toBe('analyze.');

    const reasoningDone = result.filter(e => e.type === StreamEventType.REASONING_DONE);
    expect(reasoningDone).toHaveLength(1);
    expect(reasoningDone[0].thinking).toBe('Step 1: analyze.');

    // Check for text events
    const textDeltas = result.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0].delta).toBe('Result: 42');
  });
});

// ============================================================================
// OpenAI Converter
// ============================================================================

describe('OpenAIResponsesConverter thinking', () => {
  const converter = new OpenAIResponsesConverter();

  it('should extract ThinkingContent from reasoning summary (string)', () => {
    const response = {
      id: 'resp_1',
      object: 'response',
      created_at: 1234567890,
      status: 'completed',
      model: 'gpt-5.2-thinking',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          summary: 'Let me think step by step...',
          status: 'completed',
        },
        {
          type: 'message',
          id: 'msg_1',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'The answer.', annotations: [] }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = converter.convertResponse(response as any);
    const content = result.output[0]?.content || [];

    // Should have: thinking + output_text
    const thinkingContent = content.find((c: any) => c.type === ContentType.THINKING) as any;
    expect(thinkingContent).toBeDefined();
    expect(thinkingContent.thinking).toBe('Let me think step by step...');
    expect(thinkingContent.persistInHistory).toBe(false);
  });

  it('should extract ThinkingContent from reasoning summary (array)', () => {
    const response = {
      id: 'resp_1',
      object: 'response',
      created_at: 1234567890,
      status: 'completed',
      model: 'gpt-5.2-thinking',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          summary: [
            { type: 'summary_text', text: 'Step 1: Understand the problem.' },
            { type: 'summary_text', text: 'Step 2: Solve it.' },
          ],
          status: 'completed',
        },
        {
          type: 'message',
          id: 'msg_1',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Done.', annotations: [] }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = converter.convertResponse(response as any);
    const content = result.output[0]?.content || [];

    const thinkingContent = content.find((c: any) => c.type === ContentType.THINKING) as any;
    expect(thinkingContent).toBeDefined();
    expect(thinkingContent.thinking).toBe('Step 1: Understand the problem.\nStep 2: Solve it.');
  });

  it('should skip ThinkingContent in convertInput (OpenAI manages reasoning internally)', () => {
    const result = converter.convertInput([
      {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: ContentType.THINKING,
            thinking: 'Previous reasoning',
            persistInHistory: false,
          } as any,
          {
            type: ContentType.OUTPUT_TEXT,
            text: 'Previous answer',
          } as any,
        ],
      },
    ]);

    // ThinkingContent should NOT be in the output (OpenAI manages reasoning internally)
    const items = result.input as any[];
    const msgItem = items.find((i: any) => i.type === 'message');
    // Only output_text should be there, not thinking
    expect(msgItem.content).toHaveLength(1);
    expect(msgItem.content[0].type).toBe('output_text');
  });
});

// ============================================================================
// Google Converter
// ============================================================================

describe('GoogleConverter thinking', () => {
  it('should add thinkingConfig to request when thinking.enabled', async () => {
    const converter = new GoogleConverter();
    const request = await converter.convertRequest({
      model: 'gemini-3-pro',
      input: 'Solve this',
      thinking: { enabled: true, budgetTokens: 16384 },
    });

    expect(request.generationConfig.thinkingConfig).toEqual({
      thinkingBudget: 16384,
    });
  });

  it('should prefer vendorOptions.thinkingLevel over thinking option', async () => {
    const converter = new GoogleConverter();
    const request = await converter.convertRequest({
      model: 'gemini-3-pro',
      input: 'Test',
      thinking: { enabled: true, budgetTokens: 8192 },
      vendorOptions: { thinkingLevel: 'high' },
    });

    // vendorOptions should take precedence
    expect(request.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'high',
    });
  });

  it('should convert thought parts in response to ThinkingContent', () => {
    const converter = new GoogleConverter();
    const response = {
      candidates: [{
        content: {
          parts: [
            { text: 'Internal reasoning...', thought: true },
            { text: 'The final answer.' },
          ],
        },
        finishReason: 'STOP',
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    };

    const result = converter.convertResponse(response);
    const content = result.output[0]?.content || [];

    expect(content).toHaveLength(2);
    expect(content[0].type).toBe(ContentType.THINKING);
    expect((content[0] as any).thinking).toBe('Internal reasoning...');
    expect((content[0] as any).persistInHistory).toBe(false);
    expect(content[1].type).toBe(ContentType.OUTPUT_TEXT);
  });
});

// ============================================================================
// Google Stream Converter
// ============================================================================

describe('GoogleStreamConverter thinking', () => {
  it('should emit REASONING_DELTA for thought parts and REASONING_DONE on transition', async () => {
    const converter = new GoogleStreamConverter();

    const chunks = [
      {
        candidates: [{
          content: {
            parts: [{ text: 'Thinking step 1...', thought: true }],
          },
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
      {
        candidates: [{
          content: {
            parts: [{ text: 'The answer is 42.' }],
          },
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      },
    ];

    async function* mockStream() {
      for (const c of chunks) yield c;
    }

    const result: any[] = [];
    for await (const event of converter.convertStream(mockStream() as any, 'gemini-3-pro')) {
      result.push(event);
    }

    // Should have: RESPONSE_CREATED, REASONING_DELTA, REASONING_DONE, OUTPUT_TEXT_DELTA, RESPONSE_COMPLETE
    const reasoningDeltas = result.filter(e => e.type === StreamEventType.REASONING_DELTA);
    expect(reasoningDeltas).toHaveLength(1);
    expect(reasoningDeltas[0].delta).toBe('Thinking step 1...');

    const reasoningDone = result.filter(e => e.type === StreamEventType.REASONING_DONE);
    expect(reasoningDone).toHaveLength(1);
    expect(reasoningDone[0].thinking).toBe('Thinking step 1...');

    const textDeltas = result.filter(e => e.type === StreamEventType.OUTPUT_TEXT_DELTA);
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0].delta).toBe('The answer is 42.');
  });

  it('should emit REASONING_DONE at end of stream if still in thinking mode', async () => {
    const converter = new GoogleStreamConverter();

    const chunks = [
      {
        candidates: [{
          content: {
            parts: [{ text: 'Only thinking...', thought: true }],
          },
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
    ];

    async function* mockStream() {
      for (const c of chunks) yield c;
    }

    const result: any[] = [];
    for await (const event of converter.convertStream(mockStream() as any, 'gemini-3-pro')) {
      result.push(event);
    }

    const reasoningDone = result.filter(e => e.type === StreamEventType.REASONING_DONE);
    expect(reasoningDone).toHaveLength(1);
    expect(reasoningDone[0].thinking).toBe('Only thinking...');
  });
});

// ============================================================================
// StreamHelpers
// ============================================================================

describe('StreamHelpers thinking utilities', () => {

  it('thinkingOnly should yield only reasoning deltas', async () => {
    async function* mockStream() {
      yield { type: StreamEventType.RESPONSE_CREATED, response_id: 'r1', model: 'test', created_at: Date.now() };
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Think ', sequence_number: 0 };
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'hard.', sequence_number: 1 };
      yield { type: StreamEventType.OUTPUT_TEXT_DELTA, response_id: 'r1', item_id: 'i2', output_index: 0, content_index: 0, delta: 'Answer', sequence_number: 2 };
    }

    const chunks: string[] = [];
    for await (const delta of StreamHelpers.thinkingOnly(mockStream())) {
      chunks.push(delta);
    }
    expect(chunks).toEqual(['Think ', 'hard.']);
  });

  it('textAndThinking should yield tagged objects', async () => {
    async function* mockStream() {
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Think', sequence_number: 0 };
      yield { type: StreamEventType.OUTPUT_TEXT_DELTA, response_id: 'r1', item_id: 'i2', output_index: 0, content_index: 0, delta: 'Answer', sequence_number: 1 };
    }

    const results: any[] = [];
    for await (const item of StreamHelpers.textAndThinking(mockStream())) {
      results.push(item);
    }
    expect(results).toEqual([
      { type: 'thinking', delta: 'Think' },
      { type: 'text', delta: 'Answer' },
    ]);
  });

  it('accumulateThinking should return complete thinking string', async () => {
    async function* mockStream() {
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Step 1. ', sequence_number: 0 };
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Step 2.', sequence_number: 1 };
      yield { type: StreamEventType.OUTPUT_TEXT_DELTA, response_id: 'r1', item_id: 'i2', output_index: 0, content_index: 0, delta: 'Answer', sequence_number: 2 };
    }

    const result = await StreamHelpers.accumulateThinking(mockStream());
    expect(result).toBe('Step 1. Step 2.');
  });
});

// ============================================================================
// Phase 3 Tests: Bug Fixes & Enterprise Robustness
// ============================================================================

describe('StreamHelpers.collectResponse with thinking', () => {
  it('should include thinking content in reconstructed response', async () => {
    async function* mockStream() {
      yield { type: StreamEventType.RESPONSE_CREATED, response_id: 'r1', model: 'test', created_at: Date.now() };
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Let me think...', sequence_number: 0 };
      yield { type: StreamEventType.REASONING_DONE, response_id: 'r1', item_id: 'i1', thinking: 'Let me think...' };
      yield { type: StreamEventType.OUTPUT_TEXT_DELTA, response_id: 'r1', item_id: 'i2', output_index: 0, content_index: 0, delta: 'The answer is 42.', sequence_number: 1 };
      yield { type: StreamEventType.RESPONSE_COMPLETE, response_id: 'r1', status: 'completed', usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }, iterations: 1 };
    }

    const response = await StreamHelpers.collectResponse(mockStream());

    // Should have thinking in content
    const thinkingContent = response.output[0]?.content?.find((c: any) => c.type === ContentType.THINKING);
    expect(thinkingContent).toBeDefined();
    expect((thinkingContent as any).thinking).toBe('Let me think...');

    // Should have text in content
    const textContent = response.output[0]?.content?.find((c: any) => c.type === ContentType.OUTPUT_TEXT);
    expect(textContent).toBeDefined();

    // Should have convenience thinking field
    expect(response.thinking).toBe('Let me think...');
    expect(response.output_text).toBe('The answer is 42.');
  });

  it('should handle reasoning-only response (no text)', async () => {
    async function* mockStream() {
      yield { type: StreamEventType.RESPONSE_CREATED, response_id: 'r1', model: 'test', created_at: Date.now() };
      yield { type: StreamEventType.REASONING_DELTA, response_id: 'r1', item_id: 'i1', delta: 'Deep thought...', sequence_number: 0 };
      yield { type: StreamEventType.REASONING_DONE, response_id: 'r1', item_id: 'i1', thinking: 'Deep thought...' };
      yield { type: StreamEventType.RESPONSE_COMPLETE, response_id: 'r1', status: 'completed', usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15 }, iterations: 1 };
    }

    const response = await StreamHelpers.collectResponse(mockStream());
    expect(response.thinking).toBe('Deep thought...');
    expect(response.output[0]?.content?.length).toBe(1);
    expect(response.output[0]?.content?.[0]?.type).toBe(ContentType.THINKING);
  });
});

describe('AgentContextNextGen.lastThinking lifecycle', () => {
  it('should be null initially', () => {
    const ctx = AgentContextNextGen.create({
      model: 'gpt-4',
      features: { workingMemory: false },
    });
    expect(ctx.lastThinking).toBeNull();
    ctx.destroy();
  });

  it('should be set after addAssistantResponse with thinking', () => {
    const ctx = AgentContextNextGen.create({
      model: 'gpt-4',
      features: { workingMemory: false },
    });

    ctx.addUserMessage('Hello');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.THINKING, thinking: 'Analyzing...', persistInHistory: true },
        { type: ContentType.OUTPUT_TEXT, text: 'Hi!' },
      ],
    }]);

    expect(ctx.lastThinking).toBe('Analyzing...');
    ctx.destroy();
  });

  it('should be null after addAssistantResponse without thinking', () => {
    const ctx = AgentContextNextGen.create({
      model: 'gpt-4',
      features: { workingMemory: false },
    });

    // First turn with thinking
    ctx.addUserMessage('Hello');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.THINKING, thinking: 'Thinking...', persistInHistory: false },
        { type: ContentType.OUTPUT_TEXT, text: 'Response 1' },
      ],
    }]);
    expect(ctx.lastThinking).toBe('Thinking...');

    // Second turn without thinking
    ctx.addUserMessage('Follow up');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.OUTPUT_TEXT, text: 'Response 2' },
      ],
    }]);
    expect(ctx.lastThinking).toBeNull();
    ctx.destroy();
  });

  it('should be reset at start of prepare()', async () => {
    const ctx = AgentContextNextGen.create({
      model: 'gpt-4',
      features: { workingMemory: false },
    });

    ctx.addUserMessage('Hello');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.THINKING, thinking: 'Old thinking', persistInHistory: false },
        { type: ContentType.OUTPUT_TEXT, text: 'Response' },
      ],
    }]);
    expect(ctx.lastThinking).toBe('Old thinking');

    // prepare() should reset lastThinking
    ctx.addUserMessage('Next question');
    await ctx.prepare();
    expect(ctx.lastThinking).toBeNull();
    ctx.destroy();
  });
});

describe('Anthropic signature round-trip', () => {
  it('should preserve signature in non-streaming round-trip', () => {
    const converter = new AnthropicConverter();

    // Simulate Anthropic response with thinking + signature
    const content = converter['convertProviderContent']([
      { type: 'thinking', thinking: 'Step 1...', signature: 'sig_abc123' },
      { type: 'text', text: 'The answer.' },
    ]);

    const thinking = content.find(c => c.type === ContentType.THINKING) as ThinkingContent;
    expect(thinking.signature).toBe('sig_abc123');
    expect(thinking.persistInHistory).toBe(true);

    // Convert back to Anthropic format
    const blocks = converter['convertContent'](content);
    const thinkingBlock = (blocks as any[]).find((b: any) => b.type === 'thinking');
    expect(thinkingBlock).toBeDefined();
    expect(thinkingBlock.signature).toBe('sig_abc123');
  });

  it('should skip thinking blocks without signature in convertContent', () => {
    const converter = new AnthropicConverter();

    // Simulate streaming thinking (no signature) + text
    const content = [
      { type: ContentType.THINKING, thinking: 'Streaming thought', persistInHistory: true },
      { type: ContentType.OUTPUT_TEXT, text: 'Answer' },
    ];

    const result = converter['convertContent'](content as any[]);
    // When thinking is skipped and only one text block remains, convertContent returns a string
    if (typeof result === 'string') {
      // Only the text block survived — no thinking block (correct!)
      expect(result).toBe('Answer');
    } else {
      // Array of blocks — thinking should not be present
      const thinkingBlock = (result as any[]).find((b: any) => b.type === 'thinking');
      expect(thinkingBlock).toBeUndefined();
    }
  });
});

describe('OpenAI no duplicate content', () => {
  it('should only produce ThinkingContent, not legacy reasoning item', () => {
    const converter = new OpenAIResponsesConverter();
    const response = {
      id: 'resp_1',
      object: 'response',
      created_at: 1234567890,
      status: 'completed',
      model: 'gpt-5.2',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          summary: 'Step by step analysis...',
          status: 'completed',
        },
        {
          type: 'message',
          id: 'msg_1',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Answer.', annotations: [] }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = converter.convertResponse(response as any);
    const content = result.output[0]?.content || [];

    // Should have exactly 2 items: thinking + output_text
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe(ContentType.THINKING);
    expect(content[1].type).toBe('output_text');

    // No legacy 'reasoning' item
    const legacyReasoning = content.find((c: any) => c.type === 'reasoning');
    expect(legacyReasoning).toBeUndefined();

    // Convenience thinking field
    expect(result.thinking).toBe('Step by step analysis...');
  });
});

describe('Thinking + tool calls together', () => {
  it('should handle thinking followed by tool call in OpenAI response', () => {
    const converter = new OpenAIResponsesConverter();
    const response = {
      id: 'resp_1',
      object: 'response',
      created_at: 1234567890,
      status: 'completed',
      model: 'gpt-5.2',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          summary: 'I need to look this up.',
          status: 'completed',
        },
        {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_abc',
          name: 'search',
          arguments: '{"query":"test"}',
          status: 'completed',
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    const result = converter.convertResponse(response as any);
    const content = result.output[0]?.content || [];

    // Should have thinking + tool_use
    const thinking = content.find((c: any) => c.type === ContentType.THINKING);
    expect(thinking).toBeDefined();
    const toolUse = content.find((c: any) => c.type === 'tool_use');
    expect(toolUse).toBeDefined();
    expect(result.thinking).toBe('I need to look this up.');
  });
});

describe('Multi-turn thinking persistence', () => {
  it('should persist Anthropic thinking in conversation history', () => {
    const ctx = AgentContextNextGen.create({
      model: 'claude-4.5-sonnet',
      features: { workingMemory: false },
    });

    ctx.addUserMessage('Solve this');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.THINKING, thinking: 'Let me analyze...', signature: 'sig_1', persistInHistory: true },
        { type: ContentType.OUTPUT_TEXT, text: 'Here is the answer.' },
      ],
    }]);

    const conversation = ctx.getConversation();
    const assistantMsg = conversation.find((m: any) => m.role === MessageRole.ASSISTANT);
    const thinkingInHistory = assistantMsg?.content?.find((c: any) => c.type === ContentType.THINKING);
    expect(thinkingInHistory).toBeDefined();
    ctx.destroy();
  });

  it('should NOT persist OpenAI/Google thinking in conversation history', () => {
    const ctx = AgentContextNextGen.create({
      model: 'gpt-5.2',
      features: { workingMemory: false },
    });

    ctx.addUserMessage('Solve this');
    ctx.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [
        { type: ContentType.THINKING, thinking: 'Internal reasoning...', persistInHistory: false },
        { type: ContentType.OUTPUT_TEXT, text: 'Here is the answer.' },
      ],
    }]);

    const conversation = ctx.getConversation();
    const assistantMsg = conversation.find((m: any) => m.role === MessageRole.ASSISTANT);
    const thinkingInHistory = assistantMsg?.content?.find((c: any) => c.type === ContentType.THINKING);
    expect(thinkingInHistory).toBeUndefined();

    // But lastThinking should still be available
    expect(ctx.lastThinking).toBe('Internal reasoning...');
    ctx.destroy();
  });
});

describe('Thinking config validation', () => {
  it('should accept valid config', () => {
    expect(() => validateThinkingConfig({ enabled: true, budgetTokens: 10000 })).not.toThrow();
    expect(() => validateThinkingConfig({ enabled: true, effort: 'high' })).not.toThrow();
    expect(() => validateThinkingConfig({ enabled: false })).not.toThrow();
  });

  it('should reject invalid budgetTokens', () => {
    expect(() => validateThinkingConfig({ enabled: true, budgetTokens: -1 })).toThrow('Invalid thinking budgetTokens');
    expect(() => validateThinkingConfig({ enabled: true, budgetTokens: 0 })).toThrow('Invalid thinking budgetTokens');
  });

  it('should reject invalid effort', () => {
    expect(() => validateThinkingConfig({ enabled: true, effort: 'invalid' })).toThrow('Invalid thinking effort');
    expect(() => validateThinkingConfig({ enabled: true, effort: 'MEDIUM' })).toThrow('Invalid thinking effort');
  });

  it('should skip validation when not enabled', () => {
    // Even invalid values are OK when not enabled
    expect(() => validateThinkingConfig({ enabled: false, budgetTokens: -1 })).not.toThrow();
  });
});

describe('LLMResponse thinking convenience field', () => {
  it('should populate thinking field from Anthropic response', () => {
    const converter = new AnthropicConverter();
    const response = converter.convertResponse({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-4.5-sonnet',
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: 'Deep analysis...', signature: 'sig_x' },
        { type: 'text', text: 'Result.' },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    } as any);

    expect(response.thinking).toBe('Deep analysis...');
    expect(response.output_text).toBe('Result.');
  });

  it('should not have thinking field when no thinking content', () => {
    const converter = new AnthropicConverter();
    const response = converter.convertResponse({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-4.5-sonnet',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'Simple response.' },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    } as any);

    expect(response.thinking).toBeUndefined();
    expect(response.output_text).toBe('Simple response.');
  });
});
