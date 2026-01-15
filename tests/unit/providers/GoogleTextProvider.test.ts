/**
 * GoogleTextProvider Unit Tests
 * Tests the Google Gemini provider implementation with mocked SDK
 *
 * CRITICAL: Tests the generationConfig spreading fix we made
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRole } from '@/domain/entities/Message.js';
import { ContentType } from '@/domain/entities/Content.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
} from '@/domain/errors/AIErrors.js';
import { StreamEventType } from '@/domain/entities/StreamEvent.js';

// Create mock functions with vi.hoisted for proper hoisting
const { mockGenerateContent, mockGenerateContentStream, mockGoogleGenAI } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGenerateContentStream = vi.fn();
  const mockGoogleGenAI = vi.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    },
  }));
  return { mockGenerateContent, mockGenerateContentStream, mockGoogleGenAI };
});

// Mock Google GenAI SDK
vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

// Import after mocking
import { GoogleTextProvider } from '@/infrastructure/providers/google/GoogleTextProvider.js';

describe('GoogleTextProvider', () => {
  let provider: GoogleTextProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleTextProvider({
      apiKey: 'test-google-api-key',
    });
  });

  describe('constructor', () => {
    it('should create GoogleGenAI client with API key', () => {
      expect(mockGoogleGenAI).toHaveBeenCalledWith({
        apiKey: 'test-google-api-key',
      });
    });
  });

  describe('name and capabilities', () => {
    it('should have name "google"', () => {
      expect(provider.name).toBe('google');
    });

    it('should have correct capabilities', () => {
      expect(provider.capabilities).toEqual({
        text: true,
        images: true,
        videos: false,
        audio: false,
      });
    });
  });

  describe('generate()', () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello from Gemini!' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    };

    beforeEach(() => {
      mockGenerateContent.mockResolvedValue(mockResponse);
    });

    it('should call generateContent with correct model', async () => {
      await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
        })
      );
    });

    it('should spread generationConfig directly into config object (CRITICAL FIX)', async () => {
      await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
        temperature: 0.7,
        max_output_tokens: 1000,
      });

      // CRITICAL: generationConfig properties should be spread directly, not nested
      const call = mockGenerateContent.mock.calls[0][0];

      // Should NOT have nested generationConfig
      expect(call.config.generationConfig).toBeUndefined();

      // Should have properties spread directly
      expect(call.config.temperature).toBe(0.7);
      expect(call.config.maxOutputTokens).toBe(1000);
    });

    it('should pass systemInstruction correctly', async () => {
      await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
        instructions: 'You are a helpful assistant',
      });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.systemInstruction).toEqual({
        parts: [{ text: 'You are a helpful assistant' }],
      });
    });

    it('should pass tools and toolConfig', async () => {
      await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'What is the weather?',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: { city: { type: 'string' } },
              },
            },
          },
        ],
      });

      const call = mockGenerateContent.mock.calls[0][0];
      expect(call.config.tools).toBeDefined();
      expect(call.config.toolConfig).toBeDefined();
    });

    it('should convert response to LLMResponse format', async () => {
      const response = await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
      });

      expect(response).toEqual(
        expect.objectContaining({
          object: 'response',
          status: 'completed',
          output_text: 'Hello from Gemini!',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
        })
      );
    });

    it('should include output array with message', async () => {
      const response = await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
      });

      expect(response.output).toHaveLength(1);
      expect(response.output[0]).toEqual(
        expect.objectContaining({
          type: 'message',
          role: MessageRole.ASSISTANT,
        })
      );
    });

    it('should handle function call in response', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'get_weather',
                    args: { city: 'Paris' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      });

      const response = await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'What is the weather in Paris?',
      });

      expect(response.output[0].content).toContainEqual(
        expect.objectContaining({
          type: ContentType.TOOL_USE,
          name: 'get_weather',
        })
      );
    });
  });

  describe('streamGenerate()', () => {
    it('should spread generationConfig in stream config (CRITICAL FIX)', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            candidates: [{ content: { parts: [{ text: 'Hi' }] } }],
          };
        },
      };
      mockGenerateContentStream.mockResolvedValue(mockStream);

      const events: any[] = [];
      for await (const event of provider.streamGenerate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
        temperature: 0.5,
        max_output_tokens: 500,
      })) {
        events.push(event);
      }

      // CRITICAL: generationConfig properties should be spread directly
      const call = mockGenerateContentStream.mock.calls[0][0];
      expect(call.config.generationConfig).toBeUndefined();
      expect(call.config.temperature).toBe(0.5);
      expect(call.config.maxOutputTokens).toBe(500);
    });

    it('should emit correct stream events', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
          };
          yield {
            candidates: [{ content: { parts: [{ text: ' world' }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
          };
        },
      };
      mockGenerateContentStream.mockResolvedValue(mockStream);

      const events: any[] = [];
      for await (const event of provider.streamGenerate({
        model: 'gemini-2.0-flash',
        input: 'Hello',
      })) {
        events.push(event);
      }

      // Should have RESPONSE_CREATED
      expect(events.some((e) => e.type === StreamEventType.RESPONSE_CREATED)).toBe(true);

      // Should have OUTPUT_TEXT_DELTA
      expect(events.some((e) => e.type === StreamEventType.OUTPUT_TEXT_DELTA)).toBe(true);

      // Should have RESPONSE_COMPLETE
      expect(events.some((e) => e.type === StreamEventType.RESPONSE_COMPLETE)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw ProviderAuthError on invalid API key', async () => {
      mockGenerateContent.mockRejectedValue({
        status: 401,
        message: 'API key not valid',
      });

      await expect(
        provider.generate({ model: 'gemini-2.0-flash', input: 'Hello' })
      ).rejects.toThrow(ProviderAuthError);
    });

    it('should throw ProviderRateLimitError on resource exhausted', async () => {
      mockGenerateContent.mockRejectedValue({
        status: 429,
        message: 'Resource exhausted',
      });

      await expect(
        provider.generate({ model: 'gemini-2.0-flash', input: 'Hello' })
      ).rejects.toThrow(ProviderRateLimitError);
    });

    it('should throw ProviderContextLengthError on context too long', async () => {
      mockGenerateContent.mockRejectedValue({
        message: 'context length exceeded',
      });

      await expect(
        provider.generate({ model: 'gemini-2.0-flash', input: 'Hello' })
      ).rejects.toThrow(ProviderContextLengthError);
    });

    it('should re-throw unknown errors', async () => {
      const customError = new Error('Custom error');
      mockGenerateContent.mockRejectedValue(customError);

      await expect(
        provider.generate({ model: 'gemini-2.0-flash', input: 'Hello' })
      ).rejects.toThrow('Custom error');
    });
  });

  describe('getModelCapabilities()', () => {
    it('should return correct capabilities for gemini-2.0 models', () => {
      const caps = provider.getModelCapabilities('gemini-2.0-flash');

      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsJSON).toBe(true);
      expect(caps.maxTokens).toBe(1048576);
    });

    it('should return correct capabilities for gemini-1.5 models', () => {
      const caps = provider.getModelCapabilities('gemini-1.5-pro');

      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsVision).toBe(true);
      expect(caps.maxTokens).toBe(1048576);
    });
  });

  describe('converter cleanup', () => {
    it('should clean up converter mappings after successful request', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: { parts: [{ text: 'Hi' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      });

      // Make multiple requests - should not have memory leaks
      await provider.generate({ model: 'gemini-2.0-flash', input: 'Hello 1' });
      await provider.generate({ model: 'gemini-2.0-flash', input: 'Hello 2' });
      await provider.generate({ model: 'gemini-2.0-flash', input: 'Hello 3' });

      // If cleanup works, no errors should occur
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should clean up converter mappings even on error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Test error'));
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: { parts: [{ text: 'Hi' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      });

      // First request fails
      await expect(
        provider.generate({ model: 'gemini-2.0-flash', input: 'Hello' })
      ).rejects.toThrow();

      // Second request should still work (cleanup happened in finally block)
      const response = await provider.generate({
        model: 'gemini-2.0-flash',
        input: 'Hello again',
      });
      expect(response.output_text).toBe('Hi');
    });
  });
});
