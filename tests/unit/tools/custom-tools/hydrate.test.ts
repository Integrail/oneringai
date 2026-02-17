/**
 * Tests for hydrateCustomTool
 */

import { describe, it, expect } from 'vitest';
import { hydrateCustomTool } from '../../../../src/tools/custom-tools/hydrate.js';
import type { CustomToolDefinition } from '../../../../src/domain/entities/CustomToolDefinition.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../../../src/domain/entities/CustomToolDefinition.js';

describe('hydrateCustomTool', () => {
  const definition: CustomToolDefinition = {
    version: CUSTOM_TOOL_DEFINITION_VERSION,
    name: 'double',
    description: 'Doubles a number',
    inputSchema: {
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
    },
    code: 'output = input.x * 2;',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should create a valid ToolFunction', () => {
    const tool = hydrateCustomTool(definition);

    expect(tool.definition.type).toBe('function');
    expect(tool.definition.function.name).toBe('double');
    expect(tool.definition.function.description).toBe('Doubles a number');
    expect(tool.definition.function.parameters).toEqual(definition.inputSchema);
    expect(tool.execute).toBeInstanceOf(Function);
    expect(tool.describeCall).toBeInstanceOf(Function);
    expect(tool.permission).toBeDefined();
  });

  it('should execute the code with input args', async () => {
    const tool = hydrateCustomTool(definition);
    const result = await tool.execute({ x: 5 });

    expect(result).toBe(10);
  });

  it('should handle complex return values', async () => {
    const def: CustomToolDefinition = {
      ...definition,
      name: 'process',
      code: 'output = { doubled: input.x * 2, tripled: input.x * 3 };',
    };

    const tool = hydrateCustomTool(def);
    const result = await tool.execute({ x: 4 });

    expect(result).toEqual({ doubled: 8, tripled: 12 });
  });

  it('should handle async code', async () => {
    const def: CustomToolDefinition = {
      ...definition,
      name: 'async_tool',
      code: `
        const delay = ms => new Promise(r => setTimeout(r, ms));
        await delay(10);
        output = input.x + 1;
      `,
    };

    const tool = hydrateCustomTool(def);
    const result = await tool.execute({ x: 99 });

    expect(result).toBe(100);
  });

  it('should throw on code errors', async () => {
    const def: CustomToolDefinition = {
      ...definition,
      name: 'error_tool',
      code: 'throw new Error("intentional");',
    };

    const tool = hydrateCustomTool(def);
    await expect(tool.execute({ x: 1 })).rejects.toThrow('intentional');
  });

  it('describeCall should show first arg value', () => {
    const tool = hydrateCustomTool(definition);
    const desc = tool.describeCall!({ x: 42 });
    expect(desc).toBe('42');
  });
});
