/**
 * MCPToolAdapter Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { createMCPToolAdapter, createMCPToolAdapters } from '../../../src/infrastructure/mcp/adapters/MCPToolAdapter.js';
import type { MCPTool } from '../../../src/domain/entities/MCPTypes.js';
import type { IMCPClient } from '../../../src/domain/interfaces/IMCPClient.js';
import { MCPToolError } from '../../../src/domain/errors/MCPError.js';

describe('MCPToolAdapter', () => {
  const mockClient: Partial<IMCPClient> = {
    name: 'test-server',
    callTool: vi.fn(),
  };

  const mockTool: MCPTool = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
  };

  describe('createMCPToolAdapter()', () => {
    it('should create a ToolFunction from an MCP tool', () => {
      const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

      expect(toolFn.definition.type).toBe('function');
      expect(toolFn.definition.function.name).toBe('mcp:test:test_tool');
      expect(toolFn.definition.function.description).toContain('test tool');
      expect(toolFn.definition.function.parameters).toEqual(mockTool.inputSchema);
      expect(toolFn.execute).toBeDefined();
      expect(toolFn.describeCall).toBeDefined();
    });

    it('should execute tool via MCPClient', async () => {
      const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

      const mockResult = {
        content: [{ type: 'text' as const, text: 'Result text' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool!).mockResolvedValue(mockResult);

      const result = await toolFn.execute({ input: 'test' });

      expect(mockClient.callTool).toHaveBeenCalledWith('test_tool', { input: 'test' });
      expect(result).toBe('Result text');
    });

    it('should return full result for complex responses', async () => {
      const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

      const mockResult = {
        content: [
          { type: 'text' as const, text: 'Part 1' },
          { type: 'text' as const, text: 'Part 2' },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool!).mockResolvedValue(mockResult);

      const result = await toolFn.execute({ input: 'test' });

      expect(result).toEqual(mockResult);
    });

    it('should throw MCPToolError on execution failure', async () => {
      const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

      vi.mocked(mockClient.callTool!).mockRejectedValue(new Error('Tool failed'));

      await expect(toolFn.execute({ input: 'test' })).rejects.toThrow(MCPToolError);
    });

    it('should handle error results from MCP', async () => {
      const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

      // When MCPClient gets an error result, it throws MCPToolError
      const error = new MCPToolError('Error message', 'test_tool', 'test-server');
      vi.mocked(mockClient.callTool!).mockRejectedValue(error);

      await expect(toolFn.execute({ input: 'test' })).rejects.toThrow(MCPToolError);
    });

    describe('describeCall()', () => {
      it('should extract common argument names', () => {
        const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

        expect(toolFn.describeCall({ file_path: '/path/to/file' })).toBe('/path/to/file');
        expect(toolFn.describeCall({ path: '/some/path' })).toBe('/some/path');
        expect(toolFn.describeCall({ url: 'https://example.com' })).toBe('https://example.com');
        expect(toolFn.describeCall({ query: 'search term' })).toBe('search term');
      });

      it('should fallback to first string value', () => {
        const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

        expect(toolFn.describeCall({ someArg: 'value' })).toBe('value');
      });

      it('should truncate long strings', () => {
        const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

        const longString = 'a'.repeat(100);
        const result = toolFn.describeCall({ arg: longString });

        expect(result.length).toBeLessThanOrEqual(63); // 60 + '...'
      });

      it('should fallback to tool name if no string args', () => {
        const toolFn = createMCPToolAdapter(mockTool, mockClient as IMCPClient, 'mcp:test');

        expect(toolFn.describeCall({ number: 42 })).toBe('test_tool');
        expect(toolFn.describeCall({})).toBe('test_tool');
      });
    });
  });

  describe('createMCPToolAdapters()', () => {
    it('should convert multiple tools', () => {
      const tools: MCPTool[] = [
        {
          name: 'tool1',
          description: 'First tool',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tool2',
          description: 'Second tool',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const toolFns = createMCPToolAdapters(tools, mockClient as IMCPClient, 'mcp:test');

      expect(toolFns).toHaveLength(2);
      expect(toolFns[0].definition.function.name).toBe('mcp:test:tool1');
      expect(toolFns[1].definition.function.name).toBe('mcp:test:tool2');
    });

    it('should handle empty array', () => {
      const toolFns = createMCPToolAdapters([], mockClient as IMCPClient, 'mcp:test');

      expect(toolFns).toEqual([]);
    });
  });
});
