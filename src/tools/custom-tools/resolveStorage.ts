/**
 * Shared helper to resolve ICustomToolStorage for custom tool meta-tools.
 *
 * Resolution order:
 * 1. Explicit storage passed to the factory function (backward compat)
 * 2. StorageRegistry factory called with StorageContext (multi-tenant)
 * 3. Default FileCustomToolStorage
 */

import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import type { ToolContext } from '../../domain/interfaces/IToolContext.js';
import { FileCustomToolStorage } from '../../infrastructure/storage/FileCustomToolStorage.js';
import { StorageRegistry } from '../../core/StorageRegistry.js';
import type { StorageContext } from '../../core/StorageRegistry.js';

/**
 * Build a StorageContext from ToolContext (extracts userId).
 */
function buildStorageContext(toolContext?: ToolContext): StorageContext | undefined {
  const global = StorageRegistry.getContext();
  if (global) return global;
  if (toolContext?.userId) return { userId: toolContext.userId };
  return undefined;
}

/**
 * Resolve custom tool storage.
 *
 * @param explicit - Storage instance passed to the factory (highest priority)
 * @param toolContext - ToolContext from execution (provides userId for multi-tenant)
 */
export function resolveCustomToolStorage(
  explicit: ICustomToolStorage | undefined,
  toolContext?: ToolContext,
): ICustomToolStorage {
  // 1. Explicit storage (backward compat)
  if (explicit) return explicit;

  // 2. Registry factory
  const factory = StorageRegistry.get('customTools');
  if (factory) {
    return factory(buildStorageContext(toolContext));
  }

  // 3. Default
  return new FileCustomToolStorage();
}
