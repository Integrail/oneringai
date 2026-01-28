/**
 * JSON Extractor Utility Tests
 * Tests for extracting JSON from LLM responses with various formats
 */

import { describe, it, expect } from 'vitest';
import {
  extractJSON,
  extractJSONField,
  extractNumber,
  JSONExtractionResult,
} from '@/utils/jsonExtractor.js';

describe('JSON Extractor', () => {
  describe('extractJSON', () => {
    describe('code block extraction', () => {
      it('should extract JSON from ```json code block', () => {
        const text = `Here's the result:
\`\`\`json
{"name": "test", "value": 42}
\`\`\`
That's the answer.`;

        const result = extractJSON<{ name: string; value: number }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ name: 'test', value: 42 });
        expect(result.method).toBe('code_block');
      });

      it('should extract JSON from ``` code block without language', () => {
        const text = `Result:
\`\`\`
{"score": 85}
\`\`\``;

        const result = extractJSON<{ score: number }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ score: 85 });
        expect(result.method).toBe('code_block');
      });

      it('should handle multiple code blocks and return first valid JSON', () => {
        const text = `Here's some code:
\`\`\`python
def hello():
    pass
\`\`\`

And here's the JSON:
\`\`\`json
{"found": true}
\`\`\``;

        const result = extractJSON<{ found: boolean }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ found: true });
      });

      it('should extract arrays from code blocks', () => {
        const text = `\`\`\`json
[1, 2, 3, 4, 5]
\`\`\``;

        const result = extractJSON<number[]>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([1, 2, 3, 4, 5]);
      });

      it('should handle nested objects in code blocks', () => {
        const text = `\`\`\`json
{
  "user": {
    "name": "Alice",
    "age": 30
  },
  "items": [
    {"id": 1, "name": "Item 1"},
    {"id": 2, "name": "Item 2"}
  ]
}
\`\`\``;

        const result = extractJSON<{
          user: { name: string; age: number };
          items: Array<{ id: number; name: string }>;
        }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.user.name).toBe('Alice');
        expect(result.data?.items).toHaveLength(2);
      });
    });

    describe('inline JSON extraction', () => {
      it('should extract inline JSON object', () => {
        const text = 'The result is {"status": "ok", "count": 5} as expected.';

        const result = extractJSON<{ status: string; count: number }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ status: 'ok', count: 5 });
        expect(result.method).toBe('inline');
      });

      it('should extract inline JSON array', () => {
        const text = 'Here are the values: [10, 20, 30]';

        const result = extractJSON<number[]>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([10, 20, 30]);
        expect(result.method).toBe('inline');
      });

      it('should handle JSON with special characters in strings', () => {
        const text = 'Result: {"message": "Hello \\"World\\"", "path": "C:\\\\Users"}';

        const result = extractJSON<{ message: string; path: string }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.message).toBe('Hello "World"');
        expect(result.data?.path).toBe('C:\\Users');
      });

      it('should handle nested braces in JSON', () => {
        const text = 'Data: {"outer": {"inner": {"deep": 1}}}';

        const result = extractJSON<{ outer: { inner: { deep: number } } }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.outer.inner.deep).toBe(1);
      });
    });

    describe('raw JSON extraction', () => {
      it('should parse raw JSON string', () => {
        const text = '{"direct": true}';

        const result = extractJSON<{ direct: boolean }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ direct: true });
        // Note: inline detection finds it first since it's a complete JSON object
        expect(result.method).toBe('inline');
      });

      it('should parse raw JSON array', () => {
        const text = '[1, 2, 3]';

        const result = extractJSON<number[]>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([1, 2, 3]);
      });

      it('should handle whitespace around raw JSON', () => {
        const text = '  \n  {"trimmed": true}  \n  ';

        const result = extractJSON<{ trimmed: boolean }>(text);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ trimmed: true });
      });
    });

    describe('error handling', () => {
      it('should return error for empty string', () => {
        const result = extractJSON('');

        expect(result.success).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should return error for null/undefined', () => {
        const result = extractJSON(null as any);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error for text without JSON', () => {
        const text = 'This is just plain text without any JSON data.';

        const result = extractJSON(text);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Could not extract JSON');
      });

      it('should return error for invalid JSON', () => {
        const text = '{invalid json: without quotes}';

        const result = extractJSON(text);

        expect(result.success).toBe(false);
      });

      it('should return error for incomplete JSON in code block', () => {
        const text = `\`\`\`json
{"incomplete": true
\`\`\``;

        // Should fail because JSON is incomplete
        const result = extractJSON(text);
        expect(result.success).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle JSON with unicode characters', () => {
        const text = '{"emoji": "👍", "chinese": "中文"}';

        const result = extractJSON<{ emoji: string; chinese: string }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.emoji).toBe('👍');
        expect(result.data?.chinese).toBe('中文');
      });

      it('should handle JSON with newlines in strings', () => {
        const text = '{"multiline": "line1\\nline2\\nline3"}';

        const result = extractJSON<{ multiline: string }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.multiline).toBe('line1\nline2\nline3');
      });

      it('should handle empty object', () => {
        const result = extractJSON<Record<string, never>>('{}');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should handle empty array', () => {
        const result = extractJSON<never[]>('[]');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should prefer code block over inline JSON', () => {
        const text = `Some inline {"ignored": true} JSON here.
\`\`\`json
{"preferred": true}
\`\`\``;

        const result = extractJSON<{ preferred?: boolean; ignored?: boolean }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.preferred).toBe(true);
        expect(result.data?.ignored).toBeUndefined();
      });

      it('should handle JSON with null values', () => {
        const text = '{"value": null, "name": "test"}';

        const result = extractJSON<{ value: null; name: string }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.value).toBeNull();
        expect(result.data?.name).toBe('test');
      });

      it('should handle JSON with boolean and number types', () => {
        const text = '{"active": true, "count": 0, "rate": 3.14}';

        const result = extractJSON<{ active: boolean; count: number; rate: number }>(text);

        expect(result.success).toBe(true);
        expect(result.data?.active).toBe(true);
        expect(result.data?.count).toBe(0);
        expect(result.data?.rate).toBeCloseTo(3.14);
      });
    });
  });

  describe('extractJSONField', () => {
    it('should extract specific field from JSON', () => {
      const text = '```json\n{"score": 85, "status": "ok"}\n```';

      const score = extractJSONField<number>(text, 'score', 0);

      expect(score).toBe(85);
    });

    it('should return default value when field not found', () => {
      const text = '{"other": "value"}';

      const missing = extractJSONField<string>(text, 'notFound', 'default');

      expect(missing).toBe('default');
    });

    it('should return default value when JSON parsing fails', () => {
      const text = 'no json here';

      const result = extractJSONField<number>(text, 'value', 42);

      expect(result).toBe(42);
    });

    it('should handle nested field extraction', () => {
      const text = '{"data": {"nested": {"value": 100}}}';

      // extractJSONField only works on top-level fields
      const data = extractJSONField<{ nested: { value: number } }>(text, 'data', { nested: { value: 0 } });

      expect(data.nested.value).toBe(100);
    });
  });

  describe('extractNumber', () => {
    it('should extract number from JSON', () => {
      const text = '{"completionScore": 85}';

      const score = extractNumber(text);

      expect(score).toBe(85);
    });

    it('should extract score from common field names', () => {
      expect(extractNumber('{"score": 90}')).toBe(90);
      expect(extractNumber('{"completion_score": 80}')).toBe(80);
      expect(extractNumber('{"rating": 75}')).toBe(75);
      expect(extractNumber('{"percent": 95}')).toBe(95);
    });

    it('should extract number from text patterns', () => {
      expect(extractNumber('The task is 85% complete')).toBe(85);
      expect(extractNumber('Score: 90 out of 100')).toBe(90);
      expect(extractNumber('Completion score: 75')).toBe(75);
    });

    it('should return default when no number found', () => {
      const result = extractNumber('no numbers here', [], 42);

      expect(result).toBe(42);
    });

    it('should use custom patterns', () => {
      const text = 'Rating: 4.5 stars';
      const result = extractNumber(text, [/Rating:\s*(\d+)/i], 0);

      expect(result).toBe(4);
    });

    it('should handle percentage without % sign', () => {
      const text = 'The completion rate is 78 percent';

      const result = extractNumber(text);

      expect(result).toBe(78);
    });

    it('should handle "X out of 100" format', () => {
      const text = 'Scored 92/100 on the test';

      const result = extractNumber(text);

      expect(result).toBe(92);
    });

    it('should prefer JSON extraction over regex', () => {
      // JSON has score 80, text mentions 50%
      const text = '{"score": 80} which is about 50% of the maximum';

      const result = extractNumber(text);

      expect(result).toBe(80); // Should prefer JSON value
    });
  });

  describe('real-world LLM response scenarios', () => {
    it('should handle typical validation response', () => {
      const llmResponse = `Based on my analysis of the task output, here is my evaluation:

\`\`\`json
{
  "completionScore": 92,
  "isComplete": true,
  "explanation": "The task successfully retrieved weather data for San Francisco with temperature (72°F) and conditions (sunny).",
  "criteriaResults": [
    {"criterion": "Contains temperature", "met": true, "evidence": "72°F"},
    {"criterion": "Contains location", "met": true, "evidence": "San Francisco"}
  ]
}
\`\`\`

Overall, the task met all the specified criteria.`;

      interface ValidationResponse {
        completionScore: number;
        isComplete: boolean;
        explanation: string;
        criteriaResults: Array<{ criterion: string; met: boolean; evidence: string }>;
      }

      const result = extractJSON<ValidationResponse>(llmResponse);

      expect(result.success).toBe(true);
      expect(result.data?.completionScore).toBe(92);
      expect(result.data?.isComplete).toBe(true);
      expect(result.data?.criteriaResults).toHaveLength(2);
    });

    it('should handle response with markdown formatting', () => {
      const llmResponse = `# Analysis

Here is the **structured** output:

\`\`\`json
{
  "status": "success",
  "items": ["item1", "item2"]
}
\`\`\`

## Summary
All items processed successfully.`;

      const result = extractJSON<{ status: string; items: string[] }>(llmResponse);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('success');
      expect(result.data?.items).toHaveLength(2);
    });

    it('should handle response with only percentage text', () => {
      const llmResponse = `After reviewing the output, I estimate the task is approximately 65% complete.
The main criteria were partially met, but some information is still missing.`;

      const score = extractNumber(llmResponse);

      expect(score).toBe(65);
    });

    it('should handle GPT-style response with thinking', () => {
      const llmResponse = `Let me analyze this task completion...

First, I'll check the criteria:
1. ✅ Contains user data
2. ❌ Missing email field

Based on this analysis:
{"completionScore": 60, "isComplete": false, "explanation": "Missing required email field"}`;

      const result = extractJSON<{ completionScore: number; isComplete: boolean }>(llmResponse);

      expect(result.success).toBe(true);
      expect(result.data?.completionScore).toBe(60);
      expect(result.data?.isComplete).toBe(false);
    });
  });
});
