/**
 * Tests for __images convention in tool results across all provider converters
 */

import { describe, it, expect } from 'vitest';
import { AnthropicConverter } from '../../../src/infrastructure/providers/anthropic/AnthropicConverter.js';
import { OpenAIResponsesConverter } from '../../../src/infrastructure/providers/openai/OpenAIResponsesConverter.js';
import { GoogleConverter } from '../../../src/infrastructure/providers/google/GoogleConverter.js';
import { ContentType } from '../../../src/domain/entities/Content.js';
import { MessageRole } from '../../../src/domain/entities/Message.js';

// Shared test data — JSON fallback path (images embedded in JSON string)
const screenshotToolResult = {
  type: ContentType.TOOL_RESULT,
  tool_use_id: 'call_123',
  content: JSON.stringify({
    success: true,
    width: 2560,
    height: 1600,
    base64: 'iVBORw0KGgo=', // short dummy PNG
    __images: [{ base64: 'iVBORw0KGgo=', mediaType: 'image/png' }],
  }),
};

// Content object path (images pre-extracted by addToolResults)
const screenshotToolResultWithSeparateImages = {
  type: ContentType.TOOL_RESULT,
  tool_use_id: 'call_789',
  content: JSON.stringify({ success: true, width: 2560, height: 1600 }),
  __images: [{ base64: 'iVBORw0KGgo=', mediaType: 'image/png' }],
};

const plainToolResult = {
  type: ContentType.TOOL_RESULT,
  tool_use_id: 'call_456',
  content: JSON.stringify({ success: true, x: 100, y: 200 }),
};

describe('__images convention in Anthropic converter', () => {
  it('should produce multimodal content for tool results with __images', () => {
    const converter = new AnthropicConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResult],
      },
    ];

    const result = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input,
    });

    // Find the tool_result message
    const messages = (result as any).messages;
    const toolResultMsg = messages.find((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'tool_result'),
    );

    if (toolResultMsg) {
      const toolResult = toolResultMsg.content.find((c: any) => c.type === 'tool_result');
      // Should have multimodal content array (text + image)
      expect(Array.isArray(toolResult.content)).toBe(true);
      const textBlock = toolResult.content.find((c: any) => c.type === 'text');
      const imageBlock = toolResult.content.find((c: any) => c.type === 'image');
      expect(textBlock).toBeDefined();
      expect(imageBlock).toBeDefined();
      expect(imageBlock.source.type).toBe('base64');
      expect(imageBlock.source.media_type).toBe('image/png');
      // Text should not contain __images or base64
      expect(textBlock.text).not.toContain('__images');
    }
  });

  it('should read __images from Content object (pre-extracted path)', () => {
    const converter = new AnthropicConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResultWithSeparateImages],
      },
    ];

    const result = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input,
    });

    const messages = (result as any).messages;
    const toolResultMsg = messages.find((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'tool_result'),
    );

    if (toolResultMsg) {
      const toolResult = toolResultMsg.content.find((c: any) => c.type === 'tool_result');
      expect(Array.isArray(toolResult.content)).toBe(true);
      const imageBlock = toolResult.content.find((c: any) => c.type === 'image');
      expect(imageBlock).toBeDefined();
      expect(imageBlock.source.data).toBe('iVBORw0KGgo=');
    }
  });

  it('should not affect plain tool results', () => {
    const converter = new AnthropicConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [plainToolResult],
      },
    ];

    const result = converter.convertRequest({
      model: 'claude-sonnet-4-5-20250929',
      input,
    });

    const messages = (result as any).messages;
    const toolResultMsg = messages.find((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'tool_result'),
    );

    if (toolResultMsg) {
      const toolResult = toolResultMsg.content.find((c: any) => c.type === 'tool_result');
      // Should be plain string content
      expect(typeof toolResult.content).toBe('string');
    }
  });
});

describe('__images convention in OpenAI Responses converter', () => {
  it('should inject follow-up user message with image for tool results with __images', () => {
    const converter = new OpenAIResponsesConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResult],
      },
    ];

    const result = converter.convertInput(input);
    const items = result.input as any[];

    // Should have function_call_output + follow-up user message with image
    const callOutput = items.find((i: any) => i.type === 'function_call_output');
    expect(callOutput).toBeDefined();
    // Output should not contain __images or base64
    expect(callOutput.output).not.toContain('__images');

    // Should have a follow-up user message with input_image
    const userMsg = items.find(
      (i: any) => i.type === 'message' && i.role === 'user' && i.content?.some((c: any) => c.type === 'input_image'),
    );
    expect(userMsg).toBeDefined();
    const imageContent = userMsg.content.find((c: any) => c.type === 'input_image');
    expect(imageContent.image_url).toContain('data:image/png;base64,');
  });

  it('should read __images from Content object (pre-extracted path)', () => {
    const converter = new OpenAIResponsesConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResultWithSeparateImages],
      },
    ];

    const result = converter.convertInput(input);
    const items = result.input as any[];

    const callOutput = items.find((i: any) => i.type === 'function_call_output');
    expect(callOutput).toBeDefined();
    // Output should not contain __images (they're on the Content object, not in JSON)
    expect(callOutput.output).not.toContain('__images');

    const userMsg = items.find(
      (i: any) => i.type === 'message' && i.role === 'user' && i.content?.some((c: any) => c.type === 'input_image'),
    );
    expect(userMsg).toBeDefined();
  });

  it('should not inject extra message for plain tool results', () => {
    const converter = new OpenAIResponsesConverter();
    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [plainToolResult],
      },
    ];

    const result = converter.convertInput(input);
    const items = result.input as any[];

    // Should only have function_call_output, no extra user message
    const userMessages = items.filter(
      (i: any) => i.type === 'message' && i.role === 'user',
    );
    expect(userMessages).toHaveLength(0);
  });
});

describe('__images convention in Google converter', () => {
  it('should add inline data parts for tool results with __images', () => {
    const converter = new GoogleConverter();

    // Register a tool call mapping so the converter can look up the function name
    // Access the private mapping for test purposes
    (converter as any).toolCallMapping.set('call_123', 'desktop_screenshot');

    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResult],
      },
    ];

    const result = converter.convertRequest({
      model: 'gemini-2.5-pro',
      input,
    });

    const contents = (result as any).contents;
    // Find content with functionResponse parts
    const functionResponseContent = contents?.find((c: any) =>
      c.parts?.some((p: any) => p.functionResponse),
    );

    if (functionResponseContent) {
      const parts = functionResponseContent.parts;
      const inlinePart = parts.find((p: any) => p.inlineData);
      expect(inlinePart).toBeDefined();
      expect(inlinePart.inlineData.mimeType).toBe('image/png');
      expect(inlinePart.inlineData.data).toBe('iVBORw0KGgo=');
    }
  });

  it('should read __images from Content object (pre-extracted path)', () => {
    const converter = new GoogleConverter();
    (converter as any).toolCallMapping.set('call_789', 'desktop_screenshot');

    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [screenshotToolResultWithSeparateImages],
      },
    ];

    const result = converter.convertRequest({
      model: 'gemini-2.5-pro',
      input,
    });

    const contents = (result as any).contents;
    const functionResponseContent = contents?.find((c: any) =>
      c.parts?.some((p: any) => p.functionResponse),
    );

    if (functionResponseContent) {
      const parts = functionResponseContent.parts;
      const inlinePart = parts.find((p: any) => p.inlineData);
      expect(inlinePart).toBeDefined();
      expect(inlinePart.inlineData.data).toBe('iVBORw0KGgo=');
    }
  });

  it('should not add inline data for plain tool results', () => {
    const converter = new GoogleConverter();
    (converter as any).toolCallMapping.set('call_456', 'desktop_mouse_click');

    const input = [
      {
        type: 'message' as const,
        id: 'msg_1',
        role: MessageRole.USER,
        content: [plainToolResult],
      },
    ];

    const result = converter.convertRequest({
      model: 'gemini-2.5-pro',
      input,
    });

    const contents = (result as any).contents;
    const functionResponseContent = contents?.find((c: any) =>
      c.parts?.some((p: any) => p.functionResponse),
    );

    if (functionResponseContent) {
      const parts = functionResponseContent.parts;
      const inlinePart = parts.find((p: any) => p.inlineData);
      expect(inlinePart).toBeUndefined();
    }
  });
});
