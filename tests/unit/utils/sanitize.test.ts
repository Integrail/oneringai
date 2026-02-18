import { describe, it, expect } from 'vitest';
import { sanitizeToolName } from '../../../src/utils/sanitize.js';

describe('sanitizeToolName', () => {
  it('passes through valid names unchanged', () => {
    expect(sanitizeToolName('my_tool')).toBe('my_tool');
    expect(sanitizeToolName('my-tool')).toBe('my-tool');
    expect(sanitizeToolName('myTool123')).toBe('myTool123');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeToolName('Microsoft Graph API')).toBe('Microsoft_Graph_API');
  });

  it('replaces special characters', () => {
    expect(sanitizeToolName('my.tool/v2')).toBe('my_tool_v2');
    expect(sanitizeToolName('tool@#$name')).toBe('tool_name');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizeToolName('my   tool')).toBe('my_tool');
    expect(sanitizeToolName('a__b')).toBe('a_b');
  });

  it('trims leading/trailing underscores and hyphens', () => {
    expect(sanitizeToolName('_tool_')).toBe('tool');
    expect(sanitizeToolName('-tool-')).toBe('tool');
    expect(sanitizeToolName('__my__tool__')).toBe('my_tool');
  });

  it('handles leading digits', () => {
    expect(sanitizeToolName('123service')).toBe('n_123service');
  });

  it('handles empty/whitespace input', () => {
    expect(sanitizeToolName('')).toBe('unnamed');
    expect(sanitizeToolName('   ')).toBe('unnamed');
    expect(sanitizeToolName('!!!')).toBe('unnamed');
  });

  it('handles unicode characters', () => {
    const result = sanitizeToolName('café_tool');
    expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('result always matches provider pattern', () => {
    const pattern = /^[a-zA-Z0-9_-]+$/;
    const cases = [
      'Microsoft Graph API',
      '123',
      'a b c',
      'tool!@#',
      'my_tool',
      'slack',
      'my-serper',
      'Open AI (backup)',
    ];
    for (const name of cases) {
      const result = sanitizeToolName(name);
      expect(result, `sanitizeToolName('${name}') = '${result}'`).toMatch(pattern);
    }
  });

  it('produces readable names from realistic connector names', () => {
    expect(sanitizeToolName('Microsoft Graph API')).toBe('Microsoft_Graph_API');
    expect(sanitizeToolName('my-slack')).toBe('my-slack');
    expect(sanitizeToolName('openai')).toBe('openai');
    expect(sanitizeToolName('Open AI (backup)')).toBe('Open_AI_backup');
  });
});
