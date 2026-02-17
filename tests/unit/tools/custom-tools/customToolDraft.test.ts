/**
 * Tests for custom_tool_draft
 */

import { describe, it, expect } from 'vitest';
import { createCustomToolDraft } from '../../../../src/tools/custom-tools/customToolDraft.js';

describe('custom_tool_draft', () => {
  const tool = createCustomToolDraft();

  it('should validate a correct draft', async () => {
    const result = await tool.execute({
      name: 'my_tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      code: 'output = input.x * 2;',
    });

    expect(result.success).toBe(true);
    expect(result.validated).toBeDefined();
    expect(result.validated!.name).toBe('my_tool');
  });

  it('should reject invalid name (uppercase)', async () => {
    const result = await tool.execute({
      name: 'MyTool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('invalid'))).toBe(true);
  });

  it('should reject invalid name (starts with number)', async () => {
    const result = await tool.execute({
      name: '1tool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });

    expect(result.success).toBe(false);
  });

  it('should accept name with underscores', async () => {
    const result = await tool.execute({
      name: 'my_cool_tool_v2',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty description', async () => {
    const result = await tool.execute({
      name: 'test',
      description: '   ',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('description'))).toBe(true);
  });

  it('should reject inputSchema without type: object', async () => {
    const result = await tool.execute({
      name: 'test',
      description: 'A test tool',
      inputSchema: { type: 'array' },
      code: 'output = 1;',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('inputSchema.type'))).toBe(true);
  });

  it('should reject code with syntax errors', async () => {
    const result = await tool.execute({
      name: 'test',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: 'const x = {{{;',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('syntax error'))).toBe(true);
  });

  it('should reject empty code', async () => {
    const result = await tool.execute({
      name: 'test',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: '',
    });

    expect(result.success).toBe(false);
  });

  it('should collect multiple errors', async () => {
    const result = await tool.execute({
      name: 'BAD',
      description: '',
      inputSchema: { type: 'array' },
      code: '',
    });

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThanOrEqual(3);
  });

  it('should pass through optional fields', async () => {
    const result = await tool.execute({
      name: 'test',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      code: 'output = 1;',
      tags: ['math'],
      connectorName: 'github',
    });

    expect(result.success).toBe(true);
    expect(result.validated!.tags).toEqual(['math']);
    expect(result.validated!.connectorName).toBe('github');
  });

  it('should have a descriptionFactory', () => {
    expect(tool.descriptionFactory).toBeDefined();
    const desc = tool.descriptionFactory!(undefined);
    expect(desc).toContain('SANDBOX API');
    expect(desc).toContain('authenticatedFetch');
  });
});
