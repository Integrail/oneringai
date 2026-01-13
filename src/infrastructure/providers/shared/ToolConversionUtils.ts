/**
 * Shared Tool Conversion Utilities
 *
 * DRY principle: Tool conversion logic shared across all providers
 * Each provider has slightly different tool formats, but the extraction
 * and basic conversion is the same.
 */

import { FunctionToolDefinition, Tool } from '../../../domain/entities/Tool.js';

/**
 * Standardized tool format before provider-specific transformation
 */
export interface ProviderToolFormat {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Extract function tools from mixed tool array
 * Filters out built-in tools (web_search, code_interpreter, etc.)
 *
 * @param tools - Mixed array of tool definitions
 * @returns Only function tools
 */
export function extractFunctionTools(
  tools: Tool[]
): FunctionToolDefinition[] {
  return tools.filter((t): t is FunctionToolDefinition => t.type === 'function');
}

/**
 * Convert tools to standard format (before provider transformation)
 * Extracts common properties: name, description, parameters
 *
 * @param tools - Array of tool definitions
 * @returns Standardized tool format
 */
export function convertToolsToStandardFormat(
  tools: Tool[]
): ProviderToolFormat[] {
  return extractFunctionTools(tools).map((tool) => ({
    name: tool.function.name,
    description: tool.function.description || '',
    parameters: tool.function.parameters || { type: 'object', properties: {} },
  }));
}

/**
 * Transform for Anthropic API (uses input_schema)
 *
 * @param tool - Standardized tool format
 * @returns Anthropic-specific tool format
 */
export function transformForAnthropic(tool: ProviderToolFormat) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

/**
 * Transform for Google Gemini API (uses parameters)
 *
 * @param tool - Standardized tool format
 * @returns Google-specific tool format
 */
export function transformForGoogle(tool: ProviderToolFormat) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

/**
 * Transform for OpenAI API (uses function definition)
 *
 * @param tool - Standardized tool format
 * @returns OpenAI-specific tool format
 */
export function transformForOpenAI(tool: ProviderToolFormat) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
