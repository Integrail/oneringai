import { describe, it, expect } from 'vitest';
import { createExecuteJavaScriptTool } from '../../../../src/tools/code/executeJavaScript.js';

describe('executeJavaScript', () => {
  const tool = createExecuteJavaScriptTool();

  describe('output handling', () => {
    it('should return output when user provides async IIFE without return', async () => {
      // This was the bug: user-wrapped IIFE sets output but doesn't return
      const result = await tool.execute({
        code: `(async () => {
          output = { test: 'success', value: 42 };
        })();`
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ test: 'success', value: 42 });
    });

    it('should return output for auto-wrapped code', async () => {
      const result = await tool.execute({
        code: `output = { wrapped: true };`
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ wrapped: true });
    });

    it('should prefer explicit return over output variable', async () => {
      const result = await tool.execute({
        code: `(async () => {
          output = { fromOutput: true };
          return { fromReturn: true };
        })();`
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ fromReturn: true });
    });

    it('should fallback to output when explicitly returning undefined', async () => {
      const result = await tool.execute({
        code: `(async () => {
          output = { fallback: true };
          return undefined;
        })();`
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ fallback: true });
    });

    it('should return null when neither return nor output is set', async () => {
      const result = await tool.execute({
        code: `(async () => {
          // Does nothing
        })();`
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeNull();
    });

    it('should handle returning 0 and false correctly (not fallback to output)', async () => {
      // Ensure 0 and false are not treated as undefined
      const result1 = await tool.execute({
        code: `(async () => {
          output = 'should not use';
          return 0;
        })();`
      });

      expect(result1.success).toBe(true);
      expect(result1.result).toBe(0);

      const result2 = await tool.execute({
        code: `(async () => {
          output = 'should not use';
          return false;
        })();`
      });

      expect(result2.success).toBe(true);
      expect(result2.result).toBe(false);
    });

    it('should handle returning null (fallback to output)', async () => {
      // null !== undefined, so should return null, not output
      const result = await tool.execute({
        code: `(async () => {
          output = 'should not use';
          return null;
        })();`
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeNull();
    });
  });

  describe('basic execution', () => {
    it('should execute simple sync code', async () => {
      const result = await tool.execute({
        code: `output = 1 + 1;`
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(2);
    });

    it('should have access to input', async () => {
      const result = await tool.execute({
        code: `output = input.x * 2;`,
        input: { x: 5 }
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
    });

    it('should capture console.log', async () => {
      const result = await tool.execute({
        code: `
          console.log('hello');
          console.log('world');
          output = 'done';
        `
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('hello');
      expect(result.logs).toContain('world');
    });
  });
});
