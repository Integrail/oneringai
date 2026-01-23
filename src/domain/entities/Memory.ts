/**
 * Memory entities for TaskAgent working memory
 *
 * This file defines the data structures for the indexed working memory system.
 */

/**
 * Scope determines memory lifecycle
 */
export type MemoryScope = 'task' | 'persistent';

/**
 * Single memory entry stored in working memory
 */
export interface MemoryEntry {
  key: string;                    // Namespaced key: "user.profile"
  description: string;            // Short description for index (max 150 chars)
  value: unknown;                 // The actual data
  sizeBytes: number;              // Computed size for tracking
  scope: MemoryScope;
  createdAt: number;              // Unix timestamp
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * Index entry (lightweight, always in context)
 */
export interface MemoryIndexEntry {
  key: string;
  description: string;
  size: string;                   // Human readable: "4.2KB"
  scope: MemoryScope;
}

/**
 * Full memory index with metadata
 */
export interface MemoryIndex {
  entries: MemoryIndexEntry[];
  totalSizeBytes: number;
  totalSizeHuman: string;         // "42KB"
  limitBytes: number;
  limitHuman: string;             // "1MB"
  utilizationPercent: number;
}

/**
 * Configuration for working memory
 */
export interface WorkingMemoryConfig {
  /** Max memory size in bytes. If not set, calculated from model context */
  maxSizeBytes?: number;

  /** Max description length */
  descriptionMaxLength: number;

  /** Percentage at which to warn agent */
  softLimitPercent: number;

  /** Percentage of model context to allocate to memory */
  contextAllocationPercent: number;
}

/**
 * Input for creating a memory entry
 */
export interface MemoryEntryInput {
  key: string;
  description: string;
  value: unknown;
  scope?: MemoryScope;
}

/**
 * Default configuration values
 */
export const DEFAULT_MEMORY_CONFIG: WorkingMemoryConfig = {
  descriptionMaxLength: 150,
  softLimitPercent: 80,
  contextAllocationPercent: 20,
};

/**
 * Validate memory key format
 * Valid: "simple", "user.profile", "order.items.123"
 * Invalid: "", ".invalid", "invalid.", "with spaces"
 */
export function validateMemoryKey(key: string): void {
  if (!key || key.length === 0) {
    throw new Error('Memory key cannot be empty');
  }

  // Check for invalid patterns
  if (key.startsWith('.') || key.endsWith('.') || key.includes('..')) {
    throw new Error('Invalid memory key format: keys cannot start/end with dots or contain consecutive dots');
  }

  // Check for invalid characters (only alphanumeric, dots, dashes, underscores)
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error('Invalid memory key format: only alphanumeric, dots, dashes, and underscores allowed');
  }
}

/**
 * Calculate the size of a value in bytes (JSON serialization)
 */
export function calculateEntrySize(value: unknown): number {
  if (value === undefined) {
    return 0;
  }

  const serialized = JSON.stringify(value);
  return serialized.length;
}

/**
 * Create a memory entry with defaults and validation
 */
export function createMemoryEntry(
  input: MemoryEntryInput,
  config: WorkingMemoryConfig = DEFAULT_MEMORY_CONFIG
): MemoryEntry {
  // Validate key
  validateMemoryKey(input.key);

  // Validate description length
  if (input.description.length > config.descriptionMaxLength) {
    throw new Error(`Description exceeds maximum length of ${config.descriptionMaxLength} characters`);
  }

  const now = Date.now();
  const sizeBytes = calculateEntrySize(input.value);

  return {
    key: input.key,
    description: input.description,
    value: input.value,
    sizeBytes,
    scope: input.scope ?? 'task',
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatSizeHuman(bytes: number): string {
  if (bytes === 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;

  const kb = bytes / 1024;
  if (bytes < 1024 * 1024) {
    // Show 1 decimal place, but remove .0
    return `${kb.toFixed(1).replace(/\.0$/, '')}KB`;
  }

  const mb = bytes / (1024 * 1024);
  if (bytes < 1024 * 1024 * 1024) {
    return `${mb.toFixed(1).replace(/\.0$/, '')}MB`;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1).replace(/\.0$/, '')}GB`;
}

/**
 * Format memory index for context injection
 */
export function formatMemoryIndex(index: MemoryIndex): string {
  const lines: string[] = [];

  // Format utilization percent without unnecessary decimals
  const utilPercent = Number.isInteger(index.utilizationPercent)
    ? index.utilizationPercent.toString()
    : index.utilizationPercent.toFixed(1).replace(/\.0$/, '');

  lines.push(`## Working Memory (${index.totalSizeHuman} / ${index.limitHuman} - ${utilPercent}%)`);
  lines.push('');

  if (index.entries.length === 0) {
    lines.push('Memory is empty.');
  } else {
    // Group by scope
    const persistent = index.entries.filter((e) => e.scope === 'persistent');
    const task = index.entries.filter((e) => e.scope === 'task');

    if (persistent.length > 0) {
      lines.push('**Persistent:**');
      for (const entry of persistent) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [scope: persistent]`);
      }
      lines.push('');
    }

    if (task.length > 0) {
      lines.push('**Task-scoped:**');
      for (const entry of task) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [scope: task]`);
      }
      lines.push('');
    }

    // Add warning if utilization is high
    if (index.utilizationPercent > 80) {
      lines.push('⚠️ **Warning:** Memory utilization is high. Consider deleting unused entries.');
      lines.push('');
    }
  }

  lines.push('Use `memory_retrieve("key")` to load full content.');
  lines.push('Use `memory_persist("key")` to keep data after task completion.');

  return lines.join('\n');
}
