/**
 * InContextMemory Tools - Tools for LLM to manipulate in-context memory
 *
 * These tools allow the LLM to store, retrieve, update, and delete
 * key-value pairs that are stored directly in the context.
 */

import type { ToolFunction, FunctionToolDefinition } from '../../../domain/entities/Tool.js';
import type { ToolContext } from '../../../domain/interfaces/IToolContext.js';
import { ToolExecutionError } from '../../../domain/errors/AIErrors.js';
import { InContextMemoryPlugin, type InContextMemoryConfig, type InContextPriority } from './InContextMemoryPlugin.js';
import type { AgentContext } from '../../AgentContext.js';

// ============ Tool Definitions ============

/**
 * Tool definition for context_set
 */
export const contextSetDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'context_set',
    description: `Store or update a key-value pair in the live context.
The value will appear directly in the context and can be read without retrieval calls.

Use for:
- Current state/status that changes during execution
- User preferences or settings
- Counters, flags, or control variables
- Small accumulated results

Priority levels (for eviction when space is needed):
- "low": Evicted first. Temporary or easily recreated data.
- "normal": Default. Standard importance.
- "high": Keep longer. Important state.
- "critical": Never auto-evicted. Only removed via context_delete.`,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Unique key for this entry (e.g., "current_state", "user_prefs")',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this data represents (shown in context)',
        },
        value: {
          description: 'The value to store (any JSON-serializable data)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Eviction priority. Default: "normal"',
        },
      },
      required: ['key', 'description', 'value'],
    },
  },
};

/**
 * Tool definition for context_get
 */
export const contextGetDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'context_get',
    description: `Retrieve a value from the live context by key.

Note: Values are already visible in the context, so this tool is mainly for:
- Verifying a value exists
- Getting the value programmatically for processing
- Debugging`,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to retrieve',
        },
      },
      required: ['key'],
    },
  },
};

/**
 * Tool definition for context_delete
 */
export const contextDeleteDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'context_delete',
    description: `Delete an entry from the live context to free space.

Use this to:
- Remove entries that are no longer needed
- Free space when approaching limits
- Clean up after a task completes`,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to delete',
        },
      },
      required: ['key'],
    },
  },
};

/**
 * Tool definition for context_list
 */
export const contextListDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'context_list',
    description: `List all keys stored in the live context with their metadata.

Returns key, description, priority, and last update time for each entry.
Use to see what's stored and identify entries to clean up.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ============ Tool Factory ============

/**
 * Create all in-context memory tools
 *
 * @returns Array of tool functions
 */
export function createInContextMemoryTools(): ToolFunction[] {
  return [
    // context_set
    {
      definition: contextSetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'context_set');

        const key = args.key as string;
        const description = args.description as string;
        const value = args.value;
        const priority = args.priority as InContextPriority | undefined;

        plugin.set(key, description, value, priority);

        return {
          success: true,
          key,
          priority: priority ?? 'normal',
          message: `Stored "${key}" in live context`,
        };
      },
      idempotency: { cacheable: false },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always', // Auto-approve context operations
        riskLevel: 'low',
      },
      describeCall: (args) => args.key as string,
    },

    // context_get
    {
      definition: contextGetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'context_get');

        const key = args.key as string;
        const value = plugin.get(key);

        if (value === undefined) {
          return { error: `Key "${key}" not found in live context` };
        }

        return { key, value };
      },
      idempotency: { cacheable: true, ttlMs: 1000 },
      output: { expectedSize: 'variable' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: (args) => args.key as string,
    },

    // context_delete
    {
      definition: contextDeleteDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'context_delete');

        const key = args.key as string;
        const existed = plugin.delete(key);

        return {
          success: true,
          key,
          existed,
          message: existed ? `Deleted "${key}" from live context` : `Key "${key}" did not exist`,
        };
      },
      idempotency: { cacheable: false },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: (args) => args.key as string,
    },

    // context_list
    {
      definition: contextListDefinition,
      execute: async (_args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'context_list');

        const entries = plugin.list();

        return {
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.priority,
            updatedAt: new Date(e.updatedAt).toISOString(),
          })),
          count: entries.length,
        };
      },
      idempotency: { cacheable: true, ttlMs: 500 },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: () => 'all',
    },
  ];
}

// ============ Factory Functions ============

/**
 * Create an InContextMemory plugin with its tools
 *
 * @param config - Optional configuration
 * @returns Object containing the plugin and its tools
 *
 * @example
 * ```typescript
 * const { plugin, tools } = createInContextMemory({ maxEntries: 15 });
 * ctx.registerPlugin(plugin);
 * for (const tool of tools) {
 *   ctx.tools.register(tool);
 * }
 * ```
 */
export function createInContextMemory(config?: InContextMemoryConfig): {
  plugin: InContextMemoryPlugin;
  tools: ToolFunction[];
} {
  const plugin = new InContextMemoryPlugin(config);
  const tools = createInContextMemoryTools();

  return { plugin, tools };
}

/**
 * Set up InContextMemory on an AgentContext
 *
 * Registers both the plugin and its tools on the context.
 *
 * @param agentContext - The AgentContext to set up
 * @param config - Optional configuration
 * @returns The created plugin (for direct access)
 *
 * @example
 * ```typescript
 * const ctx = AgentContext.create({ model: 'gpt-4' });
 * const plugin = setupInContextMemory(ctx, { maxEntries: 10 });
 *
 * // Plugin is accessible through ctx.inContextMemory
 * plugin.set('state', 'Current processing state', { step: 1 });
 * ```
 */
export function setupInContextMemory(
  agentContext: AgentContext,
  config?: InContextMemoryConfig
): InContextMemoryPlugin {
  const { plugin, tools } = createInContextMemory(config);

  // Register plugin with context manager
  agentContext.registerPlugin(plugin);

  // Register tools with tool manager
  for (const tool of tools) {
    agentContext.tools.register(tool);
  }

  // Store reference on context for tool access
  (agentContext as AgentContext & { inContextMemory?: InContextMemoryPlugin }).inContextMemory = plugin;

  return plugin;
}

// ============ Helper Functions ============

/**
 * Get the InContextMemoryPlugin from tool context
 */
function getPluginFromContext(context: ToolContext | undefined, toolName: string): InContextMemoryPlugin {
  if (!context) {
    throw new ToolExecutionError(
      toolName,
      'InContextMemory tools require a tool context'
    );
  }

  // Access plugin through the extended context
  const plugin = (context as ToolContext & { inContextMemory?: InContextMemoryPlugin }).inContextMemory;

  if (!plugin) {
    throw new ToolExecutionError(
      toolName,
      'InContextMemory plugin not found. Use setupInContextMemory() to initialize.'
    );
  }

  return plugin;
}
