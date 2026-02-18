/**
 * Factory functions for creating custom tool meta-tools.
 *
 * Individual factories for each tool, plus a bundle factory
 * that creates all 6 tools at once.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import { createCustomToolDraft } from './customToolDraft.js';
import { createCustomToolTest } from './customToolTest.js';
import { createCustomToolSave } from './customToolSave.js';
import { createCustomToolList } from './customToolList.js';
import { createCustomToolLoad } from './customToolLoad.js';
import { createCustomToolDelete } from './customToolDelete.js';

export interface CustomToolMetaToolsOptions {
  /** Custom storage backend. Default: FileCustomToolStorage */
  storage?: ICustomToolStorage;
}

/**
 * Create all 6 custom tool meta-tools as an array.
 *
 * @example
 * ```typescript
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4',
 *   tools: [
 *     ...createCustomToolMetaTools(),
 *     ...otherTools,
 *   ],
 * });
 * ```
 */
export function createCustomToolMetaTools(options?: CustomToolMetaToolsOptions): ToolFunction[] {
  // When explicit storage is provided, pass it to each factory.
  // Otherwise, let each factory resolve from StorageRegistry at execution time.
  const storage = options?.storage;

  return [
    createCustomToolDraft(),
    createCustomToolTest(),
    createCustomToolSave(storage),
    createCustomToolList(storage),
    createCustomToolLoad(storage),
    createCustomToolDelete(storage),
  ];
}

// Re-export individual factories for selective use
export {
  createCustomToolDraft,
  createCustomToolTest,
  createCustomToolSave,
  createCustomToolList,
  createCustomToolLoad,
  createCustomToolDelete,
};
