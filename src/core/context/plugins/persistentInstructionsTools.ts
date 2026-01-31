/**
 * PersistentInstructions Tools - Tools for LLM to manipulate persistent instructions
 *
 * These tools allow the LLM to manage custom instructions that persist
 * across sessions and are stored on disk.
 *
 * Tools:
 * - instructions_set: Replace all instructions
 * - instructions_append: Add a section
 * - instructions_get: Read current instructions
 * - instructions_clear: Remove all (requires confirm: true)
 */

import type { ToolFunction, FunctionToolDefinition } from '../../../domain/entities/Tool.js';
import type { ToolContext } from '../../../domain/interfaces/IToolContext.js';
import { ToolExecutionError } from '../../../domain/errors/AIErrors.js';
import { PersistentInstructionsPlugin, type PersistentInstructionsConfig } from './PersistentInstructionsPlugin.js';
import type { AgentContext } from '../../AgentContext.js';

// ============ Tool Definitions ============

/**
 * Tool definition for instructions_set
 */
export const instructionsSetDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'instructions_set',
    description: `Set or replace all custom instructions for this agent.

Custom instructions persist across sessions and are stored on disk.
Use this to define:
- Agent personality/behavior
- User preferences
- Custom rules and guidelines
- Tool usage patterns

The instructions will be loaded automatically in future sessions.
IMPORTANT: This replaces ALL existing instructions.`,
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The full instructions content (markdown supported)',
        },
      },
      required: ['content'],
    },
  },
};

/**
 * Tool definition for instructions_append
 */
export const instructionsAppendDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'instructions_append',
    description: `Append a new section to existing custom instructions.

Use this to incrementally add:
- New rules based on user feedback
- Learned preferences
- Additional guidelines

The section will be added with appropriate spacing.`,
    parameters: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description: 'The section to append (will add newlines before)',
        },
      },
      required: ['section'],
    },
  },
};

/**
 * Tool definition for instructions_get
 */
export const instructionsGetDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'instructions_get',
    description: `Get current custom instructions.

Returns the full instructions content and metadata.
Instructions are also shown in context, so this is mainly for:
- Verification before modifications
- Getting programmatic access
- Debugging`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * Tool definition for instructions_clear
 */
export const instructionsClearDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'instructions_clear',
    description: `Clear all custom instructions (DESTRUCTIVE).

This permanently removes all custom instructions from disk.
Requires explicit confirmation.`,
    parameters: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['confirm'],
    },
  },
};

// ============ Tool Factory ============

/**
 * Create all persistent instructions tools
 *
 * @returns Array of tool functions
 */
export function createPersistentInstructionsTools(): ToolFunction[] {
  return [
    // instructions_set
    {
      definition: instructionsSetDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'instructions_set');

        const content = args.content as string;

        if (!content || content.trim().length === 0) {
          return {
            error: 'Content cannot be empty. Use instructions_clear to remove instructions.',
          };
        }

        const success = await plugin.set(content);

        if (!success) {
          return {
            error: `Instructions too long. Maximum ${plugin.getMaxLength()} characters, got ${content.length}.`,
          };
        }

        return {
          success: true,
          message: 'Instructions saved successfully',
          path: plugin.getPath(),
          length: plugin.getLength(),
        };
      },
      idempotency: { cacheable: false },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always', // Auto-approve - instructions management is safe
        riskLevel: 'low',
      },
      describeCall: () => 'set',
    },

    // instructions_append
    {
      definition: instructionsAppendDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'instructions_append');

        const section = args.section as string;

        if (!section || section.trim().length === 0) {
          return {
            error: 'Section cannot be empty',
          };
        }

        const success = await plugin.append(section);

        if (!success) {
          return {
            error: `Would exceed maximum length of ${plugin.getMaxLength()} characters. Current: ${plugin.getLength()}, Adding: ${section.length}.`,
          };
        }

        return {
          success: true,
          message: 'Section appended successfully',
          newLength: plugin.getLength(),
        };
      },
      idempotency: { cacheable: false },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: () => 'append',
    },

    // instructions_get
    {
      definition: instructionsGetDefinition,
      execute: async (_args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'instructions_get');

        const content = plugin.get();

        if (!content) {
          return {
            exists: false,
            message: 'No custom instructions set',
            path: plugin.getPath(),
          };
        }

        return {
          exists: true,
          content,
          length: content.length,
          maxLength: plugin.getMaxLength(),
          path: plugin.getPath(),
        };
      },
      idempotency: { cacheable: true, ttlMs: 1000 },
      output: { expectedSize: 'variable' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: () => 'read',
    },

    // instructions_clear
    {
      definition: instructionsClearDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const plugin = getPluginFromContext(context, 'instructions_clear');

        const confirm = args.confirm as boolean;

        if (confirm !== true) {
          return {
            error: 'Must set confirm: true to clear instructions',
          };
        }

        const hadContent = plugin.has();
        await plugin.clear();

        return {
          success: true,
          message: hadContent
            ? 'Instructions cleared successfully'
            : 'No instructions to clear',
          path: plugin.getPath(),
        };
      },
      idempotency: { cacheable: false },
      output: { expectedSize: 'small' },
      permission: {
        scope: 'always',
        riskLevel: 'low',
      },
      describeCall: () => 'clear',
    },
  ];
}

// ============ Factory Functions ============

/**
 * Create a PersistentInstructionsPlugin with its tools
 *
 * @param config - Configuration (agentId is required)
 * @returns Object containing the plugin and its tools
 *
 * @example
 * ```typescript
 * const { plugin, tools } = createPersistentInstructions({ agentId: 'my-agent' });
 * ctx.registerPlugin(plugin);
 * for (const tool of tools) {
 *   ctx.tools.register(tool);
 * }
 * ```
 */
export function createPersistentInstructions(config: PersistentInstructionsConfig): {
  plugin: PersistentInstructionsPlugin;
  tools: ToolFunction[];
} {
  const plugin = new PersistentInstructionsPlugin(config);
  const tools = createPersistentInstructionsTools();

  return { plugin, tools };
}

/**
 * Set up PersistentInstructions on an AgentContext
 *
 * Registers both the plugin and its tools on the context.
 *
 * @param agentContext - The AgentContext to set up
 * @param config - Configuration (agentId is required)
 * @returns The created plugin (for direct access)
 *
 * @example
 * ```typescript
 * const ctx = AgentContext.create({ model: 'gpt-4' });
 * const plugin = setupPersistentInstructions(ctx, { agentId: 'my-agent' });
 *
 * // Instructions are loaded automatically on first context prepare
 * // Plugin is accessible through ctx.persistentInstructions
 * ```
 */
export function setupPersistentInstructions(
  agentContext: AgentContext,
  config: PersistentInstructionsConfig
): PersistentInstructionsPlugin {
  const { plugin, tools } = createPersistentInstructions(config);

  // Register plugin with context manager
  agentContext.registerPlugin(plugin);

  // Register tools with tool manager
  for (const tool of tools) {
    agentContext.tools.register(tool);
  }

  // Store reference on context for tool access
  (agentContext as AgentContext & { persistentInstructions?: PersistentInstructionsPlugin }).persistentInstructions = plugin;

  return plugin;
}

// ============ Helper Functions ============

/**
 * Get the PersistentInstructionsPlugin from tool context
 */
function getPluginFromContext(context: ToolContext | undefined, toolName: string): PersistentInstructionsPlugin {
  if (!context) {
    throw new ToolExecutionError(
      toolName,
      'PersistentInstructions tools require a tool context'
    );
  }

  // Access plugin through the extended context
  const plugin = (context as ToolContext & { persistentInstructions?: PersistentInstructionsPlugin }).persistentInstructions;

  if (!plugin) {
    throw new ToolExecutionError(
      toolName,
      'PersistentInstructions plugin not found. Enable features.persistentInstructions or use setupPersistentInstructions().'
    );
  }

  return plugin;
}
