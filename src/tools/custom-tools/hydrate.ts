/**
 * hydrateCustomTool - Converts a CustomToolDefinition into a live ToolFunction
 *
 * The hydrated tool is indistinguishable from built-in tools once
 * registered on ToolManager.
 */

import type { ToolFunction, ToolContext } from '../../domain/entities/Tool.js';
import type { CustomToolDefinition } from '../../domain/entities/CustomToolDefinition.js';
import { executeInVM } from '../code/executeJavaScript.js';
import { Connector } from '../../core/Connector.js';

const DEFAULT_TIMEOUT = 10000;
const MAX_TIMEOUT = 30000;

export interface HydrateOptions {
  /** Default execution timeout in ms. Default: 10000 */
  defaultTimeout?: number;
  /** Maximum execution timeout in ms. Default: 30000 */
  maxTimeout?: number;
}

/**
 * Convert a stored CustomToolDefinition into an executable ToolFunction.
 *
 * The resulting ToolFunction:
 * - Executes the definition's code through executeInVM
 * - Has input args passed as `input` in the VM sandbox
 * - Gets connector registry from ToolContext for authenticatedFetch
 * - Has session-scoped permission with medium risk level
 */
export function hydrateCustomTool(
  definition: CustomToolDefinition,
  options?: HydrateOptions,
): ToolFunction {
  const defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT;
  const maxTimeout = options?.maxTimeout ?? MAX_TIMEOUT;

  return {
    definition: {
      type: 'function',
      function: {
        name: definition.name,
        description: definition.description,
        parameters: definition.inputSchema as any,
      },
      timeout: maxTimeout + 5000,
    },

    permission: { scope: 'session', riskLevel: 'medium' },

    execute: async (args: any, context?: ToolContext): Promise<any> => {
      const logs: string[] = [];
      const registry = context?.connectorRegistry ?? Connector.asRegistry();

      const result = await executeInVM(
        definition.code,
        args,
        defaultTimeout,
        logs,
        context?.userId,
        registry,
      );

      return result;
    },

    describeCall: (args: any) => {
      // Show first meaningful arg value
      if (!args || typeof args !== 'object') return definition.name;
      const firstKey = Object.keys(args)[0];
      if (!firstKey) return definition.name;
      const val = args[firstKey];
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return str.length > 50 ? str.slice(0, 47) + '...' : str;
    },
  };
}
