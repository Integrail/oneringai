/**
 * Tool Conversion Utils Tests
 * Tests shared DRY utilities for tool format conversion
 */

import { describe, it, expect } from 'vitest';
import {
  extractFunctionTools,
  convertToolsToStandardFormat,
  transformForAnthropic,
  transformForGoogle,
  transformForOpenAI,
} from '@/infrastructure/providers/shared/ToolConversionUtils.js';
import { Tool } from '@/domain/entities/Tool.js';

describe('Tool Conversion Utils', () => {
  const sampleTools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['city']
        }
      }
    },
    {
      type: 'web_search' // Built-in tool (should be filtered out)
    } as Tool,
    {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform calculation',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          }
        }
      }
    }
  ];

  describe('extractFunctionTools()', () => {
    it('should filter only function tools from mixed array', () => {
      const result = extractFunctionTools(sampleTools);

      expect(result).toHaveLength(2);
      expect(result[0].function.name).toBe('get_weather');
      expect(result[1].function.name).toBe('calculate');
    });

    it('should return empty array if no function tools', () => {
      const tools: Tool[] = [
        { type: 'web_search' } as Tool,
        { type: 'code_interpreter' } as Tool
      ];

      const result = extractFunctionTools(tools);
      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = extractFunctionTools([]);
      expect(result).toEqual([]);
    });
  });

  describe('convertToolsToStandardFormat()', () => {
    it('should extract common properties', () => {
      const result = convertToolsToStandardFormat(sampleTools);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'get_weather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['city']
        }
      });
    });

    it('should provide empty description if not given', () => {
      const tools: Tool[] = [{
        type: 'function',
        function: {
          name: 'my_tool',
          parameters: { type: 'object' }
        }
      }];

      const result = convertToolsToStandardFormat(tools);
      expect(result[0].description).toBe('');
    });

    it('should provide default parameters if not given', () => {
      const tools: Tool[] = [{
        type: 'function',
        function: {
          name: 'simple_tool',
          description: 'A simple tool'
        }
      }];

      const result = convertToolsToStandardFormat(tools);
      expect(result[0].parameters).toEqual({ type: 'object', properties: {} });
    });
  });

  describe('transformForAnthropic()', () => {
    it('should convert to Anthropic format with input_schema', () => {
      const tool = {
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      };

      const result = transformForAnthropic(tool);

      expect(result).toEqual({
        name: 'get_weather',
        description: 'Get weather',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      });
    });
  });

  describe('transformForGoogle()', () => {
    it('should convert to Google format with parameters', () => {
      const tool = {
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      };

      const result = transformForGoogle(tool);

      expect(result).toEqual({
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      });
    });
  });

  describe('transformForOpenAI()', () => {
    it('should convert to OpenAI format with function wrapper', () => {
      const tool = {
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      };

      const result = transformForOpenAI(tool);

      expect(result).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string' } }
          }
        }
      });
    });
  });

  describe('Integration - Full Conversion Pipeline', () => {
    it('should convert tools for all providers consistently', () => {
      const standardTools = convertToolsToStandardFormat(sampleTools);

      // Transform for each provider
      const anthropicTools = standardTools.map(transformForAnthropic);
      const googleTools = standardTools.map(transformForGoogle);
      const openaiTools = standardTools.map(transformForOpenAI);

      // All should have same name and description
      expect(anthropicTools[0].name).toBe('get_weather');
      expect(googleTools[0].name).toBe('get_weather');
      expect(openaiTools[0].function.name).toBe('get_weather');

      expect(anthropicTools[0].description).toBe('Get current weather for a city');
      expect(googleTools[0].description).toBe('Get current weather for a city');
      expect(openaiTools[0].function.description).toBe('Get current weather for a city');
    });
  });
});
