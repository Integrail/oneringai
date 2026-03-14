/**
 * StoreToolsManager - Unified CRUD tools for all IStoreHandler plugins
 *
 * Creates 5 generic tools (store_get, store_set, store_delete, store_list, store_action)
 * that route to the correct plugin handler based on the `store` parameter.
 *
 * Registered once on the first IStoreHandler plugin registration.
 * Subsequent handlers are added dynamically; `descriptionFactory` picks them up.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ToolContext } from '../../domain/entities/Tool.js';
import type { IStoreHandler, StoreEntrySchema } from './types.js';

// ============================================================================
// StoreToolsManager
// ============================================================================

export class StoreToolsManager {
  private handlers = new Map<string, IStoreHandler>();

  /**
   * Register a store handler. Throws on duplicate storeId.
   */
  registerHandler(handler: IStoreHandler): void {
    const schema = handler.getStoreSchema();
    if (this.handlers.has(schema.storeId)) {
      throw new Error(`Store handler with storeId '${schema.storeId}' is already registered`);
    }
    this.handlers.set(schema.storeId, handler);
  }

  /**
   * Get a handler by storeId.
   */
  getHandler(storeId: string): IStoreHandler | undefined {
    return this.handlers.get(storeId);
  }

  /**
   * Get all registered store schemas (for building tool descriptions).
   */
  getSchemas(): StoreEntrySchema[] {
    return Array.from(this.handlers.values()).map(h => h.getStoreSchema());
  }

  /**
   * Get all registered store IDs.
   */
  getStoreIds(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Create the 5 generic store tools.
   * Called once when the first IStoreHandler is registered.
   */
  getTools(): ToolFunction[] {
    return [
      this.createStoreGetTool(),
      this.createStoreSetTool(),
      this.createStoreDeleteTool(),
      this.createStoreListTool(),
      this.createStoreActionTool(),
    ];
  }

  /**
   * Cleanup.
   */
  destroy(): void {
    this.handlers.clear();
  }

  // ============================================================================
  // Description Builders
  // ============================================================================

  /**
   * Build the store comparison section for tool descriptions.
   * Called dynamically via descriptionFactory so it always reflects current handlers.
   */
  private buildStoreDescriptions(mode: 'get' | 'set' | 'delete' | 'list' | 'action'): string {
    const schemas = this.getSchemas();
    if (schemas.length === 0) return 'No stores available.';

    const lines: string[] = ['Available stores:'];
    for (const schema of schemas) {
      lines.push(`- "${schema.storeId}": ${schema.displayName} — ${schema.description}`);
      lines.push(`  ${schema.usageHint}`);

      if (mode === 'set') {
        lines.push(`  Data: { ${schema.setDataFields.replace(/\n/g, ', ')} }`);
      }

      if (mode === 'action' && schema.actions) {
        const actionNames = Object.keys(schema.actions);
        if (actionNames.length > 0) {
          const actionDescs = actionNames.map(a => {
            const info = schema.actions?.[a];
            return `${a}${info?.destructive ? ' (destructive)' : ''}: ${info?.description ?? ''}`;
          });
          lines.push(`  Actions: ${actionDescs.join('; ')}`);
        }
      }
    }
    return lines.join('\n');
  }

  // ============================================================================
  // Tool Factories
  // ============================================================================

  private createStoreGetTool(): ToolFunction {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'store_get',
          description: 'Retrieve an entry from a data store by key, or get all entries if no key provided.',
          parameters: {
            type: 'object',
            properties: {
              store: { type: 'string', description: 'Target store name' },
              key: { type: 'string', description: 'Key to retrieve. Omit to get all entries.' },
            },
            required: ['store'],
          },
        },
      },
      descriptionFactory: () => {
        return `Retrieve an entry from a data store by key, or get all entries if no key provided.\n\n${this.buildStoreDescriptions('get')}`;
      },
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const handler = this.resolveHandler(args.store as string);
        return handler.storeGet(args.key as string | undefined, context);
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `get ${args.key ?? 'all'} from ${args.store}`,
    };
  }

  private createStoreSetTool(): ToolFunction {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'store_set',
          description: 'Create or update an entry in a data store.',
          parameters: {
            type: 'object',
            properties: {
              store: { type: 'string', description: 'Target store name' },
              key: { type: 'string', description: 'Unique key for the entry' },
              data: {
                type: 'object',
                description: 'Entry data (fields depend on store — see store descriptions)',
              },
            },
            required: ['store', 'key', 'data'],
          },
        },
      },
      descriptionFactory: () => {
        return `Create or update an entry in a data store.\n\n${this.buildStoreDescriptions('set')}`;
      },
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const handler = this.resolveHandler(args.store as string);
        return handler.storeSet(args.key as string, args.data as Record<string, unknown>, context);
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `set ${args.key} in ${args.store}`,
    };
  }

  private createStoreDeleteTool(): ToolFunction {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'store_delete',
          description: 'Delete an entry from a data store by key.',
          parameters: {
            type: 'object',
            properties: {
              store: { type: 'string', description: 'Target store name' },
              key: { type: 'string', description: 'Key to delete' },
            },
            required: ['store', 'key'],
          },
        },
      },
      descriptionFactory: () => {
        return `Delete an entry from a data store by key.\n\n${this.buildStoreDescriptions('delete')}`;
      },
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const handler = this.resolveHandler(args.store as string);
        return handler.storeDelete(args.key as string, context);
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `delete ${args.key} from ${args.store}`,
    };
  }

  private createStoreListTool(): ToolFunction {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'store_list',
          description: 'List entries in a data store with optional filters.',
          parameters: {
            type: 'object',
            properties: {
              store: { type: 'string', description: 'Target store name' },
              filter: {
                type: 'object',
                description: 'Optional filter criteria (store-specific — see store descriptions)',
              },
            },
            required: ['store'],
          },
        },
      },
      descriptionFactory: () => {
        return `List entries in a data store. Returns summaries, not full values.\n\n${this.buildStoreDescriptions('list')}`;
      },
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const handler = this.resolveHandler(args.store as string);
        return handler.storeList(args.filter as Record<string, unknown> | undefined, context);
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `list ${args.store}${args.filter ? ' (filtered)' : ''}`,
    };
  }

  private createStoreActionTool(): ToolFunction {
    return {
      definition: {
        type: 'function',
        function: {
          name: 'store_action',
          description: 'Execute a store-specific action.',
          parameters: {
            type: 'object',
            properties: {
              store: { type: 'string', description: 'Target store name' },
              action: { type: 'string', description: 'Action name' },
              params: {
                type: 'object',
                description: 'Action parameters (action-specific)',
              },
            },
            required: ['store', 'action'],
          },
        },
      },
      descriptionFactory: () => {
        return `Execute a store-specific action (e.g., clear, cleanup, query).\nDestructive actions require { confirm: true } in params.\n\n${this.buildStoreDescriptions('action')}`;
      },
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        const handler = this.resolveHandler(args.store as string);
        const action = args.action as string;
        const params = args.params as Record<string, unknown> | undefined;

        // Check if handler supports actions
        if (!handler.storeAction) {
          return {
            success: false,
            action,
            error: `Store "${args.store}" does not support actions`,
          };
        }

        // Check destructive action confirmation
        const schema = handler.getStoreSchema();
        const actionDef = schema.actions?.[action];
        if (actionDef?.destructive && !params?.confirm) {
          return {
            success: false,
            action,
            error: `Action "${action}" is destructive and requires { confirm: true } in params`,
          };
        }

        return handler.storeAction(action, params, context);
      },
      permission: { scope: 'always', riskLevel: 'low' },
      describeCall: (args) => `${args.action} on ${args.store}`,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private resolveHandler(storeId: string): IStoreHandler {
    const handler = this.handlers.get(storeId);
    if (!handler) {
      const available = this.getStoreIds().join(', ');
      throw new Error(
        `Unknown store "${storeId}". Available stores: ${available || 'none'}`,
      );
    }
    return handler;
  }
}
