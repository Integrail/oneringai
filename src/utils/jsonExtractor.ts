/**
 * JSON Extractor Utilities
 *
 * Extracts JSON from LLM responses that may contain markdown formatting,
 * code blocks, or other text mixed with JSON data.
 */

/**
 * Result of JSON extraction attempt
 */
export interface JSONExtractionResult<T = unknown> {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted and parsed data (if successful) */
  data?: T;
  /** Raw JSON string that was parsed (if found) */
  rawJson?: string;
  /** Error message (if failed) */
  error?: string;
  /** How the JSON was found */
  method?: 'code_block' | 'inline' | 'raw';
}

/**
 * Extract JSON from a string that may contain markdown code blocks or other formatting.
 *
 * Tries multiple extraction strategies in order:
 * 1. JSON inside markdown code blocks (```json ... ``` or ``` ... ```)
 * 2. First complete JSON object/array found in text
 * 3. Raw string as JSON
 *
 * @param text - Text that may contain JSON
 * @returns Extraction result with parsed data or error
 *
 * @example
 * ```typescript
 * const response = `Here's the result:
 * \`\`\`json
 * {"score": 85, "valid": true}
 * \`\`\`
 * That's the answer.`;
 *
 * const result = extractJSON<{score: number, valid: boolean}>(response);
 * if (result.success) {
 *   console.log(result.data.score); // 85
 * }
 * ```
 */
export function extractJSON<T = unknown>(text: string): JSONExtractionResult<T> {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: 'Input is empty or not a string',
    };
  }

  const trimmedText = text.trim();

  // Strategy 1: Try to find JSON in markdown code blocks
  const codeBlockResult = extractFromCodeBlock<T>(trimmedText);
  if (codeBlockResult.success) {
    return codeBlockResult;
  }

  // Strategy 2: Try to find inline JSON object or array
  const inlineResult = extractInlineJSON<T>(trimmedText);
  if (inlineResult.success) {
    return inlineResult;
  }

  // Strategy 3: Try parsing the raw text as JSON
  try {
    const data = JSON.parse(trimmedText) as T;
    return {
      success: true,
      data,
      rawJson: trimmedText,
      method: 'raw',
    };
  } catch (e) {
    return {
      success: false,
      error: `Could not extract JSON from text: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Extract JSON from markdown code blocks
 */
function extractFromCodeBlock<T>(text: string): JSONExtractionResult<T> {
  // Match ```json ... ``` or ``` ... ``` code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1];
    if (content) {
      const trimmed = content.trim();
      try {
        const data = JSON.parse(trimmed) as T;
        return {
          success: true,
          data,
          rawJson: trimmed,
          method: 'code_block',
        };
      } catch {
        // This code block doesn't contain valid JSON, try next
        continue;
      }
    }
  }

  return { success: false };
}

/**
 * Extract inline JSON object or array from text
 */
function extractInlineJSON<T>(text: string): JSONExtractionResult<T> {
  // Try to find a JSON object
  const objectMatch = findJSONObject(text);
  if (objectMatch) {
    try {
      const data = JSON.parse(objectMatch) as T;
      return {
        success: true,
        data,
        rawJson: objectMatch,
        method: 'inline',
      };
    } catch {
      // Not valid JSON despite matching braces
    }
  }

  // Try to find a JSON array
  const arrayMatch = findJSONArray(text);
  if (arrayMatch) {
    try {
      const data = JSON.parse(arrayMatch) as T;
      return {
        success: true,
        data,
        rawJson: arrayMatch,
        method: 'inline',
      };
    } catch {
      // Not valid JSON despite matching brackets
    }
  }

  return { success: false };
}

/**
 * Find the first complete JSON object in text by matching braces
 */
function findJSONObject(text: string): string | null {
  const startIndex = text.indexOf('{');
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Find the first complete JSON array in text by matching brackets
 */
function findJSONArray(text: string): string | null {
  const startIndex = text.indexOf('[');
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Safely extract a specific field from JSON embedded in text
 *
 * @param text - Text that may contain JSON
 * @param field - Field name to extract
 * @param defaultValue - Default value if extraction fails
 * @returns Extracted value or default
 *
 * @example
 * ```typescript
 * const score = extractJSONField<number>(llmResponse, 'completionScore', 50);
 * ```
 */
export function extractJSONField<T>(
  text: string,
  field: string,
  defaultValue: T
): T {
  const result = extractJSON<Record<string, unknown>>(text);
  if (result.success && result.data && field in result.data) {
    return result.data[field] as T;
  }
  return defaultValue;
}

/**
 * Extract a number from text, trying JSON first, then regex patterns
 *
 * @param text - Text that may contain a number
 * @param patterns - Optional regex patterns to try (default: common score patterns)
 * @param defaultValue - Default value if extraction fails
 * @returns Extracted number or default
 *
 * @example
 * ```typescript
 * const score = extractNumber(llmResponse, [/(\d{1,3})%?\s*complete/i], 50);
 * ```
 */
export function extractNumber(
  text: string,
  patterns: RegExp[] = [
    /(\d{1,3})%?\s*(?:complete|score|percent)/i,
    /(?:score|completion|rating)[:\s]+(\d{1,3})/i,
    /(\d{1,3})\s*(?:out of|\/)\s*100/i,
  ],
  defaultValue: number = 0
): number {
  // Try JSON extraction first
  const jsonResult = extractJSON<Record<string, unknown>>(text);
  if (jsonResult.success && jsonResult.data) {
    // Look for common score field names
    const scoreFields = ['score', 'completionScore', 'completion_score', 'rating', 'percent', 'value'];
    for (const field of scoreFields) {
      if (field in jsonResult.data && typeof jsonResult.data[field] === 'number') {
        return jsonResult.data[field] as number;
      }
    }
  }

  // Try regex patterns
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        return num;
      }
    }
  }

  return defaultValue;
}
