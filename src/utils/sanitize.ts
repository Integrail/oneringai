/**
 * Sanitize a string to be a valid tool name.
 * Matches the common denominator pattern across all LLM providers: ^[a-zA-Z0-9_-]+$
 *
 * - Replaces invalid characters (spaces, special chars, unicode) with underscores
 * - Collapses consecutive underscores into one
 * - Strips leading/trailing underscores and hyphens
 * - Prepends 'n_' if the result starts with a digit
 * - Returns 'unnamed' if the result would be empty
 */
export function sanitizeToolName(name: string): string {
  let result = name
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars
    .replace(/_+/g, '_') // Collapse consecutive underscores
    .replace(/^[_-]+|[_-]+$/g, ''); // Trim leading/trailing _ and -

  if (/^[0-9]/.test(result)) {
    result = `n_${result}`;
  }

  return result || 'unnamed';
}
