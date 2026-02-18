/**
 * Tests for custom_tool_test
 */

import { describe, it, expect } from 'vitest';
import { createCustomToolTest } from '../../../../src/tools/custom-tools/customToolTest.js';

describe('custom_tool_test', () => {
  const tool = createCustomToolTest();

  it('should execute simple code with test input', async () => {
    const result = await tool.execute({
      code: 'output = input.x * 2;',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      testInput: { x: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(10);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('should capture console.log output', async () => {
    const result = await tool.execute({
      code: 'console.log("hello"); output = 42;',
      inputSchema: { type: 'object' },
      testInput: {},
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.logs).toContain('hello');
  });

  it('should return error for failing code', async () => {
    const result = await tool.execute({
      code: 'throw new Error("boom");',
      inputSchema: { type: 'object' },
      testInput: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('should handle async code', async () => {
    const result = await tool.execute({
      code: `
        const delay = ms => new Promise(r => setTimeout(r, ms));
        await delay(50);
        output = "delayed";
      `,
      inputSchema: { type: 'object' },
      testInput: {},
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('delayed');
  });

  it('should timeout on long-running code', async () => {
    const result = await tool.execute({
      code: 'while(true) {}',
      inputSchema: { type: 'object' },
      testInput: {},
      timeout: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should have a descriptionFactory', () => {
    expect(tool.descriptionFactory).toBeDefined();
    const desc = tool.descriptionFactory!(undefined);
    expect(desc).toContain('SANDBOX API');
    expect(desc).toContain('authenticatedFetch');
  });
});
