/**
 * Tests for image token counting in AgentContextNextGen
 *
 * Verifies:
 * 1. __images are separated from text content in addToolResults()
 * 2. Image tokens are counted using estimateImageTokens(), not text estimation
 * 3. emergencyToolResultsTruncation preserves __images
 * 4. INPUT_IMAGE_URL uses estimateImageTokens()
 */

import { describe, it, expect } from 'vitest';
import { AgentContextNextGen } from '../../../src/core/context-nextgen/AgentContextNextGen.js';
import { ContentType } from '../../../src/domain/entities/Content.js';
import type { ToolResult } from '../../../src/domain/entities/Tool.js';

describe('Image token counting in AgentContextNextGen', () => {
  function createContext(maxTokens = 128000) {
    return AgentContextNextGen.create({
      model: 'gpt-4',
      maxContextTokens: maxTokens,
    });
  }

  describe('addToolResults() - __images separation', () => {
    it('should strip __images and base64 from content string', () => {
      const ctx = createContext();

      const toolResult: ToolResult = {
        tool_use_id: 'call_1',
        content: {
          success: true,
          width: 1920,
          height: 1080,
          base64: 'iVBORw0KGgoAAAANSUhEUg==',
          __images: [{ base64: 'iVBORw0KGgoAAAANSUhEUg==', mediaType: 'image/png' }],
        },
        state: 'completed',
      };

      ctx.addToolResults([toolResult]);

      // Get the current input and inspect the stored content
      const input = (ctx as any)._currentInput;
      expect(input).toHaveLength(1);
      const msg = input[0];
      expect(msg.content).toHaveLength(1);

      const stored = msg.content[0];
      expect(stored.type).toBe(ContentType.TOOL_RESULT);

      // Text content should NOT contain __images or base64
      expect(stored.content).not.toContain('__images');
      expect(stored.content).not.toContain('iVBORw0KGgo');

      // Images should be stored separately on the content object
      expect(stored.__images).toBeDefined();
      expect(stored.__images).toHaveLength(1);
      expect(stored.__images[0].base64).toBe('iVBORw0KGgoAAAANSUhEUg==');
      expect(stored.__images[0].mediaType).toBe('image/png');

      // Text content should still have success and dimensions
      const parsed = JSON.parse(stored.content);
      expect(parsed.success).toBe(true);
      expect(parsed.width).toBe(1920);
      expect(parsed.height).toBe(1080);
    });

    it('should not modify tool results without __images', () => {
      const ctx = createContext();

      const toolResult: ToolResult = {
        tool_use_id: 'call_2',
        content: { success: true, x: 100, y: 200 },
        state: 'completed',
      };

      ctx.addToolResults([toolResult]);

      const input = (ctx as any)._currentInput;
      const stored = input[0].content[0];
      expect(stored.__images).toBeUndefined();

      const parsed = JSON.parse(stored.content);
      expect(parsed.success).toBe(true);
      expect(parsed.x).toBe(100);
    });

    it('should handle string content unchanged', () => {
      const ctx = createContext();

      const toolResult: ToolResult = {
        tool_use_id: 'call_3',
        content: 'plain text result',
        state: 'completed',
      };

      ctx.addToolResults([toolResult]);

      const input = (ctx as any)._currentInput;
      const stored = input[0].content[0];
      expect(stored.content).toBe('plain text result');
      expect(stored.__images).toBeUndefined();
    });
  });

  describe('Token estimation for images', () => {
    it('should count __images as image tokens, not text tokens', () => {
      const ctx = createContext();

      // Create a large base64 string (~100KB) that would be ~28,000 text tokens
      const largeBase64 = 'A'.repeat(100_000);

      const toolResultWithImages: ToolResult = {
        tool_use_id: 'call_img',
        content: {
          success: true,
          width: 1920,
          height: 1080,
          base64: largeBase64,
          __images: [{ base64: largeBase64, mediaType: 'image/png' }],
        },
        state: 'completed',
      };

      ctx.addToolResults([toolResultWithImages]);

      // The stored content string should NOT contain the large base64
      const input = (ctx as any)._currentInput;
      const stored = input[0].content[0];
      expect(stored.content.length).toBeLessThan(500); // Just JSON metadata

      // Estimate tokens for the input
      const tokens = (ctx as any).calculateInputTokens(input);

      // Should be MUCH less than what text-counting the base64 would produce
      // 100KB base64 / 3.5 chars = ~28,571 tokens if counted as text
      // Image should be ~1000 tokens (default) + small JSON metadata
      expect(tokens).toBeLessThan(2000);
    });

    it('should use estimateImageTokens for INPUT_IMAGE_URL', () => {
      const ctx = createContext();

      // Manually add a message with an image URL
      const msg = {
        type: 'message' as const,
        id: 'test',
        role: 'user' as const,
        content: [
          {
            type: ContentType.INPUT_IMAGE_URL,
            image_url: { url: 'https://example.com/img.png', detail: 'low' },
          },
        ],
      };

      const tokens = (ctx as any).estimateItemTokens(msg);
      // detail='low' should be ~85 tokens, not the old hardcoded 200
      expect(tokens).toBeLessThanOrEqual(100); // 85 + 4 overhead
    });

    it('should use tile-based estimation for high detail images', () => {
      const ctx = createContext();

      const msg = {
        type: 'message' as const,
        id: 'test',
        role: 'user' as const,
        content: [
          {
            type: ContentType.INPUT_IMAGE_URL,
            image_url: { url: 'https://example.com/img.png', detail: 'high' },
          },
        ],
      };

      const tokens = (ctx as any).estimateItemTokens(msg);
      // Unknown dimensions but high detail → default 1000 tokens + 4 overhead
      expect(tokens).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Oversized input handling with images', () => {
    it('should not reject tool results with __images as binary', () => {
      // Create a very small context to force oversized handling
      const ctx = createContext(2000);

      const toolResult: ToolResult = {
        tool_use_id: 'call_img',
        content: {
          success: true,
          width: 1920,
          height: 1080,
          base64: 'iVBORw0KGgo=',
          __images: [{ base64: 'iVBORw0KGgo=', mediaType: 'image/png' }],
        },
        state: 'completed',
      };

      ctx.addToolResults([toolResult]);

      // Get the stored content - it should have __images separated
      const input = (ctx as any)._currentInput;
      const stored = input[0].content[0];

      // The text content should NOT be binary (base64 was stripped)
      expect(stored.content).not.toContain('iVBORw0KGgo');
      // Images should be preserved
      expect(stored.__images).toHaveLength(1);
    });

    it('should preserve __images during emergency truncation', () => {
      const ctx = createContext();

      // Simulate emergency truncation with a message that has __images
      const msg = {
        type: 'message' as const,
        id: 'test',
        role: 'user' as const,
        content: [
          {
            type: ContentType.TOOL_RESULT,
            tool_use_id: 'call_1',
            content: '{"success": true, "data": "some text result"}',
            __images: [{ base64: 'iVBORw0KGgo=', mediaType: 'image/png' }],
          },
        ],
      };

      const result = (ctx as any).emergencyToolResultsTruncation(msg, 100);
      expect(result.accepted).toBe(true);

      // Images should be preserved in the truncated content
      const truncated = msg.content[0] as any;
      expect(truncated.__images).toBeDefined();
      expect(truncated.__images).toHaveLength(1);
    });
  });
});

describe('simpleTokenEstimator.estimateImageTokens', () => {
  it('should return 85 for low detail', async () => {
    const { simpleTokenEstimator } = await import('../../../src/core/context-nextgen/BasePluginNextGen.js');
    expect(simpleTokenEstimator.estimateImageTokens!(undefined, undefined, 'low')).toBe(85);
  });

  it('should use tile-based estimation for known dimensions', async () => {
    const { simpleTokenEstimator } = await import('../../../src/core/context-nextgen/BasePluginNextGen.js');
    // 1920x1080: ceil(1920/512) * ceil(1080/512) = 4 * 3 = 12 tiles
    // 85 + 170 * 12 = 2125
    expect(simpleTokenEstimator.estimateImageTokens!(1920, 1080)).toBe(2125);
  });

  it('should return 1000 for unknown dimensions', async () => {
    const { simpleTokenEstimator } = await import('../../../src/core/context-nextgen/BasePluginNextGen.js');
    expect(simpleTokenEstimator.estimateImageTokens!()).toBe(1000);
  });

  it('should handle small images', async () => {
    const { simpleTokenEstimator } = await import('../../../src/core/context-nextgen/BasePluginNextGen.js');
    // 256x256: ceil(256/512) * ceil(256/512) = 1 * 1 = 1 tile
    // 85 + 170 * 1 = 255
    expect(simpleTokenEstimator.estimateImageTokens!(256, 256)).toBe(255);
  });
});
